"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import type { TaskPriority, WishItem } from "@/lib/types";
import { CURRENCIES, formatMoney, normalizeUrl, parseMoney } from "@/lib/things";

/** Who a wish is for: a member's user id, or "" for the home. */
export type ForWhom = string;

export function WishSheet({
  item,
  initialFor = "",
  onClose,
  onTrack,
}: {
  item: WishItem | null;
  initialFor?: ForWhom;
  onClose: () => void;
  /** Open the purchase form pre-filled from this (bought) wish. */
  onTrack?: (item: WishItem) => void;
}) {
  const { t, userId, household, members, member } = useApp();
  const isNew = !item;
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const people = members.filter((m) => m.role !== "device");
  const isDevice = member(userId)?.role === "device";
  const canSetPrivacy = !isDevice && (isNew || item?.created_by === userId);

  const [title, setTitle] = useState(item?.title ?? "");
  const [forWhom, setForWhom] = useState<ForWhom>(item ? item.for_user_id ?? "" : initialFor);
  const [priority, setPriority] = useState<TaskPriority>(item?.priority ?? "medium");
  const [isPrivate, setIsPrivate] = useState(item?.is_private ?? false);
  const [price, setPrice] = useState(item?.price_estimate != null ? String(item.price_estimate) : "");
  const [currency, setCurrency] = useState(item?.currency ?? "DKK");
  const [url, setUrl] = useState(item?.url ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [bought, setBought] = useState(item?.status === "bought");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNum = price.trim() ? parseMoney(price) : null;
  const priceBad = !!price.trim() && priceNum === null;
  const link = normalizeUrl(url);
  const urlBad = !!url.trim() && !link;

  // Focus once on open; Escape closes. onClose lives in a ref so a parent refresh doesn't re-run this.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (isNew) firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNew]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId || priceBad || urlBad) return;
    setBusy(true);
    setError(null);
    const fields = {
      title: title.trim(),
      for_user_id: forWhom || null,
      priority,
      is_private: canSetPrivacy ? isPrivate : item?.is_private ?? false,
      price_estimate: priceNum,
      currency,
      url: link,
      notes: notes.trim() || null,
      status: bought ? "bought" : "wanted",
    };
    const sb = supabase();
    const { error } = isNew
      ? await sb.from("wishlist_items").insert({ ...fields, household_id: household.id, created_by: userId })
      : await sb.from("wishlist_items").update(fields).eq("id", item!.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    onClose();
  }

  async function remove() {
    if (!item || !window.confirm(t("deleteWishConfirm"))) return;
    setBusy(true);
    const { error } = await supabase().from("wishlist_items").delete().eq("id", item.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <div className="sheet-head">
          <h2 id={titleId}>{isNew ? t("newWish") : t("editWish")}</h2>
          <button type="button" className="icon-btn" aria-label={t("cancel")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        {!isNew && (
          <div className="segmented" role="group" aria-label={t("status")}>
            <button type="button" aria-pressed={!bought} onClick={() => setBought(false)}>
              {t("wishlist")}
            </button>
            <button type="button" aria-pressed={bought} onClick={() => setBought(true)}>
              <Icon name="check" size={16} stroke={2.4} />
              {t("boughtRecently")}
            </button>
          </div>
        )}

        <label className="field">
          <span>{t("title")}</span>
          <input
            ref={firstField}
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("wishTitlePlaceholder")}
            required
            maxLength={200}
          />
        </label>

        <div className="field">
          <span>{t("forWhom")}</span>
          {people.length <= 3 ? (
            <div className="segmented" role="group" aria-label={t("forWhom")}>
              {people.map((m) => (
                <button key={m.user_id} type="button" aria-pressed={forWhom === m.user_id} onClick={() => setForWhom(m.user_id)}>
                  <i className="for-dot" style={{ background: m.profile.color }} aria-hidden="true" />
                  {m.profile.display_name}
                </button>
              ))}
              <button type="button" aria-pressed={forWhom === ""} onClick={() => setForWhom("")}>
                <Icon name="home" size={16} />
                {t("forHome")}
              </button>
            </div>
          ) : (
            <select className="select" value={forWhom} onChange={(e) => setForWhom(e.target.value)}>
              {people.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile.display_name}
                </option>
              ))}
              <option value="">{t("forHomeLong")}</option>
            </select>
          )}
        </div>

        <div className="field">
          <span>{t("wishPriority")}</span>
          <div className="segmented prio-seg" role="group" aria-label={t("wishPriority")}>
            {(["high", "medium", "low"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)}>
                <i className={`prio-dot ${p}`} aria-hidden="true" />
                {t(`wish_${p}`)}
              </button>
            ))}
          </div>
        </div>

        {canSetPrivacy && (
          <div className="field">
            <span>{t("visibility")}</span>
            <div className="segmented" role="group" aria-label={t("visibility")}>
              <button type="button" aria-pressed={!isPrivate} onClick={() => setIsPrivate(false)}>
                <Icon name="people" size={16} />
                {t("visShared")}
              </button>
              <button type="button" aria-pressed={isPrivate} onClick={() => setIsPrivate(true)}>
                <Icon name="lock" size={16} />
                {t("visPrivate")}
              </button>
            </div>
            <small className="muted">{isPrivate ? t("wishPrivateHint") : t("wishSharedHint")}</small>
          </div>
        )}

        <div className="money-row">
          <label className="field grow">
            <span>{t("estPrice")}</span>
            <input
              className="input"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1500"
              aria-invalid={priceBad}
            />
          </label>
          <label className="field currency-field">
            <span className="sr-only">Currency</span>
            <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        {priceNum != null && <small className="muted money-preview">{formatMoney(priceNum, currency)}</small>}

        <label className="field">
          <span>{t("whereToBuy")}</span>
          <div className="link-input">
            <input
              className="input"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("urlPlaceholder")}
              aria-invalid={urlBad}
            />
            {link && (
              <a className="icon-btn" href={link} target="_blank" rel="noopener noreferrer" aria-label={t("openLink")}>
                <Icon name="external" size={20} />
              </a>
            )}
          </div>
        </label>

        <label className="field">
          <span>{t("notes")}</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </label>

        {item && item.status === "bought" && !item.purchase_id && onTrack && (
          <button type="button" className="btn soft block" onClick={() => onTrack(item)}>
            <Icon name="shield" size={18} />
            {t("trackPurchase")}
          </button>
        )}

        {error && <p className="error" role="alert">{t("somethingWrong", { msg: error })}</p>}

        <div className="row">
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>
              {t("delete")}
            </button>
          )}
          <span className="grow" />
          <button type="submit" className="btn" disabled={busy || !title.trim() || priceBad || urlBad}>
            {busy ? t("working") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
