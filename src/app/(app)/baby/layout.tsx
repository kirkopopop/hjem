"use client";

import { usePathname, useRouter } from "next/navigation";
import { useBaby } from "@/baby/useBaby";
import { ageText, fromKey } from "@/baby/util";

const TABS = [
  { href: "/baby", label: "Today" },
  { href: "/baby/history", label: "History" },
  { href: "/baby/trends", label: "Trends" },
] as const;

export default function BabyLayout({ children }: { children: React.ReactNode }) {
  const baby = useBaby().baby;
  const pathname = usePathname();
  const router = useRouter();
  const active = TABS.slice().reverse().find((t) => pathname.startsWith(t.href))?.href ?? "/baby";
  return (
    <>
      <div className="page-head baby-head">
        <div>
          <h1 className="page-title">{baby?.name ?? "Baby"}</h1>
          {baby && <span className="eyebrow">{ageText(fromKey(baby.birth_date))}</span>}
        </div>
        <div className="segmented baby-tabs" role="group" aria-label="Baby sections">
          {TABS.map((t) => (
            <button key={t.href} type="button" aria-pressed={active === t.href} onClick={() => router.push(t.href)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {children}
    </>
  );
}
