import type { Key } from "./i18n";

export type Metric = "myDone" | "teamDone" | "myCooked" | "myPlanned" | "myTicked";

export type BadgeDef = {
  key: string;
  scope: "me" | "together";
  icon: string;
  metric?: Metric;
  target?: number;
};

// Thresholds here must match the database triggers that award badges.
export const BADGES: BadgeDef[] = [
  { key: "team_25", scope: "together", icon: "people", metric: "teamDone", target: 25 },
  { key: "team_100", scope: "together", icon: "people", metric: "teamDone", target: 100 },
  { key: "team_500", scope: "together", icon: "people", metric: "teamDone", target: 500 },
  { key: "full_week", scope: "together", icon: "calendarCheck" },
  { key: "clean_slate", scope: "together", icon: "sparkle" },

  { key: "first_task", scope: "me", icon: "flag", metric: "myDone", target: 1 },
  { key: "tasks_10", scope: "me", icon: "medal", metric: "myDone", target: 10 },
  { key: "tasks_50", scope: "me", icon: "medal", metric: "myDone", target: 50 },
  { key: "tasks_100", scope: "me", icon: "medal", metric: "myDone", target: 100 },
  { key: "streak_3", scope: "me", icon: "flame" },
  { key: "streak_7", scope: "me", icon: "flame" },
  { key: "early_bird", scope: "me", icon: "sun" },
  { key: "night_owl", scope: "me", icon: "moon" },
  { key: "claimer", scope: "me", icon: "heart" },
  { key: "first_plan", scope: "me", icon: "meals", metric: "myPlanned", target: 1 },
  { key: "chef_5", scope: "me", icon: "pan", metric: "myCooked", target: 5 },
  { key: "chef_20", scope: "me", icon: "pan", metric: "myCooked", target: 20 },
  { key: "shopper", scope: "me", icon: "cart", metric: "myTicked", target: 25 },
];

export const badgeName = (key: string) => `b_${key}` as Key;
export const badgeDesc = (key: string) => `d_${key}` as Key;
