"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { EventRow } from "@/components/EventRow";
import { WhoPicker } from "@/components/WhoPicker";
import { eventsOnDay, useCalendarData, useHiddenCalendars } from "@/lib/calendar";
import { addDays, daysFromToday, formatDayMonth, formatWeekday, localISODate, weekDates } from "@/lib/dates";
import { BADGES, badgeName } from "@/lib/badges";
import type { BadgeRow, Meal, Task } from "@/lib/types";

const AGENDA_DAYS = 4;
const MAX_EVENTS = 9;

export default function HomePage() {
  const { t, locale, userId, household, members, member, notify, badgeTick } = useApp();
  const hid = household?.id;
  const [now, setNow] = useState(() => new Date());
  const today = localISODate(now);
  const week = useMemo(() => weekDates(0), []);
  const agendaDays = useMemo(() => Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(today, i)), [today]);
  const { calendars, events, loaded: calLoaded } = useCalendarData(today, agendaDays[AGENDA_DAYS - 1]);
  const { hidden } = useHiddenCalendars();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [picking, setPicking] = useState<Task | null>(null);
  const isDevice = member(userId)?.role === "device";

  // Clock: refresh every 20 seconds.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!hid) return;
    const sb = supabase();
    const [tk, ml, bd] = await Promise.all([
      sb.from("tasks").select("*").eq("household_id", hid).neq("status", "done"),
      sb.from("meals").select("*").eq("household_id", hid).gte("date", week[0]).lte("date", week[6]),
      sb.from("badges").select("*").eq("household_id", hid).order("earned_at", { ascending: false }).limit(3),
    ]);
    setTasks((tk.data ?? []) as Task[]);
    setMeals((ml.data ?? []) as Meal[]);
    setBadges((bd.data ?? []) as BadgeRow[]);
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

  async function complete(task: Task, by: string | null) {
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
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

  const todayTasks = tasks
    .filter((x) => !x.due_date || daysFromToday(x.due_date) <= 0)
    .sort((a, b) => (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1)
    .slice(0, 7);

  const dinner = (d: string) => meals.find((m) => m.date === d && m.slot === "dinner");
  const tonight = dinner(today);
  const tonightCook = member(tonight?.cook_id);

  const dayLabel = (iso: string) => {
    const n = daysFromToday(iso);
    if (n === 0) return t("today");
    if (n === 1) return t("tomorrow");
    return `${formatWeekday(iso, locale)} · ${formatDayMonth(iso, locale)}`;
  };
  const shortDow = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { weekday: "short" }).format(new Date(`${iso}T12:00:00`));
  const clock = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(now);
  const dateLong = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "long" }).format(now);
  const people = members.filter((m) => m.role !== "device");

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <span className="eyebrow home-weekday">{formatWeekday(today, locale)}</span>
          <h1 className="home-date">
            {dateLong} <span className="home-clock">{clock}</span>
          </h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {people.map((m) => (
            <span key={m.user_id} className="person-pill">
              <Avatar name={m.profile.display_name} color={m.profile.color} size={34} />
              <span>{m.profile.display_name}</span>
            </span>
          ))}
        </div>
      </header>

      <div className="home-grid">
        <section className="card home-card" aria-labelledby="h-agenda">
          <div className="card-head">
            <h2 id="h-agenda">{t("agenda")}</h2>
            <Link href="/calendar" className="small">{t("seeAll")}</Link>
          </div>
          {calLoaded && calendars.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              {t("noCalendarsYet")}{" "}
              {!isDevice && <Link href="/household#calendars">{t("connectGoogle")}</Link>}
            </p>
          ) : agenda.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>{t("noEvents")}</p>
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
          {todayTasks.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>{t("allClear")}</p>
          ) : (
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
              {todayTasks.map((task) => {
                const who = member(task.assignee_id);
                const overdue = task.due_date && daysFromToday(task.due_date) < 0;
                return (
                  <li key={task.id} className="home-task">
                    <button
                      type="button"
                      className={`check${task.status === "doing" ? " doing" : ""}`}
                      aria-label={t("markDone", { title: task.title })}
                      onClick={() => (isDevice ? setPicking(task) : complete(task, null))}
                    />
                    <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span className="task-title" style={{ fontSize: 15 }}>{task.title}</span>
                      {overdue && <span className="small" style={{ color: "#8c1d16" }}>{t("overdue")}</span>}
                    </span>
                    {who ? (
                      <Avatar name={who.profile.display_name} color={who.profile.color} size={26} />
                    ) : (
                      <span className="chip">{t("unclaimedHint")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="home-side">
          <section className="card home-card dark" aria-labelledby="h-tonight">
            <div className="card-head">
              <h2 id="h-tonight" className="mini-label" style={{ color: "#c3cdca" }}>{t("tonight")}</h2>
              {tonightCook && <span className="small" style={{ color: "#c3cdca" }}>{t("cooks", { name: tonightCook.profile.display_name })}</span>}
            </div>
            {tonight ? (
              <p className="tonight-title">{tonight.title}</p>
            ) : (
              <Link href="/meals" className="tonight-title" style={{ color: "#f2b48a", textDecoration: "none" }}>
                + {t("nothingPlannedTonight")}
              </Link>
            )}
            <div className="dinner-strip">
              {week.map((d) => {
                const m = dinner(d);
                const isToday = d === today;
                return (
                  <div key={d} className={`dinner-cell${isToday ? " is-today" : ""}`}>
                    <span className="dinner-dow">{shortDow(d)}</span>
                    <span className="dinner-meal">{m?.title ?? "—"}</span>
                  </div>
                );
              })}
            </div>
            <Link href="/meals" className="btn small" style={{ background: "#2e3d3b", textDecoration: "none" }}>
              <Icon name="cart" size={16} />
              {t("groceries")}
            </Link>
          </section>

          <section className="card home-card" aria-labelledby="h-badges">
            <div className="card-head">
              <h2 id="h-badges">{t("latestBadges")}</h2>
              <Link href="/badges" className="small">{t("seeAll")}</Link>
            </div>
            {badges.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>{t("noBadgesYet")}</p>
            ) : (
              <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 10 }}>
                {badges.map((b) => {
                  const def = BADGES.find((x) => x.key === b.badge_key);
                  const who = member(b.user_id);
                  return (
                    <li key={b.id} className="row">
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
            const task = picking;
            setPicking(null);
            complete(task, uid);
          }}
        />
      )}
    </div>
  );
}
