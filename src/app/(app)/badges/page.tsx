"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { BADGES, badgeDesc, badgeName, type BadgeDef, type Metric } from "@/lib/badges";
import type { BadgeRow } from "@/lib/types";

type Counts = Record<Metric, number>;
const ZERO: Counts = { myDone: 0, teamDone: 0, myCooked: 0, myPlanned: 0, myTicked: 0 };

export default function BadgesPage() {
  const { t, locale, userId, household, members, badgeTick } = useApp();
  const [earned, setEarned] = useState<BadgeRow[]>([]);
  const [counts, setCounts] = useState<Counts>(ZERO);
  const [loaded, setLoaded] = useState(false);
  const hid = household?.id;

  const load = useCallback(async () => {
    if (!hid || !userId) return;
    const sb = supabase();
    const head = { count: "exact" as const, head: true };
    const [b, myDone, teamDone, myCooked, myPlanned, myTicked] = await Promise.all([
      sb.from("badges").select("*").eq("household_id", hid).order("earned_at", { ascending: false }),
      sb.from("tasks").select("id", head).eq("household_id", hid).eq("status", "done").eq("completed_by", userId),
      sb.from("tasks").select("id", head).eq("household_id", hid).eq("status", "done"),
      sb
        .from("meals")
        .select("id", head)
        .eq("household_id", hid)
        .eq("cooked", true)
        .or(`cook_id.eq.${userId},and(cook_id.is.null,created_by.eq.${userId})`),
      sb.from("meals").select("id", head).eq("household_id", hid).eq("created_by", userId),
      sb.from("grocery_items").select("id", head).eq("household_id", hid).eq("checked", true).eq("checked_by", userId),
    ]);
    setEarned((b.data ?? []) as BadgeRow[]);
    setCounts({
      myDone: myDone.count ?? 0,
      teamDone: teamDone.count ?? 0,
      myCooked: myCooked.count ?? 0,
      myPlanned: myPlanned.count ?? 0,
      myTicked: myTicked.count ?? 0,
    });
    setLoaded(true);
  }, [hid, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount and when a badge arrives
    load();
  }, [load, badgeTick]);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  const find = (key: string, uid: string | null) => earned.find((e) => e.badge_key === key && e.user_id === uid);

  function tile(def: BadgeDef, row: BadgeRow | undefined, showProgress: boolean) {
    const n = def.metric ? Math.min(counts[def.metric], def.target ?? 0) : 0;
    return (
      <li key={def.key} className={`badge-tile${row ? " is-earned" : ""}`}>
        <span className="badge-icon">
          <Icon name={row ? def.icon : "lock"} size={26} stroke={1.9} />
        </span>
        <span className="badge-name">{t(badgeName(def.key))}</span>
        <span className="badge-desc">{t(badgeDesc(def.key))}</span>
        {row ? (
          <span className="badge-foot">{t("earnedOn", { date: fmt(row.earned_at) })}</span>
        ) : showProgress && def.metric && def.target && def.target > 1 ? (
          <span className="badge-foot">
            <span className="bar" aria-hidden="true">
              <span style={{ width: `${(n / def.target) * 100}%` }} />
            </span>
            {t("progress", { n, target: def.target })}
          </span>
        ) : null}
      </li>
    );
  }

  const together = BADGES.filter((b) => b.scope === "together");
  const personal = BADGES.filter((b) => b.scope === "me");
  const me = members.find((m) => m.user_id === userId);
  const others = members.filter((m) => m.user_id !== userId && m.role !== "device");

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t("badges")}</h1>
      </div>
      <p className="lead">{t("badgesLead")}</p>

      {loaded && earned.length === 0 && <p className="notice" style={{ marginBottom: 8 }}>{t("noBadgesYet")}</p>}

      <h2 className="section-label">{t("together")}</h2>
      <ul className="badge-grid">{together.map((d) => tile(d, find(d.key, null), true))}</ul>

      {me && (
        <>
          <h2 className="section-label row" style={{ gap: 8 }}>
            <Avatar name={me.profile.display_name} color={me.profile.color} size={22} />
            {t("personalBadges", { name: me.profile.display_name })}
          </h2>
          <ul className="badge-grid">
            {[...personal]
              .sort((a, b) => Number(!!find(b.key, userId)) - Number(!!find(a.key, userId)))
              .map((d) => tile(d, find(d.key, userId), true))}
          </ul>
        </>
      )}

      {others.map((m) => {
        const theirs = personal.filter((d) => find(d.key, m.user_id));
        return (
          <section key={m.user_id}>
            <h2 className="section-label row" style={{ gap: 8 }}>
              <Avatar name={m.profile.display_name} color={m.profile.color} size={22} />
              {t("personalBadges", { name: m.profile.display_name })}
            </h2>
            {theirs.length ? (
              <ul className="badge-grid">{theirs.map((d) => tile(d, find(d.key, m.user_id), false))}</ul>
            ) : (
              <p className="small muted" style={{ margin: "0 2px" }}>—</p>
            )}
          </section>
        );
      })}
    </>
  );
}
