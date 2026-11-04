"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { IngredientEditor, PortionStepper } from "./IngredientEditor";
import { RecipeArt, RecipeMeta } from "./RecipeBits";
import { daysFromToday } from "@/lib/dates";
import { cleanIngredients, scaleIngredients } from "@/lib/ingredients";
import type { Ingredient, Meal, MealSlot, Recipe } from "@/lib/types";

export function MealSheet({
  meal,
  date: initialDate,
  slot: initialSlot,
  recipe: initialRecipe,
  onClose,
}: {
  meal: Meal | null;
  date: string;
  slot: MealSlot;
  recipe?: Recipe | null;
  onClose: () => void;
}) {
  const { t, userId, household, members, notify } = useApp();
  const isNew = !meal;
  const titleId = useId();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mode, setMode] = useState<"recipe" | "new">(meal ? (meal.recipe_id ? "recipe" : "new") : "recipe");
  const [query, setQuery] = useState("");
  const [recipeId, setRecipeId] = useState<string | null>(meal?.recipe_id ?? initialRecipe?.id ?? null);
  const [title, setTitle] = useState(meal?.title ?? initialRecipe?.title ?? "");
  const [portions, setPortions] = useState(meal?.portions ?? initialRecipe?.servings ?? 2);
  const [ingredients, setIngredients] = useState<Ingredient[]>(meal?.ingredients ?? initialRecipe?.ingredients ?? []);
  const [date, setDate] = useState(meal?.date ?? initialDate);
  const [slot, setSlot] = useState<MealSlot>(meal?.slot ?? initialSlot);
  const [cook, setCook] = useState(meal?.cook_id ?? "");
  const [notes, setNotes] = useState(meal?.notes ?? "");
  const [cooked, setCooked] = useState(meal?.cooked ?? false);
  const [saveAsRecipe, setSaveAsRecipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!household) return;
    supabase()
      .from("recipes")
      .select("*")
      .eq("household_id", household.id)
      .order("title")
      .then(({ data }: { data: Recipe[] | null }) => {
        const list = data ?? [];
        setRecipes(list);
        if (!meal && !initialRecipe && list.length === 0) setMode("new");
      });
  }, [household, meal, initialRecipe]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chosen = recipes.find((r) => r.id === recipeId) ?? (initialRecipe?.id === recipeId ? initialRecipe : null);
  // Breakfast recipes first when planning breakfast, mains first otherwise; takeaway at the end.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const want = slot === "breakfast" ? "breakfast" : "main";
    const rank = (r: Recipe) => (r.kind !== "cook" ? 2 : r.meal_type === want ? 0 : 1);
    return (q ? recipes.filter((r) => r.title.toLowerCase().includes(q)) : recipes)
      .slice()
      .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  }, [recipes, query, slot]);

  function pickRecipe(r: Recipe) {
    setRecipeId(r.id);
    setTitle(r.title);
    setIngredients(scaleIngredients(r.ingredients, r.servings, portions));
  }

  function changePortions(n: number) {
    setIngredients((list) => scaleIngredients(list, portions, n));
    setPortions(n);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setBusy(true);
    setError(null);
    const sb = supabase();
    const cleaned = cleanIngredients(ingredients);
    let linkRecipe = mode === "recipe" ? recipeId : null;

    if (mode === "new" && saveAsRecipe) {
      const { data, error } = await sb
        .from("recipes")
        .insert({ household_id: household.id, created_by: userId, title: title.trim(), servings: portions, ingredients: cleaned })
        .select("id")
        .single();
      if (error) {
        setError(t("somethingWrong", { msg: error.message }));
        setBusy(false);
        return;
      }
      linkRecipe = data.id;
    }

    const fields = {
      title: title.trim(),
      date,
      slot,
      cook_id: cook || null,
      recipe_id: linkRecipe,
      portions,
      ingredients: cleaned,
      notes: notes.trim() || null,
      cooked,
    };
    const { error } = isNew
      ? await sb.from("meals").insert({ ...fields, household_id: household.id, created_by: userId })
      : await sb.from("meals").update(fields).eq("id", meal!.id);
    if (error) {
      setError(error.code === "23505" ? t("slotTaken") : t("somethingWrong", { msg: error.message }));
      setBusy(false);
      return;
    }
    if (saveAsRecipe) notify(t("saved"));
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
  const showDetails = mode === "new" || !!recipeId;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet wide" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="sheet-head">
          <h2 id={titleId}>{isNew ? t("newMeal") : t("editMeal")}</h2>
          <button type="button" className="icon-btn" aria-label={t("cancel")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

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

        <div className="segmented" role="group" aria-label={t("meal")}>
          <button type="button" aria-pressed={mode === "recipe"} onClick={() => setMode("recipe")}>
            {t("fromRecipes")}
          </button>
          <button
            type="button"
            aria-pressed={mode === "new"}
            onClick={() => {
              setMode("new");
              setRecipeId(null);
            }}
          >
            {t("somethingNew")}
          </button>
        </div>

        {mode === "recipe" && !recipeId && (
          <div className="stack" style={{ gap: 8 }}>
            {recipes.length === 0 ? (
              <p className="notice">{t("noRecipes")}</p>
            ) : (
              <>
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchRecipes")} aria-label={t("searchRecipes")} />
                <ul className="recipe-pick">
                  {matches.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => pickRecipe(r)}>
                        <span className="pick-thumb">
                          <RecipeArt recipe={r} />
                        </span>
                        <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <span style={{ fontWeight: 700 }}>{r.title}</span>
                          <RecipeMeta recipe={r} />
                        </span>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && <li className="small muted" style={{ padding: 10 }}>{t("noRecipeMatch")}</li>}
                </ul>
              </>
            )}
          </div>
        )}

        {mode === "recipe" && recipeId && (
          <div className="chosen-recipe">
            <span className="pick-thumb">
              <RecipeArt recipe={chosen ?? null} title={title} />
            </span>
            <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 800 }}>{chosen?.title ?? title}</span>
              {chosen && <RecipeMeta recipe={chosen} />}
            </span>
            <button type="button" className="btn small secondary" onClick={() => setRecipeId(null)}>
              {t("change")}
            </button>
          </div>
        )}

        {mode === "new" && (
          <label className="field">
            <span>{t("mealTitle")}</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("mealPlaceholder")} required maxLength={120} autoFocus={isNew} />
          </label>
        )}

        {showDetails && (
          <>
            <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field">
                <span>{t("servings")}</span>
                <PortionStepper value={portions} onChange={changePortions} />
              </div>
              <label className="field grow" style={{ minWidth: 160 }}>
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
            </div>

            <div className="field">
              <span>{t("ingredients")}</span>
              <IngredientEditor value={ingredients} onChange={setIngredients} />
            </div>

            <label className="field">
              <span>{t("notes")}</span>
              <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </label>

            {mode === "new" && (
              <label className="row" style={{ gap: 10, fontWeight: 700 }}>
                <input type="checkbox" checked={saveAsRecipe} onChange={(e) => setSaveAsRecipe(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--accent)" }} />
                {t("saveAsRecipe")}
              </label>
            )}
            {canBeCooked && (
              <label className="row" style={{ gap: 10, fontWeight: 700 }}>
                <input type="checkbox" checked={cooked} onChange={(e) => setCooked(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--accent)" }} />
                {t("cooked")}
              </label>
            )}
          </>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <div className="row">
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>
              {t("delete")}
            </button>
          )}
          <span className="grow" />
          <button type="submit" className="btn" disabled={busy || !title.trim() || (mode === "recipe" && !recipeId)}>
            {busy ? t("working") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
