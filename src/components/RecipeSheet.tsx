"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { IngredientEditor, PortionStepper } from "./IngredientEditor";
import { cleanIngredients } from "@/lib/ingredients";
import type { Ingredient, Recipe } from "@/lib/types";

export function RecipeSheet({ recipe, onClose, onPlan }: { recipe: Recipe | null; onClose: () => void; onPlan?: (r: Recipe) => void }) {
  const { t, userId, household } = useApp();
  const isNew = !recipe;
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [servings, setServings] = useState(recipe?.servings ?? 2);
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
    const fields = { title: title.trim(), servings, ingredients: cleanIngredients(ingredients), method: method.trim() || null };
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
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <label className="field grow" style={{ minWidth: 200 }}>
            <span>{t("recipeTitle")}</span>
            <input ref={firstField} className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          </label>
          <div className="field">
            <span>{t("servings")}</span>
            <PortionStepper value={servings} onChange={setServings} />
          </div>
        </div>
        <div className="field">
          <span>{t("ingredients")}</span>
          <IngredientEditor value={ingredients} onChange={setIngredients} />
        </div>
        <label className="field">
          <span>{t("method")}</span>
          <textarea className="textarea" rows={5} value={method} onChange={(e) => setMethod(e.target.value)} maxLength={8000} />
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
