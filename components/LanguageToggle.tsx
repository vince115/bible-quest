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
      className={`${inline ? "" : "fixed top-2.5 right-2.5 sm:top-auto sm:bottom-3 sm:right-3 z-40 "}flex overflow-hidden rounded-full bg-[#d4b35f]/15 text-xs font-semibold backdrop-blur-sm`}
      role="group"
      aria-label={t("ui.switchLanguage")}
    >
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`px-3 py-1.5 transition ${locale === l ? "bg-[#d4b35f] text-[#2b1d07]" : "text-[#efe2bd] hover:bg-[#d4b35f]/25"}`}
        >
          {l === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
