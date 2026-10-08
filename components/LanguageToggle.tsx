"use client";

import { useEffect } from "react";
import { useLocaleStore, useT } from "@/game/locale";

export function LanguageToggle() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = useT();

  useEffect(() => {
    useLocaleStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-Hant" : "en";
  }, [locale]);

  return (
    <div
      className="fixed bottom-3 right-3 z-40 flex overflow-hidden rounded-full border border-stone-600 bg-stone-900/90 text-xs font-semibold"
      role="group"
      aria-label={t("ui.switchLanguage")}
    >
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`px-3 py-1.5 ${locale === l ? "bg-amber-500 text-stone-950" : "text-stone-300 hover:bg-stone-800"}`}
        >
          {l === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
