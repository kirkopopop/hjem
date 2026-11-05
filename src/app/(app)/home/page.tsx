"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { EventRow } from "@/components/EventRow";
import { BabyCard } from "@/components/BabyCard";
import { EventSheet } from "@/components/EventSheet";
import { TaskSheet } from "@/components/TaskSheet";
import { WhoPicker } from "@/components/WhoPicker";
import { RecipeArt } from "@/components/RecipeBits";
import { EmptyState, ProgressRing, Skeleton, SkeletonRows } from "@/components/ui";
import { eventsOnDay, useCalendarData, useHiddenCalendars } from "@/lib/calendar";
import { addDays, daysFromToday, formatDayMonth, formatWeekday, localISODate, weekDates } from "@/lib/dates";
import { BADGES, badgeName } from "@/lib/badges";
import type { BadgeRow, Meal, Recipe, Task } from "@/lib/types";

const AGENDA_DAYS = 4;
const MAX_EVENTS = 9;

function greetingKey(h: number) {
  if (h >= 5 && h < 12) return "greetMorning" as const;
  if (h >= 12 && h < 18) return "greetAfternoon" as const;
  if (h >= 18 && h < 23) return "greetEvening" as const;
  return "greetLate" as const;
}

export default function HomePage() {
  const { t, locale, userId, profile, household, members, member, notify, celebrate, badgeTick } = useApp();
  const hid = household?.id;
  const [now, setNow] = useState(() => new Date());
  const today = localISODate(now);
  const week = useMemo(() => weekDates(0), []);
  const agendaDays = useMemo(() => Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(today, i)), [today]);
  const { calendars, events, loaded: calLoaded } = useCalendarData(today, agendaDays[AGENDA_DAYS - 1]);
  const { hidden } = useHiddenCalendars();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneToday, setDoneToday] = useState(0);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [art, setArt] = useState<Record<string, Pick<Recipe, "image_url" | "title">>>({});
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [picking, setPicking] = useState<{ task: Task; el: Element | null } | null>(null);
  const [sheet, setSheet] = useState<"task" | "event" | null>(null);
  const isDevice = member(userId)?.role === "device";

  // Clock: refresh every 20 seconds.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!hid) return;
    const sb = supabase();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const [tk, dn, ml, bd] = await Promise.all([
      sb.from("tasks").select("*").eq("household_id", hid).neq("status", "done"),
      sb
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("household_id", hid)
        .eq("status", "done")
        .gte("completed_at", midnight.toISOString()),
      sb.from("meals").select("*").eq("household_id", hid).gte("date", week[0]).lte("date", week[6]),
      sb.from("badges").select("*").eq("household_id", hid).order("earned_at", { ascending: false }).limit(3),
    ]);
    const mealRows = (ml.data ?? []) as Meal[];
    setTasks((tk.data ?? []) as Task[]);
    setDoneToday(dn.count ?? 0);
    setMeals(mealRows);
    setBadges((bd.data ?? []) as BadgeRow[]);
    setLoaded(true);
    const ids = [...new Set(mealRows.map((m) => m.recipe_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data } = await sb.from("recipes").select("id, title, image_url").in("id", ids);
      setArt(Object.fromEntries((data ?? []).map((r: Pick<Recipe, "id" | "title" | "image_url">) => [r.id, r])));
    }
  }, [hid, week]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount and when a badge arrives
    load();
  }, [load, badgeTick]);

  useEffect(() => {
    if (!hid) return;
    const sb = supabase();
    let tm: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (tm) clearTimeout(tm);
      tm = setTimeout(load, 200);
    };
    const filter = `household_id=eq.${hid}`;
    const ch = sb
      .channel(`home-${hid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "meals", filter }, refresh)
      .subscribe();
    return () => {
      if (tm) clearTimeout(tm);
      sb.removeChannel(ch);
    };
  }, [hid, load]);

  async function complete(task: Task, by: string | null, el: Element | null) {
    celebrate(el);
    setLeaving((l) => [...l, task.id]);
    setDoneToday((n) => n + 1);
    setTimeout(() => {
      setTasks((prev) => prev.filter((x) => x.id !== task.id));
      setLeaving((l) => l.filter((x) => x !== task.id));
    }, 260);
    const { error } = await supabase()
      .from("tasks")
      .update({ status: "done", completed_by: by ?? userId })
      .eq("id", task.id);
    if (error) {
      notify(t("somethingWrong", { msg: error.message }));
      load();
    } else notify(t("niceDone"));
  }

  // ----- Derived views -----
  const byCal = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const shownEvents = events.filter((e) => byCal.get(e.calendar_id)?.visible && !hidden.includes(e.calendar_id));
  let budget = MAX_EVENTS;
  const agenda = agendaDays
    .map((d) => {
      let list = eventsOnDay(shownEvents, d);
      if (d === today) list = list.filter((e) => e.all_day || new Date(e.ends_at) > now);
      list = list.slice(0, Math.max(budget, 0));
      budget -= list.length;
      return { d, list };
    })
    .filter((x) => x.list.length);

  // Due today or overdue; undated tasks get their own list underneath.
  const todayTasks = tasks
    .filter((x) => x.due_date && daysFromToday(x.due_date) <= 0)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const undatedTasks = tasks
    .filter((x) => !x.due_date)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .slice(0, 8);
  const openToday = todayTasks.filter((x) => !leaving.includes(x.id)).length;
  const totalToday = openToday + doneToday;

  function renderTask(task: Task) {
    const who = member(task.assignee_id);
    const overdue = task.due_date && daysFromToday(task.due_date) < 0;
    return (
      <li key={task.id} className={`home-task${leaving.includes(task.id) ? " is-leaving" : ""}`}>
        <button
          type="button"
          className={`check${task.status === "doing" ? " doing" : ""}`}
          aria-label={t("markDone", { title: task.title })}
          onClick={(e) => {
            const el = e.currentTarget;
            if (isDevice) setPicking({ task, el });
            else complete(task, null, el);
          }}
        />
        <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="task-title" style={{ fontSize: 15 }}>{task.title}</span>
          {overdue && <span className="small" style={{ color: "var(--danger-ink)" }}>{t("overdue")}</span>}
        </span>
        {who ? (
          <Avatar name={who.profile.display_name} color={who.profile.color} size={26} />
        ) : (
          <span className="chip unclaimed-chip">{t("unclaimedHint")}</span>
        )}
      </li>
    );
  }

  const dinners = (d: string) =>
    meals.filter((m) => m.date === d && m.slot === "dinner").sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const titles = (list: Meal[]) => list.map((m) => m.title).join(" + ");
  const tonightAll = dinners(today);
  const tonight = tonightAll[0];
  const tonightCook = member(tonight?.cook_id);
  const tonightArt = tonight?.recipe_id ? art[tonight.recipe_id] : null;

  const dayLabel = (iso: string) => {
    const n = daysFromToday(iso);
    if (n === 0) return t("today");
    if (n === 1) return t("tomorrow");
    return `${formatWeekday(iso, locale)} · ${formatDayMonth(iso, locale)}`;
  };
  const shortDow = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(`${iso}T12:00:00`));
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(now);
  const dateLong = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const people = members.filter((m) => m.role !== "device");
  const greeting = t(greetingKey(now.getHours()));
  const title = !isDevice && profile?.display_name ? t("greetName", { greeting, name: profile.display_name }) : greeting;
  const leftLine =
    totalToday === 0 ? t("heroNothing") : openToday === 0 ? t("heroAllDone") : openToday === 1 ? t("heroLeftOne") : t("heroLeft", { n: openToday });

  return (
    <div className="home">
      <section className="hero" aria-labelledby="h-hello">
        <div>
          <span className="hero-eyebrow">
            <span>{dateLong}</span>
            <span aria-hidden="true">·</span>
            <span className="hero-clock">{clock}</span>
          </span>
          <h1 id="h-hello" className="hero-title">{title}</h1>
          <p className="hero-sub">
            <span>
              <Icon name="check" size={15} stroke={2.4} />
              {loaded ? leftLine : t("loading")}
            </span>
            <span>
              <Icon name="meals" size={15} stroke={2} />
              {tonight ? t("heroDinner", { meal: titles(tonightAll) }) : t("heroNoDinner")}
            </span>
          </p>
        </div>
        <ProgressRing
          value={totalToday ? doneToday / totalToday : loaded ? 1 : 0}
          size={84}
          stroke={8}
          label={t("ringLabel", { done: doneToday, total: totalToday })}
        >
          <span className="hero-ring-num">{loaded ? (totalToday ? `${doneToday}/${totalToday}` : "✓") : "–"}</span>
          <span className="hero-ring-sub">{t("ringToday")}</span>
        </ProgressRing>
        <div className="quick" role="group" aria-label={t("quickActions")}>
          <button type="button" className="quick-btn primary" onClick={() => setSheet("task")}>
            <Icon name="plus" size={18} stroke={2.3} />
            {t("newTask")}
          </button>
          {calendars.some((c) => c.can_write) && (
            <button type="button" className="quick-btn" onClick={() => setSheet("event")}>
              <Icon name="calendar" size={18} />
              {t("addEvent")}
            </button>
          )}
          <Link href="/meals" className="quick-btn">
            <Icon name="meals" size={18} />
            {t("quickMeal")}
          </Link>
          <Link href="/meals?view=groceries" className="quick-btn">
            <Icon name="cart" size={18} />
            {t("groceries")}
          </Link>
        </div>
        <div className="hero-people" aria-hidden="true">
          {people.map((m) => (
            <Avatar key={m.user_id} name={m.profile.display_name} color={m.profile.color} size={36} />
          ))}
        </div>
      </section>

      <div className="home-grid stagger">
        <BabyCard />
        <section className="card home-card" aria-labelledby="h-agenda">
          <div className="card-head">
            <h2 id="h-agenda">{t("agenda")}</h2>
            <Link href="/calendar" className="small">{t("seeAll")}</Link>
          </div>
          {!calLoaded ? (
            <SkeletonRows n={3} h={44} />
          ) : calendars.length === 0 ? (
            <EmptyState
              compact
              icon="calendar"
              title={t("noCalendarsYet")}
              action={!isDevice ? <Link href="/settings#calendars" className="btn small soft">{t("connectGoogle")}</Link> : undefined}
            />
          ) : agenda.length === 0 ? (
            <EmptyState compact icon="sun" title={t("noEvents")} />
          ) : (
            agenda.map(({ d, list }) => (
              <div key={d} className="stack" style={{ gap: 6 }}>
                <h3 className="mini-label">{dayLabel(d)}</h3>
                {list.map((e) => (
                  <EventRow key={`${e.id}-${d}`} event={e} calendar={byCal.get(e.calendar_id)} compact />
                ))}
              </div>
            ))
          )}
        </section>

        <section className="card home-card" aria-labelledby="h-tasks">
          <div className="card-head">
            <h2 id="h-tasks">{t("tasksToday")}</h2>
            <Link href="/tasks" className="small">{t("openTasks", { n: tasks.length })}</Link>
          </div>
          {!loaded ? (
            <SkeletonRows n={3} h={50} />
          ) : todayTasks.length === 0 ? (
            <EmptyState compact icon="sparkle" title={t("allClearTitle")} hint={t("allClear")} />
          ) : (
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
              {todayTasks.map(renderTask)}
            </ul>
          )}
          {undatedTasks.length > 0 && (
            <>
              <h3 className="mini-label home-subhead">{t("noDateTasks")}</h3>
              <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
                {undatedTasks.map(renderTask)}
              </ul>
            </>
          )}
        </section>

        <div className="home-side">
          <section className="card home-card" aria-labelledby="h-tonight">
            <div className="tonight">
              <div style={{ minWidth: 0 }}>
                <h2 id="h-tonight" className="mini-label" style={{ margin: 0 }}>{t("tonight")}</h2>
                {!loaded ? (
                  <Skeleton h={24} w="70%" style={{ marginTop: 6 }} />
                ) : tonight ? (
                  <p className="tonight-title">{titles(tonightAll)}</p>
                ) : (
                  <Link href="/meals" className="tonight-title">
                    + {t("nothingPlannedTonight")}
                  </Link>
                )}
                {tonightCook && <span className="small muted">{t("cooks", { name: tonightCook.profile.display_name })}</span>}
              </div>
              {tonight && (
                <span className="tonight-art">
                  <RecipeArt recipe={tonightArt} title={tonight.title} />
                </span>
              )}
            </div>
            <div className="dinner-strip">
              {week.map((d) => {
                const list = dinners(d);
                const m = list[0];
                const isToday = d === today;
                return (
                  <div key={d} className={`dinner-cell${isToday ? " is-today" : ""}${m ? "" : " is-empty"}`}>
                    <span className="dinner-dow">{shortDow(d)}</span>
                    <span className="dinner-meal">{m ? titles(list) : "—"}</span>
                  </div>
                );
              })}
            </div>
            <Link href="/meals?view=groceries" className="btn small soft" style={{ alignSelf: "flex-start" }}>
              <Icon name="cart" size={16} />
              {t("groceries")}
            </Link>
          </section>

          <section className="card home-card" aria-labelledby="h-badges">
            <div className="card-head">
              <h2 id="h-badges">{t("latestBadges")}</h2>
              <Link href="/badges" className="small">{t("seeAll")}</Link>
            </div>
            {!loaded ? (
              <SkeletonRows n={2} h={44} />
            ) : badges.length === 0 ? (
              <EmptyState compact icon="medal" title={t("noBadgesYet")} />
            ) : (
              <ul className="stack stagger" style={{ listStyle: "none", padding: 0, margin: 0, gap: 6 }}>
                {badges.map((b) => {
                  const def = BADGES.find((x) => x.key === b.badge_key);
                  const who = member(b.user_id);
                  return (
                    <li key={b.id} className="badge-row">
                      <span className="badge-icon small-badge">
                        <Icon name={def?.icon ?? "star"} size={20} stroke={1.9} />
                      </span>
                      <span className="grow" style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{t(badgeName(b.badge_key))}</span>
                        <span className="small muted">{who ? who.profile.display_name : t("together")}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {picking && (
        <WhoPicker
          onClose={() => setPicking(null)}
          onPick={(uid) => {
            const { task, el } = picking;
            setPicking(null);
            complete(task, uid, el);
          }}
        />
      )}
      {sheet === "task" && (
        <TaskSheet
          task={null}
          onClose={() => {
            setSheet(null);
            load();
          }}
        />
      )}
      {sheet === "event" && <EventSheet date={today} calendars={calendars} onClose={() => setSheet(null)} />}
    </div>
  );
}
