"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { IngredientEditor, PortionStepper } from "./IngredientEditor";
import { RecipeArt } from "./RecipeBits";
import { cleanIngredients } from "@/lib/ingredients";
import type { Ingredient, Recipe } from "@/lib/types";

const num = (v: string, max: number) => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

export function RecipeSheet({ recipe, onClose, onPlan }: { recipe: Recipe | null; onClose: () => void; onPlan?: (r: Recipe) => void }) {
  const { t, userId, household } = useApp();
  const isNew = !recipe;
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [blurb, setBlurb] = useState(recipe?.blurb ?? "");
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [minutes, setMinutes] = useState(recipe?.cook_minutes?.toString() ?? "");
  const [mealType, setMealType] = useState<Recipe["meal_type"]>(recipe?.meal_type ?? "main");
  const [style, setStyle] = useState<string>(recipe?.style ?? "");
  const [protein, setProtein] = useState<string>(recipe?.protein ?? "");
  const [special, setSpecial] = useState(recipe?.is_special ?? false);
  const [kcal, setKcal] = useState(recipe?.kcal?.toString() ?? "");
  const [pG, setPG] = useState(recipe?.protein_g?.toString() ?? "");
  const [fG, setFG] = useState(recipe?.fat_g?.toString() ?? "");
  const [cG, setCG] = useState(recipe?.carbs_g?.toString() ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(recipe?.ingredients ?? []);
  const [method, setMethod] = useState(recipe?.method ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNew, onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setBusy(true);
    setError(null);
    const m = num(minutes, 999);
    const fields = {
      title: title.trim(),
      blurb: blurb.trim() || null,
      servings,
      cook_minutes: m ? Math.round(m) : null,
      meal_type: mealType,
      style: style || null,
      protein: protein || null,
      is_special: special,
      kcal: num(kcal, 5000) == null ? null : Math.round(num(kcal, 5000)!),
      protein_g: num(pG, 500),
      fat_g: num(fG, 500),
      carbs_g: num(cG, 1000),
      ingredients: cleanIngredients(ingredients),
      method: method.trim() || null,
    };
    const sb = supabase();
    const { error } = isNew
      ? await sb.from("recipes").insert({ ...fields, household_id: household.id, created_by: userId })
      : await sb.from("recipes").update(fields).eq("id", recipe!.id);
    if (error) {
      setError(t("somethingWrong", { msg: error.message }));
      setBusy(false);
      return;
    }
    onClose();
  }

  async function remove() {
    if (!recipe || !window.confirm(`${t("delete")}?`)) return;
    setBusy(true);
    await supabase().from("recipes").delete().eq("id", recipe.id);
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet wide" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="sheet-head">
          <h2 id={titleId}>{isNew ? t("newRecipe") : t("editRecipe")}</h2>
          <button type="button" className="icon-btn" aria-label={t("cancel")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <div className="row" style={{ alignItems: "flex-start", gap: 14 }}>
          <div className="re-thumb">
            <RecipeArt recipe={recipe ? { ...recipe, title: title || recipe.title } : null} title={title || "?"} />
          </div>
          <div className="stack grow" style={{ gap: 10 }}>
            <label className="field">
              <span>{t("recipeTitle")}</span>
              <input ref={firstField} className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
            </label>
            <label className="field">
              <span>{t("blurb")}</span>
              <input className="input" value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={200} />
            </label>
          </div>
        </div>

        <div className="re-grid">
          <div className="field">
            <span>{t("servings")}</span>
            <PortionStepper value={servings} onChange={setServings} />
          </div>
          <label className="field">
            <span>{t("cookTime")}</span>
            <input className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="25" aria-describedby={`${titleId}-min`} />
            <small id={`${titleId}-min`} className="small muted">min</small>
          </label>
          <label className="field">
            <span>{t("mealType")}</span>
            <select className="select" value={mealType} onChange={(e) => setMealType(e.target.value as Recipe["meal_type"])}>
              <option value="breakfast">{t("type_breakfast")}</option>
              <option value="main">{t("type_main")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("style")}</span>
            <select className="select" value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="">{t("none")}</option>
              <option value="healthy">{t("style_healthy")}</option>
              <option value="everyday">{t("style_everyday")}</option>
              <option value="comfort">{t("style_comfort")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("proteinType")}</span>
            <select className="select" value={protein} onChange={(e) => setProtein(e.target.value)}>
              <option value="">{t("none")}</option>
              <option value="fish">{t("protein_fish")}</option>
              <option value="chicken">{t("protein_chicken")}</option>
              <option value="beef">{t("protein_beef")}</option>
              <option value="veg">{t("protein_veg")}</option>
            </select>
          </label>
          <label className="row" style={{ gap: 10, fontWeight: 700, alignSelf: "end", minHeight: 48 }}>
            <input type="checkbox" checked={special} onChange={(e) => setSpecial(e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--accent)" }} />
            {t("weekendSpecial")}
          </label>
        </div>

        <fieldset className="nut-fields">
          <legend>{t("nutritionPerPortion")}</legend>
          <label className="field">
            <span>kcal</span>
            <input className="input" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("proteinG")} (g)</span>
            <input className="input" inputMode="decimal" value={pG} onChange={(e) => setPG(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("fatG")} (g)</span>
            <input className="input" inputMode="decimal" value={fG} onChange={(e) => setFG(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("carbsG")} (g)</span>
            <input className="input" inputMode="decimal" value={cG} onChange={(e) => setCG(e.target.value)} />
          </label>
        </fieldset>

        <div className="field">
          <span>{t("ingredients")}</span>
          <IngredientEditor value={ingredients} onChange={setIngredients} />
        </div>
        <label className="field">
          <span>{t("methodSteps")}</span>
          <textarea className="textarea" rows={6} value={method} onChange={(e) => setMethod(e.target.value)} maxLength={8000} />
          <small className="small muted">{t("methodHint")}</small>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row" style={{ flexWrap: "wrap" }}>
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>
              {t("delete")}
            </button>
          )}
          <span className="grow" />
          {!isNew && onPlan && (
            <button type="button" className="btn secondary" onClick={() => onPlan(recipe!)}>
              {t("planIt")}
            </button>
          )}
          <button type="submit" className="btn" disabled={busy || !title.trim()}>
            {busy ? t("working") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
