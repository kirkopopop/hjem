"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import type { CalendarRow } from "@/lib/types";

export function EventSheet({ date: initialDate, calendars, onClose }: { date: string; calendars: CalendarRow[]; onClose: () => void }) {
  const { t, userId, notify } = useApp();
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const writable = calendars.filter((c) => c.visible && c.can_write);
  // Default: your own main calendar, else the first one you can write to.
  const preferred = writable.find((c) => c.owner_user_id === userId && c.is_primary) ?? writable[0];

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:00");
  const [location, setLocation] = useState("");
  const [calendarId, setCalendarId] = useState(preferred?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().functions.invoke("google-calendar/add-event", {
      body: { calendar_id: calendarId, title: title.trim(), date, all_day: allDay, start_time: start, end_time: end, location: location.trim() },
    });
    if (error) {
      setError(t("somethingWrong", { msg: error.message }));
      setBusy(false);
      return;
    }
    notify(t("saved"));
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="sheet-head">
          <h2 id={titleId}>{t("newEvent")}</h2>
          <button type="button" className="icon-btn" aria-label={t("cancel")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        {writable.length === 0 ? (
          <p className="notice">{t("noWritable")}</p>
        ) : (
          <>
            <label className="field">
              <span>{t("eventTitle")}</span>
              <input ref={firstField} className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
            </label>
            <div className="two">
              <label className="field">
                <span>{t("day")}</span>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label className="field">
                <span>{t("whichCalendar")}</span>
                <select className="select" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
                  {writable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="row" style={{ gap: 10, fontWeight: 700 }}>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--accent)" }} />
              {t("allDay")}
            </label>
            {!allDay && (
              <div className="two">
                <label className="field">
                  <span>{t("startTime")}</span>
                  <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
                </label>
                <label className="field">
                  <span>{t("endTime")}</span>
                  <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </label>
              </div>
            )}
            <label className="field">
              <span>{t("location")}</span>
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="row">
              <span className="grow" />
              <button type="submit" className="btn" disabled={busy || !title.trim() || !calendarId}>
                {busy ? t("working") : t("save")}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
