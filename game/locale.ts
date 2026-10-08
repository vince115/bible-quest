"use client";

import { useCallback } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type Locale, type Params, translate } from "./i18n";

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// Storage can throw (private mode, blocked site data); fall back silently.
const safeStorage = {
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: "zh",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "bible-quest-locale",
      storage: createJSONStorage(() => safeStorage),
      // Rehydrated after mount (see LanguageToggle) so server and first client render match.
      skipHydration: true,
    },
  ),
);

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return useCallback((key: string, params?: Params) => translate(locale, key, params), [locale]);
}
