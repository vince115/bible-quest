"use client";

import Link from "next/link";
import { RULES } from "@/game/data/rules";
import { useT } from "@/game/locale";

const PHASE_COLORS = ["text-purple-400", "text-amber-300", "text-amber-400", "text-red-400"];

export function TitleScreen() {
  const t = useT();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">{t("ui.tagline")}</p>
        <h1 className="mt-2 text-5xl font-bold text-stone-100">Bible Quest</h1>
        <p className="mt-3 text-stone-400">{t("ui.subtitle")}</p>
      </div>

      <ol className="max-w-lg space-y-1 text-left text-sm text-stone-300">
        {PHASE_COLORS.map((color, i) => (
          <li key={i}>
            <span className={color}>
              {i + 1}. {t(`ui.phase.${i + 1}`)}
            </span>{" "}
            — {t(`ui.phaseDesc.${i + 1}`, RULES)}
          </li>
        ))}
      </ol>

      <Link
        href="/battle"
        className="rounded-2xl bg-amber-500 px-8 py-4 text-lg font-bold text-stone-950 shadow-lg hover:bg-amber-400"
      >
        {t("ui.start")}
      </Link>
    </main>
  );
}
