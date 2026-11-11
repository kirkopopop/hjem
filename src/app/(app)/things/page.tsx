"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp, type Member } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { EmptyState, Skeleton } from "@/components/ui";
import { WishSheet, type ForWhom } from "@/components/WishSheet";
import { PurchaseSheet } from "@/components/PurchaseSheet";
import type { WishItem } from "@/lib/types";
import { compareWishes, formatMoney, hostOf } from "@/lib/things";
import { formatDayMonth } from "@/lib/dates";

const BOUGHT_PREVIEW = 5;
const ALL = "all";

/** "Bought!" — offer to keep warranty, receipt and manual for the thing just bought. */
function BoughtPrompt({ item, onTrack, onClose }: { item: WishItem; onTrack: () => void; onClose: () => void }) {
  const { t } = useApp();
  const titleId = useId();
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet bought-prompt" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <span className="bought-ico" aria-hidden="true">
          <Icon name="gift" size={30} stroke={1.9} />
        </span>
        <h2 id={titleId}>{t("boughtTitle")}</h2>
        <p className="muted">{t("boughtLead", { title: item.title })}</p>
        <div className="row">
          <button type="button" className="btn secondary grow" onClick={onClose}>
            {t("notNow")}
          </button>
          <button type="button" className="btn grow" onClick={onTrack}>
            <Icon name="shield" size={18} />
            {t("trackPurchase")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WishlistPage() {
  const { t, locale, userId, household, members, member, notify, celebrate } = useApp();
  const [items, setItems] = useState<WishItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<string>(ALL);
  const [editing, setEditing] = useState<WishItem | null | "new">(null);
  const [prompt, setPrompt] = useState<WishItem | null>(null);
  const [tracking, setTracking] = useState<WishItem | null>(null);
  const [showAllBought, setShowAllBought] = useState(false);
  const hid = household?.id;

  // Me first, then everyone else, then the home.
  const people = useMemo<Member[]>(() => {
    const ps = members.filter((m) => m.role !== "device");
    return [...ps.filter((m) => m.user_id === userId), ...ps.filter((m) => m.user_id !== userId)];
  }, [members, userId]);

  const load = useCallback(async () => {
    if (!hid) return;
    const sb = supabase();
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const [wanted, bought] = await Promise.all([
      sb.from("wishlist_items").select("*").eq("household_id", hid).eq("status", "wanted"),
      sb
        .from("wishlist_items")
        .select("*")
        .eq("household_id", hid)
        .eq("status", "bought")
        .gte("bought_at", since)
        .order("bought_at", { ascending: false })
        .limit(50),
    ]);
    if (wanted.error) notify(t("somethingWrong", { msg: wanted.error.message }));
    setItems([...((wanted.data ?? []) as WishItem[]), ...((bought.data ?? []) as WishItem[])]);
    setLoaded(true);
  }, [hid, notify, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    load();
  }, [load]);

  // Live sync with the other phone and the wall tablet.
  useEffect(() => {
    if (!hid) return;
    const sb = supabase();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(load, 150);
    };
    const ch = sb
      .channel(`wishlist-${hid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlist_items", filter: `household_id=eq.${hid}` }, refresh)
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      if (pending) clearTimeout(pending);
      document.removeEventListener("visibilitychange", onFocus);
      sb.removeChannel(ch);
    };
  }, [hid, load]);

  async function setStatus(item: WishItem, status: WishItem["status"], from?: Element | null) {
    const patch = status === "bought" ? { status, bought_at: new Date().toISOString(), bought_by: userId } : { status, bought_at: null, bought_by: null };
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
    if (status === "bought") celebrate(from ?? null);
    const { error } = await supabase().from("wishlist_items").update({ status }).eq("id", item.id);
    if (error) {
      notify(t("somethingWrong", { msg: error.message }));
      load();
      return;
    }
    if (status === "bought" && !item.purchase_id) setPrompt({ ...item, ...patch });
  }

  const matches = (x: WishItem) => filter === ALL || (filter === "" ? x.for_user_id === null : x.for_user_id === filter);
  const wanted = useMemo(() => items.filter((x) => x.status === "wanted" && matches(x)).sort(compareWishes),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matches depends only on filter
    [items, filter]);
  const bought = useMemo(() => items.filter((x) => x.status === "bought" && matches(x)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matches depends only on filter
    [items, filter]);

  // When showing everyone, group by who it's for.
  const groups = useMemo(() => {
    if (filter !== ALL) return [{ key: filter, label: null as string | null, items: wanted }];
    const out = people.map((m) => ({
      key: m.user_id,
      label: t("forPerson", { name: m.profile.display_name }),
      items: wanted.filter((x) => x.for_user_id === m.user_id),
    }));
    out.push({ key: "", label: t("forHomeLong"), items: wanted.filter((x) => x.for_user_id === null || !people.some((m) => m.user_id === x.for_user_id)) });
    return out.filter((g) => g.items.length);
  }, [filter, wanted, people, t]);

  const total = useMemo(() => {
    const dkk = wanted.filter((x) => x.price_estimate != null && x.currency === "DKK");
    return dkk.length ? dkk.reduce((s, x) => s + (x.price_estimate ?? 0), 0) : null;
  }, [wanted]);

  function row(item: WishItem) {
    const done = item.status === "bought";
    const by = member(item.bought_by);
    return (
      <li key={item.id} className={`task wish${done ? " is-done" : ""}`}>
        <button
          type="button"
          className={`check${done ? " on" : ""}`}
          aria-label={done ? t("markWanted", { title: item.title }) : t("markBought", { title: item.title })}
          onClick={(e) => setStatus(item, done ? "wanted" : "bought", e.currentTarget)}
        >
          {done && <Icon name="check" size={18} stroke={2.6} />}
        </button>
        <button type="button" className="task-main" onClick={() => setEditing(item)}>
          <span className="task-title">{item.title}</span>
          <span className="task-meta">
            {filter === ALL && done && item.for_user_id && member(item.for_user_id) && (
              <span className="who">{t("forPerson", { name: member(item.for_user_id)!.profile.display_name })}</span>
            )}
            {!done && item.priority === "high" && (
              <span className="chip prio-high">
                <Icon name="flag" size={12} stroke={2.2} />
                {t("wish_high")}
              </span>
            )}
            {!done && item.priority === "low" && <span className="chip prio-low">{t("wish_low")}</span>}
            {item.price_estimate != null && <span className="chip">~{formatMoney(item.price_estimate, item.currency)}</span>}
            {item.is_private && (
              <span className="chip private-chip">
                <Icon name="lock" size={12} stroke={2.2} />
                {item.for_user_id && item.for_user_id !== userId ? t("giftIdea") : t("visPrivate")}
              </span>
            )}
            {done && (
              <span className="who">
                {by && <Avatar name={by.profile.display_name} color={by.profile.color} size={18} />}
                {item.bought_at ? formatDayMonth(item.bought_at.slice(0, 10), locale) : ""}
              </span>
            )}
            {done && item.purchase_id && (
              <span className="chip today">
                <Icon name="shield" size={12} stroke={2.2} />
                {t("tracked")}
              </span>
            )}
          </span>
        </button>
        {!done && item.url && (
          <a className="icon-btn small wish-link" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${t("openLink")}: ${hostOf(item.url)}`}>
            <Icon name="link" size={18} />
          </a>
        )}
        {done && !item.purchase_id && (
          <button type="button" className="btn small soft" onClick={() => setTracking(item)}>
            {t("trackIt")}
          </button>
        )}
      </li>
    );
  }

  const boughtShown = showAllBought ? bought : bought.slice(0, BOUGHT_PREVIEW);
  const newFor: ForWhom = filter === ALL ? (member(userId)?.role === "device" ? "" : userId ?? "") : filter;
  const segmentedFilter = people.length <= 2;

  return (
    <>
      {segmentedFilter ? (
        <div className="segmented wish-filter" role="group" aria-label={t("forWhom")}>
          <button type="button" aria-pressed={filter === ALL} onClick={() => setFilter(ALL)}>
            {t("allWishes")}
          </button>
          {people.map((m) => (
            <button key={m.user_id} type="button" aria-pressed={filter === m.user_id} onClick={() => setFilter(m.user_id)}>
              {m.profile.display_name}
            </button>
          ))}
          <button type="button" aria-pressed={filter === ""} onClick={() => setFilter("")}>
            {t("forHome")}
          </button>
        </div>
      ) : (
        <select className="select wish-filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t("forWhom")}>
          <option value={ALL}>{t("allWishes")}</option>
          {people.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.profile.display_name}
            </option>
          ))}
          <option value="">{t("forHomeLong")}</option>
        </select>
      )}

      {loaded && wanted.length > 0 && (
        <p className="small muted wish-summary">
          {total != null ? t("wishTotal", { n: wanted.length, sum: formatMoney(total, "DKK") }) : t("wishCount", { n: wanted.length })}
        </p>
      )}

      {!loaded && (
        <ul className="board-list" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="sk-card">
              <Skeleton w={30} h={30} r={15} />
              <span className="grow stack" style={{ gap: 8 }}>
                <Skeleton h={15} w={`${80 - i * 15}%`} />
                <Skeleton h={11} w="40%" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {loaded && !wanted.length && (
        <EmptyState
          icon="gift"
          title={filter === ALL ? t("emptyWishTitle") : t("emptyWishFilterTitle")}
          hint={filter === ALL ? t("emptyWishHint") : undefined}
          action={
            <button type="button" className="btn soft small" onClick={() => setEditing("new")}>
              <Icon name="plus" size={16} stroke={2.2} />
              {t("newWish")}
            </button>
          }
        />
      )}

      {groups.map((g) => (
        <section key={g.key || "home"} aria-label={g.label ?? undefined}>
          {g.label && <h2 className="section-label">{g.label}</h2>}
          <ul className="board-list">{g.items.map(row)}</ul>
        </section>
      ))}

      {bought.length > 0 && (
        <section aria-label={t("boughtRecently")}>
          <h2 className="section-label">{t("boughtRecently")}</h2>
          <ul className="board-list">
            {boughtShown.map(row)}
            {bought.length > BOUGHT_PREVIEW && (
              <li>
                <button type="button" className="show-more" onClick={() => setShowAllBought((v) => !v)}>
                  {showAllBought ? t("showLess") : t("showMore", { n: bought.length - BOUGHT_PREVIEW })}
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      <button type="button" className="fab" onClick={() => setEditing("new")}>
        <Icon name="plus" size={20} stroke={2.2} />
        {t("newWish")}
      </button>

      {editing && (
        <WishSheet
          item={editing === "new" ? null : editing}
          initialFor={newFor}
          onTrack={(it) => {
            setEditing(null);
            setTracking(it);
          }}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {prompt && (
        <BoughtPrompt
          item={prompt}
          onClose={() => setPrompt(null)}
          onTrack={() => {
            setTracking(prompt);
            setPrompt(null);
          }}
        />
      )}

      {tracking && (
        <PurchaseSheet
          purchase={null}
          draft={{
            name: tracking.title,
            price: tracking.price_estimate,
            currency: tracking.currency,
            owner_id: tracking.for_user_id,
            product_url: tracking.url,
            notes: tracking.notes,
            fromWishId: tracking.id,
          }}
          onClose={(saved) => {
            setTracking(null);
            if (saved) notify(t("tracked"));
            load();
          }}
        />
      )}
    </>
  );
}
