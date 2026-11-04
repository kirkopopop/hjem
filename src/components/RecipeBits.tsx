"use client";

import { useApp } from "./AppProvider";
import type { Recipe } from "@/lib/types";

/** Plate illustration, or a plate with the dish's first letter for recipes without one. */
export function RecipeArt({ recipe, title, className = "" }: { recipe?: Pick<Recipe, "image_url" | "title"> | null; title?: string; className?: string }) {
  const name = recipe?.title ?? title ?? "?";
  if (recipe?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`recipe-art ${className}`} src={recipe.image_url} alt="" aria-hidden="true" loading="lazy" />;
  }
  return (
    <svg className={`recipe-art ${className}`} viewBox="0 0 160 120" aria-hidden="true">
      <circle cx="80" cy="64" r="50" fill="rgba(40,60,45,0.12)" />
      <circle cx="80" cy="60" r="50" fill="#FFFFFF" stroke="#DDE3DB" strokeWidth="1.2" />
      <circle cx="80" cy="60" r="39" fill="none" stroke="#DDE3DB" strokeWidth="1" />
      <text x="80" y="71" textAnchor="middle" fontSize="30" fontWeight="800" fill="#8A958D" fontFamily="Manrope, system-ui, sans-serif">
        {name.trim().charAt(0).toUpperCase()}
      </text>
    </svg>
  );
}

const MACRO_COLORS = { p: "#4F63B8", f: "#D99A1E", c: "#5E9E4C" };

/** kcal plus protein / fat / carbs per portion, with a bar showing where the energy comes from. */
export function Nutrition({ recipe, compact = false }: { recipe: Pick<Recipe, "kcal" | "protein_g" | "fat_g" | "carbs_g">; compact?: boolean }) {
  const { t } = useApp();
  if (recipe.kcal == null) return null;
  const fmt = (n: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n);
  const p = recipe.protein_g ?? 0;
  const f = recipe.fat_g ?? 0;
  const c = recipe.carbs_g ?? 0;
  const energy = [p * 4, f * 9, c * 4];
  const total = energy.reduce((a, b) => a + b, 0) || 1;
  const hasMacros = recipe.protein_g != null || recipe.fat_g != null || recipe.carbs_g != null;
  return (
    <div className={`nut${compact ? " compact" : ""}`}>
      <div className="nut-kcal">
        <b>≈ {fmt(recipe.kcal)}</b> kcal
      </div>
      {hasMacros && (
        <>
          <div className="nut-macros">
            <span><i style={{ background: MACRO_COLORS.p }} />{t("proteinG")} <b>{t("grams", { n: fmt(p) })}</b></span>
            <span><i style={{ background: MACRO_COLORS.f }} />{t("fatG")} <b>{t("grams", { n: fmt(f) })}</b></span>
            <span><i style={{ background: MACRO_COLORS.c }} />{t("carbsG")} <b>{t("grams", { n: fmt(c) })}</b></span>
          </div>
          <span className="nut-bar" aria-hidden="true">
            <span style={{ width: `${(energy[0] / total) * 100}%`, background: MACRO_COLORS.p }} />
            <span style={{ width: `${(energy[1] / total) * 100}%`, background: MACRO_COLORS.f }} />
            <span style={{ width: `${(energy[2] / total) * 100}%`, background: MACRO_COLORS.c }} />
          </span>
        </>
      )}
    </div>
  );
}

/** Small labels: time, kcal, style, takeaway, weekend. */
export function RecipeMeta({ recipe }: { recipe: Recipe }) {
  const { t } = useApp();
  const fmt = (n: number) => new Intl.NumberFormat("en-GB").format(n);
  const bits: React.ReactNode[] = [];
  if (recipe.kind === "order") bits.push(<span key="k" className="rtag order">{t("takeaway")}</span>);
  if (recipe.kind === "work") bits.push(<span key="k" className="rtag work">{t("fromWork")}</span>);
  if (recipe.cook_minutes) bits.push(<span key="t">{t("minutes", { n: recipe.cook_minutes })}</span>);
  if (recipe.kcal != null) bits.push(<span key="c" className="kc">{t("kcalShort", { n: fmt(recipe.kcal) })}</span>);
  if (recipe.style) bits.push(<span key="s" className={`rtag ${recipe.style}`}>{t(`style_${recipe.style}`)}</span>);
  if (recipe.is_special) bits.push(<span key="w" className="rtag special">{t("weekendSpecial")}</span>);
  return <span className="rmeta">{bits}</span>;
}
