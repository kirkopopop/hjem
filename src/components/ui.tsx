"use client";

import { Icon } from "./Icon";

/** Accessible on/off toggle. */
export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`switch${on ? " on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

/** A setting row: icon, label + hint, control on the right. */
export function SettingRow({
  icon,
  title,
  hint,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="set-row">
      <span className="set-ico">
        <Icon name={icon} size={20} />
      </span>
      <span className="set-text">
        <span className="set-title">{title}</span>
        {hint && <span className="set-hint">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
  compact = false,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state${compact ? " compact" : ""}`}>
      <span className="empty-ico" aria-hidden="true">
        <Icon name={icon} size={compact ? 22 : 28} stroke={1.8} />
      </span>
      <span className="empty-title">{title}</span>
      {hint && <span className="empty-hint">{hint}</span>}
      {action}
    </div>
  );
}

export function Skeleton({ w = "100%", h = 14, r = 8, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <span className="sk" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Placeholder rows shaped like list items while data loads. */
export function SkeletonRows({ n = 3, h = 52 }: { n?: number; h?: number }) {
  return (
    <div className="stack" style={{ gap: 8 }} role="status" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} h={h} r={14} style={{ opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}

/** Circular progress. `value` is 0..1. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ ["--c" as string]: c }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-center">{children}</span>
    </span>
  );
}
