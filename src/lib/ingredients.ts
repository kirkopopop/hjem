import type { Locale } from "./i18n";
import type { Ingredient, Meal, Unit } from "./types";
import { normaliseItem } from "./grocery";

export const UNITS: Unit[] = ["pcs", "g", "kg", "ml", "l", "tbsp", "tsp", "pack", "can", "bunch", "clove", ""];

// Words people type for units, in English, Russian and Danish.
const UNIT_ALIASES: Record<string, Unit> = {
  pc: "pcs", pcs: "pcs", piece: "pcs", pieces: "pcs", x: "pcs", "шт": "pcs", "шт.": "pcs", stk: "pcs", "stk.": "pcs",
  g: "g", gr: "g", gram: "g", grams: "g", "г": "g", "гр": "g",
  kg: "kg", "кг": "kg",
  ml: "ml", "мл": "ml",
  l: "l", "л": "l", liter: "l", litre: "l",
  tbsp: "tbsp", spsk: "tbsp", "ст.л.": "tbsp", "ст.л": "tbsp",
  tsp: "tsp", tsk: "tsp", "ч.л.": "tsp", "ч.л": "tsp",
  pack: "pack", "уп": "pack", "уп.": "pack", pk: "pack",
  can: "can", tin: "can", "банка": "can", ds: "can",
  bunch: "bunch", "пучок": "bunch", bundt: "bunch",
  clove: "clove", cloves: "clove", "зубчик": "clove", "зубчика": "clove", fed: "clove",
};

/** "3 eggs", "200 g flour", "3 x eggs", "2 шт яйца" → structured ingredient. */
export function parseIngredient(line: string): Ingredient {
  const text = line.trim().replace(/\s+/g, " ");
  const m = text.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*([^\s\d]+\.?)?\s+(.+)$/u);
  if (!m) {
    const tail = text.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([^\s\d]+)?$/u); // "eggs 3", "flour 200 g"
    if (tail) {
      const u = tail[3] ? UNIT_ALIASES[tail[3].toLowerCase()] : "pcs";
      if (u !== undefined) return { name: cap(tail[1]), qty: toNum(tail[2]), unit: u };
    }
    return { name: cap(text), qty: null, unit: "" };
  }
  const qty = toNum(m[1]);
  const maybeUnit = m[2]?.toLowerCase();
  if (maybeUnit && UNIT_ALIASES[maybeUnit] !== undefined) return { name: cap(m[3]), qty, unit: UNIT_ALIASES[maybeUnit] };
  const name = maybeUnit ? `${m[2]} ${m[3]}` : m[3];
  return { name: cap(name), qty, unit: "pcs" };
}

function toNum(s: string) {
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    return b ? a / b : null;
  }
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function cleanIngredients(list: Ingredient[]): Ingredient[] {
  return list
    .map((i) => ({ name: i.name.trim(), qty: i.qty != null && Number.isFinite(i.qty) && i.qty > 0 ? i.qty : null, unit: i.unit ?? "" }))
    .filter((i) => i.name)
    .slice(0, 80);
}

/** Multiply amounts when portions change; countable units stay at sensible steps. */
export function scaleIngredients(list: Ingredient[], from: number, to: number): Ingredient[] {
  if (!from || from === to) return list;
  const f = to / from;
  return list.map((i) => {
    if (i.qty == null) return i;
    let q = i.qty * f;
    if (["pcs", "pack", "can", "bunch", "clove"].includes(i.unit)) q = Math.round(q * 2) / 2;
    else q = Math.round(q * 100) / 100;
    return { ...i, qty: q || i.qty };
  });
}

// Convert to a base unit so 500 g + 1 kg add up.
function toBase(qty: number | null, unit: string): { qty: number | null; unit: string } {
  if (unit === "kg") return { qty: qty == null ? null : qty * 1000, unit: "g" };
  if (unit === "l") return { qty: qty == null ? null : qty * 1000, unit: "ml" };
  if (unit === "") return { qty, unit: qty == null ? "" : "pcs" };
  return { qty, unit };
}
function fromBase(qty: number | null, unit: string): { qty: number | null; unit: string } {
  if (qty != null && unit === "g" && qty >= 1000) return { qty: Math.round(qty) / 1000, unit: "kg" };
  if (qty != null && unit === "ml" && qty >= 1000) return { qty: Math.round(qty) / 1000, unit: "l" };
  return { qty: qty == null ? null : Math.round(qty * 100) / 100, unit };
}

export type GroceryNeed = { key: string; name: string; qty: number | null; unit: string; meals: string[] };

/** Adds up ingredients across meals: 3 eggs (Mon) + 2 eggs (Fri) = 5 eggs. */
export function aggregateIngredients(meals: Pick<Meal, "title" | "ingredients">[]): GroceryNeed[] {
  const map = new Map<string, { name: string; qty: number | null; anyQty: boolean; unit: string; meals: string[] }>();
  for (const meal of meals) {
    for (const ing of meal.ingredients ?? []) {
      const name = ing.name?.trim();
      if (!name) continue;
      const base = toBase(ing.qty, ing.unit ?? "");
      // Items without an amount join whichever entry has the same product name.
      let key = `${normaliseItem(name)}|${base.unit}`;
      if (base.qty == null) {
        const existing = [...map.keys()].find((k) => k.startsWith(`${normaliseItem(name)}|`));
        if (existing) key = existing;
      } else {
        // An earlier "Salt" without an amount folds into "1 tsp salt".
        const bare = map.get(`${normaliseItem(name)}|`);
        if (bare && !bare.anyQty && !map.has(key)) {
          map.delete(`${normaliseItem(name)}|`);
          map.set(key, { ...bare, unit: base.unit });
        }
      }
      const cur = map.get(key);
      if (!cur) {
        map.set(key, { name, qty: base.qty, anyQty: base.qty != null, unit: base.unit, meals: [meal.title] });
      } else {
        if (base.qty != null) {
          cur.qty = (cur.qty ?? 0) + base.qty;
          cur.anyQty = true;
          if (!cur.unit) cur.unit = base.unit;
        }
        if (!cur.meals.includes(meal.title)) cur.meals.push(meal.title);
      }
    }
  }
  return [...map.entries()].map(([key, v]) => {
    const out = fromBase(v.anyQty ? v.qty : null, v.unit);
    return { key, name: v.name, qty: out.qty, unit: out.qty == null ? "" : out.unit, meals: v.meals };
  });
}

/** Key used to match a grocery row to a computed need. */
export function groceryKey(name: string, qty: number | null, unit: string) {
  return `${normaliseItem(name)}|${toBase(qty, unit).unit}`;
}

export function fmtQty(qty: number | null, unit: string, locale: Locale, unitLabel: (u: string) => string) {
  if (qty == null) return "";
  const n = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(qty);
  return unit ? `${n} ${unitLabel(unit)}` : n;
}
