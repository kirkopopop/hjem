"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Icon } from "@/components/Icon";
import { EventRow } from "@/components/EventRow";
import { EventSheet } from "@/components/EventSheet";
import { eventsOnDay, useCalendarData, useHiddenCalendars } from "@/lib/calendar";
import { addDays, daysFromToday, formatDayMonth, formatWeekday, localISODate, weekDates } from "@/lib/dates";

export default function CalendarPage() {
  const { t, locale, profile } = useApp();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(localISODate());
  const [adding, setAdding] = useState(false);
  const week = useMemo(() => weekDates(offset), [offset]);
  const agendaDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(selected, i)), [selected]);
  const from = week[0] < selected ? week[0] : selected;
  const to = agendaDays[6] > week[6] ? agendaDays[6] : week[6];
  const { calendars, events, loaded, syncing, sync } = useCalendarData(from, to);
  const { hidden, toggle } = useHiddenCalendars();

  const shown = calendars.filter((c) => c.visible);
  const byId = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const visibleEvents = useMemo(
    () => events.filter((e) => byId.get(e.calendar_id)?.visible && !hidden.includes(e.calendar_id)),
    [events, byId, hidden],
  );

  const monthLabel = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { month: "long", year: "numeric" }).format(
    new Date(`${selected}T12:00:00`),
  );
  const dayLabel = (iso: string) => {
    const d = daysFromToday(iso);
    if (d === 0) return t("today");
    if (d === 1) return t("tomorrow");
    return `${formatWeekday(iso, locale)} · ${formatDayMonth(iso, locale)}`;
  };
  const shortDow = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { weekday: "short" }).format(new Date(`${iso}T12:00:00`));

  function moveWeek(delta: number) {
    const next = offset + delta;
    setOffset(next);
    setSelected(next === 0 ? localISODate() : weekDates(next)[0]);
  }

  if (loaded && calendars.length === 0) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">{t("calendar")}</h1>
        </div>
        <section className="card stack">
          <h2>{t("connectCalendarTitle")}</h2>
          <p className="lead" style={{ margin: 0 }}>{t("connectCalendarLead")}</p>
          {profile && (
            <Link href="/household#calendars" className="btn" style={{ textDecoration: "none" }}>
              {t("connectGoogle")}
            </Link>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow" style={{ textTransform: "capitalize" }}>{monthLabel}</span>
          <h1 className="page-title">{t("calendar")}</h1>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="icon-btn round" aria-label={t("refresh")} onClick={() => sync(true)} disabled={syncing}>
            <span className={syncing ? "spin" : ""} style={{ display: "inline-flex" }}>
              <Icon name="repeat" size={18} />
            </span>
          </button>
        </div>
      </div>

      <div className="week-strip">
        <button type="button" className="icon-btn small" aria-label={t("prevWeek")} onClick={() => moveWeek(-1)}>
          <Icon name="chevronLeft" size={18} stroke={2.2} />
        </button>
        <div className="week-days">
          {week.map((d) => {
            const has = eventsOnDay(visibleEvents, d).length > 0;
            const sel = d === selected;
            return (
              <button
                key={d}
                type="button"
                className={`wday${sel ? " is-selected" : ""}${daysFromToday(d) === 0 ? " is-today" : ""}`}
                aria-pressed={sel}
                aria-label={dayLabel(d)}
                onClick={() => setSelected(d)}
              >
                <span className="wday-dow">{shortDow(d)}</span>
                <span className="wday-num">{Number(d.slice(8))}</span>
                <span className="wday-dot" style={{ opacity: has ? 1 : 0 }} />
              </button>
            );
          })}
        </div>
        <button type="button" className="icon-btn small" aria-label={t("nextWeek")} onClick={() => moveWeek(1)}>
          <Icon name="chevronRight" size={18} stroke={2.2} />
        </button>
      </div>

      {shown.length > 1 && (
        <div className="chips-row" role="group" aria-label={t("calendarsTitle")}>
          {shown.map((c) => {
            const on = !hidden.includes(c.id);
            return (
              <button key={c.id} type="button" className="cal-chip" aria-pressed={on} onClick={() => toggle(c.id)}>
                <span className="ev-dot" style={{ background: c.color }} aria-hidden="true" />
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="stack" style={{ gap: 4 }}>
        {agendaDays.map((d) => {
          const list = eventsOnDay(visibleEvents, d);
          if (!list.length && d !== selected) return null;
          return (
            <section key={d} className="agenda-day">
              <h2 className="section-label" style={{ textTransform: "none", letterSpacing: 0, fontSize: 14 }}>{dayLabel(d)}</h2>
              {list.length ? (
                <div className="stack" style={{ gap: 6 }}>
                  {list.map((e) => (
                    <EventRow key={`${e.id}-${d}`} event={e} calendar={byId.get(e.calendar_id)} />
                  ))}
                </div>
              ) : (
                <p className="small muted" style={{ margin: "0 2px 8px" }}>{t("noEvents")}</p>
              )}
            </section>
          );
        })}
      </div>

      <button type="button" className="fab" onClick={() => setAdding(true)}>
        <Icon name="plus" size={20} stroke={2.2} />
        {t("addEvent")}
      </button>

      {adding && <EventSheet date={selected} calendars={calendars} onClose={() => setAdding(false)} />}
    </>
  );
}
