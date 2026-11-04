"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useApp } from "@/components/AppProvider";
import { Avatar, Icon } from "@/components/Icon";
import { CalendarSettings, WallSettings } from "@/components/CalendarSettings";
import { SettingRow, Switch } from "@/components/ui";
import { canVibrate, usePrefs, type ThemePref } from "@/lib/prefs";

const COLORS = ["#2F62C8", "#C2621B", "#24695C", "#7A4FB8", "#B0306A", "#5C6B12"];

export default function SettingsPage() {
  const { t, userId, profile, household, members, updateProfile, celebrate } = useApp();
  const [prefs, setPref] = usePrefs();
  const [vibrates, setVibrates] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature check after mount
    setVibrates(canVibrate());
  }, []);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setName] = useState<string | null>(null);
  const name = nameDraft ?? profile?.display_name ?? "";
  const [nameSaved, setNameSaved] = useState(false);

  const roleLabel = (r: string) => (r === "owner" ? t("roleOwner") : r === "device" ? t("roleDevice") : t("roleMember"));
  const inviteUrl = code ? `${typeof window !== "undefined" ? window.location.origin : ""}/onboarding?code=${code}` : "";

  async function makeCode() {
    if (!household) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase().rpc("create_invite", { p_household: household.id });
    if (error) setError(error.message);
    else setCode(data as string);
    setBusy(false);
  }

  async function share() {
    if (!code) return;
    const text = t("shareText", { code });
    if (navigator.share) {
      try {
        await navigator.share({ title: "hjem", text, url: inviteUrl });
        return;
      } catch {
        // cancelled: fall through to copy
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const err = await updateProfile({ display_name: name.trim() });
    if (err) setError(err);
    else {
      setName(null);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 1500);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t("settings")}</h1>
      </div>

      {error && <p className="error" role="alert" style={{ marginBottom: 12 }}>{t("somethingWrong", { msg: error })}</p>}

      <div className="stack stagger">
        <section className="card stack" aria-labelledby="me-h">
          <div className="profile-card">
            {profile && <Avatar name={name || profile.display_name} color={profile.color} size={60} />}
            <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <h2 id="me-h" className="profile-name">{profile?.display_name}</h2>
              <span className="small muted">{household?.name}</span>
            </div>
          </div>
          <form className="row" onSubmit={saveName} style={{ alignItems: "flex-end" }}>
            <label className="field grow">
              <span>{t("displayName")}</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
            </label>
            <button type="submit" className="btn secondary" disabled={!name.trim() || name.trim() === profile?.display_name}>
              {nameSaved ? t("saved") : t("save")}
            </button>
          </form>
          <div className="field">
            <span>{t("colour")}</span>
            <div className="swatches" role="group" aria-label={t("colour")}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  style={{ background: c }}
                  aria-label={c}
                  aria-pressed={profile?.color.toUpperCase() === c}
                  onClick={() => updateProfile({ color: c })}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="card stack" aria-labelledby="look-h">
          <h2 id="look-h" className="card-title">
            <span className="set-ico"><Icon name="palette" size={18} /></span>
            {t("appearance")}
          </h2>
          <p className="lead" style={{ margin: 0 }}>{t("appearanceLead")}</p>
          <div className="segmented theme-seg" role="group" aria-label={t("theme")}>
            {(
              [
                ["system", "monitor", "themeSystem"],
                ["light", "sun", "themeLight"],
                ["dark", "moon", "themeDark"],
              ] as const
            ).map(([v, icon, label]) => (
              <button key={v} type="button" aria-pressed={prefs.theme === v} onClick={() => setPref("theme", v as ThemePref)}>
                <Icon name={icon} size={17} />
                {t(label)}
              </button>
            ))}
          </div>
          <div className="set-list">
            <SettingRow icon="party" title={t("celebrations")} hint={t("celebrationsHint")}>
              <Switch
                on={prefs.celebrations}
                label={t("celebrations")}
                onChange={(v) => {
                  setPref("celebrations", v);
                  if (v) setTimeout(() => celebrate(null), 50);
                }}
              />
            </SettingRow>
            <SettingRow icon="vibrate" title={t("haptics")} hint={vibrates ? t("hapticsHint") : t("hapticsUnsupported")}>
              <Switch on={prefs.haptics && vibrates} disabled={!vibrates} label={t("haptics")} onChange={(v) => setPref("haptics", v)} />
            </SettingRow>
            <SettingRow icon="wave" title={t("reduceMotion")} hint={t("reduceMotionHint")}>
              <Switch on={prefs.reduceMotion} label={t("reduceMotion")} onChange={(v) => setPref("reduceMotion", v)} />
            </SettingRow>
          </div>
        </section>

        <section className="card stack" aria-labelledby="members-h">
          <h2 id="members-h" className="card-title">
            <span className="set-ico"><Icon name="people" size={18} /></span>
            {t("members")}
          </h2>
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 4 }}>
            {members.map((m) => (
              <li key={m.user_id} className="member-row">
                <Avatar name={m.profile.display_name} color={m.profile.color} size={40} />
                <div className="grow" style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700 }}>
                    {m.profile.display_name}
                    {m.user_id === userId ? ` (${t("you")})` : ""}
                  </span>
                </div>
                <span className="role-chip">{roleLabel(m.role)}</span>
              </li>
            ))}
          </ul>
          <div className="account-block stack" style={{ gap: 10 }}>
          <h3 id="invite-h" style={{ fontSize: 15, fontWeight: 800 }}>{t("invite")}</h3>
          <p className="lead" style={{ margin: 0 }}>{t("inviteLead")}</p>
          {code ? (
            <div className="stack invite-box">
              <span className="code" aria-live="polite">{code}</span>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button type="button" className="btn small" onClick={share}>
                  <Icon name="share" size={18} />
                  {t("share")}
                </button>
                <button type="button" className="btn small secondary" onClick={copy}>
                  <Icon name="copy" size={18} />
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn soft" onClick={makeCode} disabled={busy} style={{ alignSelf: "flex-start" }}>
              <Icon name="share" size={17} />
              {busy ? t("working") : t("makeCode")}
            </button>
          )}
          </div>
        </section>

        <CalendarSettings />

        <WallSettings />

        <section className="card stack" aria-labelledby="install-h">
          <h2 id="install-h" className="card-title">
            <span className="set-ico"><Icon name="phone" size={18} /></span>
            {t("install")}
          </h2>
          <p className="small" style={{ margin: 0, lineHeight: 1.5 }}>{t("installIphone")}</p>
          <p className="small" style={{ margin: 0, lineHeight: 1.5 }}>{t("installAndroid")}</p>
        </section>

        <button type="button" className="btn danger" onClick={signOut} style={{ alignSelf: "flex-start" }}>
          <Icon name="logout" size={17} />
          {t("signOut")}
        </button>
      </div>
    </>
  );
}
