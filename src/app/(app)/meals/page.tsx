"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { MealSheet } from "@/components/MealSheet";
import { daysFromToday, formatDayMonth, formatWeekday, isoWeekNumber, weekDates } from "@/lib/dates";
import { CATEGORY_ORDER, guessCategory, normaliseItem } from "@/lib/grocery";
import type { Key } from "@/lib/i18n";
import type { GroceryCategory, GroceryItem, Meal, MealSlot } from "@/lib/types";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export default function MealsPage() {
  const { t, locale, userId, household, member, notify } = useApp();
  const [view, setView] = useState<"plan" | "groceries">("plan");
  const [offset, setOffset] = useState(0);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [editing, setEditing] = useState<{ meal: Meal | null; date: string; slot: MealSlot } | null>(null);
  const hid = household?.id;
  const days = useMemo(() => weekDates(offset), [offset]);

  const loadMeals = useCallback(async () => {
    if (!hid) return;
    const { data } = await supabase()
      .from("meals")
      .select("*")
      .eq("household_id", hid)
      .gte("date", days[0])
      .lte("date", days[6]);
    setMeals((data ?? []) as Meal[]);
  }, [hid, days]);

  const loadItems = useCallback(async () => {
    if (!hid) return;
    const { data } = await supabase()
      .from("grocery_items")
      .select("*")
      .eq("household_id", hid)
      .eq("archived", false)
      .order("created_at");
    setItems((data ?? []) as GroceryItem[]);
  }, [hid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    loadMeals();
  }, [loadMeals]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!hid) return;
    const sb = supabase();
    const ch = sb
      .channel(`meals-${hid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meals", filter: `household_id=eq.${hid}` }, () => loadMeals())
      .on("postgres_changes", { event: "*", schema: "public", table: "grocery_items", filter: `household_id=eq.${hid}` }, () => loadItems())
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
  }, [hid, loadMeals, loadItems]);

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

  async function fillFromPlan() {
    if (!hid || !userId) return;
    const have = new Set(items.map((i) => normaliseItem(i.name)));
    const rows: Partial<GroceryItem>[] = [];
    for (const m of meals) {
      if (m.cooked) continue;
      for (const ing of m.ingredients) {
        const key = normaliseItem(ing);
        if (!key || have.has(key)) continue;
        have.add(key);
        rows.push({ household_id: hid, name: ing.trim(), category: guessCategory(ing), meal_id: m.id, created_by: userId });
      }
    }
    if (!rows.length) {
      notify(t("nothingToAdd"));
      return;
    }
    const { error } = await supabase().from("grocery_items").insert(rows);
    if (error) notify(t("somethingWrong", { msg: error.message }));
    else {
      notify(t("addedItems", { n: rows.length }));
      loadItems();
    }
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
          {m.slot !== "dinner" && <span className="meal-slot">{t(m.slot)}</span>}
          <span className="meal-title">{m.title}</span>
        </button>
        {cook && <Avatar name={cook.profile.display_name} color={cook.profile.color} size={26} />}
      </div>
    );
  }

  const label = (c: GroceryCategory) => t(`category_${c}` as Key);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            {offset === 0 ? t("thisWeek") : t("weekLabel", { n: isoWeekNumber(days[0]) })} · {formatDayMonth(days[0], locale)} – {formatDayMonth(days[6], locale)}
          </span>
          <h1 className="page-title">{t("meals")}</h1>
        </div>
        {view === "plan" && (
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
      </div>

      {view === "plan" ? (
        <>
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {days.map((date) => {
              const today = daysFromToday(date) === 0;
              const dayMeals = SLOTS.map((s) => mealAt(date, s)).filter(Boolean) as Meal[];
              return (
                <li key={date} className={`day-card${today ? " is-today" : ""}`}>
                  <div className="day-head">
                    <span className="day-name">{formatWeekday(date, locale)}</span>
                    <span className="day-date">{today ? t("today") : formatDayMonth(date, locale)}</span>
                    <span className="grow" />
                    <button
                      type="button"
                      className="icon-btn small"
                      aria-label={`${t("addMeal")}: ${formatWeekday(date, locale)}`}
                      onClick={() => setEditing({ meal: null, date, slot: freeSlot(date) })}
                    >
                      <Icon name="plus" size={18} stroke={2.2} />
                    </button>
                  </div>
                  {dayMeals.map(renderMeal)}
                  {!mealAt(date, "dinner") && (
                    <button type="button" className="plan-empty" onClick={() => setEditing({ meal: null, date, slot: "dinner" })}>
                      + {t("planDinner")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn soft block" style={{ marginTop: 14 }} onClick={fillFromPlan}>
            <Icon name="cart" size={18} />
            {t("fillFromPlan")}
          </button>
        </>
      ) : (
        <Groceries items={items} meals={meals} reload={loadItems} label={label} />
      )}

      {editing && (
        <MealSheet
          meal={editing.meal}
          date={editing.date}
          slot={editing.slot}
          onClose={() => {
            setEditing(null);
            loadMeals();
          }}
        />
      )}
    </>
  );
}

function Groceries({
  items,
  meals,
  reload,
  label,
}: {
  items: GroceryItem[];
  meals: Meal[];
  reload: () => Promise<void>;
  label: (c: GroceryCategory) => string;
}) {
  const { t, userId, household, notify } = useApp();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<GroceryCategory | null>(null);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const category = picked ?? guessCategory(name);

  const isChecked = (i: GroceryItem) => local[i.id] ?? i.checked;
  const mealTitle = (id: string | null) => meals.find((m) => m.id === id)?.title;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId || !name.trim()) return;
    const { error } = await supabase()
      .from("grocery_items")
      .insert({ household_id: household.id, name: name.trim(), category, created_by: userId });
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
      .sort((a, b) => Number(isChecked(a)) - Number(isChecked(b))),
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
          <label className="row small" style={{ gap: 8 }}>
            <span className="muted">{t("category")}</span>
            <select className="select" style={{ minHeight: 38, width: "auto" }} value={category} onChange={(e) => setPicked(e.target.value as GroceryCategory)}>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          </label>
        )}
      </form>

      {groups.length === 0 && <p className="empty">{t("emptyGroceries")}</p>}

      {groups.map((g) => (
        <section key={g.c}>
          <h2 className="section-label">{label(g.c)}</h2>
          <ul className="card grocery-list">
            {g.list.map((i) => {
              const done = isChecked(i);
              const from = mealTitle(i.meal_id);
              return (
                <li key={i.id} className={`grocery${done ? " is-done" : ""}`}>
                  <label className="grocery-label">
                    <input type="checkbox" checked={done} onChange={() => toggle(i)} />
                    <span className="grow">
                      <span className="grocery-name">{i.name}</span>
                      {from && <span className="grocery-from">{from}</span>}
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
