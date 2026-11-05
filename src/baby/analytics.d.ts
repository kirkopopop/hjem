import type { BabyEvent, BabyRow } from "./store";
export type Model = unknown;
export function model(evts: BabyEvent[], version: number, baby: BabyRow | null): Model;
export function current(m: Model, evts: BabyEvent[], now?: Date): {
  running?: BabyEvent; lastSleep?: BabyEvent; lastBottle: BabyEvent | null; lastSolid: BabyEvent | null;
  lastNappy: BabyEvent | null; lastVitD?: BabyEvent; vitdToday: boolean | undefined;
};
export function predictNext(m: Model, cur: ReturnType<typeof current>, now?: Date): { what: string; at: Date; windowH: number; awake: number } | null;
