"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";

const LINKS = [
  { href: "/tasks", icon: "tasks", label: "navTasks" },
  { href: "/meals", icon: "meals", label: "navMeals" },
  { href: "/badges", icon: "medal", label: "navBadges" },
  { href: "/household", icon: "people", label: "navHousehold" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, userId, household, t } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!userId) window.location.assign("/login");
    else if (!household) router.replace("/onboarding");
  }, [ready, userId, household, router]);

  if (!ready || !household) {
    return (
      <div className="splash">
        <span className="logo">hjem</span>
      </div>
    );
  }

  return (
    <div className="frame">
      <nav className="nav" aria-label="Sections">
        <span className="brand">hjem</span>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={pathname.startsWith(l.href) ? "page" : undefined}>
            <Icon name={l.icon} />
            {t(l.label)}
          </Link>
        ))}
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
