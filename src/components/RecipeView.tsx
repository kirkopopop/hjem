"use client";

import { useEffect, useId, useState } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { PortionStepper } from "./IngredientEditor";
import { Nutrition, RecipeArt, RecipeMeta } from "./RecipeBits";
import { fmtQty, scaleIngredients } from "@/lib/ingredients";
import type { Key } from "@/lib/i18n";
import type { Recipe } from "@/lib/types";

/** Read-only recipe page: picture, nutrition per portion, ingredients (scalable) and numbered steps. */
export function RecipeView({ recipe, onClose, onEdit, onPlan }: { recipe: Recipe; onClose: () => void; onEdit: () => void; onPlan: () => void }) {
  const { t, locale } = useApp();
  const titleId = useId();
  const [portions, setPortions] = useState(recipe.servings);
  const ingredients = scaleIngredients(recipe.ingredients, recipe.servings, portions);
  const steps = (recipe.method ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const unitLabel = (u: string) => t(`unit_${u}` as Key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <article className="sheet wide recipe-view" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="rv-hero">
          <RecipeArt recipe={recipe} />
          <button type="button" className="icon-btn rv-close" aria-label={t("cancel")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="rv-body">
          <div>
            <h2 id={titleId} className="rv-title">{recipe.title}</h2>
            {recipe.blurb && <p className="rv-blurb">{recipe.blurb}</p>}
            <RecipeMeta recipe={recipe} />
          </div>

          {recipe.kcal != null && (
            <section>
              <h3 className="mini-label">{t("nutritionPerPortion")}</h3>
              <Nutrition recipe={recipe} />
            </section>
          )}

          {ingredients.length > 0 && (
            <section>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <h3 className="mini-label" style={{ margin: 0 }}>{t("ingredients")}</h3>
                <PortionStepper value={portions} onChange={setPortions} />
              </div>
              <ul className="rv-ings">
                {ingredients.map((i, n) => (
                  <li key={n}>
                    <span className="rv-amt">{fmtQty(i.qty, i.unit, locale, unitLabel)}</span>
                    <span>{i.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {steps.length > 0 && (
            <section>
              <h3 className="mini-label">{t("methodSteps")}</h3>
              <ol className="rv-steps">
                {steps.map((s, n) => (
                  <li key={n}>{s}</li>
                ))}
              </ol>
            </section>
          )}

          <div className="row" style={{ flexWrap: "wrap" }}>
            <button type="button" className="btn secondary" onClick={onEdit}>
              {t("edit")}
            </button>
            <span className="grow" />
            <button type="button" className="btn" onClick={onPlan}>
              <Icon name="calendar" size={18} />
              {t("planIt")}
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
