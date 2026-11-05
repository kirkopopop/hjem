// Styles for the baby views. They live inside a shadow root, so hjem's global classes
// can't collide with them; colours, font and radii come from hjem's tokens, which inherit in.
export const STYLES = /* css */ `
:host{display:block;
  --bg:var(--ground); --sunk:var(--ground-2); --line2:var(--line-strong);
  --ink-3:color-mix(in srgb,var(--muted) 70%,var(--faint));
  --scrim:var(--backdrop);
  --night:#1c5cab; --nap:#86b6ef; --bottle:#e2622c; --solid:#1baf7a; --nurse:#7f72d9;
  --nappy:#c98500; --med:#d55181; --growth:#5a4ab8; --mile:#1e6b5c; --bath:#1baf7a; --walk:#6f7c95;
  --band-out:#e4ebf3; --band-in:#cfdcee; --median:#6f7c95;
  --good:var(--success); --good-bg:var(--success-soft); --bad:var(--danger); --bad-bg:var(--danger-soft);
  --warn:color-mix(in srgb,var(--gold) 70%,var(--ink)); --warn-bg:var(--gold-soft); --info:var(--accent-ink); --info-bg:var(--accent-soft);
  --night-a:#173a6e; --night-b:#0e2448;
  font-family:var(--font); color:var(--ink); line-height:1.45; font-size:15px;
}
:host([data-theme="dark"]){
  --night:#4a8fe6; --nap:#2b5a96; --bottle:#e2733f; --solid:#2bb784; --nurse:#9085e9;
  --nappy:#e2a531; --med:#e66f9b; --growth:#9085e9; --mile:#5cc1a8; --walk:#8d99b3;
  --band-out:#1c2a35; --band-in:#243a52; --median:#8d99b3;
  --warn:var(--gold); --night-a:#16305a; --night-b:#0b1a33;
}
*{box-sizing:border-box}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
h1,h2,h3{margin:0;letter-spacing:-.015em;text-wrap:balance}
h2{font-size:18px;font-weight:800}
h3{font-size:15px;font-weight:800}
p{margin:0}
a{color:var(--accent)}
.num,.mono{font-variant-numeric:tabular-nums}
.muted{color:var(--muted)} .faint{color:var(--ink-3)}
.small{font-size:13px}
.eyebrow{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);font-weight:800}
[hidden]{display:none!important}
:focus-visible{outline:2.5px solid var(--accent);outline-offset:2px;border-radius:8px}

section{display:grid;gap:12px;margin-top:22px}
.sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:4px 12px;flex-wrap:wrap}
.sec-head p{font-size:13px;color:var(--muted);font-weight:600}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);padding:18px;min-width:0}
.panel h3{margin-bottom:2px}
.panel .sub{font-size:13px;color:var(--muted);margin-bottom:10px;font-weight:500}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}

/* status hero: hjem's dark-green hero when awake, night blue while asleep */
.hero{display:grid;gap:14px;padding:20px;border-radius:var(--radius-lg);color:var(--hero-ink);background:linear-gradient(150deg,var(--hero-a),var(--hero-b));box-shadow:var(--shadow-md);position:relative;overflow:hidden}
.hero.asleep{background:linear-gradient(150deg,var(--night-a),var(--night-b))}
.hero .eyebrow{color:var(--hero-muted)}
.hero .state{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.hero .big{font-size:38px;font-weight:800;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums}
.hero .big small{font-size:15px;font-weight:600;color:var(--hero-muted);margin-left:8px;letter-spacing:0}
.hero .hint{font-size:14px;color:var(--hero-muted);font-weight:600}
.hero .hint b{color:var(--hero-ink)}
.since{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr));gap:1px;background:var(--line);border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--line)}
.since div{background:var(--surface);padding:10px 12px;display:grid;gap:2px}
.since .l{font-size:12px;color:var(--ink-3);font-weight:700}
.since .v{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums}
.since .x{font-size:12px;color:var(--muted)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;background:var(--accent);color:var(--on-accent);border-radius:999px;padding:0 20px;font-weight:800;font-size:15px;min-height:48px;box-shadow:0 4px 14px -6px var(--accent-ring);transition:transform var(--dur-1) var(--ease-out),background-color var(--dur-2)}
.btn:hover:not(:disabled){background:var(--accent-hover)}
.btn:active:not(:disabled){transform:scale(.97)}
.btn.secondary{background:var(--surface);color:var(--ink);border:1.5px solid var(--line2);box-shadow:var(--shadow-xs)}
.btn.secondary:hover:not(:disabled){background:var(--sunken)}
.btn.light{background:#fff;color:#10231f;box-shadow:none}
.btn.light:hover:not(:disabled){background:#eef3f1}
.btn.danger{background:transparent;color:var(--danger);border:1.5px solid var(--danger-line);box-shadow:none}
.btn.ghost{background:transparent;color:var(--ink-2);box-shadow:none}
.btn.ghost:hover:not(:disabled){background:var(--sunken)}
.btn.big{min-height:52px;padding-inline:22px;font-size:16px}
.btn:disabled{opacity:.5;cursor:default}
.btn svg{width:18px;height:18px}

.quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.qbtn{display:grid;justify-items:center;gap:6px;padding:12px 4px 10px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow-xs);font-size:12.5px;font-weight:700;color:var(--ink);min-height:80px;transition:transform var(--dur-1) var(--ease-out)}
.qbtn .ic{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--k) 15%,transparent);color:var(--k)}
.qbtn .ic svg{width:20px;height:20px}
.qbtn .badge{font-size:11px;font-weight:800;color:var(--success)}
.qbtn:active{transform:scale(.96)}

.totals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius-md);overflow:hidden}
.totals div{background:var(--surface);padding:10px 12px;display:grid;gap:2px}
.totals .l{font-size:12px;color:var(--ink-3);font-weight:700}
.totals .v{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums}
@media (max-width:420px){.totals{grid-template-columns:repeat(2,minmax(0,1fr))}}

.entries{display:grid}
.entry{display:grid;grid-template-columns:48px 30px 1fr auto;gap:10px;align-items:center;padding:10px 2px;border:0;border-bottom:1px solid var(--line);background:none;text-align:left;width:100%}
.entry:last-child{border-bottom:0}
.entry .t{font-size:13.5px;color:var(--muted);font-weight:700;font-variant-numeric:tabular-nums}
.entry .ic{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,var(--k) 15%,transparent);color:var(--k)}
.entry .ic svg{width:16px;height:16px}
.entry .txt{min-width:0}
.entry .txt b{font-weight:700}
.entry .txt .s{font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.entry .by{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ink-3);font-weight:600}
.daylabel{font-size:13px;font-weight:800;color:var(--ink-2);padding:16px 4px 6px;display:flex;justify-content:space-between;gap:8px}
.daylabel .faint{font-weight:600}
.empty{padding:22px 8px;text-align:center;color:var(--muted);font-size:14px}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.avatar{width:30px;height:30px;border-radius:50%;display:inline-grid;place-items:center;font-size:13px;font-weight:800;color:#fff;flex:none}

.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip-btn{border:1.5px solid var(--line2);background:var(--surface);border-radius:999px;padding:6px 12px;font-size:14px;font-weight:600;min-height:38px;display:inline-flex;align-items:center;gap:6px}
.chip-btn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;padding:2px 9px;border-radius:999px;white-space:nowrap;line-height:1.6}
.chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.chip.good{color:var(--good);background:var(--good-bg)} .chip.warn{color:var(--warn);background:var(--warn-bg)}
.chip.bad{color:var(--bad);background:var(--bad-bg)} .chip.info{color:var(--info);background:var(--info-bg)}
.seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:16px;background:var(--ground-2);border:1px solid var(--line)}
.seg button{border:0;background:transparent;padding:0 12px;min-height:36px;border-radius:12px;font-size:13.5px;font-weight:700;color:var(--muted)}
.seg button[aria-pressed="true"]{background:var(--surface);color:var(--ink);font-weight:800;box-shadow:var(--shadow-sm)}
:host([data-theme="dark"]) .seg button[aria-pressed="true"]{background:var(--line-strong)}

/* sheet: same shape as hjem's sheets */
.scrim{position:fixed;inset:0;background:var(--scrim);z-index:40;opacity:0;transition:opacity var(--dur-2);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.scrim.open{opacity:1}
.sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;z-index:41;width:100%;max-width:560px;max-height:92dvh;overflow:auto;overscroll-behavior:contain;background:var(--surface);border-radius:28px 28px 0 0;padding:26px 18px calc(18px + var(--safe-bottom));box-shadow:var(--shadow-lg);transform:translateY(100%);transition:transform 340ms var(--ease-out)}
.sheet::before{content:"";position:absolute;top:9px;left:50%;width:40px;height:5px;margin-left:-20px;border-radius:3px;background:var(--line-strong)}
.sheet.open{transform:none}
@media (min-width:640px){
  .sheet{top:50%;bottom:auto;left:50%;right:auto;margin:0;border-radius:28px;padding:22px;border:1px solid var(--line);transform:translate(-50%,-46%);opacity:0;transition:transform var(--dur-3) var(--ease-out),opacity var(--dur-2)}
  .sheet.open{transform:translate(-50%,-50%);opacity:1}
  .sheet::before{display:none}
}
.sheet header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px}
.sheet header h2{display:flex;align-items:center;gap:10px;font-size:21px;letter-spacing:-.02em}
.sheet header .ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,var(--k) 15%,transparent);color:var(--k)}
.sheet header .ic svg{width:18px;height:18px}
.sheet header .btn.ghost{min-height:44px;width:44px;padding:0}
.field{display:grid;gap:6px;margin-bottom:16px}
.field > label,.field > .lbl{font-size:13px;font-weight:700;color:var(--ink-2)}
input[type=text],input[type=number],input[type=date],input[type=time],input[type=datetime-local],select,textarea{border:1.5px solid var(--line2);background:var(--surface);border-radius:var(--radius-md);padding:10px 14px;min-height:48px;width:100%;font-size:16px;font-weight:600}
input:focus,select:focus,textarea:focus{border-color:var(--accent);outline:none;box-shadow:0 0 0 4px var(--accent-ring)}
input[type=checkbox]{accent-color:var(--accent)}
.stepper{display:grid;grid-template-columns:52px 1fr 52px;gap:8px;align-items:center}
.stepper input{text-align:center;font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}
.stepper button{height:52px;border-radius:14px;border:1.5px solid var(--line2);background:var(--sunken);font-size:24px;font-weight:700}
.actions{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap}
.actions .spacer{flex:1}
.err{color:var(--danger);font-size:14px;font-weight:700}

.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-sm)}
@media (min-width:521px){.kpi:last-child:nth-child(3n+1){grid-column:span 3}.kpi:last-child:nth-child(3n+2){grid-column:span 2}}
@media (max-width:520px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi:last-child:nth-child(odd){grid-column:span 2}}
.kpi{background:var(--surface);padding:12px 14px;display:grid;gap:3px;align-content:start}
.kpi .label{font-size:12.5px;color:var(--muted);font-weight:700}
.kpi .val{font-size:24px;font-weight:800;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.kpi .val small{font-size:13px;color:var(--muted);margin-left:3px;font-weight:600;letter-spacing:0}
.kpi .delta{font-size:12px;color:var(--ink-3);font-weight:600}

.score{display:grid}
.score .grp{padding:12px 0 4px}
.score .item{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:10px 0;border-top:1px solid var(--line);align-items:center}
.score .grp + .item{border-top:0}
.score .item b{font-weight:700}
.score .item .vals{grid-column:1 / -1;font-size:13px;color:var(--ink-2);font-weight:700;font-variant-numeric:tabular-nums}
.score .item .vals span{color:var(--ink-3);font-weight:500}
.score .item .chip{justify-self:start}
@media (min-width:640px){.score .item{grid-template-columns:minmax(0,1.3fr) minmax(0,1.6fr) auto}.score .item .vals{grid-column:auto}.score .item .chip{justify-self:end}}

.chart{position:relative;width:100%;min-width:0}
.chart svg{display:block;overflow:visible}
.chart text{font-family:var(--font);font-size:11px;font-weight:600;fill:var(--ink-3)}
.chart .lbl-strong{fill:var(--ink);font-weight:800}
.chart .axis{stroke:var(--line2);stroke-width:1}
.chart .grid{stroke:var(--line);stroke-width:1;stroke-dasharray:2 3}
.m-night{fill:var(--night)} .m-nap{fill:var(--nap)} .m-bottle{fill:var(--bottle)} .m-solid{fill:var(--solid)} .m-nurse{fill:var(--nurse)} .m-nappy{fill:var(--nappy)} .m-med{fill:var(--med)} .m-accent{fill:var(--accent)}
.s-night{stroke:var(--night)} .s-nap{stroke:var(--nap)} .s-bottle{stroke:var(--bottle)} .s-solid{stroke:var(--solid)} .s-nurse{stroke:var(--nurse)} .s-nappy{stroke:var(--nappy)} .s-accent{stroke:var(--accent)} .s-ink{stroke:var(--ink-2)}
.ring{stroke:var(--surface);stroke-width:2}
.band-out{fill:var(--band-out)} .band-in{fill:var(--band-in)} .median{stroke:var(--median);stroke-dasharray:4 3;fill:none;stroke-width:1.5}
.ref-band{fill:var(--success-soft)}
.hit{fill:transparent;cursor:pointer}
.xh{stroke:var(--ink-3);stroke-width:1}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--muted);font-weight:600;margin-top:8px}
.legend span{display:inline-flex;align-items:center;gap:6px}
.sw{width:12px;height:12px;border-radius:3px;display:inline-block}
.sw.line{height:3px;border-radius:2px}
.sw.dot{border-radius:50%;width:9px;height:9px}
.sw.dia{width:9px;height:9px;border-radius:2px;transform:rotate(45deg)}
.tip{position:fixed;z-index:60;pointer-events:none;background:#18211f;color:#f3f7f5;font-size:13px;font-weight:600;padding:7px 10px;border-radius:10px;max-width:260px;line-height:1.35;opacity:0;transition:opacity .08s;box-shadow:var(--shadow-md)}
.tip b{font-weight:800}
.tip .t-sub{opacity:.75;font-size:12px}

table{border-collapse:collapse;width:100%;font-size:14px}
th{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);font-weight:800;text-align:left;padding:8px;border-bottom:1px solid var(--line)}
td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
.tbl-wrap{overflow-x:auto}

.foods{display:flex;flex-wrap:wrap;gap:6px}
.food{display:inline-flex;align-items:baseline;gap:6px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:13.5px;font-weight:600;background:var(--surface)}
.food .n{font-size:12px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.allergens{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px}
.allergen{border:1px solid var(--line);background:var(--surface);border-radius:var(--radius-md);padding:10px 12px;display:grid;gap:4px;justify-items:start}
.allergen.missing{border-style:dashed;background:transparent}
.allergen b{font-weight:800}
.allergen span{font-size:12.5px;color:var(--muted)}

.callout{border-left:3px solid var(--accent);padding:4px 0 4px 12px;font-size:14px}
.note{font-size:13px;color:var(--muted)}

.toast{position:fixed;left:50%;bottom:calc(104px + var(--safe-bottom));transform:translateX(-50%);background:#18211f;color:#f3f7f5;padding:10px 16px;border-radius:999px;font-size:15px;font-weight:700;z-index:70;display:flex;gap:14px;align-items:center;box-shadow:var(--shadow-lg);max-width:calc(100vw - 32px)}
:host([data-theme="dark"]) .toast,:host([data-theme="dark"]) .tip{background:#26332f}
.toast button{background:none;border:0;color:#a3e5d4;font-weight:800;text-decoration:underline;padding:0}
@media (min-width:900px){.toast{bottom:32px}}

/* embedded (inside a hjem settings card) */
.embedded .block{padding:16px 0;border-top:1px solid var(--line)}
.embedded .block:first-child{border-top:0;padding-top:4px}
.embedded h3{margin-bottom:2px}
@media (prefers-reduced-motion:reduce){.sheet,.scrim,.tip{transition:none}}
`;
