"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
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
import { compareByPosition, repeatLabel } from "@/lib/tasks";

const COLUMNS: TaskStatus[] = ["todo", "doing", "done"];
const DONE_PREVIEW = 6;
const isColumn = (id: unknown): id is TaskStatus => COLUMNS.includes(id as TaskStatus);

/** Where a drop lands: a column, and optionally a card in it to go before/after. */
type DropTarget = { status: TaskStatus; overId: string | null; after: boolean };

// Prefer the card under the finger/pointer over the column around it; fall back to overlap.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const pool = hits.length ? hits : rectIntersection(args);
  const cards = pool.filter((c) => !isColumn(c.id));
  return cards.length ? cards : pool;
};

function Column({
  status,
  title,
  count,
  onAdd,
  addLabel,
  empty,
  isTarget,
  children,
}: {
  status: TaskStatus;
  title: string;
  count: number;
  onAdd: () => void;
  addLabel: string;
  empty: string | null;
  isTarget: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`board-col col-${status}${isTarget ? " is-over" : ""}`} aria-label={title}>
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

/** A card you can pick up, and also drop other cards onto (to slot in above or below it). */
function Draggable({ task, className, children }: { task: Task; className: string; children: React.ReactNode }) {
  const drag = useDraggable({ id: task.id });
  const drop = useDroppable({ id: task.id });
  const ref = useCallback(
    (node: HTMLLIElement | null) => {
      drag.setNodeRef(node);
      drop.setNodeRef(node);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setNodeRef functions are stable
    [],
  );
  return (
    <li ref={ref} {...drag.listeners} className={`${className}${drag.isDragging ? " is-dragging" : ""}`}>
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
  const [target, setTarget] = useState<DropTarget | null>(null);
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
  async function moveTo(
    task: Task,
    status: TaskStatus,
    by?: string,
    from?: Element | { x: number; y: number } | null,
    extra: Partial<Task> = {},
  ) {
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
      await patch(task, { status, completed_at: null, completed_by: null, ...extra });
    }
  }

  /**
   * Slots a task into an open column before/after another card (or at the end), and
   * renumbers that column so the order sticks on every device.
   */
  async function placeIn(task: Task, status: Exclude<TaskStatus, "done">, overId: string | null, after: boolean, from: { x: number; y: number }) {
    const col = tasks.filter((x) => x.status === status && x.id !== task.id).sort(compareByPosition);
    let idx = overId ? col.findIndex((x) => x.id === overId) : -1;
    idx = idx < 0 ? col.length : idx + (after ? 1 : 0);
    const ordered = [...col.slice(0, idx), task, ...col.slice(idx)];
    const next = new Map(ordered.map((x, i) => [x.id, (i + 1) * 1000]));
    const unchanged = task.status === status && ordered.every((x) => x.position === next.get(x.id));
    if (unchanged) return;
    setTasks((prev) => prev.map((x) => (next.has(x.id) ? { ...x, position: next.get(x.id)!, ...(x.id === task.id ? { status } : {}) } : x)));
    const sb = supabase();
    const writes = ordered
      .filter((x) => x.id !== task.id && x.position !== next.get(x.id))
      .map((x) => sb.from("tasks").update({ position: next.get(x.id) }).eq("id", x.id));
    if (task.status !== status) {
      await moveTo(task, status, undefined, from, { position: next.get(task.id)! });
    } else if (task.position !== next.get(task.id)) {
      writes.push(sb.from("tasks").update({ position: next.get(task.id) }).eq("id", task.id));
    }
    const results = await Promise.all(writes);
    const failed = results.find((x) => x.error);
    if (failed?.error) {
      notify(t("somethingWrong", { msg: failed.error.message }));
      loadTasks();
    }
  }

  /** Forget the hand-made order in To do and Doing; back to date + priority. */
  async function resetOrder() {
    const placed = tasks.filter((x) => x.status !== "done" && x.position != null);
    if (!placed.length) return;
    setTasks((prev) => prev.map((x) => (x.status !== "done" ? { ...x, position: null } : x)));
    const { error } = await supabase()
      .from("tasks")
      .update({ position: null })
      .in("id", placed.map((x) => x.id));
    if (error) {
      notify(t("somethingWrong", { msg: error.message }));
      loadTasks();
    }
  }

  function targetFrom(e: DragMoveEvent | DragEndEvent): DropTarget | null {
    const over = e.over;
    if (!over) return null;
    if (isColumn(over.id)) return { status: over.id, overId: null, after: false };
    const overTask = tasks.find((x) => x.id === over.id);
    if (!overTask) return null;
    if (overTask.id === e.active.id) return { status: overTask.status, overId: null, after: false };
    const a = e.active.rect.current.translated;
    const mid = over.rect.top + over.rect.height / 2;
    const after = a ? a.top + a.height / 2 > mid : false;
    return { status: overTask.status, overId: overTask.id, after };
  }

  function onDragStart(e: DragStartEvent) {
    setDragging(tasks.find((x) => x.id === e.active.id) ?? null);
  }
  function onDragMove(e: DragMoveEvent) {
    const next = targetFrom(e);
    setTarget((prev) =>
      prev?.status === next?.status && prev?.overId === next?.overId && prev?.after === next?.after ? prev : next,
    );
  }
  function onDragEnd(e: DragEndEvent) {
    const task = tasks.find((x) => x.id === e.active.id);
    const dest = targetFrom(e);
    setDragging(null);
    setTarget(null);
    if (!task || !dest || !e.over) return;
    const r = e.over.rect;
    const from = { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 120) };
    // Dropped on itself: nothing to do.
    if (dest.overId === null && !isColumn(e.over.id)) return;
    if (dest.status === "done") {
      moveTo(task, "done", undefined, from);
      return;
    }
    placeIn(task, dest.status, dest.overId, dest.after, from);
  }

  const filtered = useMemo(() => tasks.filter((x) => !mineOnly || x.assignee_id === userId), [tasks, mineOnly, userId]);
  const columns = useMemo(() => {
    const out = { todo: [] as Task[], doing: [] as Task[], done: [] as Task[] };
    for (const x of filtered) out[x.status].push(x);
    out.todo.sort(compareByPosition);
    out.doing.sort(compareByPosition);
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
    const unclaimed = task.status !== "done" && !task.assignee_id && !task.is_private;
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
            {task.is_private && (
              <span className="chip private-chip" title={t("privateTask")}>
                <Icon name="lock" size={12} stroke={2.2} />
                {t("privateTask")}
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
            {task.repeat && (
              <span className="chip">
                <Icon name="repeat" size={12} stroke={2.2} />
                {repeatLabel(task.repeat) || t("repeats")}
              </span>
            )}
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

  const dropMark = (task: Task) =>
    target?.overId === task.id && task.status !== "done" && dragging?.id !== task.id ? (target.after ? " drop-after" : " drop-before") : "";
  const card = (task: Task) => (
    <Draggable
      key={task.id}
      task={task}
      className={`task${task.status === "done" ? " is-done" : ""}${!task.assignee_id && task.status !== "done" ? " is-unclaimed" : ""}${dropMark(task)}`}
    >
      {cardBody(task)}
    </Draggable>
  );

  const emptyFor = (s: TaskStatus) => {
    if (!loaded || columns[s].length) return null;
    if (dragging) return t("dropHere");
    return s === "todo" ? t("emptyTodo") : s === "doing" ? t("emptyDoing") : t("emptyDone");
  };
  const hasManualOrder = tasks.some((x) => x.status !== "done" && x.position != null);
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
      <p className="small muted" style={{ margin: "-4px 2px 12px" }}>
        {t("dragHint")}
        {hasManualOrder && !isDevice && (
          <>
            {" "}
            <button type="button" className="order-reset" onClick={resetOrder}>
              {t("resetOrder")}
            </button>
          </>
        )}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null);
          setTarget(null);
        }}
      >
        <div className={`board${dragging ? " is-dragging" : ""}`}>
          {COLUMNS.map((s) => (
            <Column
              key={s}
              status={s}
              title={t(s)}
              count={columns[s].length}
              addLabel={t("addTo", { column: t(s) })}
              empty={emptyFor(s)}
              isTarget={!!dragging && target?.status === s && dragging.status !== s}
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
