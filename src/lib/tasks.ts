import type { Task, TaskPriority } from "./types";

export const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];
const RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Task order used everywhere: dated tasks first, earliest date first, and
 * within the same date the most important first. Undated tasks follow,
 * ranked by importance only. Oldest first breaks any remaining tie.
 */
export function compareTasks(a: Task, b: Task) {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  const p = RANK[a.priority ?? "medium"] - RANK[b.priority ?? "medium"];
  if (p) return p;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/**
 * Column order: tasks placed by hand (drag) keep their spot, top to bottom.
 * Anything not placed yet follows, in the automatic order above.
 */
export function compareByPosition(a: Task, b: Task) {
  const pa = a.position, pb = b.position;
  if (pa != null && pb != null && pa !== pb) return pa - pb;
  if (pa != null && pb == null) return -1;
  if (pa == null && pb != null) return 1;
  return compareTasks(a, b);
}

// ---------- Repeat rules ----------

export type RepeatUnit = "d" | "w" | "m" | "y";
export type RepeatRule = { n: number; unit: RepeatUnit };

const LEGACY: Record<string, RepeatRule> = { daily: { n: 1, unit: "d" }, weekly: { n: 1, unit: "w" }, monthly: { n: 1, unit: "m" } };

/** Parses "weekly" / "2w" / "6m" into {n, unit}. */
export function parseRepeat(r: string | null | undefined): RepeatRule | null {
  if (!r) return null;
  if (LEGACY[r]) return LEGACY[r];
  const m = /^([1-9]\d{0,2})([dwmy])$/.exec(r);
  return m ? { n: Number(m[1]), unit: m[2] as RepeatUnit } : null;
}

/** Stores a rule in the compact form; 1 day/week/month keep their legacy names. */
export function formatRepeat(rule: RepeatRule): string {
  if (rule.n === 1 && rule.unit === "d") return "daily";
  if (rule.n === 1 && rule.unit === "w") return "weekly";
  if (rule.n === 1 && rule.unit === "m") return "monthly";
  return `${rule.n}${rule.unit}`;
}

const UNIT_WORD: Record<RepeatUnit, [string, string]> = { d: ["day", "days"], w: ["week", "weeks"], m: ["month", "months"], y: ["year", "years"] };

/** "Every week", "Every 2 weeks", "Every 6 months". */
export function repeatLabel(r: string | null | undefined): string {
  const rule = parseRepeat(r);
  if (!rule) return "";
  const [one, many] = UNIT_WORD[rule.unit];
  return rule.n === 1 ? `Every ${one}` : `Every ${rule.n} ${many}`;
}

/** Quick picks shown in the Repeats menu (anything else is "Custom"). */
export const REPEAT_PRESETS = ["daily", "weekly", "2w", "monthly", "3m", "6m", "1y"] as const;
