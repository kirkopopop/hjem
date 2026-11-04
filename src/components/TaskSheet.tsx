"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import type { Task, TaskStatus } from "@/lib/types";

export function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { t, userId, household, members } = useApp();
  const isNew = !task;
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [assignee, setAssignee] = useState<string>(task ? task.assignee_id ?? "" : "");
  const [due, setDue] = useState(task?.due_date ?? "");
  const [repeat, setRepeat] = useState<string>(task?.repeat ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
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
      repeat: repeat || null,
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

        <div className="two">
          <label className="field">
            <span>{t("due")}</span>
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="field">
            <span>{t("repeat")}</span>
            <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="">{t("repeatNone")}</option>
              <option value="daily">{t("repeatDaily")}</option>
              <option value="weekly">{t("repeatWeekly")}</option>
              <option value="monthly">{t("repeatMonthly")}</option>
            </select>
          </label>
        </div>

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
          <button type="submit" className="btn" disabled={busy || !title.trim()}>
            {busy ? t("working") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
