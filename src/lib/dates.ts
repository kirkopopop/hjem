import type { Locale } from "./i18n";

export function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Days from today to the given YYYY-MM-DD (negative = past). */
export function daysFromToday(iso: string) {
  const today = parseISODate(localISODate());
  return Math.round((parseISODate(iso).getTime() - today.getTime()) / 86_400_000);
}

export function formatShortDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parseISODate(iso));
}

/** Monday 00:00 of the current week, as an ISO timestamp. */
export function startOfWeekISO() {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d.toISOString();
}
