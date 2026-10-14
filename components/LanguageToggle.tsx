"use client";

import { useEffect } from "react";
import { useLocaleStore, useT } from "@/game/locale";

/** `inline` sits in the page (the top bar); otherwise it floats in the corner (battle pages). */
export function LanguageToggle({ inline = false }: { inline?: boolean }) {
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
      className={`${inline ? "" : "fixed top-2.5 right-2.5 sm:top-auto sm:bottom-3 sm:right-3 z-40 "}flex overflow-hidden rounded-full border border-stone-600 bg-stone-900/90 text-xs font-semibold shadow-lg backdrop-blur-sm`}
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
