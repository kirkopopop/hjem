"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { BADGES } from "@/lib/badges";

const COLORS = ["#2a8a76", "#f3b48a", "#e8b955", "#5e9e4c", "#4f63b8", "#e0607e", "#7a4fb8"];

export type Piece = { dx: number; dy: number; r: number; c: string; d: number; w: number; s: "sq" | "dot" | "bar" };
export type Burst = { id: number; x: number; y: number; pieces: Piece[] };

/** Random confetti pieces, computed once per burst. */
export function makeBurst(id: number, x: number, y: number, big: boolean): Burst {
  const n = big ? 64 : 26;
  const spread = big ? 260 : 130;
  const pieces: Piece[] = Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    const dist = spread * (0.35 + Math.random() * 0.65);
    const kinds: Piece["s"][] = ["sq", "dot", "bar"];
    return {
      dx: Math.cos(a) * dist,
      dy: Math.sin(a) * dist * 0.75 - (big ? 90 : 50),
      r: (Math.random() - 0.5) * 720,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      d: Math.random() * 120,
      w: 5 + Math.random() * 5,
      s: kinds[Math.floor(Math.random() * kinds.length)],
    };
  });
  return { id, x, y, pieces };
}

export function Confetti({ bursts }: { bursts: Burst[] }) {
  if (!bursts.length) return null;
  return (
    <div className="confetti-layer" aria-hidden="true">
      {bursts.map((b) => (
        <span key={b.id} className="confetti" style={{ left: b.x, top: b.y }}>
          {b.pieces.map((p, i) => (
            <i
              key={i}
              className={p.s}
              style={
                {
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  "--r": `${p.r}deg`,
                  "--w": `${p.w}px`,
                  background: p.c,
                  animationDelay: `${p.d}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
}

export type BadgeNews = { id: number; key: string; title: string; name: string; desc: string; button: string };

/** Full-screen moment for a newly earned badge. */
export function BadgePop({ news, onClose }: { news: BadgeNews; onClose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const icon = BADGES.find((b) => b.key === news.key)?.icon ?? "star";
  useEffect(() => {
    btn.current?.focus();
    const tm = setTimeout(onClose, 9000);
    return () => clearTimeout(tm);
  }, [onClose]);
  return (
    <div className="badge-pop-backdrop" onClick={onClose}>
      <div
        className="badge-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-pop-name"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="badge-pop-rays" aria-hidden="true" />
        <span className="badge-pop-medal" aria-hidden="true">
          <Icon name={icon} size={46} stroke={1.8} />
        </span>
        <span className="badge-pop-kicker">{news.title}</span>
        <h2 id="badge-pop-name" className="badge-pop-name">{news.name}</h2>
        <p className="badge-pop-desc">{news.desc}</p>
        <button ref={btn} type="button" className="btn block" onClick={onClose}>
          {news.button}
        </button>
      </div>
    </div>
  );
}
