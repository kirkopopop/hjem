"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { useBaby } from "@/baby/useBaby";
import { addEvent, events, updateEvent } from "@/baby/store";
import { current, model, predictNext } from "@/baby/analytics";
import { dur, hhmm } from "@/baby/util";

const nightNow = (d: Date) => {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= 18.5 || h < 5.5 ? "night" : "nap";
};

/** Home card: is the baby asleep or awake, what's next, and one tap to start or stop a sleep. */
export function BabyCard() {
  const st = useBaby();
  const { notify } = useApp();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const baby = st.baby;
  if (!baby) return null;
  const ev = events();
  const m = model(ev, st.version, baby);
  const cur = current(m, ev, now);
  const next = predictNext(m, cur, now);
  const r = cur.running;
  const since = r ? r._s : cur.lastSleep?._e;

  function toggle() {
    const d = new Date();
    if (r) {
      updateEvent(r.id, { ended_at: (d < r._s ? r._s : d).toISOString() });
      notify(`${baby!.name} woke up at ${hhmm(d)}`);
    } else {
      addEvent({ kind: "sleep", subtype: nightNow(d), started_at: d.toISOString() });
      notify(`${nightNow(d) === "night" ? "Night sleep" : "Nap"} started at ${hhmm(d)}`);
    }
    setNow(d);
  }

  return (
    <section className={`card home-card baby-card${r ? " is-asleep" : ""}`} aria-labelledby="h-baby">
      <div className="card-head">
        <h2 id="h-baby">{baby.name}</h2>
        <Link href="/baby" className="small">Open</Link>
      </div>
      <div className="baby-card-state">
        <span className="baby-card-ico"><Icon name={r ? "moon" : "sun"} size={22} /></span>
        <div className="grow">
          <div className="baby-card-big">
            {r ? (r.subtype === "night" ? "Asleep" : "Napping") : "Awake"}
            {since && <span> · {dur(now.getTime() - since.getTime())}</span>}
          </div>
          <div className="small muted">
            {since ? `since ${hhmm(since)}` : "No sleep logged yet"}
            {!r && next ? ` · ${next.what.toLowerCase()} usually around ${hhmm(next.at)}` : ""}
          </div>
        </div>
      </div>
      <div className="baby-card-facts">
        <span>
          <b>{cur.lastBottle ? hhmm(cur.lastBottle._s) : "–"}</b>
          Last bottle{cur.lastBottle?.amount ? ` · ${Math.round(cur.lastBottle.amount)} ml` : ""}
        </span>
        <span>
          <b>{cur.lastSolid ? hhmm(cur.lastSolid._s) : "–"}</b>
          Last meal
        </span>
      </div>
      <button type="button" className={`btn block${r ? " soft" : ""}`} onClick={toggle}>
        <Icon name={r ? "sun" : "moon"} size={18} />
        {r ? "Woke up" : "Start sleep"}
      </button>
    </section>
  );
}
