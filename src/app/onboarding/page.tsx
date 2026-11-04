"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";

export default function OnboardingPage() {
  const { ready, userId, profile, household, t, reload } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [asDevice, setAsDevice] = useState(false);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount
    if (c) setCode(c.toUpperCase());
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!userId) window.location.assign("/login");
    else if (household) router.replace("/home");
  }, [ready, userId, household, router]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    const { error } = await supabase().rpc("create_household", { p_name: name.trim() || t("defaultHouseholdName") });
    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }
    await reload();
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy("join");
    setError(null);
    const { error } = await supabase().rpc("join_household", { p_code: code.trim(), p_as_device: asDevice });
    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }
    await reload();
  }

  async function signOut() {
    await supabase().auth.signOut();
    window.location.assign("/login");
  }

  if (!ready || !userId || household) {
    return (
      <div className="splash">
        <span className="logo">hjem</span>
      </div>
    );
  }

  return (
    <main className="auth-wrap">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <span className="logo">
          hjem<span className="logo-dot">.</span>
        </span>
      </div>
      <h1 className="page-title">{t("welcome", { name: profile?.display_name ?? "" })}</h1>
      <p className="lead" style={{ marginTop: 6 }}>{t("onboardingLead")}</p>

      {error && <p className="error" role="alert" style={{ marginBottom: 12 }}>{error}</p>}

      <form className="card stack" onSubmit={join} style={{ marginBottom: 14 }}>
        <h2>{t("joinHousehold")}</h2>
        <label className="field">
          <span>{t("inviteCode")}</span>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-2345"
            autoCapitalize="characters"
            autoComplete="off"
            required
            style={{ letterSpacing: 2, fontWeight: 800 }}
          />
        </label>
        <label className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={asDevice}
            onChange={(e) => setAsDevice(e.target.checked)}
            style={{ width: 22, height: 22, marginTop: 1, accentColor: "var(--accent)", flexShrink: 0 }}
          />
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontWeight: 700 }}>{t("wallDisplay")}</span>
            <span className="small muted">{t("wallDisplayHint")}</span>
          </span>
        </label>
        <button className="btn block" type="submit" disabled={busy !== null}>
          {busy === "join" ? t("working") : t("join")}
        </button>
      </form>

      <form className="card stack" onSubmit={create}>
        <h2>{t("createHousehold")}</h2>
        <label className="field">
          <span>{t("householdName")}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("defaultHouseholdName")} maxLength={60} />
        </label>
        <button className="btn secondary block" type="submit" disabled={busy !== null}>
          {busy === "create" ? t("working") : t("create")}
        </button>
      </form>

      <button className="btn secondary small" type="button" onClick={signOut} style={{ alignSelf: "center", marginTop: 20 }}>
        {t("signOut")}
      </button>
    </main>
  );
}
