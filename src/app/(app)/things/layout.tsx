"use client";

import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";

const TABS = [
  { href: "/things", label: "wishlist" },
  { href: "/things/purchases", label: "purchases" },
] as const;

export default function ThingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname.startsWith("/things/purchases") ? "/things/purchases" : "/things";
  return (
    <div className="things-page">
      <div className="page-head">
        <h1 className="page-title">{t("things")}</h1>
        <div className="segmented things-tabs" role="group" aria-label={t("thingsSections")}>
          {TABS.map((tab) => (
            <button key={tab.href} type="button" aria-pressed={active === tab.href} onClick={() => router.push(tab.href)}>
              {t(tab.label)}
            </button>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
