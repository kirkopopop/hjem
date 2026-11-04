"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { daysFromToday } from "@/lib/dates";
import type { Meal, MealSlot } from "@/lib/types";

type Remembered = { title: string; ingredients: string[] };

export function MealSheet({
  meal,
  date: initialDate,
  slot: initialSlot,
  onClose,
}: {
  meal: Meal | null;
  date: string;
  slot: MealSlot;
  onClose: () => void;
}) {
  const { t, userId, household, members } = useApp();
  const isNew = !meal;
  const titleId = useId();
  const listId = useId();
  const firstField = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(meal?.title ?? "");
  const [date, setDate] = useState(meal?.date ?? initialDate);
  const [slot, setSlot] = useState<MealSlot>(meal?.slot ?? initialSlot);
  const [cook, setCook] = useState(meal?.cook_id ?? "");
  const [ingredients, setIngredients] = useState((meal?.ingredients ?? []).join("\n"));
  const [notes, setNotes] = useState(meal?.notes ?? "");
  const [cooked, setCooked] = useState(meal?.cooked ?? false);
  const [remembered, setRemembered] = useState<Remembered[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Past meals become suggestions; picking one brings its ingredients along.
  useEffect(() => {
    if (!household) return;
    supabase()
      .from("meals")
      .select("title, ingredients, date")
      .eq("household_id", household.id)
      .order("date", { ascending: false })
      .limit(300)
      .then(({ data }: { data: { title: string; ingredients: string[] }[] | null }) => {
        const seen = new Map<string, Remembered>();
        for (const m of data ?? []) {
          const k = m.title.trim().toLowerCase();
          if (!seen.has(k)) seen.set(k, { title: m.title, ingredients: m.ingredients });
        }
        setRemembered([...seen.values()]);
      });
  }, [household]);

  useEffect(() => {
    if (isNew) firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNew, onClose]);

  const byTitle = useMemo(() => new Map(remembered.map((r) => [r.title.trim().toLowerCase(), r])), [remembered]);

  function onTitle(v: string) {
    setTitle(v);
    const hit = byTitle.get(v.trim().toLowerCase());
    if (hit && !ingredients.trim() && hit.ingredients.length) setIngredients(hit.ingredients.join("\n"));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setBusy(true);
    setError(null);
    const fields = {
      title: title.trim(),
      date,
      slot,
      cook_id: cook || null,
      ingredients: ingredients
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 60),
      notes: notes.trim() || null,
      cooked,
    };
    const sb = supabase();
    const { error } = isNew
      ? await sb.from("meals").insert({ ...fields, household_id: household.id, created_by: userId })
      : await sb.from("meals").update(fields).eq("id", meal!.id);
    if (error) {
      setError(error.code === "23505" ? t("slotTaken") : t("somethingWrong", { msg: error.message }));
      setBusy(false);
      return;
    }
    onClose();
  }

  async function remove() {
    if (!meal || !window.confirm(`${t("delete")}?`)) return;
    setBusy(true);
    const { error } = await supabase().from("meals").delete().eq("id", meal.id);
    if (error) {
      setError(t("somethingWrong", { msg: error.message }));
      setBusy(false);
      return;
    }
    onClose();
  }

  const canBeCooked = daysFromToday(date) <= 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="sheet-head">
          <h2 id={titleId}>{isNew ? t("newMeal") : t("editMeal")}</h2>
          <button type="button" className="icon-btn" aria-label={t("cancel")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <label className="field">
          <span>{t("mealTitle")}</span>
          <input
            ref={firstField}
            className="input"
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder={t("mealPlaceholder")}
            list={listId}
            required
            maxLength={120}
            autoComplete="off"
          />
          <datalist id={listId}>
            {remembered.map((r) => (
              <option key={r.title} value={r.title} />
            ))}
          </datalist>
        </label>

        <div className="two">
          <label className="field">
            <span>{t("day")}</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            <span>{t("meal")}</span>
            <select className="select" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              <option value="breakfast">{t("breakfast")}</option>
              <option value="lunch">{t("lunch")}</option>
              <option value="dinner">{t("dinner")}</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>{t("cook")}</span>
          <select className="select" value={cook} onChange={(e) => setCook(e.target.value)}>
            <option value="">{t("noCook")}</option>
            {members
              .filter((m) => m.role !== "device")
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile.display_name}
                </option>
              ))}
          </select>
        </label>

        <label className="field">
          <span>{t("ingredients")}</span>
          <textarea className="textarea" rows={5} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
          <small className="small muted">{t("ingredientsHint")}</small>
        </label>

        <label className="field">
          <span>{t("notes")}</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </label>

        {canBeCooked && (
          <label className="row" style={{ gap: 10, fontWeight: 700 }}>
            <input type="checkbox" checked={cooked} onChange={(e) => setCooked(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--accent)" }} />
            {t("cooked")}
          </label>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <div className="row">
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>
              {t("delete")}
            </button>
          )}
          <span className="grow" />
          <button type="submit" className="btn" disabled={busy || !title.trim()}>
            {busy ? t("working") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
