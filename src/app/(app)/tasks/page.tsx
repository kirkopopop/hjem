"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { TaskSheet } from "@/components/TaskSheet";
import { WhoPicker } from "@/components/WhoPicker";
import { Skeleton } from "@/components/ui";
import { daysFromToday, formatShortDate, startOfWeekISO } from "@/lib/dates";
import type { Task, TaskStatus } from "@/lib/types";
import { compareTasks } from "@/lib/tasks";

const COLUMNS: TaskStatus[] = ["todo", "doing", "done"];
const DONE_PREVIEW = 6;

function Column({
  status,
  title,
  count,
  onAdd,
  addLabel,
  empty,
  children,
}: {
  status: TaskStatus;
  title: string;
  count: number;
  onAdd: () => void;
  addLabel: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`board-col col-${status}${isOver ? " is-over" : ""}`} aria-label={title}>
      <div className="board-col-head">
        <h2>{title}</h2>
        <span className="col-count">{count}</span>
        <span className="grow" />
        <button type="button" className="icon-btn small" aria-label={addLabel} onClick={onAdd}>
          <Icon name="plus" size={18} stroke={2.2} />
        </button>
      </div>
      {empty && <p className="drop-empty">{empty}</p>}
      <ul className="board-list">{children}</ul>
    </section>
  );
}

function Draggable({ task, className, children }: { task: Task; className: string; children: React.ReactNode }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: task.id });
  return (
    <li ref={setNodeRef} {...listeners} className={`${className}${isDragging ? " is-dragging" : ""}`}>
      {children}
    </li>
  );
}

export default function TasksPage() {
  const { t, locale, userId, household, member, notify, celebrate } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [editing, setEditing] = useState<Task | null | "new">(null);
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [picking, setPicking] = useState<Task | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const isDevice = member(userId)?.role === "device";
  const hid = household?.id;

  // Mouse: drag after moving 6px. Touch: press and hold briefly, so normal swipes still scroll.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const loadTasks = useCallback(async () => {
    if (!hid) return;
    const sb = supabase();
    const [open, done] = await Promise.all([
      sb.from("tasks").select("*").eq("household_id", hid).neq("status", "done"),
      sb
        .from("tasks")
        .select("*")
        .eq("household_id", hid)
        .eq("status", "done")
        .gte("completed_at", startOfWeekISO())
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

  // Live sync: any change on another device refreshes the board.
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

  /** Moves a task to a column; finishing on the wall tablet asks who did it first. */
  async function moveTo(task: Task, status: TaskStatus, by?: string, from?: Element | { x: number; y: number } | null) {
    if (task.status === status) return;
    if (status === "done") {
      if (isDevice && !by) {
        setPicking(task);
        return;
      }
      celebrate(from ?? null);
      const ok = await patch(task, { status: "done", completed_at: new Date().toISOString(), completed_by: by ?? userId });
      if (ok) notify(t("niceDone"));
    } else {
      await patch(task, { status, completed_at: null, completed_by: null });
    }
  }

  function onDragStart(e: DragStartEvent) {
    setDragging(tasks.find((x) => x.id === e.active.id) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    const task = tasks.find((x) => x.id === e.active.id);
    setDragging(null);
    if (task && e.over) {
      const r = e.over.rect;
      moveTo(task, e.over.id as TaskStatus, undefined, { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 120) });
    }
  }

  const filtered = useMemo(() => tasks.filter((x) => !mineOnly || x.assignee_id === userId), [tasks, mineOnly, userId]);
  const columns = useMemo(() => {
    const out = { todo: [] as Task[], doing: [] as Task[], done: [] as Task[] };
    for (const x of filtered) out[x.status].push(x);
    out.todo.sort(compareTasks);
    out.doing.sort(compareTasks);
    return out;
  }, [filtered]);

  function dueChip(task: Task) {
    if (!task.due_date || task.status === "done") return null;
    const d = daysFromToday(task.due_date);
    if (d < 0) return <span className="chip warn">{t("overdue")} · {formatShortDate(task.due_date, locale)}</span>;
    if (d === 0) return <span className="chip today">{t("today")}</span>;
    if (d === 1) return <span className="chip">{t("tomorrow")}</span>;
    return <span className="chip">{formatShortDate(task.due_date, locale)}</span>;
  }

  function cardBody(task: Task) {
    const unclaimed = task.status !== "done" && !task.assignee_id;
    const who = member(task.status === "done" ? task.completed_by ?? task.assignee_id : task.assignee_id);
    const done = task.status === "done";
    return (
      <>
        <button
          type="button"
          className={`check${done ? " on" : task.status === "doing" ? " doing" : ""}`}
          aria-label={done ? t("markNotDone", { title: task.title }) : t("markDone", { title: task.title })}
          onClick={(e) => moveTo(task, done ? "todo" : "done", undefined, e.currentTarget)}
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
              <span className="chip unclaimed-chip">
                <Icon name="star" size={12} stroke={2} />
                {t("unclaimedHint")}
              </span>
            )}
            {task.status !== "done" && task.priority === "high" && (
              <span className="chip prio-high">
                <Icon name="flag" size={12} stroke={2.2} />
                {t("priority_high")}
              </span>
            )}
            {task.status !== "done" && task.priority === "low" && <span className="chip prio-low">{t("priority_low")}</span>}
            {dueChip(task)}
            {task.repeat && <span className="chip">{t("repeats")}</span>}
          </span>
        </button>
        {unclaimed && !isDevice && (
          <button type="button" className="btn small soft claim-btn" onClick={() => patch(task, { assignee_id: userId })}>
            {t("claim")}
          </button>
        )}
      </>
    );
  }

  const card = (task: Task) => (
    <Draggable key={task.id} task={task} className={`task${task.status === "done" ? " is-done" : ""}${!task.assignee_id && task.status !== "done" ? " is-unclaimed" : ""}`}>
      {cardBody(task)}
    </Draggable>
  );

  const emptyFor = (s: TaskStatus) => {
    if (!loaded || columns[s].length) return null;
    if (dragging) return t("dropHere");
    return s === "todo" ? t("emptyTodo") : s === "doing" ? t("emptyDoing") : t("emptyDone");
  };
  const doneShown = showAllDone ? columns.done : columns.done.slice(0, DONE_PREVIEW);
  const doneHidden = columns.done.length - doneShown.length;

  return (
    <div className="tasks-page">
      <div className="page-head">
        <h1 className="page-title">{t("tasks")}</h1>
        <div className="segmented" role="group" aria-label={t("assignee")} style={{ width: 200 }}>
          <button type="button" aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>
            {t("everyone")}
          </button>
          <button type="button" aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>
            {t("mine")}
          </button>
        </div>
      </div>
      <p className="small muted" style={{ margin: "-4px 2px 12px" }}>{t("dragHint")}</p>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className={`board${dragging ? " is-dragging" : ""}`}>
          {COLUMNS.map((s) => (
            <Column
              key={s}
              status={s}
              title={t(s)}
              count={columns[s].length}
              addLabel={t("addTo", { column: t(s) })}
              empty={emptyFor(s)}
              onAdd={() => {
                setNewStatus(s);
                setEditing("new");
              }}
            >
              {!loaded &&
                [0, 1, 2].slice(0, s === "todo" ? 3 : 2).map((i) => (
                  <li key={`sk-${i}`} className="sk-card" aria-hidden="true">
                    <Skeleton w={30} h={30} r={15} />
                    <span className="grow stack" style={{ gap: 8 }}>
                      <Skeleton h={15} w={`${80 - i * 15}%`} />
                      <Skeleton h={11} w="40%" />
                    </span>
                  </li>
                ))}
              {(s === "done" ? doneShown : columns[s]).map(card)}
              {s === "done" && columns.done.length > DONE_PREVIEW && (
                <li>
                  <button type="button" className="show-more" onClick={() => setShowAllDone((v) => !v)}>
                    {doneHidden > 0 ? t("showMore", { n: doneHidden }) : t("showLess")}
                  </button>
                </li>
              )}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 160, easing: "ease-out" }}>
          {dragging && <div className={`task drag-ghost${dragging.status === "done" ? " is-done" : ""}`}>{cardBody(dragging)}</div>}
        </DragOverlay>
      </DndContext>

      <button
        type="button"
        className="fab"
        onClick={() => {
          setNewStatus("todo");
          setEditing("new");
        }}
      >
        <Icon name="plus" size={20} stroke={2.2} />
        {t("newTask")}
      </button>

      {picking && (
        <WhoPicker
          onClose={() => setPicking(null)}
          onPick={(uid) => {
            const task = picking;
            setPicking(null);
            moveTo(task, "done", uid);
          }}
        />
      )}

      {editing && (
        <TaskSheet
          task={editing === "new" ? null : editing}
          initialStatus={newStatus}
          onClose={() => {
            setEditing(null);
            loadTasks();
          }}
        />
      )}
    </div>
  );
}
