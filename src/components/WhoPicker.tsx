"use client";

import { useEffect, useId } from "react";
import { useApp } from "./AppProvider";
import { Avatar, Icon } from "./Icon";

/** On the wall tablet, ask who did the task so the right person gets credit. */
export function WhoPicker({ onPick, onClose }: { onPick: (userId: string) => void; onClose: () => void }) {
  const { t, members } = useApp();
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 id={titleId}>{t("whoDidIt")}</h2>
          <button type="button" className="icon-btn" aria-label={t("cancel")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="who-grid">
          {members
            .filter((m) => m.role !== "device")
            .map((m) => (
              <button key={m.user_id} type="button" className="who-btn" onClick={() => onPick(m.user_id)}>
                <Avatar name={m.profile.display_name} color={m.profile.color} size={56} />
                {m.profile.display_name}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
