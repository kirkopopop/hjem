"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Icon, Logo } from "@/components/Icon";

export default function LoginPage() {
  const { t } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [next, setNext] = useState("/");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    if (p.get("confirmed")) setInfo("confirmedSignIn");
    const n = p.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) {
      setNext(n);
      if (n.startsWith("/onboarding?code=")) setMode("up");
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const sb = supabase();
    if (mode === "up") {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        window.location.assign(next);
        return;
      } else {
        setInfo("checkEmail");
        setMode("in");
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.message);
      else {
        window.location.assign(next);
        return;
      }
    }
    setBusy(false);
  }

  return (
    <main className="auth">
      <section className="auth-hero" aria-labelledby="auth-h">
        <Logo size={34} />
        <h1 id="auth-h" className="auth-title">
          {t("authHeadline1")} <em>{t("authHeadline2")}</em>
        </h1>
        <p className="auth-lead">{t("authTagline")}</p>
        <ul className="auth-features">
          {(
            [
              ["calendar", "featCalendars", "featCalendarsSub"],
              ["tasks", "featTasks", "featTasksSub"],
              ["meals", "featMeals", "featMealsSub"],
            ] as const
          ).map(([icon, title, sub]) => (
            <li key={icon}>
              <span className="f-ico">
                <Icon name={icon} size={20} />
              </span>
              <span>
                <b>{t(title)}</b>
                <span>{t(sub)}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="auth-preview" aria-hidden="true">
          <span className="pv pv-1">
            <span className="pv-check">
              <Icon name="check" size={14} stroke={3} />
            </span>
            <span>
              {t("previewTask")}
              <small>{t("niceDone")}</small>
            </span>
          </span>
          <span className="pv pv-2">
            <span className="pv-bar" />
            <span>
              {t("previewEvent")}
              <small>18:00 – 19:30</small>
            </span>
          </span>
          <span className="pv pv-3">
            <span className="pv-medal">
              <Icon name="calendarCheck" size={15} stroke={2} />
            </span>
            <span>
              {t("previewBadge")}
              <small>{t("badgeUnlocked")}</small>
            </span>
          </span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "in"} onClick={() => setMode("in")}>
            {t("signIn")}
          </button>
          <button type="button" role="tab" aria-selected={mode === "up"} onClick={() => setMode("up")}>
            {t("createAccount")}
          </button>
        </div>

        <form className="card stack" onSubmit={submit} key={mode} style={{ animation: "pop-in 280ms var(--ease-out)" }}>
          {info && <p className="notice" role="status">{t(info as "checkEmail")}</p>}
          {mode === "up" && (
            <label className="field">
              <span>{t("yourName")}</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="given-name" />
            </label>
          )}
          <label className="field">
            <span>{t("email")}</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
          </label>
          <label className="field">
            <span>{t("password")}</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
            {mode === "up" && <small className="small muted">{t("passwordHint")}</small>}
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn block" type="submit" disabled={busy}>
            {busy && <Icon name="repeat" size={16} />}
            {busy ? t("working") : mode === "up" ? t("createAccount") : t("signIn")}
          </button>
        </form>
        <p className="auth-foot">
          <a href="/privacy">{t("privacy")}</a>
        </p>
      </section>
    </main>
  );
}
