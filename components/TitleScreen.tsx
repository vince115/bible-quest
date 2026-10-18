"use client";

import Link from "next/link";
import { useT } from "@/game/locale";
import { button } from "@/components/ui/buttons";

export function TitleScreen() {
  const t = useT();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">{t("ui.tagline")}</p>
        <h1 className="mt-2 text-5xl font-bold text-stone-100">Bible Quest</h1>
        <p className="mt-3 text-stone-400">{t("ui.subtitle")}</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          href="/campaign"
          className={button("primary", "lg")}
        >
          {t("ui.campaign")}
        </Link>
        <Link href="/gacha" className={button("secondary")}>
          {t("v3.gacha.title")}
        </Link>
        <Link href="/collection" className={button("secondary")}>
          {t("v3.collection.link")}
        </Link>
        <Link href="/battle-v3" className={button("secondary")}>
          {t("ui.free")}
        </Link>
      </div>
    </main>
  );
}
