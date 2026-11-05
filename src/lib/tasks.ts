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
