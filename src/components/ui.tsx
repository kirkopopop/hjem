"use client";

import { useId } from "react";
import { Icon } from "./Icon";
import { buzz } from "@/lib/prefs";

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

/**
 * A range slider with a large live value, a filled track and optional tick labels.
 * Arrow keys and dragging both work; each step gives a light buzz on phones.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  format = (v) => String(v),
  ticks,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (v: number) => string;
  /** Values to label under the track; tapping one jumps to it. */
  ticks?: number[];
}) {
  const id = useId();
  const clamped = Math.min(max, Math.max(min, value));
  const fill = ((clamped - min) / (max - min)) * 100;
  const set = (v: number) => {
    if (v !== value) {
      buzz(6);
      onChange(v);
    }
  };
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="slider-value" key={clamped}>{format(clamped)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        style={{ ["--fill" as string]: `${fill}%` }}
        onChange={(e) => set(Number(e.target.value))}
      />
      {ticks && (
        <div className="slider-ticks">
          {ticks.map((v) => (
            <button key={v} type="button" tabIndex={-1} aria-hidden="true" className={v === clamped ? "on" : undefined} style={{ left: `${((v - min) / (max - min)) * 100}%` }} onClick={() => set(v)}>
              {format(v)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A labelled on/off row for forms: icon, title and hint on the left, the switch on the right. The whole row toggles. */
export function ToggleRow({
  icon,
  title,
  hint,
  on,
  onChange,
}: {
  icon: string;
  title: string;
  hint?: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={`toggle-row${on ? " on" : ""}`} onClick={() => onChange(!on)}>
      <span className="set-ico">
        <Icon name={icon} size={18} />
      </span>
      <span className="set-text">
        <span className="set-title">{title}</span>
        {hint && <span className="set-hint">{hint}</span>}
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <Switch on={on} onChange={onChange} label={title} />
      </span>
    </div>
  );
}
