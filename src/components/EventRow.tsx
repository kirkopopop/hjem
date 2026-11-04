"use client";

import { useApp } from "./AppProvider";
import { fmtTime } from "@/lib/calendar";
import type { CalendarEvent, CalendarRow } from "@/lib/types";

export function EventRow({ event, calendar, compact = false }: { event: CalendarEvent; calendar?: CalendarRow; compact?: boolean }) {
  const { t, locale, member } = useApp();
  const owner = member(calendar?.owner_user_id);
  const time = event.all_day ? t("allDay") : fmtTime(event.starts_at, locale);
  const endTime = event.all_day ? null : fmtTime(event.ends_at, locale);
  const body = (
    <>
      <span className="ev-dot" style={{ background: calendar?.color ?? "#8a9693" }} aria-hidden="true" />
      <span className="ev-time">
        <span>{time}</span>
        {!compact && endTime && <span className="ev-end">{endTime}</span>}
      </span>
      <span className="ev-main">
        <span className="ev-title">{event.title || "—"}</span>
        {!compact && (
          <span className="ev-sub">
            {[calendar?.name, owner && calendar && !calendar.name.includes(owner.profile.display_name) ? owner.profile.display_name : null, event.location]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </span>
    </>
  );
  return event.html_link ? (
    <a className={`ev${compact ? " compact" : ""}`} href={event.html_link} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <div className={`ev${compact ? " compact" : ""}`}>{body}</div>
  );
}
