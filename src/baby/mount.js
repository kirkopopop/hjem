// Mounts a baby view inside a shadow root on `host` and keeps it in step with the store and hjem's theme.
import { STYLES } from './styles.js';
import { onChange, state, setErrorHandler } from './store.js';
import { setLayer, closeSheet, sheetOpen, toast } from './ui.js';
import { hideTip } from './charts.js';
import * as Today from './views/today.js';
import * as History from './views/history.js';
import * as Trends from './views/trends.js';
import * as Settings from './views/settings.js';

const VIEWS = { today: { v: Today, live: true }, history: { v: History, live: true }, trends: { v: Trends, live: true }, settings: { v: Settings, live: false } };

export function mount(host, name) {
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${STYLES}</style><div class="view"></div><div class="layer"></div>`;
  const view = root.querySelector('.view');
  setLayer(root.querySelector('.layer'));
  setErrorHandler(m => toast(m));
  const syncTheme = () => { host.dataset.theme = document.documentElement.dataset.theme || 'light'; };
  syncTheme();
  const mo = new MutationObserver(syncTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const spec = VIEWS[name];
  let drawnFor = null, timer = null;
  const draw = () => {
    if (!state.baby) {
      if (name === 'settings' && state.error === 'no-baby') { spec.v.render(view); return; }
      view.innerHTML = `<div class="panel"><p class="empty">${state.error === 'no-baby' ? 'No baby added yet. Add one in Settings, then come back.' : 'Loading…'}</p></div>`;
      return;
    }
    // Settings is a form: draw it once per baby so typing isn't wiped by sync updates.
    if (!spec.live && drawnFor === state.baby.id + '|' + state.baby.updated_at) return;
    const y = scrollY;
    try { spec.v.render(view); } catch (e) { console.error(e); view.innerHTML = `<div class="panel"><p class="err">Something went wrong drawing this page: ${String(e.message).replace(/</g, '&lt;')}</p></div>`; }
    if (drawnFor) scrollTo(0, y);
    drawnFor = state.baby.id + '|' + state.baby.updated_at;
  };
  draw();
  const off = onChange(() => { clearTimeout(timer); timer = setTimeout(draw, 120); });
  const tick = name === 'today' ? setInterval(() => { if (!sheetOpen() && document.visibilityState === 'visible') draw(); }, 30000) : null;
  return () => { off(); clearTimeout(timer); if (tick) clearInterval(tick); mo.disconnect(); closeSheet(true); hideTip(); setLayer(null); };
}
