"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { Avatar, Icon, Logo, LogoMark } from "./Icon";
import { useWakeLock } from "./CalendarSettings";

// Six sections in the bottom bar; Settings (with Badges) sits behind your avatar on phones.
const LINKS = [
  { href: "/home", icon: "home", label: "navHome" },
  { href: "/baby", icon: "baby", label: "navBaby" },
  { href: "/tasks", icon: "tasks", label: "navTasks" },
  { href: "/calendar", icon: "calendar", label: "navCalendar" },
  { href: "/meals", icon: "meals", label: "navMeals" },
  { href: "/things", icon: "bag", label: "navThings" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, userId, profile, household, t } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  useWakeLock();

  useEffect(() => {
    if (!ready) return;
    if (!userId) window.location.assign("/login");
    else if (!household) router.replace("/onboarding");
  }, [ready, userId, household, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!ready || !household) {
    return (
      <div className="splash" role="status" aria-label={t("loading")}>
        <span className="splash-mark">
          <LogoMark size={64} />
        </span>
      </div>
    );
  }

  const onSettings = pathname.startsWith("/settings") || pathname.startsWith("/badges");

  return (
    <div className="frame">
      <nav className="nav" aria-label="Sections">
        <Link href="/home" className="brand" aria-label="hjem">
          <LogoMark size={40} />
        </Link>
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className="nav-link" aria-current={active ? "page" : undefined}>
              <span className="nav-ico">
                <Icon name={l.icon} size={22} stroke={active ? 2.1 : 1.8} />
              </span>
              <span className="nav-label">{t(l.label)}</span>
            </Link>
          );
        })}
        <span className="nav-spacer" />
        <Link href="/settings" className="nav-link nav-settings" aria-current={onSettings ? "page" : undefined}>
          <span className="nav-ico">
            {profile ? <Avatar name={profile.display_name} color={profile.color} size={28} /> : <Icon name="settings" />}
          </span>
          <span className="nav-label">{t("navSettings")}</span>
        </Link>
      </nav>

      <div className="main-col">
        <header className={`topbar${scrolled ? " is-scrolled" : ""}`}>
          <Link href="/home" className="topbar-brand" aria-label="hjem">
            <Logo size={28} />
          </Link>
          <span className="topbar-house">{household.name}</span>
          <Link
            href="/settings"
            className={`topbar-me${onSettings ? " is-active" : ""}`}
            aria-label={t("navSettings")}
            aria-current={onSettings ? "page" : undefined}
          >
            {profile ? <Avatar name={profile.display_name} color={profile.color} size={34} /> : <Icon name="settings" />}
          </Link>
        </header>
        <main key={pathname} className="content page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
