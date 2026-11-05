// Baby data layer: events cache, realtime sync and an offline outbox.
// Uses hjem's Supabase client and session; call init() once a household is known.
import { uuid } from './util.js';

const COLS = ['id', 'baby_id', 'household_id', 'kind', 'subtype', 'started_at', 'ended_at', 'amount', 'unit', 'foods', 'note', 'detail', 'source', 'source_key', 'created_by', 'created_at', 'updated_at'];
const CACHE = 'hjem-baby-cache', OUTBOX = 'hjem-baby-outbox';
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};

export const state = {
  user: null, household: null, baby: null, members: {}, role: null,
  events: new Map(), version: 0, sorted: null,
  outbox: [], status: 'idle', loaded: false, error: null,
};
let sb = null;
const subs = new Set();
export const onChange = fn => { subs.add(fn); return () => subs.delete(fn); };
let notifyQueued = false;
function notify() { state.version++; state.sorted = null; if (notifyQueued) return; notifyQueued = true; queueMicrotask(() => { notifyQueued = false; subs.forEach(f => f()); }); }
export const getVersion = () => state.version;

export function events() {
  if (!state.sorted) state.sorted = [...state.events.values()].sort((a, b) => a._s - b._s);
  return state.sorted;
}
function hydrate(r) {
  const e = { ...r };
  e._s = new Date(e.started_at); e._e = e.ended_at ? new Date(e.ended_at) : null;
  e.amount = e.amount == null ? null : Number(e.amount);
  e.foods = e.foods || []; e.detail = e.detail || {};
  return e;
}
const rowOf = e => { const r = {}; for (const c of COLS) if (e[c] !== undefined) r[c] = e[c]; return r; };

// ---------- bootstrap ----------
let initFor = null;
/** opts: { client, userId, householdId, role, members: [{id,name,color,role}] } */
export function init(opts) {
  setMembers(opts.members || []);
  const key = `${opts.userId}|${opts.householdId}`;
  if (initFor === key) return;
  initFor = key; sb = opts.client;
  state.user = { id: opts.userId }; state.household = opts.householdId; state.role = opts.role || null;
  const cached = LS.get(CACHE);
  if (cached && cached.user === opts.userId && cached.household === opts.householdId) {
    state.baby = cached.baby;
    for (const r of cached.events || []) state.events.set(r.id, hydrate(r));
    state.loaded = true; notify();
  }
  state.outbox = LS.get(OUTBOX) || [];
  (async () => {
    try { await refreshBaby(); await refreshEvents(); subscribe(); flush(); }
    catch (e) { console.warn('baby init failed', e); state.error = state.error || 'load'; notify(); }
  })();
  addEventListener('online', flush);
  setInterval(flush, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { refreshEvents(); flush(); } });
}
export function setMembers(list) {
  const m = {}; for (const p of list) m[p.id] = { name: p.name || 'Someone', color: p.color || '#8A9693', role: p.role };
  const changed = JSON.stringify(m) !== JSON.stringify(state.members);
  state.members = m; if (changed) notify();
}

async function refreshBaby() {
  const { data, error } = await sb.from('babies').select('*').eq('household_id', state.household).order('created_at').limit(1);
  if (error) throw error;
  state.baby = data?.[0] || null; state.error = state.baby ? null : 'no-baby'; notify();
}
export async function createBaby(fields) {
  const { data, error } = await sb.from('babies').insert({ household_id: state.household, ...fields }).select().single();
  if (error) throw error; state.baby = data; state.error = null; notify(); await refreshEvents(); subscribe();
}

export async function refreshEvents() {
  if (!state.baby || !sb) return;
  state.status = state.outbox.length ? 'pending' : 'syncing'; notify();
  try {
    const rows = []; const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from('baby_events').select(COLS.join(',')).eq('baby_id', state.baby.id).order('started_at').order('id').range(from, from + page - 1);
      if (error) throw error;
      rows.push(...data); if (data.length < page) break;
    }
    const pendingIds = new Set(state.outbox.map(o => o.id));
    const next = new Map();
    for (const r of rows) next.set(r.id, pendingIds.has(r.id) && state.events.has(r.id) ? state.events.get(r.id) : hydrate(r));
    for (const o of state.outbox) if (o.type === 'upsert' && state.events.has(o.id)) next.set(o.id, state.events.get(o.id));
    for (const o of state.outbox) if (o.type === 'delete') next.delete(o.id);
    state.events = next; state.loaded = true; state.status = state.outbox.length ? 'pending' : 'ok';
    saveCache(); notify();
  } catch (e) {
    console.warn('refresh failed', e); state.status = navigator.onLine ? 'error' : 'offline'; state.loaded = true; notify();
  }
}
let cacheTimer;
function saveCache() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => LS.set(CACHE, { user: state.user.id, household: state.household, baby: state.baby, events: [...state.events.values()].map(rowOf) }), 400);
}

let channel;
function subscribe() {
  if (channel || !state.baby) return;
  channel = sb.channel('baby-' + state.baby.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'baby_events', filter: `baby_id=eq.${state.baby.id}` }, p => remoteUpsert(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'baby_events', filter: `baby_id=eq.${state.baby.id}` }, p => remoteUpsert(p.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'baby_events' }, p => { const id = p.old?.id; if (id && state.events.delete(id)) { saveCache(); notify(); } })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'babies', filter: `id=eq.${state.baby.id}` }, p => { state.baby = p.new; saveCache(); notify(); })
    .subscribe();
}
function remoteUpsert(r) {
  if (state.outbox.some(o => o.id === r.id)) return; // a local edit still being saved wins
  state.events.set(r.id, hydrate(r)); saveCache(); notify();
}

// ---------- mutations (optimistic, queued) ----------
export function addEvent(fields) {
  const now = new Date().toISOString();
  const e = hydrate({ id: uuid(), baby_id: state.baby.id, household_id: state.household, subtype: null, ended_at: null, amount: null, unit: null, foods: [], note: null, detail: {}, source: 'app', source_key: null, created_by: state.user.id, created_at: now, updated_at: now, ...fields });
  state.events.set(e.id, e); queue({ type: 'upsert', id: e.id }); return e;
}
export function updateEvent(id, patch) {
  const old = state.events.get(id); if (!old) return;
  const e = hydrate({ ...rowOf(old), ...patch, updated_at: new Date().toISOString() });
  state.events.set(id, e); queue({ type: 'upsert', id }); return e;
}
export function deleteEvent(id) {
  const old = state.events.get(id); if (!old) return;
  state.events.delete(id); queue({ type: 'delete', id }); return old;
}
export function restoreEvent(row) { const e = hydrate(row); state.events.set(e.id, e); queue({ type: 'upsert', id: e.id }); }

function queue(op) {
  state.outbox = state.outbox.filter(o => o.id !== op.id); state.outbox.push(op);
  LS.set(OUTBOX, state.outbox); state.status = 'pending'; saveCache(); notify(); flush();
}
let flushing = false;
export async function flush() {
  if (flushing || !state.outbox.length || !sb) return; flushing = true;
  try {
    while (state.outbox.length) {
      const op = state.outbox[0];
      let error;
      if (op.type === 'upsert') {
        const e = state.events.get(op.id);
        if (!e) { state.outbox.shift(); continue; }
        const row = rowOf(e); delete row.created_by; delete row.created_at; delete row.updated_at;
        ({ error } = await sb.from('baby_events').upsert(row, { onConflict: 'id' }));
      } else {
        ({ error } = await sb.from('baby_events').delete().eq('id', op.id));
      }
      if (error) {
        const network = !navigator.onLine || (/fetch|network|Failed/i.test(error.message || '') && !error.code);
        if (network) { state.status = 'offline'; notify(); break; }
        console.warn('write rejected', error);
        state.outbox.shift(); LS.set(OUTBOX, state.outbox);
        errorHandler(error.code === '23505' ? 'A sleep is already running. Refreshed from the server.' : 'Could not save: ' + (error.message || 'unknown error'));
        await refreshEvents(); continue;
      }
      state.outbox.shift(); LS.set(OUTBOX, state.outbox);
    }
    if (!state.outbox.length) state.status = 'ok';
  } catch (e) { console.warn(e); state.status = 'offline'; }
  finally { flushing = false; notify(); }
}
let errorHandler = m => console.warn(m);
export const setErrorHandler = f => { errorHandler = f; };

// ---------- baby settings ----------
export async function saveBaby(patch) {
  const { data, error } = await sb.from('babies').update(patch).eq('id', state.baby.id).select().single();
  if (error) throw error; state.baby = data; saveCache(); notify();
}

// ---------- bulk import ----------
export async function importRows(rows, onProgress) {
  let done = 0, inserted = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400).map(r => ({ ...r, baby_id: state.baby.id, household_id: state.household }));
    const { data, error } = await sb.from('baby_events').upsert(chunk, { onConflict: 'baby_id,source_key', ignoreDuplicates: true }).select('id');
    if (error) throw error;
    inserted += data?.length || 0; done += chunk.length; onProgress?.(done, rows.length);
  }
  await refreshEvents();
  return inserted;
}
