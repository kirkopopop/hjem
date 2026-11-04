"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { guessLocale, rememberLocale, translate, type Key, type Locale } from "@/lib/i18n";

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
  setLocale: (l: Locale) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "display_name" | "color">>) => Promise<string | null>;
  reload: () => Promise<void>;
  member: (id: string | null | undefined) => Member | undefined;
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
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    setLocaleState(guessLocale());
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
      setLocaleState(me.locale as Locale);
      rememberLocale(me.locale as Locale);
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

  const setLocale = useCallback(
    async (l: Locale) => {
      setLocaleState(l);
      rememberLocale(l);
      if (userId) await supabase().from("profiles").update({ locale: l }).eq("id", userId);
    },
    [userId],
  );

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
      setLocale,
      updateProfile,
      reload,
      member: (id) => members.find((m) => m.user_id === id),
    }),
    [ready, userId, profile, household, members, locale, setLocale, updateProfile, reload],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
