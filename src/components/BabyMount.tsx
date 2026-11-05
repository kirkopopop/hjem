"use client";

import { useEffect, useRef } from "react";
import { useBaby } from "@/baby/useBaby";

/** Hosts one of the framework-free baby views (rendered in a shadow root so styles stay separate). */
export function BabyMount({ view }: { view: "today" | "history" | "trends" | "settings" }) {
  useBaby();
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    import("@/baby/mount").then(({ mount }) => {
      if (!cancelled && host.current) off = mount(host.current, view);
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [view]);
  return <div ref={host} className="baby-host" />;
}
