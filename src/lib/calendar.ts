"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase/client";
import { useApp } from "@/components/AppProvider";
import { addDays, localISODate } from "./dates";
import type { Locale } from "./i18n";
import type { CalendarEvent, CalendarRow, GoogleAccount } from "./types";

function localMidnight(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Calendars, accounts and events for the household between two local dates (inclusive). */
export function useCalendarData(from: string, to: string) {
  const { household, userId } = useApp();
  const hid = household?.id;
  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!hid) return;
    const sb = supabase();
    // Pad a day on each side so all-day events (stored at UTC midnight) are never missed.
    const start = localMidnight(addDays(from, -1)).toISOString();
    const end = localMidnight(addDays(to, 2)).toISOString();
    const [c, a, e] = await Promise.all([
      sb.from("calendars").select("*").eq("household_id", hid).order("is_primary", { ascending: false }).order("name"),
      sb.from("google_accounts").select("*").eq("household_id", hid).order("created_at"),
      sb
        .from("calendar_events")
        .select("id, calendar_id, title, location, starts_at, ends_at, all_day, html_link")
        .eq("household_id", hid)
        .lt("starts_at", end)
        .gt("ends_at", start)
        .order("starts_at")
        .limit(1000),
    ]);
    setCalendars((c.data ?? []) as CalendarRow[]);
    setAccounts((a.data ?? []) as GoogleAccount[]);
    setEvents((e.data ?? []) as CalendarEvent[]);
    setLoaded(true);
  }, [hid, from, to]);

  const sync = useCallback(
    async (force = false) => {
      if (!hid || !userId) return;
      setSyncing(true);
      await supabase().functions.invoke("google-calendar/sync", { body: { force } }).catch(() => null);
      setSyncing(false);
      await load();
    },
    [hid, userId, load],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    load();
  }, [load]);

  // Ask the server to refresh from Google whenever the app opens (it skips if fresh).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- background refresh on open
    sync(false);
    const onVisible = () => document.visibilityState === "visible" && sync(false);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sync]);

  useEffect(() => {
    if (!hid) return;
    const sb = supabase();
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (t) clearTimeout(t);
      t = setTimeout(load, 400);
    };
    const filter = `household_id=eq.${hid}`;
    const ch = sb
      .channel(`calendar-${hid}-${from}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendars", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "google_accounts", filter }, refresh)
      .subscribe();
    return () => {
      if (t) clearTimeout(t);
      sb.removeChannel(ch);
    };
  }, [hid, from, load]);

  return { calendars, accounts, events, loaded, syncing, sync, reload: load };
}

/** Events that fall on a given local date, all-day first, then by start time. */
export function eventsOnDay(events: CalendarEvent[], iso: string) {
  return events
    .filter((e) => {
      if (e.all_day) {
        const s = e.starts_at.slice(0, 10);
        const end = e.ends_at.slice(0, 10);
        return s <= iso && iso < end;
      }
      const s = localISODate(new Date(e.starts_at));
      const end = localISODate(new Date(new Date(e.ends_at).getTime() - 1));
      return s <= iso && iso <= end;
    })
    .sort((a, b) => (a.all_day === b.all_day ? (a.starts_at < b.starts_at ? -1 : 1) : a.all_day ? -1 : 1));
}

export function fmtTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const HIDDEN_KEY = "hjem-hidden-calendars";

/** Per-device quick filter: calendars hidden on this screen only. */
export function useHiddenCalendars() {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved filter on mount
      setHidden(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]"));
    } catch {}
  }, []);
  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  return { hidden, toggle };
}
