"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Icon } from "@/components/Icon";
import { EventSheet } from "@/components/EventSheet";
import { TimeGrid } from "@/components/TimeGrid";
import { calendarLabel, eventsOnDay, useCalendarData, useHiddenCalendars } from "@/lib/calendar";
import { addDays, daysFromToday, formatDayMonth, formatWeekday, localISODate, mondayOf } from "@/lib/dates";

type View = "day" | "week";
const VIEW_KEY = "hjem-calendar-view";

export default function CalendarPage() {
  const { t, locale, member } = useApp();
  const [view, setView] = useState<View>("day");
  const [selected, setSelected] = useState(localISODate());
  const [adding, setAdding] = useState(false);
  const monday = mondayOf(selected);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const { calendars, events, loaded, syncing, sync } = useCalendarData(week[0], week[6]);
  const { hidden, toggle } = useHiddenCalendars();

  // Each device remembers its preferred view (e.g. Week on the wall tablet).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved view on mount
      if (saved === "day" || saved === "week") setView(saved);
      else if (window.matchMedia("(min-width: 900px)").matches) setView("week");
    } catch {}
  }, []);
  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }

  const shown = calendars.filter((c) => c.visible);
  const byId = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const visibleEvents = useMemo(
    () => events.filter((e) => byId.get(e.calendar_id)?.visible && !hidden.includes(e.calendar_id)),
    [events, byId, hidden],
  );

  const loc = "en-GB";
  const title =
    view === "day"
      ? daysFromToday(selected) === 0
        ? `${t("today")} · ${formatDayMonth(selected, locale)}`
        : `${formatWeekday(selected, locale)} · ${formatDayMonth(selected, locale)}`
      : `${formatDayMonth(week[0], locale)} – ${formatDayMonth(week[6], locale)}`;
  const monthLabel = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }).format(new Date(`${selected}T12:00:00`));
  const step = view === "day" ? 1 : 7;
  const isCurrent = view === "day" ? selected === localISODate() : week.includes(localISODate());

  if (loaded && calendars.length === 0) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">{t("calendar")}</h1>
        </div>
        <section className="card stack">
          <h2>{t("connectCalendarTitle")}</h2>
          <p className="lead" style={{ margin: 0 }}>{t("connectCalendarLead")}</p>
          <Link href="/settings#calendars" className="btn" style={{ textDecoration: "none" }}>
            {t("connectGoogle")}
          </Link>
        </section>
      </>
    );
  }

  return (
    <div className="cal-page">
      <div className="page-head">
        <div>
          <span className="eyebrow" style={{ textTransform: "capitalize" }}>{monthLabel}</span>
          <h1 className="page-title">{t("calendar")}</h1>
        </div>
        <button type="button" className="icon-btn round" aria-label={t("refresh")} onClick={() => sync(true)} disabled={syncing}>
          <span className={syncing ? "spin" : ""} style={{ display: "inline-flex" }}>
            <Icon name="repeat" size={18} />
          </span>
        </button>
      </div>

      <div className="cal-toolbar">
        <div className="segmented" role="group" aria-label={t("calendarView")} style={{ width: 180 }}>
          <button type="button" aria-pressed={view === "day"} onClick={() => changeView("day")}>
            {t("dayView")}
          </button>
          <button type="button" aria-pressed={view === "week"} onClick={() => changeView("week")}>
            {t("weekView")}
          </button>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {!isCurrent && (
            <button type="button" className="btn small secondary" onClick={() => setSelected(localISODate())}>
              {t("goToday")}
            </button>
          )}
          <button
            type="button"
            className="icon-btn round"
            aria-label={view === "day" ? t("prevDay") : t("prevWeek")}
            onClick={() => setSelected((d) => addDays(d, -step))}
          >
            <Icon name="chevronLeft" size={18} stroke={2.2} />
          </button>
          <button
            type="button"
            className="icon-btn round"
            aria-label={view === "day" ? t("nextDay") : t("nextWeek")}
            onClick={() => setSelected((d) => addDays(d, step))}
          >
            <Icon name="chevronRight" size={18} stroke={2.2} />
          </button>
        </div>
      </div>

      <h2 className="cal-range" aria-live="polite">{title}</h2>

      {view === "day" && (
        <div className="week-days" style={{ marginBottom: 10 }}>
          {week.map((d) => {
            const has = eventsOnDay(visibleEvents, d).length > 0;
            const sel = d === selected;
            return (
              <button
                key={d}
                type="button"
                className={`wday${sel ? " is-selected" : ""}${daysFromToday(d) === 0 ? " is-today" : ""}`}
                aria-pressed={sel}
                aria-label={`${formatWeekday(d, locale)} ${formatDayMonth(d, locale)}`}
                onClick={() => setSelected(d)}
              >
                <span className="wday-dow">{new Intl.DateTimeFormat(loc, { weekday: "short" }).format(new Date(`${d}T12:00:00`))}</span>
                <span className="wday-num">{Number(d.slice(8))}</span>
                <span className="wday-dot" style={{ opacity: has ? 1 : 0 }} />
              </button>
            );
          })}
        </div>
      )}

      {shown.length > 1 && (
        <div className="chips-row" role="group" aria-label={t("calendarsTitle")}>
          {shown.map((c) => {
            const on = !hidden.includes(c.id);
            return (
              <button key={c.id} type="button" className="cal-chip" aria-pressed={on} onClick={() => toggle(c.id)}>
                <span className="ev-dot" style={{ background: c.color }} aria-hidden="true" />
                {calendarLabel(c, member(c.owner_user_id)?.profile.display_name)}
              </button>
            );
          })}
        </div>
      )}

      {view === "day" ? (
        <TimeGrid days={[selected]} events={visibleEvents} calendars={byId} showHeader={false} />
      ) : (
        <TimeGrid
          days={week}
          events={visibleEvents}
          calendars={byId}
          showHeader
          onPickDay={(d) => {
            setSelected(d);
            changeView("day");
          }}
        />
      )}

      <button type="button" className="fab" onClick={() => setAdding(true)}>
        <Icon name="plus" size={20} stroke={2.2} />
        {t("addEvent")}
      </button>

      {adding && <EventSheet date={selected} calendars={calendars} onClose={() => setAdding(false)} />}
    </div>
  );
}
