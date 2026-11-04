"use client";

import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { parseIngredient, UNITS } from "@/lib/ingredients";
import type { Key } from "@/lib/i18n";
import type { Ingredient, Unit } from "@/lib/types";

/** Rows of amount · unit · product, with "3 eggs" typed into Product splitting itself. */
export function IngredientEditor({ value, onChange }: { value: Ingredient[]; onChange: (v: Ingredient[]) => void }) {
  const { t } = useApp();
  const rows = value.length ? value : [{ name: "", qty: null, unit: "pcs" as Unit }];

  const set = (i: number, patch: Partial<Ingredient>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));
  const add = () => onChange([...rows, { name: "", qty: null, unit: "pcs" }]);

  function onNameBlur(i: number) {
    const r = rows[i];
    if (r.qty == null && /\d/.test(r.name)) {
      const parsed = parseIngredient(r.name);
      if (parsed.qty != null) set(i, parsed);
    }
  }

  return (
    <div className="ing-editor">
      <div className="ing-head" aria-hidden="true">
        <span>{t("amount")}</span>
        <span>{t("unit")}</span>
        <span>{t("ingredientName")}</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="ing-row">
          <input
            className="input"
            inputMode="decimal"
            aria-label={`${t("amount")} ${i + 1}`}
            value={r.qty ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(",", ".");
              set(i, { qty: v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : r.qty });
            }}
            placeholder="3"
          />
          <select className="select" aria-label={`${t("unit")} ${i + 1}`} value={r.unit} onChange={(e) => set(i, { unit: e.target.value as Unit })}>
            {UNITS.map((u) => (
              <option key={u || "none"} value={u}>
                {t(`unit_${u}` as Key)}
              </option>
            ))}
          </select>
          <input
            className="input"
            aria-label={`${t("ingredientName")} ${i + 1}`}
            value={r.name}
            onChange={(e) => set(i, { name: e.target.value })}
            onBlur={() => onNameBlur(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onNameBlur(i);
                if (i === rows.length - 1 && r.name.trim()) add();
              }
            }}
            maxLength={120}
          />
          <button type="button" className="icon-btn small" aria-label={t("removeItem", { name: r.name || String(i + 1) })} onClick={() => remove(i)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      <button type="button" className="btn small secondary" style={{ alignSelf: "flex-start" }} onClick={add}>
        <Icon name="plus" size={16} stroke={2.2} />
        {t("addIngredient")}
      </button>
      <small className="small muted">{t("ingredientsHint2")}</small>
    </div>
  );
}

export function PortionStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useApp();
  return (
    <div className="stepper" role="group" aria-label={t("servings")}>
      <button type="button" className="icon-btn round" aria-label={t("fewerPortions")} disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}>
        <span aria-hidden="true" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>−</span>
      </button>
      <span className="stepper-value" aria-live="polite">{value}</span>
      <button type="button" className="icon-btn round" aria-label={t("morePortions")} disabled={value >= 50} onClick={() => onChange(Math.min(50, value + 1))}>
        <Icon name="plus" size={18} stroke={2.4} />
      </button>
    </div>
  );
}
