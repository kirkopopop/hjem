"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { EmptyState, SkeletonRows } from "@/components/ui";
import { PurchaseSheet } from "@/components/PurchaseSheet";
import type { Purchase, PurchaseCategory } from "@/lib/types";
import { CATEGORIES, categoryIcon, formatLongDate, formatMoney, formatMonthYear, timeLeft, warrantyState } from "@/lib/things";

type Sort = "recent" | "warranty";

export default function PurchasesPage() {
  const { t, household, member, notify } = useApp();
  const [items, setItems] = useState<Purchase[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Purchase | null | "new">(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PurchaseCategory | "">("");
  const [sort, setSort] = useState<Sort>("recent");
  const [endingOnly, setEndingOnly] = useState(false);
  const hid = household?.id;

  const load = useCallback(async () => {
    if (!hid) return;
    const { data, error } = await supabase()
      .from("purchases")
      .select("*")
      .eq("household_id", hid)
      .order("purchased_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) notify(t("somethingWrong", { msg: error.message }));
    setItems((data ?? []) as Purchase[]);
    setLoaded(true);
  }, [hid, notify, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    load();
  }, [load]);

  // Live sync.
  useEffect(() => {
    if (!hid) return;
    const sb = supabase();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(load, 150);
    };
    const ch = sb
      .channel(`purchases-${hid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases", filter: `household_id=eq.${hid}` }, refresh)
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      sb.removeChannel(ch);
    };
  }, [hid, load]);

  // Deep link: /things/purchases?open=<id> opens that purchase.
  useEffect(() => {
    if (!loaded) return;
    const id = new URLSearchParams(window.location.search).get("open");
    if (!id) return;
    const hit = items.find((p) => p.id === id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off deep link
    if (hit) setEditing(hit);
    window.history.replaceState(null, "", "/things/purchases");
  }, [loaded, items]);

  const ending = useMemo(() => items.filter((p) => warrantyState(p).state === "soon"), [items]);
  const total = useMemo(() => {
    const dkk = items.filter((p) => p.price != null && p.currency === "DKK");
    return dkk.length ? dkk.reduce((s, p) => s + (p.price ?? 0), 0) : null;
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((p) => {
      if (category && p.category !== category) return false;
      if (endingOnly && warrantyState(p).state !== "soon") return false;
      if (!q) return true;
      return [p.name, p.brand, p.model, p.store, p.serial_number, p.notes].some((v) => v?.toLowerCase().includes(q));
    });
    if (sort === "warranty") {
      // Active warranties ending soonest first, then expired, then none.
      const rank = (p: Purchase) => {
        const w = warrantyState(p);
        return w.state === "soon" || w.state === "ok" ? 0 : w.state === "expired" ? 1 : 2;
      };
      out.sort((a, b) => {
        const r = rank(a) - rank(b);
        if (r) return r;
        const byDate = (a.warranty_until ?? "").localeCompare(b.warranty_until ?? "");
        // Active: ending soonest first. Expired: most recently expired first.
        return rank(a) === 1 ? -byDate : byDate;
      });
    }
    return out;
  }, [items, query, category, sort, endingOnly]);

  function warrantyChip(p: Purchase) {
    const w = warrantyState(p);
    if (w.state === "none") return null;
    if (w.state === "expired")
      return <span className="chip w-expired">{t("wExpired", { date: formatMonthYear(p.warranty_until!) })}</span>;
    if (w.state === "soon")
      return (
        <span className="chip w-soon" title={formatLongDate(p.warranty_until!)}>
          <Icon name="shield" size={12} stroke={2.2} />
          {w.days === 0 ? t("wEndsToday") : t("wEnds", { n: w.days })}
        </span>
      );
    return (
      <span className="chip w-ok" title={formatLongDate(p.warranty_until!)}>
        <Icon name="shield" size={12} stroke={2.2} />
        {timeLeft(w.days)}
      </span>
    );
  }

  return (
    <>
      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-label">{t("statTracked")}</span>
          <span className="stat-value">
            {loaded ? (total != null ? t("statValue", { n: items.length, sum: formatMoney(total, "DKK") }) : items.length) : "–"}
          </span>
        </div>
        <button
          type="button"
          className={`stat-tile${ending.length ? " is-warn" : ""}`}
          aria-pressed={endingOnly}
          disabled={!ending.length && !endingOnly}
          onClick={() => setEndingOnly((v) => !v)}
        >
          <span className="stat-label">{t("statEnding")}</span>
          <span className="stat-value">{ending.length ? t("statEndingValue", { n: ending.length }) : t("statEndingNone")}</span>
        </button>
      </div>

      {items.length > 0 && (
        <div className="purchase-tools">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              className="input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPurchases")}
              aria-label={t("searchPurchases")}
            />
          </label>
          <div className="row">
            <select
              className="select grow"
              value={category}
              onChange={(e) => setCategory(e.target.value as PurchaseCategory | "")}
              aria-label={t("purchaseCategory")}
            >
              <option value="">{t("allCategories")}</option>
              {CATEGORIES.filter((c) => items.some((p) => p.category === c.key)).map((c) => (
                <option key={c.key} value={c.key}>
                  {t(`cat_${c.key}`)}
                </option>
              ))}
            </select>
            <div className="segmented sort-seg" role="group" aria-label="Sort">
              <button type="button" aria-pressed={sort === "recent"} onClick={() => setSort("recent")}>
                {t("sortRecent")}
              </button>
              <button type="button" aria-pressed={sort === "warranty"} onClick={() => setSort("warranty")}>
                {t("sortWarranty")}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loaded && <SkeletonRows n={3} h={74} />}

      {loaded && !items.length && (
        <EmptyState
          icon="shield"
          title={t("emptyPurchasesTitle")}
          hint={t("emptyPurchasesHint")}
          action={
            <button type="button" className="btn soft small" onClick={() => setEditing("new")}>
              <Icon name="plus" size={16} stroke={2.2} />
              {t("newPurchase")}
            </button>
          }
        />
      )}

      {loaded && items.length > 0 && !shown.length && <EmptyState compact icon="search" title={t("emptyPurchasesMatch")} />}

      <ul className="board-list purchase-list">
        {shown.map((p) => {
          const owner = member(p.owner_id);
          const sub = [p.brand, p.model].filter(Boolean).join(" · ");
          const hasManual = !!p.manual_url || p.files.some((f) => f.kind === "manual");
          const hasReceipt = !!p.receipt_url || p.files.some((f) => f.kind === "receipt");
          return (
            <li key={p.id}>
              <button type="button" className="purchase" onClick={() => setEditing(p)}>
                <span className={`purchase-ico cat-${p.category}`} aria-hidden="true">
                  <Icon name={categoryIcon(p.category)} size={22} />
                </span>
                <span className="purchase-main">
                  <span className="purchase-title">{p.name}</span>
                  {sub && <span className="purchase-sub">{sub}</span>}
                  <span className="task-meta">
                    {warrantyChip(p)}
                    {p.purchased_on && <span className="chip">{formatMonthYear(p.purchased_on)}</span>}
                    {p.price != null && <span className="chip">{formatMoney(p.price, p.currency)}</span>}
                    {hasManual && (
                      <span className="chip icon-chip" title={t("fileKind_manual")}>
                        <Icon name="book" size={13} stroke={2} />
                        <span className="sr-only">{t("fileKind_manual")}</span>
                      </span>
                    )}
                    {hasReceipt && (
                      <span className="chip icon-chip" title={t("fileKind_receipt")}>
                        <Icon name="receipt" size={13} stroke={2} />
                        <span className="sr-only">{t("fileKind_receipt")}</span>
                      </span>
                    )}
                  </span>
                </span>
                {owner && <Avatar name={owner.profile.display_name} color={owner.profile.color} size={26} />}
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="fab" onClick={() => setEditing("new")}>
        <Icon name="plus" size={20} stroke={2.2} />
        {t("newPurchase")}
      </button>

      {editing && (
        <PurchaseSheet
          purchase={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}
