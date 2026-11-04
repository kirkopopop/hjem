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

export function addDays(iso: string, n: number) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return localISODate(d);
}

/** The 7 dates (Mon–Sun) of the week `offset` weeks from this one. */
export function weekDates(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  const monday = localISODate(d);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isoWeekNumber(iso: string) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

export function formatWeekday(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { weekday: "long" }).format(parseISODate(iso));
}

export function formatDayMonth(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short" }).format(parseISODate(iso));
}
