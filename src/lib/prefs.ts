"use client";

import { useSyncExternalStore } from "react";
import { PREFS_KEY as KEY, THEME_COLORS } from "./theme";

/** Per-device display preferences. They live in this browser only, like the wall-tablet setting. */
export type ThemePref = "system" | "light" | "dark";
export type Prefs = {
  theme: ThemePref;
  celebrations: boolean;
  haptics: boolean;
  reduceMotion: boolean;
};

const DEFAULTS: Prefs = { theme: "system", celebrations: true, haptics: true, reduceMotion: false };

let cache: Prefs | null = null;
const listeners = new Set<() => void>();

function read(): Prefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function systemDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** Puts the chosen theme and motion setting on <html> and the browser chrome. */
export function applyPrefs(p: Prefs = read()) {
  const dark = p.theme === "dark" || (p.theme === "system" && systemDark());
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
  if (p.reduceMotion) root.dataset.motion = "reduced";
  else delete root.dataset.motion;
  const color = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  cache = { ...read(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  applyPrefs(cache);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePrefs(): [Prefs, typeof setPref] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  return [prefs, setPref];
}

export function getPrefs() {
  return read();
}

/** True when animation should be kept to a minimum (system setting or in-app toggle). */
export function motionReduced() {
  if (read().reduceMotion) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** A short vibration for confirmations, where the device supports it. */
export function buzz(pattern: number | number[] = 12) {
  if (!read().haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

export const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
