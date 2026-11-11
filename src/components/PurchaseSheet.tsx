"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import type { Purchase, PurchaseCategory, PurchaseFile, PurchaseFileKind } from "@/lib/types";
import { localISODate } from "@/lib/dates";
import {
  CATEGORIES,
  CURRENCIES,
  FILE_BUCKET,
  FILE_KINDS,
  MAX_FILE_BYTES,
  WARRANTY_PRESETS,
  addMonthsISO,
  filePath,
  formatBytes,
  formatMoney,
  monthsBetween,
  normalizeUrl,
  parseMoney,
} from "@/lib/things";

/** Fields a new purchase can start from (e.g. a wish that was just bought). */
export type PurchaseDraft = Partial<Pick<Purchase, "name" | "price" | "currency" | "owner_id" | "product_url" | "notes">> & {
  /** Wishlist item to link once the purchase is saved. */
  fromWishId?: string;
};

type Pending = { key: string; file: File; kind: PurchaseFileKind };

/** Warranty picker state: no warranty, a length in months from the purchase date, or an exact date. */
type WarrantyMode = "none" | number | "custom";

const guessKind = (f: File): PurchaseFileKind => (f.type.startsWith("image/") ? "receipt" : f.type === "application/pdf" ? "manual" : "other");

export function PurchaseSheet({
  purchase,
  draft,
  onClose,
}: {
  purchase: Purchase | null;
  draft?: PurchaseDraft;
  onClose: (saved?: Purchase) => void;
}) {
  const { t, userId, household, members, notify } = useApp();
  const isNew = !purchase;
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const people = members.filter((m) => m.role !== "device");

  const [name, setName] = useState(purchase?.name ?? draft?.name ?? "");
  const [brand, setBrand] = useState(purchase?.brand ?? "");
  const [model, setModel] = useState(purchase?.model ?? "");
  const [category, setCategory] = useState<PurchaseCategory>(purchase?.category ?? "other");
  const [owner, setOwner] = useState<string>(purchase ? purchase.owner_id ?? "" : draft?.owner_id ?? "");
  const [store, setStore] = useState(purchase?.store ?? "");
  const initialPrice = purchase?.price ?? draft?.price;
  const [price, setPrice] = useState(initialPrice != null ? String(initialPrice) : "");
  const [currency, setCurrency] = useState(purchase?.currency ?? draft?.currency ?? "DKK");
  const [boughtOn, setBoughtOn] = useState(purchase ? purchase.purchased_on ?? "" : localISODate());
  const [until, setUntil] = useState(purchase ? purchase.warranty_until ?? "" : addMonthsISO(localISODate(), 24));
  const [mode, setMode] = useState<WarrantyMode>(() => {
    if (!purchase) return 24;
    if (!purchase.warranty_until) return "none";
    return (purchase.purchased_on && monthsBetween(purchase.purchased_on, purchase.warranty_until)) || "custom";
  });
  const [serial, setSerial] = useState(purchase?.serial_number ?? "");
  const [manualUrl, setManualUrl] = useState(purchase?.manual_url ?? "");
  const [productUrl, setProductUrl] = useState(purchase?.product_url ?? draft?.product_url ?? "");
  const [receiptUrl, setReceiptUrl] = useState(purchase?.receipt_url ?? "");
  const [notes, setNotes] = useState(purchase?.notes ?? draft?.notes ?? "");

  // Files: what's stored, what's waiting to upload, and what to delete on save.
  const [files, setFiles] = useState<PurchaseFile[]>(purchase?.files ?? []);
  const [pending, setPending] = useState<Pending[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});

  const [busy, setBusy] = useState<false | "save" | "upload">(false);
  const [error, setError] = useState<string | null>(null);

  const priceNum = price.trim() ? parseMoney(price) : null;
  const priceBad = !!price.trim() && priceNum === null;
  const links = { manual: normalizeUrl(manualUrl), product: normalizeUrl(productUrl), receipt: normalizeUrl(receiptUrl) };
  const linkBad =
    (!!manualUrl.trim() && !links.manual) || (!!productUrl.trim() && !links.product) || (!!receiptUrl.trim() && !links.receipt);

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

  // Short-lived links for the stored files, so they open with a normal tap.
  useEffect(() => {
    const paths = (purchase?.files ?? []).map((f) => f.path);
    if (!paths.length) return;
    let live = true;
    supabase()
      .storage.from(FILE_BUCKET)
      .createSignedUrls(paths, 3600)
      .then(({ data }: { data: { path: string | null; signedUrl: string }[] | null }) => {
        if (!live || !data) return;
        setSigned(Object.fromEntries(data.filter((d) => d.path && d.signedUrl).map((d) => [d.path as string, d.signedUrl])));
      });
    return () => {
      live = false;
    };
  }, [purchase]);

  function pickWarranty(next: WarrantyMode) {
    setMode(next);
    if (next === "none") setUntil("");
    else if (typeof next === "number") setUntil(addMonthsISO(boughtOn || localISODate(), next));
  }

  function changeBoughtOn(v: string) {
    setBoughtOn(v);
    if (typeof mode === "number" && v) setUntil(addMonthsISO(v, mode));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Pending[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) {
        notify(t("fileTooBig", { name: f.name }), 3600);
        continue;
      }
      next.push({ key: `${f.name}-${f.size}-${Math.random()}`, file: f, kind: guessKind(f) });
    }
    setPending((p) => [...p, ...next]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeStored(f: PurchaseFile) {
    setFiles((xs) => xs.filter((x) => x.path !== f.path));
    setRemoved((r) => [...r, f.path]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId || priceBad || linkBad) return;
    setBusy("save");
    setError(null);
    const sb = supabase();
    const id = purchase?.id ?? crypto.randomUUID();

    // Upload new files first so the row only ever points at files that exist.
    let stored = files;
    if (pending.length) {
      setBusy("upload");
      const uploaded: PurchaseFile[] = [];
      for (const p of pending) {
        const path = filePath(household.id, id, p.file.name);
        const { error } = await sb.storage.from(FILE_BUCKET).upload(path, p.file, {
          contentType: p.file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) {
          // Roll back this save's uploads so nothing is left orphaned.
          if (uploaded.length) await sb.storage.from(FILE_BUCKET).remove(uploaded.map((u) => u.path));
          setError(error.message);
          setBusy(false);
          return;
        }
        uploaded.push({ path, name: p.file.name, kind: p.kind, size: p.file.size, type: p.file.type });
      }
      stored = [...files, ...uploaded];
    }

    const fields = {
      name: name.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      category,
      owner_id: owner || null,
      store: store.trim() || null,
      price: priceNum,
      currency,
      purchased_on: boughtOn || null,
      warranty_until: mode === "none" ? null : until || null,
      serial_number: serial.trim() || null,
      manual_url: links.manual,
      product_url: links.product,
      receipt_url: links.receipt,
      notes: notes.trim() || null,
      files: stored,
    };
    const { data, error } = isNew
      ? await sb.from("purchases").insert({ ...fields, id, household_id: household.id, created_by: userId }).select().single()
      : await sb.from("purchases").update(fields).eq("id", id).select().single();
    if (error) {
      const fresh = stored.filter((f) => !files.some((x) => x.path === f.path)).map((f) => f.path);
      if (fresh.length) await sb.storage.from(FILE_BUCKET).remove(fresh);
      setError(error.message);
      setBusy(false);
      return;
    }
    if (removed.length) await sb.storage.from(FILE_BUCKET).remove(removed);
    if (isNew && draft?.fromWishId) {
      await sb.from("wishlist_items").update({ purchase_id: id }).eq("id", draft.fromWishId);
    }
    onClose(data as Purchase);
  }

  async function remove() {
    if (!purchase || !window.confirm(t("deletePurchaseConfirm"))) return;
    setBusy("save");
    const sb = supabase();
    const paths = [...purchase.files.map((f) => f.path), ...removed];
    const { error } = await sb.from("purchases").delete().eq("id", purchase.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (paths.length) await sb.storage.from(FILE_BUCKET).remove(paths);
    onClose();
  }

  const linkField = (label: string, value: string, set: (v: string) => void, valid: string | null) => (
    <label className="field">
      <span>{label}</span>
      <div className="link-input">
        <input
          className="input"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder="https://…"
          aria-invalid={!!value.trim() && !valid}
        />
        {valid && (
          <a className="icon-btn" href={valid} target="_blank" rel="noopener noreferrer" aria-label={t("openLink")}>
            <Icon name="external" size={20} />
          </a>
        )}
      </div>
    </label>
  );

  return (
    <div className="sheet-backdrop" onClick={() => onClose()}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <div className="sheet-head">
          <h2 id={titleId}>{isNew ? t("newPurchase") : t("editPurchase")}</h2>
          <button type="button" className="icon-btn" aria-label={t("cancel")} onClick={() => onClose()}>
            <Icon name="close" />
          </button>
        </div>

        {draft?.fromWishId && (
          <p className="notice">
            <Icon name="gift" size={16} /> {t("fromWishlist")}
          </p>
        )}

        <label className="field">
          <span>{t("purchaseName")}</span>
          <input
            ref={firstField}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("purchaseNamePlaceholder")}
            required
            maxLength={200}
          />
        </label>

        <div className="two">
          <label className="field">
            <span>{t("brand")}</span>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={100} />
          </label>
          <label className="field">
            <span>{t("model")}</span>
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} maxLength={100} />
          </label>
        </div>

        <div className="two">
          <label className="field">
            <span>{t("purchaseCategory")}</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value as PurchaseCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {t(`cat_${c.key}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("owner")}</span>
            <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">{t("ownerHousehold")}</option>
              {people.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="two">
          <label className="field">
            <span>{t("purchasedOn")}</span>
            <input className="input" type="date" value={boughtOn} onChange={(e) => changeBoughtOn(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("store")}</span>
            <input className="input" value={store} onChange={(e) => setStore(e.target.value)} placeholder={t("storePlaceholder")} maxLength={120} />
          </label>
        </div>

        <div className="money-row">
          <label className="field grow">
            <span>{t("price")}</span>
            <input
              className="input"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="3999"
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

        <div className="field">
          <span>{t("warranty")}</span>
          <div className="warranty-picks" role="group" aria-label={t("warranty")}>
            <button type="button" className="pick" aria-pressed={mode === "none"} onClick={() => pickWarranty("none")}>
              {t("warrantyNone")}
            </button>
            {WARRANTY_PRESETS.map((n) => (
              <button key={n} type="button" className="pick" aria-pressed={mode === n} onClick={() => pickWarranty(n)}>
                {t("warrantyYears", { n: n / 12 })}
              </button>
            ))}
          </div>
          {mode !== "none" && (
            <label className="field" style={{ marginTop: 6 }}>
              <span>{t("warrantyUntil")}</span>
              <input
                className="input"
                type="date"
                value={until}
                onChange={(e) => {
                  setUntil(e.target.value);
                  setMode((boughtOn && monthsBetween(boughtOn, e.target.value)) || "custom");
                }}
              />
            </label>
          )}
          <small className="muted">{t("warrantyHint")}</small>
        </div>

        <label className="field">
          <span>{t("serial")}</span>
          <input
            className="input mono"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={120}
          />
        </label>

        <div className="field">
          <span>{t("files")}</span>
          {(files.length > 0 || pending.length > 0) && (
            <ul className="file-list">
              {files.map((f) => (
                <li key={f.path} className="file-row">
                  <span className="file-ico">
                    <Icon name={f.kind === "receipt" ? "receipt" : f.kind === "manual" ? "book" : "file"} size={18} />
                  </span>
                  {signed[f.path] ? (
                    <a className="file-name" href={signed[f.path]} target="_blank" rel="noopener noreferrer">
                      {f.name}
                    </a>
                  ) : (
                    <span className="file-name">{f.name}</span>
                  )}
                  <span className="chip">{t(`fileKind_${f.kind}`)}</span>
                  <button type="button" className="icon-btn small" aria-label={t("removeFile", { name: f.name })} onClick={() => removeStored(f)}>
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              ))}
              {pending.map((p) => (
                <li key={p.key} className="file-row is-pending">
                  <span className="file-ico">
                    <Icon name="upload" size={18} />
                  </span>
                  <span className="file-name">
                    {p.file.name} <span className="muted small">· {formatBytes(p.file.size)}</span>
                  </span>
                  <select
                    className="select kind-select"
                    value={p.kind}
                    aria-label={t("files")}
                    onChange={(e) =>
                      setPending((xs) => xs.map((x) => (x.key === p.key ? { ...x, kind: e.target.value as PurchaseFileKind } : x)))
                    }
                  >
                    {FILE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`fileKind_${k}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn small"
                    aria-label={t("removeFile", { name: p.file.name })}
                    onClick={() => setPending((xs) => xs.filter((x) => x.key !== p.key))}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            tabIndex={-1}
          />
          <button type="button" className="btn secondary small add-file" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={16} />
            {t("addFile")}
          </button>
          {pending.length > 0 && <small className="muted">{t("fileSaveFirst")}</small>}
        </div>

        <div className="field-group">
          <span className="field-group-label">{t("links")}</span>
          {linkField(t("manualLink"), manualUrl, setManualUrl, links.manual)}
          {linkField(t("productLink"), productUrl, setProductUrl, links.product)}
          {linkField(t("receiptLink"), receiptUrl, setReceiptUrl, links.receipt)}
        </div>

        <label className="field">
          <span>{t("notes")}</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        </label>

        {error && <p className="error" role="alert">{t("somethingWrong", { msg: error })}</p>}

        <div className="row">
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove} disabled={!!busy}>
              {t("delete")}
            </button>
          )}
          <span className="grow" />
          <button type="submit" className="btn" disabled={!!busy || !name.trim() || priceBad || linkBad}>
            {busy === "upload" ? t("uploading") : busy ? t("working") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
