import type { Purchase, PurchaseCategory, PurchaseFileKind, WishItem } from "./types";
import { daysFromToday, localISODate } from "./dates";

export const CATEGORIES: { key: PurchaseCategory; icon: string }[] = [
  { key: "electronics", icon: "monitor" },
  { key: "appliance", icon: "plug" },
  { key: "kitchen", icon: "pan" },
  { key: "furniture", icon: "sofa" },
  { key: "baby", icon: "baby" },
  { key: "sports", icon: "bike" },
  { key: "tools", icon: "wrench" },
  { key: "clothing", icon: "shirt" },
  { key: "vehicle", icon: "car" },
  { key: "other", icon: "box" },
];

export const categoryIcon = (c: PurchaseCategory) => CATEGORIES.find((x) => x.key === c)?.icon ?? "box";

export const CURRENCIES = ["DKK", "EUR", "SEK", "NOK", "GBP", "USD"] as const;

export const FILE_KINDS: PurchaseFileKind[] = ["receipt", "manual", "photo", "other"];

/** Warranty quick picks, in months from the purchase date. 24 = the EU/Danish 2-year complaint right. */
export const WARRANTY_PRESETS = [12, 24, 36, 60] as const;

/** "1,499 kr", "€89.50", "£12". */
export function formatMoney(n: number | null | undefined, currency = "DKK") {
  if (n == null || !Number.isFinite(n)) return "";
  const whole = Math.abs(n % 1) < 0.005;
  const digits = { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 };
  if (currency === "DKK" || currency === "SEK" || currency === "NOK") {
    return `${new Intl.NumberFormat("en-GB", digits).format(n)} kr`;
  }
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, ...digits }).format(n);
  } catch {
    return `${new Intl.NumberFormat("en-GB", digits).format(n)} ${currency}`;
  }
}

/** Parses "1.499,50", "1,499.50", "1499" or "1 499 kr" into a number. */
export function parseMoney(s: string): number | null {
  const raw = s.replace(/[^\d.,-]/g, "");
  if (!raw) return null;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let norm = raw;
  if (lastComma > lastDot) {
    // Comma is the decimal mark if it has 1-2 digits after it ("49,95"), else a thousands mark ("1,499").
    const decimals = raw.length - lastComma - 1;
    norm = decimals <= 2 ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (lastDot > lastComma) {
    const decimals = raw.length - lastDot - 1;
    norm = decimals <= 2 ? raw.replace(/,/g, "") : raw.replace(/[.,]/g, "");
  }
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return localISODate(target);
}

/** Whole months from `from` to `to` (both YYYY-MM-DD), if that's an exact preset; else null. */
export function monthsBetween(from: string, to: string) {
  for (const n of WARRANTY_PRESETS) if (addMonthsISO(from, n) === to) return n;
  return null;
}

export function formatMonthYear(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function formatLongDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}

export type WarrantyState = "none" | "ok" | "soon" | "expired";

/** Warranties ending within this many days count as "ending soon". */
export const SOON_DAYS = 90;

export function warrantyState(p: Pick<Purchase, "warranty_until">): { state: WarrantyState; days: number } {
  if (!p.warranty_until) return { state: "none", days: 0 };
  const days = daysFromToday(p.warranty_until);
  if (days < 0) return { state: "expired", days };
  if (days <= SOON_DAYS) return { state: "soon", days };
  return { state: "ok", days };
}

/** "2y 3m left", "8m left", "45 days left". */
export function timeLeft(days: number) {
  if (days < 60) return `${days} ${days === 1 ? "day" : "days"} left`;
  const months = Math.floor(days / 30.44);
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return `${m}m left`;
  return m ? `${y}y ${m}m left` : `${y}y left`;
}

/** Makes "ikea.com/manual" a usable link; refuses anything that isn't http(s). */
export function normalizeUrl(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Wishlist order: most wanted first, then cheapest-known, then oldest. */
export function compareWishes(a: WishItem, b: WishItem) {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const p = rank[a.priority] - rank[b.priority];
  if (p) return p;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const FILE_BUCKET = "purchase-files";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Storage path for an uploaded file: "<household>/<purchase>/<time>-<safe name>". */
export function filePath(householdId: string, purchaseId: string, name: string) {
  const safe = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return `${householdId}/${purchaseId}/${Date.now()}-${safe || "file"}`;
}
