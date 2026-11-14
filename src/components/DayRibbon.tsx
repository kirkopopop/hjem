"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CalendarEvent, CalendarRow, Meal, MealSlot } from "@/lib/types";

/** When each meal usually happens, for placing it on the ribbon. */
const MEAL_HOUR: Record<MealSlot, number> = { breakfast: 8, lunch: 12.5, dinner: 18.5 };

export type RibbonSleep = { start: Date; end: Date | null; night: boolean };

/**
 * The household's day on one line: timed events as blocks in their calendar's colour, the baby's sleep as soft
 * bands underneath, meals as dots, and a marker for now. Morning to midnight, or the whole day when it's
 * still night. Tapping it opens the calendar.
 */
export function DayRibbon({
  now,
  events,
  calendars,
  meals,
  sleeps = [],
  label,
}: {
  now: Date;
  events: CalendarEvent[];
  calendars: Map<string, CalendarRow>;
  meals: Meal[];
  sleeps?: RibbonSleep[];
  label: string;
}) {
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hourOf = (d: Date | string) => (new Date(d).getTime() - day0) / 3_600_000;
  const nowH = hourOf(now);
  const from = nowH < 6 ? 0 : 6;
  const to = 24;
  const pct = (h: number) => `${((Math.min(to, Math.max(from, h)) - from) / (to - from)) * 100}%`;
  const span = (a: number, b: number) => `${((Math.min(to, b) - Math.max(from, a)) / (to - from)) * 100}%`;

  // Timed events only; overlapping ones go on a second lane.
  const blocks = useMemo(() => {
    const list = events
      .filter((e) => !e.all_day)
      .map((e) => ({ e, a: hourOf(e.starts_at), b: hourOf(e.ends_at) }))
      .filter((x) => x.b > from && x.a < to)
      .sort((x, y) => x.a - y.a);
    const laneEnd = [-1, -1];
    return list.map((x) => {
      const lane = x.a >= laneEnd[0] ? 0 : x.a >= laneEnd[1] ? 1 : 0;
      laneEnd[lane] = Math.max(laneEnd[lane], x.b);
      return { ...x, lane };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, day0, from]);
  const twoLanes = blocks.some((b) => b.lane === 1);
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21].filter((h) => h >= from);
  const slots = [...new Set(meals.map((m) => m.slot))];

  return (
    <Link href="/calendar" className={`ribbon${twoLanes ? " two" : ""}`} aria-label={label}>
      <span className="ribbon-track" aria-hidden="true">
        {ticks.map((h) => (
          <i key={h} className="ribbon-tick" style={{ left: pct(h) }} />
        ))}
        {sleeps.map((s, i) => {
          const a = hourOf(s.start);
          const b = s.end ? hourOf(s.end) : nowH;
          if (b <= from || a >= to) return null;
          return <i key={`s${i}`} className={`ribbon-sleep${s.night ? " night" : ""}${s.end ? "" : " live"}`} style={{ left: pct(a), width: span(a, b) }} />;
        })}
        {blocks.map(({ e, a, b, lane }, i) => (
          <i
            key={e.id}
            className={`ribbon-block lane-${lane}${b <= nowH ? " past" : ""}`}
            style={{ left: pct(a), width: span(a, b), background: calendars.get(e.calendar_id)?.color ?? "#8a9693", animationDelay: `${120 + i * 50}ms` }}
          />
        ))}
        {slots.map((s) => (
          <i key={s} className={`ribbon-meal${MEAL_HOUR[s] < nowH ? " past" : ""}`} style={{ left: pct(MEAL_HOUR[s]) }} />
        ))}
        {nowH >= from && nowH <= to && <i className="ribbon-now" style={{ left: pct(nowH) }} />}
      </span>
      <span className="ribbon-scale" aria-hidden="true">
        {ticks.map((h) => (
          <span key={h} style={{ left: pct(h) }}>{String(h).padStart(2, "0")}</span>
        ))}
      </span>
    </Link>
  );
}
