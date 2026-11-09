"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { PRIORITIES, REPEAT_PRESETS, formatRepeat, parseRepeat, repeatLabel, type RepeatUnit } from "@/lib/tasks";

const isPreset = (r: string) => (REPEAT_PRESETS as readonly string[]).includes(r);

export function TaskSheet({ task, onClose, initialStatus = "todo" }: { task: Task | null; onClose: () => void; initialStatus?: TaskStatus }) {
  const { t, userId, household, members } = useApp();
  const isNew = !task;
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [assignee, setAssignee] = useState<string>(task ? task.assignee_id ?? "" : "");
  const [due, setDue] = useState(task?.due_date ?? "");
  // Repeat menu: "" (none), one of the presets, or "custom" with its own number + unit.
  const initialRule = parseRepeat(task?.repeat);
  const initialRepeat = initialRule ? formatRepeat(initialRule) : "";
  const [repeat, setRepeat] = useState<string>(initialRepeat && !isPreset(initialRepeat) ? "custom" : initialRepeat);
  const [customN, setCustomN] = useState<string>(String(initialRule?.n && !isPreset(initialRepeat) ? initialRule.n : 2));
  const [customUnit, setCustomUnit] = useState<RepeatUnit>(initialRule && !isPreset(initialRepeat) ? initialRule.unit : "w");
  const customNum = Math.round(Number(customN));
  const customOk = Number.isFinite(customNum) && customNum >= 1 && customNum <= 999;
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNew, onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setBusy(true);
    setError(null);
    const fields = {
      title: title.trim(),
      notes: notes.trim() || null,
      assignee_id: assignee || null,
      due_date: due || null,
      repeat: repeat === "custom" ? formatRepeat({ n: customNum, unit: customUnit }) : repeat || null,
      priority,
      status,
    };
    const sb = supabase();
    const { error } = isNew
      ? await sb.from("tasks").insert({ ...fields, household_id: household.id, created_by: userId })
      : await sb.from("tasks").update(fields).eq("id", task!.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    onClose();
  }

  async function remove() {
    if (!task || !window.confirm(t("deleteConfirm"))) return;
    setBusy(true);
    const { error } = await supabase().from("tasks").delete().eq("id", task.id);
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
          <h2 id={titleId}>{isNew ? t("newTask") : t("editTask")}</h2>
          <button type="button" className="icon-btn" aria-label={t("cancel")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        {!isNew && (
          <div className="segmented" role="group" aria-label={t("status")}>
            {(["todo", "doing", "done"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>
                {t(s)}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>{t("title")}</span>
          <input
            ref={firstField}
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            required
            maxLength={200}
          />
        </label>

        <div className="field">
          <span>{t("priority")}</span>
          <div className="segmented prio-seg" role="group" aria-label={t("priority")}>
            {PRIORITIES.map((p) => (
              <button key={p} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)}>
                <i className={`prio-dot ${p}`} aria-hidden="true" />
                {t(`priority_${p}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field">
            <span>{t("assignee")}</span>
            <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">{t("nobody")}</option>
              {members
                .filter((m) => m.role !== "device")
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile.display_name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="two due-repeat">
          <label className="field">
            <span>{t("due")}</span>
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("repeat")}</span>
            <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="">{t("repeatNone")}</option>
              {REPEAT_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {repeatLabel(p)}
                </option>
              ))}
              <option value="custom">{t("repeatCustom")}</option>
            </select>
          </label>
        </div>

        {repeat === "custom" && (
          <div className="field">
            <span>{t("repeatEvery")}</span>
            <div className="repeat-custom">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                value={customN}
                onChange={(e) => setCustomN(e.target.value)}
                aria-label={t("repeatCount")}
                aria-invalid={!customOk}
              />
              <select className="select" value={customUnit} onChange={(e) => setCustomUnit(e.target.value as RepeatUnit)} aria-label={t("repeatUnit")}>
                <option value="d">{customNum === 1 ? "day" : "days"}</option>
                <option value="w">{customNum === 1 ? "week" : "weeks"}</option>
                <option value="m">{customNum === 1 ? "month" : "months"}</option>
                <option value="y">{customNum === 1 ? "year" : "years"}</option>
              </select>
            </div>
          </div>
        )}


        <label className="field">
          <span>{t("notes")}</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </label>

        {error && <p className="error" role="alert">{t("somethingWrong", { msg: error })}</p>}

        <div className="row">
          {!isNew && (
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>
              {t("delete")}
            </button>
          )}
          <span className="grow" />
          <button type="submit" className="btn" disabled={busy || !title.trim() || (repeat === "custom" && !customOk)}>
            {busy ? t("working") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
