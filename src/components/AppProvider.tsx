"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { translate, type Key, type Locale } from "@/lib/i18n";
import { badgeDesc, badgeName } from "@/lib/badges";
import { applyPrefs, buzz, getPrefs, motionReduced } from "@/lib/prefs";
import { Icon } from "./Icon";
import { BadgePop, Confetti, makeBurst, type BadgeNews, type Burst } from "./Celebrate";

export type Profile = { id: string; display_name: string; color: string; locale: Locale };
export type Member = { user_id: string; role: "owner" | "member" | "device"; profile: Profile };
export type Household = { id: string; name: string };

type Ctx = {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  household: Household | null;
  members: Member[];
  locale: Locale;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  updateProfile: (patch: Partial<Pick<Profile, "display_name" | "color">>) => Promise<string | null>;
  reload: () => Promise<void>;
  member: (id: string | null | undefined) => Member | undefined;
  notify: (msg: string, ms?: number) => void;
  /** Confetti from an element (or point) plus a short buzz. */
  celebrate: (from?: Element | { x: number; y: number } | null, big?: boolean) => void;
  badgeTick: number;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const locale: Locale = "en";
  const [toast, setToast] = useState<string | null>(null);
  const [badgeTick, setBadgeTick] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [badgeQueue, setBadgeQueue] = useState<BadgeNews[]>([]);
  const burstId = useRef(0);

  const notify = useCallback((msg: string, ms = 2400) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const celebrate = useCallback((from?: Element | { x: number; y: number } | null, big = false) => {
    buzz(big ? [14, 60, 22] : 14);
    if (!getPrefs().celebrations || motionReduced()) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight * 0.42;
    if (from instanceof Element) {
      const r = from.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    } else if (from) {
      x = from.x;
      y = from.y;
    }
    const id = ++burstId.current;
    setBursts((b) => [...b, makeBurst(id, x, y, big)]);
    setTimeout(() => setBursts((b) => b.filter((z) => z.id !== id)), 1600);
  }, []);

  // Theme and motion preferences: apply now, and follow the system theme when set to "System".
  useEffect(() => {
    applyPrefs();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPrefs();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Escape closes the top-most sheet; the page behind can't scroll while one is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const layers = document.querySelectorAll<HTMLElement>(".sheet-backdrop, .badge-pop-backdrop");
      layers[layers.length - 1]?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const reload = useCallback(async () => {
    const sb = supabase();
    const { data: userData } = await sb.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setProfile(null);
      setHousehold(null);
      setMembers([]);
      setReady(true);
      return;
    }
    const { data: me } = await sb.from("profiles").select("id, display_name, color, locale").eq("id", uid).maybeSingle();
    if (me) {
      setProfile(me as Profile);
    }
    const { data: membership } = await sb
      .from("household_members")
      .select("household_id")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();
    if (!membership) {
      setHousehold(null);
      setMembers([]);
      setReady(true);
      return;
    }
    const hid = membership.household_id as string;
    const [{ data: hh }, { data: rows }] = await Promise.all([
      sb.from("households").select("id, name").eq("id", hid).single(),
      sb.from("household_members").select("user_id, role").eq("household_id", hid).order("joined_at"),
    ]);
    const ids = (rows ?? []).map((r: { user_id: string }) => r.user_id);
    const { data: profs } = ids.length
      ? await sb.from("profiles").select("id, display_name, color, locale").in("id", ids)
      : { data: [] };
    const byId = new Map((profs ?? []).map((p: Profile) => [p.id, p]));
    setHousehold(hh as Household);
    setMembers(
      (rows ?? []).map((r: { user_id: string; role: Member["role"] }) => ({
        user_id: r.user_id,
        role: r.role,
        profile: byId.get(r.user_id) ?? { id: r.user_id, display_name: "?", color: "#8A9693", locale: "en" },
      })),
    );
    setReady(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    reload();
    const { data: sub } = supabase().auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") reload();
    });
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  // When someone joins or leaves the household, refresh the member list.
  useEffect(() => {
    if (!household) return;
    const ch = supabase()
      .channel(`members-${household.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${household.id}` },
        () => reload(),
      )
      .subscribe();
    return () => {
      supabase().removeChannel(ch);
    };
  }, [household, reload]);

  // Celebrate new badges on every device in the household.
  const membersRef = useRef<Member[]>([]);
  const localeRef = useRef<Locale>("en");
  useEffect(() => {
    membersRef.current = members;
    localeRef.current = locale;
  }, [members, locale]);
  useEffect(() => {
    if (!household || !userId) return;
    const ch = supabase()
      .channel(`badges-${household.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "badges", filter: `household_id=eq.${household.id}` },
        (payload: { new: { user_id: string | null; badge_key: string } }) => {
          const { user_id, badge_key } = payload.new;
          const l = localeRef.current;
          const name = translate(l, badgeName(badge_key));
          if (user_id === null || user_id === userId) {
            setBadgeQueue((q) => [
              ...q,
              {
                id: Date.now() + Math.random(),
                key: badge_key,
                title: translate(l, user_id === null ? "badgeUnlockedTogether" : "badgeUnlocked"),
                name,
                desc: translate(l, badgeDesc(badge_key)),
                button: translate(l, "lovely"),
              },
            ]);
          } else {
            const who = membersRef.current.find((m) => m.user_id === user_id)?.profile.display_name ?? "";
            notify(translate(l, "partnerBadge", { who, name }), 4200);
          }
          setBadgeTick((n) => n + 1);
        },
      )
      .subscribe();
    return () => {
      supabase().removeChannel(ch);
    };
  }, [household, userId, notify]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, "display_name" | "color">>) => {
      if (!userId) return "not signed in";
      const { error } = await supabase().from("profiles").update(patch).eq("id", userId);
      if (error) return error.message;
      await reload();
      return null;
    },
    [userId, reload],
  );

  const value = useMemo<Ctx>(
    () => ({
      ready,
      userId,
      profile,
      household,
      members,
      locale,
      t: (key, vars) => translate(locale, key, vars),
      updateProfile,
      reload,
      member: (id) => members.find((m) => m.user_id === id),
      notify,
      celebrate,
      badgeTick,
    }),
    [ready, userId, profile, household, members, locale, updateProfile, reload, notify, celebrate, badgeTick],
  );

  const dismissBadge = useCallback(() => setBadgeQueue((q) => q.slice(1)), []);
  const shownBadge = badgeQueue[0]?.id;
  useEffect(() => {
    if (shownBadge) celebrate(null, true);
  }, [shownBadge, celebrate]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <AppContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status" key={toast}>
          <span className="toast-ico">
            <Icon name="sparkle" size={16} stroke={2} />
          </span>
          {toast}
        </div>
      )}
      <Confetti bursts={bursts} />
      {badgeQueue[0] && (
        <BadgePop
          key={badgeQueue[0].id}
          news={badgeQueue[0]}
          onClose={dismissBadge}
        />
      )}
    </AppContext.Provider>
  );
}
