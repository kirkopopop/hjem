"use client";

import { useApp } from "./AppProvider";
import type { Locale } from "@/lib/i18n";

const OPTIONS: { value: Locale; label: string; name: string }[] = [
  { value: "en", label: "EN", name: "English" },
  { value: "ru", label: "RU", name: "Русский" },
];

export function LangSwitch() {
  const { locale, setLocale } = useApp();
  return (
    <div className="lang-switch" role="group" aria-label="Language / Язык">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-pressed={locale === o.value} aria-label={o.name} onClick={() => setLocale(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
