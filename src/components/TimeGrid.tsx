"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./AppProvider";
import { fmtTime } from "@/lib/calendar";
import { daysFromToday, localISODate } from "@/lib/dates";
import type { CalendarEvent, CalendarRow } from "@/lib/types";

const MIN_EVENT_MIN = 25;

function localMidnight(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Dark or light text, whichever reads better on the calendar colour. */
function textOn(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#17201f";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.35 ? "#17201f" : "#ffffff";
}

type Placed = { e: CalendarEvent; startMin: number; endMin: number; col: number; cols: number };

/** Lays out one day's timed events, putting overlapping ones side by side. */
function layoutDay(events: CalendarEvent[], iso: string): Placed[] {
  const dayStart = localMidnight(iso);
  const dayEnd = dayStart + 86_400_000;
  const items = events
    .filter((e) => {
      if (e.all_day) return false;
      const s = new Date(e.starts_at).getTime();
      const en = new Date(e.ends_at).getTime();
      return s < dayEnd && (en > dayStart || s >= dayStart);
    })
    .map((e) => {
      const s = Math.max(new Date(e.starts_at).getTime(), dayStart);
      const en = Math.min(new Date(e.ends_at).getTime(), dayEnd);
      const startMin = (s - dayStart) / 60_000;
      const endMin = Math.max((en - dayStart) / 60_000, startMin + MIN_EVENT_MIN);
      return { e, startMin, endMin: Math.min(endMin, 1440), col: 0, cols: 1 };
    })
    .filter((x) => x.startMin < 1440)
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const p of cluster) p.cols = colEnds.length;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.endMin);
    } else colEnds[col] = it.endMin;
    it.col = col;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return out;
}

function allDayOn(events: CalendarEvent[], iso: string) {
  return events.filter((e) => e.all_day && e.starts_at.slice(0, 10) <= iso && iso < e.ends_at.slice(0, 10));
}

export function TimeGrid({
  days,
  events,
  calendars,
  showHeader,
  onPickDay,
}: {
  days: string[];
  events: CalendarEvent[];
  calendars: Map<string, CalendarRow>;
  showHeader: boolean;
  onPickDay?: (iso: string) => void;
}) {
  const { t, locale } = useApp();
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const hourH = days.length === 1 ? 56 : 48;
  const today = localISODate(now);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Start scrolled to the morning, or to just before now if that's later.
  const showsToday = days.includes(today);
  const daysKey = days.join(",");
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = scroller.current;
      if (!el) return;
      const h = new Date().getHours();
      el.scrollTop = (showsToday ? Math.max(7, h - 1) : 7) * hourH;
    });
    return () => cancelAnimationFrame(id);
  }, [daysKey, hourH, showsToday]);

  const perDay = useMemo(() => days.map((d) => ({ d, timed: layoutDay(events, d), allDay: allDayOn(events, d) })), [days, events]);
  const anyAllDay = perDay.some((x) => x.allDay.length);
  const cols = `52px repeat(${days.length}, minmax(0, 1fr))`;
  const loc = "en-GB";
  const hourLabel = (h: number) => new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(new Date(2026, 0, 1, h));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className={`tg${days.length === 1 ? " is-day" : ""}`}>
      {showHeader && (
        <div className="tg-head" style={{ gridTemplateColumns: cols }}>
          <span />
          {days.map((d) => {
            const dt = new Date(`${d}T12:00:00`);
            return (
              <button
                key={d}
                type="button"
                className={`tg-dayhead${daysFromToday(d) === 0 ? " is-today" : ""}`}
                onClick={() => onPickDay?.(d)}
                aria-label={new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long" }).format(dt)}
              >
                <span className="tg-dow">{new Intl.DateTimeFormat(loc, { weekday: "short" }).format(dt)}</span>
                <span className="tg-num">{dt.getDate()}</span>
              </button>
            );
          })}
        </div>
      )}

      {anyAllDay && (
        <div className="tg-allday" style={{ gridTemplateColumns: cols }}>
          <span className="tg-axis-label">{t("allDay")}</span>
          {perDay.map(({ d, allDay }) => (
            <div key={d} className="tg-allday-cell">
              {allDay.map((e) => {
                const c = calendars.get(e.calendar_id)?.color ?? "#8a9693";
                return (
                  <a
                    key={e.id}
                    className="tg-chip"
                    href={e.html_link ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    style={{ background: c, color: textOn(c) }}
                    title={e.title}
                  >
                    {e.title || "—"}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="tg-scroll" ref={scroller}>
        <div className="tg-body" style={{ gridTemplateColumns: cols, height: 24 * hourH }}>
          <div className="tg-axis">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span key={h} style={{ top: h * hourH }}>
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {perDay.map(({ d, timed }) => (
            <div key={d} className="tg-col" style={{ backgroundSize: `100% ${hourH}px` }}>
              {timed.map((p) => {
                const c = calendars.get(p.e.calendar_id)?.color ?? "#8a9693";
                const height = ((p.endMin - p.startMin) / 60) * hourH;
                const roomy = height >= 34;
                return (
                  <a
                    key={`${p.e.id}-${d}`}
                    className="tg-event"
                    href={p.e.html_link ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    title={`${fmtTime(p.e.starts_at, locale)} ${p.e.title}`}
                    style={{
                      top: (p.startMin / 60) * hourH,
                      height: Math.max(height - 2, 16),
                      left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                      width: `calc(${100 / p.cols}% - 4px)`,
                      background: c,
                      color: textOn(c),
                    }}
                  >
                    <span className="tg-ev-title">{p.e.title || "—"}</span>
                    {roomy && <span className="tg-ev-time">{fmtTime(p.e.starts_at, locale)}</span>}
                  </a>
                );
              })}
              {d === today && <span className="tg-now" style={{ top: (nowMin / 60) * hourH }} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
