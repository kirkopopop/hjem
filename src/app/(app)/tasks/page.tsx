"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { TaskSheet } from "@/components/TaskSheet";
import { WhoPicker } from "@/components/WhoPicker";
import { daysFromToday, formatShortDate, startOfWeekISO } from "@/lib/dates";
import type { Task, TaskStatus } from "@/lib/types";

type Tab = TaskStatus;

function byDueThenCreated(a: Task, b: Task) {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return a.created_at < b.created_at ? -1 : 1;
}

export default function TasksPage() {
  const { t, locale, userId, household, member, notify } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("todo");
  const [mineOnly, setMineOnly] = useState(false);
  const [editing, setEditing] = useState<Task | null | "new">(null);
  const [picking, setPicking] = useState<Task | null>(null);
  const isDevice = member(userId)?.role === "device";
  const hid = household?.id;

  const loadTasks = useCallback(async () => {
    if (!hid) return;
    const sb = supabase();
    const weekStart = startOfWeekISO();
    const [open, done] = await Promise.all([
      sb.from("tasks").select("*").eq("household_id", hid).neq("status", "done"),
      sb
        .from("tasks")
        .select("*")
        .eq("household_id", hid)
        .eq("status", "done")
        .gte("completed_at", weekStart)
        .order("completed_at", { ascending: false })
        .limit(100),
    ]);
    setTasks([...(open.data ?? []), ...(done.data ?? [])] as Task[]);
    setLoaded(true);
  }, [hid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    loadTasks();
  }, [loadTasks]);

  // Live sync: any change on another device refreshes this list.
  useEffect(() => {
    if (!hid) return;
    const sb = supabase();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(loadTasks, 150);
    };
    const ch = sb
      .channel(`tasks-${hid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${hid}` }, refresh)
      .subscribe();
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      if (pending) clearTimeout(pending);
      document.removeEventListener("visibilitychange", onFocus);
      sb.removeChannel(ch);
    };
  }, [hid, loadTasks]);

  async function patch(task: Task, fields: Partial<Task>) {
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, ...fields } : x)));
    const { error } = await supabase().from("tasks").update(fields).eq("id", task.id);
    if (error) {
      notify(t("somethingWrong", { msg: error.message }));
      loadTasks();
      return false;
    }
    return true;
  }

  async function toggleDone(task: Task, by?: string) {
    if (task.status !== "done" && isDevice && !by) {
      setPicking(task);
      return;
    }
    if (task.status === "done") {
      await patch(task, { status: "todo", completed_at: null, completed_by: null });
    } else {
      const ok = await patch(task, { status: "done", completed_at: new Date().toISOString(), completed_by: by ?? userId });
      if (ok) notify(t("niceDone"));
    }
  }

  const counts = useMemo(() => {
    const c = { todo: 0, doing: 0, done: 0 };
    for (const x of tasks) if (!mineOnly || x.assignee_id === userId) c[x.status]++;
    return c;
  }, [tasks, mineOnly, userId]);

  const visible = useMemo(() => {
    const list = tasks.filter((x) => x.status === tab && (!mineOnly || x.assignee_id === userId));
    return tab === "done" ? list : list.sort(byDueThenCreated);
  }, [tasks, tab, mineOnly, userId]);

  const unclaimed = tab === "todo" && !mineOnly ? visible.filter((x) => !x.assignee_id) : [];
  const assigned = tab === "todo" && !mineOnly ? visible.filter((x) => x.assignee_id) : visible;

  function dueChip(task: Task) {
    if (!task.due_date || task.status === "done") return null;
    const d = daysFromToday(task.due_date);
    if (d < 0) return <span className="chip warn">{t("overdue")} · {formatShortDate(task.due_date, locale)}</span>;
    if (d === 0) return <span className="chip today">{t("today")}</span>;
    if (d === 1) return <span className="chip">{t("tomorrow")}</span>;
    return <span className="chip">{formatShortDate(task.due_date, locale)}</span>;
  }

  function renderTask(task: Task) {
    const who = member(task.status === "done" ? task.completed_by ?? task.assignee_id : task.assignee_id);
    const done = task.status === "done";
    return (
      <li key={task.id} className={`task${done ? " is-done" : ""}`}>
        <button
          type="button"
          className={`check${done ? " on" : task.status === "doing" ? " doing" : ""}`}
          aria-label={done ? t("markNotDone", { title: task.title }) : t("markDone", { title: task.title })}
          onClick={() => toggleDone(task)}
        >
          {done && <Icon name="check" size={18} stroke={2.6} />}
        </button>
        <button type="button" className="task-main" onClick={() => setEditing(task)}>
          <span className="task-title">{task.title}</span>
          <span className="task-meta">
            {who ? (
              <span className="who">
                <Avatar name={who.profile.display_name} color={who.profile.color} size={20} />
                {who.profile.display_name}
              </span>
            ) : (
              <span className="chip">{t("nobody")}</span>
            )}
            {dueChip(task)}
            {task.repeat && <span className="chip">{t("repeats")}</span>}
          </span>
        </button>
      </li>
    );
  }

  const emptyText = tab === "todo" ? t("emptyTodo") : tab === "doing" ? t("emptyDoing") : t("emptyDone");

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t("tasks")}</h1>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="segmented grow" role="tablist" aria-label={t("status")}>
          {(["todo", "doing", "done"] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={tab === s} onClick={() => setTab(s)}>
              {t(s)} · {counts[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="segmented" role="group" aria-label={t("assignee")} style={{ marginBottom: 14, maxWidth: 260 }}>
        <button type="button" aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>
          {t("everyone")}
        </button>
        <button type="button" aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>
          {t("mine")}
        </button>
      </div>

      {loaded && visible.length === 0 && <p className="empty">{emptyText}</p>}

      {unclaimed.length > 0 && (
        <>
          <h2 className="section-label">{t("unclaimed")}</h2>
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {unclaimed.map((task) => (
              <li key={task.id} className="unclaimed">
                <Icon name="star" size={22} />
                <button
                  type="button"
                  className="grow"
                  onClick={() => setEditing(task)}
                  style={{ background: "none", border: 0, padding: 0, color: "inherit", textAlign: "left", display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{task.title}</span>
                  <span className="sub">
                    {task.due_date ? formatShortDate(task.due_date, locale) : t("unclaimedHint")}
                  </span>
                </button>
                {!isDevice && (
                  <button type="button" className="btn small" onClick={() => patch(task, { assignee_id: userId })}>
                    {t("claim")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {assigned.length > 0 && <h2 className="section-label">{t("everyone")}</h2>}
        </>
      )}

      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {assigned.map(renderTask)}
      </ul>

      <button type="button" className="fab" onClick={() => setEditing("new")}>
        <Icon name="plus" size={20} stroke={2.2} />
        {t("newTask")}
      </button>

      {picking && (
        <WhoPicker
          onClose={() => setPicking(null)}
          onPick={(uid) => {
            const task = picking;
            setPicking(null);
            toggleDone(task, uid);
          }}
        />
      )}

      {editing && <TaskSheet task={editing === "new" ? null : editing} onClose={() => {
            setEditing(null);
            loadTasks();
          }}
        />}

    </>
  );
}
