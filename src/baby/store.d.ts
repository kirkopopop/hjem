export type BabyRow = { id: string; household_id: string; name: string; birth_date: string; sex: "m" | "f"; settings: Record<string, unknown>; updated_at: string };
export type BabyEvent = {
  id: string; kind: string; subtype: string | null; started_at: string; ended_at: string | null;
  amount: number | null; unit: string | null; foods: string[]; note: string | null; detail: Record<string, unknown>;
  source: "app" | "mybaby"; created_by: string | null; _s: Date; _e: Date | null;
};
export const state: {
  user: { id: string } | null; household: string | null; baby: BabyRow | null;
  members: Record<string, { name: string; color: string; role?: string }>;
  version: number; status: string; loaded: boolean; error: string | null; outbox: unknown[];
};
export function init(opts: { client: unknown; userId: string; householdId: string; role?: string | null; members: { id: string; name: string; color: string; role?: string }[] }): void;
export function setMembers(list: { id: string; name: string; color: string; role?: string }[]): void;
export function onChange(fn: () => void): () => void;
export function getVersion(): number;
export function events(): BabyEvent[];
export function addEvent(fields: Partial<BabyEvent>): BabyEvent;
export function updateEvent(id: string, patch: Partial<BabyEvent>): BabyEvent | undefined;
export function deleteEvent(id: string): BabyEvent | undefined;
