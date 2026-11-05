"use client";

import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { getVersion, init, onChange, setMembers, state } from "./store";

/** Starts the baby store for this household (once) and re-renders when its data changes. */
export function useBaby() {
  const { userId, household, members, member } = useApp();
  const role = member(userId)?.role ?? null;
  useEffect(() => {
    if (!userId || !household) return;
    init({
      client: supabase(),
      userId,
      householdId: household.id,
      role,
      members: members.map((m) => ({ id: m.user_id, name: m.profile.display_name, color: m.profile.color, role: m.role })),
    });
    setMembers(members.map((m) => ({ id: m.user_id, name: m.profile.display_name, color: m.profile.color, role: m.role })));
  }, [userId, household, members, role]);
  useSyncExternalStore(onChange, getVersion, () => 0);
  return state;
}
