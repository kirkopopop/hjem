// Google Calendar connector for hjem.
// Routes (all under /functions/v1/google-calendar):
//   POST /start        (signed-in user)  -> { url } to Google's consent screen
//   GET  /callback     (Google redirect) -> stores tokens, syncs, redirects back to the app
//   POST /sync         (signed-in user)  -> refreshes the household's calendars
//   POST /sync-all     (cron, secret)    -> refreshes every connected account
//   POST /add-event    (signed-in user)  -> creates an event in a writable calendar
//   POST /disconnect   (signed-in user)  -> removes one of the user's own Google accounts
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
let CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
let CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://hjem-five.vercel.app";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");
const DEFAULT_TZ = "Europe/Copenhagen";
const PAST_DAYS = 7;
const FUTURE_DAYS = 90;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Account = { id: string; household_id: string; user_id: string; google_email: string; last_synced_at: string | null };

// Google keys come from function secrets, or from the locked app_secrets table.
async function loadGoogleKeys() {
  if (CLIENT_ID && CLIENT_SECRET) return;
  const { data } = await admin.from("app_secrets").select("name, value").in("name", ["google_client_id", "google_client_secret"]);
  for (const r of data ?? []) {
    if (r.name === "google_client_id" && !CLIENT_ID) CLIENT_ID = r.value;
    if (r.name === "google_client_secret" && !CLIENT_SECRET) CLIENT_SECRET = r.value;
  }
}

// ---------- Auth helpers ----------
async function currentUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: m } = await admin
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (!m) return null;
  return { id: data.user.id, householdId: m.household_id as string, role: m.role as string };
}

// ---------- Google token handling ----------
async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `token_${res.status}`);
  return body as { access_token: string; expires_in: number; refresh_token?: string };
}

async function accessTokenFor(accountId: string) {
  const { data: tok } = await admin.from("google_tokens").select("*").eq("account_id", accountId).single();
  if (!tok) throw new Error("no_token");
  if (tok.access_token && tok.expires_at && new Date(tok.expires_at).getTime() > Date.now() + 60_000) {
    return tok.access_token as string;
  }
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: tok.refresh_token });
  await admin
    .from("google_tokens")
    .update({ access_token: fresh.access_token, expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString() })
    .eq("account_id", accountId);
  return fresh.access_token;
}

async function google(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`google_${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : await res.json();
}

// ---------- Sync ----------
type GCal = { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; accessRole: string; primary?: boolean };

async function refreshCalendarList(account: Account, token: string) {
  const list = await google("/users/me/calendarList?minAccessRole=reader&maxResults=250", token);
  const items: GCal[] = list.items ?? [];
  const { data: existing } = await admin.from("calendars").select("id, google_calendar_id").eq("account_id", account.id);
  const known = new Set((existing ?? []).map((c) => c.google_calendar_id));
  // A calendar shared between both of you shows once: the second copy starts hidden.
  const { data: householdCals } = await admin
    .from("calendars")
    .select("google_calendar_id, account_id")
    .eq("household_id", account.household_id);
  const elsewhere = new Set((householdCals ?? []).filter((c) => c.account_id !== account.id).map((c) => c.google_calendar_id));

  for (const c of items) {
    const writable = c.accessRole === "owner" || c.accessRole === "writer";
    const base = {
      name: c.summaryOverride ?? c.summary ?? c.id,
      color: c.backgroundColor ?? "#24695C",
      can_write: writable,
      is_primary: !!c.primary,
    };
    if (known.has(c.id)) {
      await admin.from("calendars").update(base).eq("account_id", account.id).eq("google_calendar_id", c.id);
    } else {
      await admin.from("calendars").insert({
        ...base,
        household_id: account.household_id,
        account_id: account.id,
        owner_user_id: account.user_id,
        google_calendar_id: c.id,
        visible: writable && !elsewhere.has(c.id),
      });
    }
  }
  // Calendars removed from Google disappear here too.
  const ids = new Set(items.map((c) => c.id));
  const gone = (existing ?? []).filter((c) => !ids.has(c.google_calendar_id)).map((c) => c.id);
  if (gone.length) await admin.from("calendars").delete().in("id", gone);
}

type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

async function syncCalendar(cal: { id: string; household_id: string; google_calendar_id: string }, token: string) {
  const timeMin = new Date(Date.now() - PAST_DAYS * 86_400_000).toISOString();
  const timeMax = new Date(Date.now() + FUTURE_DAYS * 86_400_000).toISOString();
  const rows: Record<string, unknown>[] = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      fields: "nextPageToken,items(id,status,summary,location,htmlLink,start,end)",
    });
    if (pageToken) q.set("pageToken", pageToken);
    const page = await google(`/calendars/${encodeURIComponent(cal.google_calendar_id)}/events?${q}`, token);
    for (const e of (page.items ?? []) as GEvent[]) {
      if (e.status === "cancelled" || !e.start || !e.end) continue;
      const allDay = !!e.start.date;
      rows.push({
        household_id: cal.household_id,
        calendar_id: cal.id,
        google_event_id: e.id,
        title: e.summary ?? "",
        location: e.location ?? null,
        html_link: e.htmlLink ?? null,
        all_day: allDay,
        starts_at: allDay ? `${e.start.date}T00:00:00Z` : e.start.dateTime,
        ends_at: allDay ? `${e.end.date}T00:00:00Z` : e.end.dateTime,
      });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);

  await admin.from("calendar_events").delete().eq("calendar_id", cal.id);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("calendar_events").insert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

async function syncAccount(account: Account) {
  try {
    const token = await accessTokenFor(account.id);
    await refreshCalendarList(account, token);
    const { data: cals } = await admin
      .from("calendars")
      .select("id, household_id, google_calendar_id, visible")
      .eq("account_id", account.id);
    let n = 0;
    for (const c of cals ?? []) {
      if (c.visible) n += await syncCalendar(c, token);
      else await admin.from("calendar_events").delete().eq("calendar_id", c.id);
    }
    await admin.from("google_accounts").update({ last_synced_at: new Date().toISOString(), sync_error: null }).eq("id", account.id);
    return n;
  } catch (err) {
    const msg = String((err as Error).message ?? err);
    await admin
      .from("google_accounts")
      .update({ sync_error: msg.includes("invalid_grant") ? "reconnect" : msg.slice(0, 300) })
      .eq("id", account.id);
    return 0;
  }
}

// ---------- Helpers ----------
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } });

// ---------- Routes ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const route = new URL(req.url).pathname.split("/google-calendar")[1] || "/";
  await loadGoogleKeys();

  try {
    if (route === "/start" && req.method === "POST") {
      const user = await currentUser(req);
      if (!user || user.role === "device") return json({ error: "not_allowed" }, 401);
      if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "google_not_configured" }, 503);
      const state = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
      await admin.from("oauth_states").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
      await admin.from("oauth_states").insert({ state, user_id: user.id, household_id: user.householdId });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent select_account",
        include_granted_scopes: "true",
        state,
      }).toString();
      return json({ url: url.toString() });
    }

    if (route === "/callback" && req.method === "GET") {
      const q = new URL(req.url).searchParams;
      const back = (status: string) => redirect(`${APP_URL}/household?calendar=${status}`);
      if (q.get("error")) return back("cancelled");
      const { data: st } = await admin.from("oauth_states").select("*").eq("state", q.get("state") ?? "").maybeSingle();
      if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) return back("expired");
      await admin.from("oauth_states").delete().eq("state", st.state);

      const tok = await tokenRequest({ grant_type: "authorization_code", code: q.get("code") ?? "", redirect_uri: REDIRECT_URI });
      if (!tok.refresh_token) return back("no_refresh");
      const list = await google("/users/me/calendarList?minAccessRole=reader&maxResults=250", tok.access_token);
      const primary = ((list.items ?? []) as GCal[]).find((c) => c.primary);
      const email = primary?.id ?? "google";

      const { data: acc, error } = await admin
        .from("google_accounts")
        .upsert(
          { household_id: st.household_id, user_id: st.user_id, google_email: email, sync_error: null },
          { onConflict: "user_id,google_email" },
        )
        .select("id, household_id, user_id, google_email, last_synced_at")
        .single();
      if (error || !acc) return back("error");
      await admin.from("google_tokens").upsert({
        account_id: acc.id,
        refresh_token: tok.refresh_token,
        access_token: tok.access_token,
        expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
      });
      await syncAccount(acc as Account);
      return back("connected");
    }

    if (route === "/sync" && req.method === "POST") {
      const user = await currentUser(req);
      if (!user) return json({ error: "not_allowed" }, 401);
      const body = await req.json().catch(() => ({}));
      const { data: accounts } = await admin
        .from("google_accounts")
        .select("id, household_id, user_id, google_email, last_synced_at")
        .eq("household_id", user.householdId);
      let synced = 0;
      for (const a of (accounts ?? []) as Account[]) {
        const fresh = a.last_synced_at && Date.now() - new Date(a.last_synced_at).getTime() < 120_000;
        if (fresh && !body.force) continue;
        await syncAccount(a);
        synced++;
      }
      return json({ synced });
    }

    if (route === "/sync-all" && req.method === "POST") {
      const { data: secret } = await admin.from("app_secrets").select("value").eq("name", "cron_secret").single();
      if (!secret || req.headers.get("x-cron-secret") !== secret.value) return json({ error: "not_allowed" }, 401);
      const { data: accounts } = await admin.from("google_accounts").select("id, household_id, user_id, google_email, last_synced_at");
      for (const a of (accounts ?? []) as Account[]) await syncAccount(a);
      return json({ synced: accounts?.length ?? 0 });
    }

    if (route === "/add-event" && req.method === "POST") {
      const user = await currentUser(req);
      if (!user) return json({ error: "not_allowed" }, 401);
      const b = await req.json();
      const title = String(b.title ?? "").trim().slice(0, 200);
      const date = String(b.date ?? "");
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "bad_input" }, 400);
      const { data: cal } = await admin
        .from("calendars")
        .select("id, household_id, account_id, google_calendar_id, can_write")
        .eq("id", b.calendar_id)
        .single();
      if (!cal || cal.household_id !== user.householdId || !cal.can_write) return json({ error: "not_allowed" }, 403);
      const { data: hh } = await admin.from("households").select("timezone").eq("id", user.householdId).single();
      const tz = hh?.timezone ?? DEFAULT_TZ;
      const timeOk = (s: unknown) => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
      let start, end;
      if (b.all_day || !timeOk(b.start_time)) {
        start = { date };
        end = { date: addDays(date, 1) };
      } else {
        const endTime = timeOk(b.end_time) && b.end_time > b.start_time ? b.end_time : null;
        const [h, m] = (b.start_time as string).split(":").map(Number);
        const fallbackEnd = `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(h + 1 > 23 ? 59 : m).padStart(2, "0")}`;
        start = { dateTime: `${date}T${b.start_time}:00`, timeZone: tz };
        end = { dateTime: `${date}T${endTime ?? fallbackEnd}:00`, timeZone: tz };
      }
      const token = await accessTokenFor(cal.account_id);
      await google(`/calendars/${encodeURIComponent(cal.google_calendar_id)}/events`, token, {
        method: "POST",
        body: JSON.stringify({ summary: title, location: b.location || undefined, start, end }),
      });
      await syncCalendar(cal, token);
      return json({ ok: true });
    }

    if (route === "/disconnect" && req.method === "POST") {
      const user = await currentUser(req);
      if (!user) return json({ error: "not_allowed" }, 401);
      const b = await req.json();
      const { data: acc } = await admin.from("google_accounts").select("id, user_id").eq("id", b.account_id).single();
      if (!acc || acc.user_id !== user.id) return json({ error: "not_allowed" }, 403);
      const { data: tok } = await admin.from("google_tokens").select("refresh_token").eq("account_id", acc.id).maybeSingle();
      if (tok) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.refresh_token)}`, { method: "POST" }).catch(() => {});
      }
      await admin.from("google_accounts").delete().eq("id", acc.id);
      return json({ ok: true });
    }

    return json({ error: "not_found" }, 404);
  } catch (err) {
    console.error(err);
    if (route === "/callback") return redirect(`${APP_URL}/household?calendar=error`);
    return json({ error: String((err as Error).message ?? err).slice(0, 300) }, 500);
  }
});
