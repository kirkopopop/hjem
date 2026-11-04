"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Avatar, Icon } from "./Icon";
import { useCalendarData } from "@/lib/calendar";
import { localISODate } from "@/lib/dates";
import type { CalendarRow } from "@/lib/types";

const NOTICES: Record<string, "calConnected" | "calCancelled" | "calError"> = {
  connected: "calConnected",
  cancelled: "calCancelled",
  expired: "calError",
  error: "calError",
  no_refresh: "calError",
};

export function CalendarSettings() {
  const { t, locale, userId, member, notify } = useApp();
  const today = localISODate();
  const { calendars, accounts, sync, syncing, reload } = useCalendarData(today, today);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const isDevice = member(userId)?.role === "device";

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const status = p.get("calendar");
    if (status) {
      notify(t(NOTICES[status] ?? "calError"), 3500);
      window.history.replaceState(null, "", "/household#calendars");
      document.getElementById("calendars")?.scrollIntoView({ behavior: "smooth" });
    }
    // Run once when the page opens after returning from Google.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy(true);
    const { data, error } = await supabase().functions.invoke("google-calendar/start", { method: "POST" });
    if (error || !data?.url) {
      const status = (error as { context?: Response } | null)?.context?.status;
      notify(status === 503 ? t("calNotConfigured") : t("calError"), 3500);
      setBusy(false);
      return;
    }
    window.location.assign(data.url);
  }

  async function toggle(c: CalendarRow) {
    const next = !(local[c.id] ?? c.visible);
    setLocal((s) => ({ ...s, [c.id]: next }));
    const { error } = await supabase().from("calendars").update({ visible: next }).eq("id", c.id);
    if (error) notify(t("somethingWrong", { msg: error.message }));
    await sync(true);
    setLocal((s) => {
      const copy = { ...s };
      delete copy[c.id];
      return copy;
    });
  }

  async function disconnect(accountId: string, email: string) {
    if (!window.confirm(t("disconnectConfirm", { email }))) return;
    const { error } = await supabase().functions.invoke("google-calendar/disconnect", { body: { account_id: accountId } });
    if (error) notify(t("somethingWrong", { msg: error.message }));
    reload();
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(
      new Date(iso),
    );

  return (
    <section id="calendars" className="card stack" aria-labelledby="cal-h">
      <div className="card-head">
        <h2 id="cal-h">{t("calendarsTitle")}</h2>
        {accounts.length > 0 && (
          <button type="button" className="icon-btn small" aria-label={t("refresh")} onClick={() => sync(true)} disabled={syncing}>
            <span className={syncing ? "spin" : ""} style={{ display: "inline-flex" }}>
              <Icon name="repeat" size={18} />
            </span>
          </button>
        )}
      </div>
      <p className="lead" style={{ margin: 0 }}>{accounts.length ? t("calendarsLead") : t("connectCalendarLead")}</p>

      {accounts.map((a) => {
        const owner = member(a.user_id);
        const cals = calendars.filter((c) => c.account_id === a.id);
        return (
          <div key={a.id} className="account-block">
            <div className="row">
              {owner && <Avatar name={owner.profile.display_name} color={owner.profile.color} size={28} />}
              <div className="grow" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{a.google_email}</span>
                <span className="small" style={{ color: a.sync_error ? "#8c1d16" : "var(--muted)" }}>
                  {a.sync_error ? t("syncError") : a.last_synced_at ? t("lastSynced", { time: fmt(a.last_synced_at) }) : t("syncing")}
                </span>
              </div>
              {a.user_id === userId && (
                <button type="button" className="btn small secondary" onClick={() => disconnect(a.id, a.google_email)}>
                  {t("disconnect")}
                </button>
              )}
            </div>
            <ul className="cal-list">
              {cals.map((c) => {
                const on = local[c.id] ?? c.visible;
                return (
                  <li key={c.id} className="row" style={{ minHeight: 44 }}>
                    <span className="ev-dot" style={{ background: c.color, width: 12, height: 12 }} aria-hidden="true" />
                    <span className="grow" style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{c.name}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={c.name}
                      className={`switch${on ? " on" : ""}`}
                      onClick={() => toggle(c)}
                    >
                      <span />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {!isDevice && (
        <button type="button" className={accounts.length ? "btn soft" : "btn"} onClick={connect} disabled={busy}>
          <Icon name="calendar" size={18} />
          {busy ? t("working") : t("connectGoogle")}
        </button>
      )}
    </section>
  );
}

const WAKE_KEY = "hjem-keep-awake";

export function WallSettings() {
  const { t } = useApp();
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved setting on mount
      setOn(localStorage.getItem(WAKE_KEY) === "1");
    } catch {}
  }, []);
  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(WAKE_KEY, next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event("hjem-wake"));
  }
  return (
    <section className="card stack" aria-labelledby="wall-h">
      <h2 id="wall-h">{t("wallSettings")}</h2>
      <div className="row" style={{ minHeight: 44 }}>
        <span className="grow" style={{ fontWeight: 600 }}>{t("keepAwake")}</span>
        <button type="button" role="switch" aria-checked={on} aria-label={t("keepAwake")} className={`switch${on ? " on" : ""}`} onClick={toggle}>
          <span />
        </button>
      </div>
    </section>
  );
}

/** Keeps the screen on while the app is visible, if this device asked for it. */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const want = () => {
      try {
        return localStorage.getItem(WAKE_KEY) === "1";
      } catch {
        return false;
      }
    };
    const apply = async () => {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (want() && document.visibilityState === "visible" && nav.wakeLock && !lock) {
        try {
          lock = await nav.wakeLock.request("screen");
        } catch {}
      } else if (!want() && lock) {
        await lock.release().catch(() => {});
        lock = null;
      }
    };
    const onVisible = () => {
      lock = null;
      apply();
    };
    apply();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("hjem-wake", apply);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("hjem-wake", apply);
      lock?.release().catch(() => {});
    };
  }, []);
}
