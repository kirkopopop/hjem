"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { MealSheet } from "@/components/MealSheet";
import { RecipeSheet } from "@/components/RecipeSheet";
import { daysFromToday, formatDayMonth, formatWeekday, isoWeekNumber, localISODate, weekDates } from "@/lib/dates";
import { CATEGORY_ORDER, guessCategory } from "@/lib/grocery";
import { aggregateIngredients, fmtQty, groceryKey, parseIngredient } from "@/lib/ingredients";
import type { Key } from "@/lib/i18n";
import type { GroceryCategory, GroceryItem, Meal, MealSlot, Recipe } from "@/lib/types";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
type View = "plan" | "groceries" | "recipes";
type Editing = { meal: Meal | null; date: string; slot: MealSlot; recipe?: Recipe | null };

export default function MealsPage() {
  const { t, locale, userId, household, member, notify } = useApp();
  const [view, setView] = useState<View>("plan");
  const [offset, setOffset] = useState(0);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [recipeEditing, setRecipeEditing] = useState<Recipe | "new" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const hid = household?.id;
  const days = useMemo(() => weekDates(offset), [offset]);

  const loadMeals = useCallback(async () => {
    if (!hid) return;
    const { data } = await supabase().from("meals").select("*").eq("household_id", hid).gte("date", days[0]).lte("date", days[6]);
    setMeals((data ?? []) as Meal[]);
  }, [hid, days]);

  const loadItems = useCallback(async () => {
    if (!hid) return;
    const { data } = await supabase().from("grocery_items").select("*").eq("household_id", hid).eq("archived", false).order("created_at");
    setItems((data ?? []) as GroceryItem[]);
  }, [hid]);

  const loadRecipes = useCallback(async () => {
    if (!hid) return;
    const { data } = await supabase().from("recipes").select("*").eq("household_id", hid).order("title");
    setRecipes((data ?? []) as Recipe[]);
  }, [hid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    loadMeals();
  }, [loadMeals]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    loadItems();
    loadRecipes();
  }, [loadItems, loadRecipes]);

  useEffect(() => {
    if (!hid) return;
    const sb = supabase();
    const filter = `household_id=eq.${hid}`;
    const ch = sb
      .channel(`meals-${hid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meals", filter }, () => loadMeals())
      .on("postgres_changes", { event: "*", schema: "public", table: "grocery_items", filter }, () => loadItems())
      .on("postgres_changes", { event: "*", schema: "public", table: "recipes", filter }, () => loadRecipes())
      .subscribe();
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        loadMeals();
        loadItems();
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      sb.removeChannel(ch);
    };
  }, [hid, loadMeals, loadItems, loadRecipes]);

  const mealAt = (date: string, slot: MealSlot) => meals.find((m) => m.date === date && m.slot === slot);
  const openCount = items.filter((i) => !i.checked).length;

  async function toggleCooked(meal: Meal) {
    setMeals((prev) => prev.map((m) => (m.id === meal.id ? { ...m, cooked: !m.cooked } : m)));
    const { error } = await supabase().from("meals").update({ cooked: !meal.cooked }).eq("id", meal.id);
    if (error) {
      notify(t("somethingWrong", { msg: error.message }));
      loadMeals();
    }
  }

  /**
   * Makes the grocery list match the week's plan: same products are added up
   * (3 eggs + 2 eggs = 5 eggs), changed amounts are updated, and items no longer
   * needed are removed unless already ticked off. Items you added by hand stay.
   */
  async function updateGroceries() {
    if (!hid || !userId) return;
    setSyncing(true);
    const week = days[0];
    const today = localISODate();
    const needs = aggregateIngredients(meals.filter((m) => !m.cooked && m.date >= today));
    const existing = new Map(
      items.filter((i) => i.from_plan && i.plan_week === week).map((i) => [groceryKey(i.name, i.qty, i.unit), i] as const),
    );
    const sb = supabase();
    let added = 0;
    let changed = 0;
    let removed = 0;
    const inserts: Partial<GroceryItem>[] = [];
    for (const n of needs) {
      const note = n.meals.join(", ").slice(0, 300);
      const ex = existing.get(n.key);
      if (ex) {
        existing.delete(n.key);
        if (ex.qty !== n.qty || ex.unit !== n.unit || ex.note !== note) {
          await sb.from("grocery_items").update({ qty: n.qty, unit: n.unit, note }).eq("id", ex.id);
          changed++;
        }
      } else {
        inserts.push({
          household_id: hid,
          name: n.name,
          qty: n.qty,
          unit: n.unit,
          note,
          category: guessCategory(n.name),
          from_plan: true,
          plan_week: week,
          created_by: userId,
        });
      }
    }
    if (inserts.length) {
      const { error } = await sb.from("grocery_items").insert(inserts);
      if (error) notify(t("somethingWrong", { msg: error.message }));
      else added = inserts.length;
    }
    const stale = [...existing.values()].filter((i) => !i.checked).map((i) => i.id);
    if (stale.length) {
      await sb.from("grocery_items").delete().in("id", stale);
      removed = stale.length;
    }
    await loadItems();
    setSyncing(false);
    notify(added || changed || removed ? t("groceriesUpdated", { added, changed, removed }) : t("groceriesUpToDate"), 3200);
  }

  function freeSlot(date: string): MealSlot {
    return (["dinner", "lunch", "breakfast"] as MealSlot[]).find((s) => !mealAt(date, s)) ?? "dinner";
  }

  function renderMeal(m: Meal) {
    const cook = member(m.cook_id);
    const past = daysFromToday(m.date) <= 0;
    return (
      <div key={m.id} className={`meal-row${m.slot === "dinner" ? " is-dinner" : ""}`}>
        {past && (
          <button
            type="button"
            className={`check small${m.cooked ? " on" : ""}`}
            aria-label={t("markCooked", { title: m.title })}
            aria-pressed={m.cooked}
            onClick={() => toggleCooked(m)}
          >
            {m.cooked && <Icon name="check" size={14} stroke={2.8} />}
          </button>
        )}
        <button type="button" className="meal-main" onClick={() => setEditing({ meal: m, date: m.date, slot: m.slot })}>
          <span className="meal-slot">{t(m.slot)}</span>
          <span className="meal-title">{m.title}</span>
          <span className="meal-portions">{t("portionsShort", { n: m.portions })}</span>
        </button>
        {cook && <Avatar name={cook.profile.display_name} color={cook.profile.color} size={26} />}
      </div>
    );
  }

  const label = (c: GroceryCategory) => t(`category_${c}` as Key);
  const unitLabel = (u: string) => t(`unit_${u}` as Key);

  return (
    <div className="meals-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            {view === "recipes"
              ? `${t("recipes")} · ${recipes.length}`
              : `${offset === 0 ? t("thisWeek") : t("weekLabel", { n: isoWeekNumber(days[0]) })} · ${formatDayMonth(days[0], locale)} – ${formatDayMonth(days[6], locale)}`}
          </span>
          <h1 className="page-title">{t("meals")}</h1>
        </div>
        {view !== "recipes" && (
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="icon-btn round" aria-label={t("prevWeek")} onClick={() => setOffset((o) => o - 1)}>
              <Icon name="chevronLeft" size={18} stroke={2.2} />
            </button>
            <button type="button" className="icon-btn round" aria-label={t("nextWeek")} onClick={() => setOffset((o) => o + 1)}>
              <Icon name="chevronRight" size={18} stroke={2.2} />
            </button>
          </div>
        )}
      </div>

      <div className="segmented" role="tablist" style={{ marginBottom: 14 }}>
        <button type="button" role="tab" aria-selected={view === "plan"} onClick={() => setView("plan")}>
          {t("plan")}
        </button>
        <button type="button" role="tab" aria-selected={view === "groceries"} onClick={() => setView("groceries")}>
          {t("groceries")}
          {openCount > 0 ? ` · ${openCount}` : ""}
        </button>
        <button type="button" role="tab" aria-selected={view === "recipes"} onClick={() => setView("recipes")}>
          {t("recipes")}
        </button>
      </div>

      {view === "plan" && (
        <>
          <ul className="plan-grid">
            {days.map((date) => {
              const today = daysFromToday(date) === 0;
              const dayMeals = SLOTS.map((s) => mealAt(date, s)).filter(Boolean) as Meal[];
              return (
                <li key={date} className={`day-card${today ? " is-today" : ""}`}>
                  <div className="day-head">
                    <span className="day-name">{formatWeekday(date, locale)}</span>
                    <span className="day-date">{today ? t("today") : formatDayMonth(date, locale)}</span>
                  </div>
                  {dayMeals.map(renderMeal)}
                  {dayMeals.length < 3 && (
                    <button type="button" className="plan-empty" onClick={() => setEditing({ meal: null, date, slot: freeSlot(date) })}>
                      + {t("planMeals")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn soft block" style={{ marginTop: 14 }} onClick={updateGroceries} disabled={syncing}>
            <Icon name="cart" size={18} />
            {syncing ? t("working") : t("updateGroceries")}
          </button>
        </>
      )}

      {view === "groceries" && (
        <>
          <Groceries items={items} reload={loadItems} label={label} unitLabel={unitLabel} />
          <button type="button" className="btn soft block" style={{ marginTop: 14 }} onClick={updateGroceries} disabled={syncing}>
            <Icon name="repeat" size={18} />
            {syncing ? t("working") : t("updateGroceries")}
          </button>
        </>
      )}

      {view === "recipes" && <Recipes recipes={recipes} onOpen={setRecipeEditing} unitLabel={unitLabel} />}

      {editing && (
        <MealSheet
          meal={editing.meal}
          date={editing.date}
          slot={editing.slot}
          recipe={editing.recipe}
          onClose={() => {
            setEditing(null);
            loadMeals();
          }}
        />
      )}

      {recipeEditing && (
        <RecipeSheet
          recipe={recipeEditing === "new" ? null : recipeEditing}
          onClose={() => {
            setRecipeEditing(null);
            loadRecipes();
          }}
          onPlan={(r) => {
            setRecipeEditing(null);
            const date = days.includes(localISODate()) ? localISODate() : days[0];
            setView("plan");
            setEditing({ meal: null, date, slot: freeSlot(date), recipe: r });
          }}
        />
      )}
    </div>
  );
}

function Recipes({
  recipes,
  onOpen,
  unitLabel,
}: {
  recipes: Recipe[];
  onOpen: (r: Recipe | "new") => void;
  unitLabel: (u: string) => string;
}) {
  const { t, locale } = useApp();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = q
    ? recipes.filter((r) => r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)))
    : recipes;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchRecipes")} aria-label={t("searchRecipes")} />
        <button type="button" className="btn" onClick={() => onOpen("new")}>
          <Icon name="plus" size={18} stroke={2.2} />
          {t("newRecipe")}
        </button>
      </div>
      {recipes.length === 0 && <p className="empty">{t("noRecipes")}</p>}
      {recipes.length > 0 && list.length === 0 && <p className="empty">{t("noRecipeMatch")}</p>}
      <ul className="recipe-grid">
        {list.map((r) => (
          <li key={r.id}>
            <button type="button" className="recipe-card" onClick={() => onOpen(r)}>
              <span className="recipe-title">{r.title}</span>
              <span className="small muted">
                {t("portionsShort", { n: r.servings })} · {t("ingredientsCount", { n: r.ingredients.length })}
              </span>
              {r.ingredients.length > 0 && (
                <span className="recipe-ings">
                  {r.ingredients
                    .slice(0, 5)
                    .map((i) => [fmtQty(i.qty, i.unit, locale, unitLabel), i.name].filter(Boolean).join(" "))
                    .join(" · ")}
                  {r.ingredients.length > 5 ? " …" : ""}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Groceries({
  items,
  reload,
  label,
  unitLabel,
}: {
  items: GroceryItem[];
  reload: () => Promise<void>;
  label: (c: GroceryCategory) => string;
  unitLabel: (u: string) => string;
}) {
  const { t, locale, userId, household, notify } = useApp();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<GroceryCategory | null>(null);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const parsed = useMemo(() => parseIngredient(name), [name]);
  const category = picked ?? guessCategory(parsed.name || name);

  const isChecked = (i: GroceryItem) => local[i.id] ?? i.checked;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId || !name.trim()) return;
    // "6 eggs" or "1 kg potatoes" becomes product + amount.
    const { error } = await supabase()
      .from("grocery_items")
      .insert({ household_id: household.id, name: parsed.name || name.trim(), qty: parsed.qty, unit: parsed.qty == null ? "" : parsed.unit, category, created_by: userId });
    if (error) notify(t("somethingWrong", { msg: error.message }));
    setName("");
    setPicked(null);
    reload();
  }

  async function toggle(i: GroceryItem) {
    const next = !isChecked(i);
    setLocal((s) => ({ ...s, [i.id]: next }));
    const { error } = await supabase().from("grocery_items").update({ checked: next }).eq("id", i.id);
    if (error) notify(t("somethingWrong", { msg: error.message }));
    await reload();
    setLocal((s) => {
      const copy = { ...s };
      delete copy[i.id];
      return copy;
    });
  }

  async function removeItem(i: GroceryItem) {
    await supabase().from("grocery_items").delete().eq("id", i.id);
    reload();
  }

  async function clearChecked() {
    if (!household) return;
    await supabase().from("grocery_items").update({ archived: true }).eq("household_id", household.id).eq("checked", true).eq("archived", false);
    setLocal({});
    reload();
  }

  const groups = CATEGORY_ORDER.map((c) => ({
    c,
    list: items
      .filter((i) => i.category === c)
      .sort((a, b) => Number(isChecked(a)) - Number(isChecked(b)) || a.name.localeCompare(b.name)),
  })).filter((g) => g.list.length);
  const anyChecked = items.some(isChecked);

  return (
    <>
      <form className="card stack" onSubmit={add} style={{ padding: 14 }}>
        <div className="row">
          <input
            className="input grow"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("addItem")}
            aria-label={t("addItem")}
            maxLength={120}
          />
          <button type="submit" className="btn" disabled={!name.trim()} aria-label={t("add")}>
            <Icon name="plus" size={20} stroke={2.2} />
          </button>
        </div>
        {name.trim() && (
          <div className="row small" style={{ gap: 8, flexWrap: "wrap" }}>
            {parsed.qty != null && (
              <span className="chip">
                {fmtQty(parsed.qty, parsed.unit, locale, unitLabel)} · {parsed.name}
              </span>
            )}
            <label className="row" style={{ gap: 8 }}>
              <span className="muted">{t("category")}</span>
              <select className="select" style={{ minHeight: 38, width: "auto" }} value={category} onChange={(e) => setPicked(e.target.value as GroceryCategory)}>
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {label(c)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </form>

      {groups.length === 0 && <p className="empty">{t("emptyGroceries")}</p>}

      {groups.map((g) => (
        <section key={g.c}>
          <h2 className="section-label">{label(g.c)}</h2>
          <ul className="card grocery-list">
            {g.list.map((i) => {
              const done = isChecked(i);
              const amount = fmtQty(i.qty, i.unit, locale, unitLabel);
              return (
                <li key={i.id} className={`grocery${done ? " is-done" : ""}`}>
                  <label className="grocery-label">
                    <input type="checkbox" checked={done} onChange={() => toggle(i)} />
                    <span className="grow">
                      <span className="grocery-name">
                        {i.name}
                        {amount && <span className="grocery-qty"> · {amount}</span>}
                      </span>
                      {i.note && <span className="grocery-from">{i.note}</span>}
                    </span>
                  </label>
                  <button type="button" className="icon-btn small" aria-label={t("removeItem", { name: i.name })} onClick={() => removeItem(i)}>
                    <Icon name="close" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {anyChecked && (
        <button type="button" className="btn secondary block" style={{ marginTop: 16 }} onClick={clearChecked}>
          {t("clearChecked")}
        </button>
      )}
    </>
  );
}
