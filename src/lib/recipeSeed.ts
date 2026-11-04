"use client";

import { supabase } from "./supabase/client";
import plates from "@/data/todaysPlates.json";

/**
 * Adds the Today's Plates recipe library to a household. Safe to run twice:
 * recipes already there (matched by source_key) are left as they are.
 */
export async function seedPlatesRecipes(householdId: string, userId: string) {
  const sb = supabase();
  const rows = plates.map((r) => ({ ...r, household_id: householdId, created_by: userId }));
  const { error } = await sb.from("recipes").upsert(rows, { onConflict: "household_id,source_key", ignoreDuplicates: true });
  if (error) return { ok: false as const, error: error.message };
  await sb.from("households").update({ recipes_seeded_at: new Date().toISOString() }).eq("id", householdId);
  return { ok: true as const, count: rows.length };
}

/** Runs the import once per household, the first time someone opens Meals. */
export async function seedPlatesOnce(householdId: string, userId: string) {
  const { data } = await supabase().from("households").select("recipes_seeded_at").eq("id", householdId).single();
  if (!data || data.recipes_seeded_at) return null;
  return seedPlatesRecipes(householdId, userId);
}
