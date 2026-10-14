"use client";

// /gacha: spend blessing points (earned by clearing stages) to draw character cards. Free play, no money involved.
import Link from "next/link";
import { useEffect, useState } from "react";
import { CHARACTER_ELEMENT } from "@/game/v2/data";
import type { CharacterId } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { GACHA_RATES, PULL_COST, TEN_PULL } from "@/game/v3/gacha";
import { pullCost, useProgressStore } from "@/game/v3/progress";
import { CharacterCardFace, figureArea } from "@/components/cards/CharacterCardFace";
import { HoloCard } from "@/components/cards/HoloCard";
import { CARD_RARITY } from "@/components/cards/rarity";

interface Result {
  card: CharacterId;
  isNew: boolean;
}

export function GachaScreen() {
  const t = useT();
  const points = useProgressStore((s) => s.points);
  const pull = useProgressStore((s) => s.pull);
  // Read from this browser after mount, so the prerendered page matches.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve(useProgressStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  const [results, setResults] = useState<Result[] | null>(null);

  const draw = (count: 1 | 10) => {
    const got = pull(count);
    if (got) setResults(got);
  };
  const can = (count: 1 | 10) => ready && points >= pullCost(count);

  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center gap-6 bg-gradient-to-b from-stone-900 via-stone-950 to-black px-4 py-8">
      <div className="max-w-xl text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("v3.gacha.title")}</h1>
        <p className="mt-2 text-sm text-stone-400">{t("v3.gacha.hint")}</p>
      </div>

      <div className="flex items-baseline gap-2 rounded-full border-2 border-amber-400/70 bg-stone-900 px-5 py-2">
        <span className="text-sm text-stone-300">{t("v3.gacha.points")}</span>
        <span className="text-2xl font-black tabular-nums text-amber-300">{ready ? points : "–"}</span>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => draw(1)}
          disabled={!can(1)}
          className="rounded-2xl bg-amber-500 px-6 py-3 text-lg font-bold text-stone-950 shadow-lg enabled:hover:bg-amber-400 disabled:opacity-40"
        >
          {t("v3.gacha.one")} <span className="text-sm font-semibold opacity-80">{PULL_COST}</span>
        </button>
        <button
          onClick={() => draw(10)}
          disabled={!can(10)}
          className="rounded-2xl bg-red-700 px-6 py-3 text-lg font-bold text-white shadow-lg enabled:hover:bg-red-600 disabled:opacity-40"
        >
          {t("v3.gacha.ten")} <span className="text-sm font-semibold opacity-80">{TEN_PULL.cost}</span>
        </button>
      </div>
      {ready && !can(1) && (
        <p className="text-sm text-stone-400">
          {t("v3.gacha.short")}{" "}
          <Link href="/campaign" className="underline">
            {t("v3.campaign.title")}
          </Link>
        </p>
      )}

      {results && (
        <section aria-label={t("v3.gacha.result")} className="grid w-full max-w-4xl grid-cols-[repeat(auto-fill,minmax(130px,1fr))] justify-items-center gap-x-3 gap-y-5">
          {results.map(({ card, isNew }, i) => (
            <div key={`${card}-${i}`} className="relative">
              <HoloCard element={CHARACTER_ELEMENT[card]} rarity={CARD_RARITY[card]} effects touchTilt={false} figure={figureArea(card)} className="w-[130px] text-[6.1px]">
                <CharacterCardFace id={card} />
              </HoloCard>
              <span className={`absolute -right-1 -top-1 rounded-full px-1.5 text-xs font-black shadow ${isNew ? "bg-red-600 text-white" : "bg-stone-700 text-stone-100"}`}>
                {isNew ? t("v3.gacha.new") : t("v3.gacha.copy")}
              </span>
            </div>
          ))}
        </section>
      )}

      <p className="max-w-md text-center text-xs text-stone-500">
        {t("v3.gacha.rates")}：{(Object.keys(GACHA_RATES) as (keyof typeof GACHA_RATES)[]).map((r) => `${r} ${GACHA_RATES[r]}%`).join("　")}．{t("v3.gacha.guarantee")}
      </p>

      <div className="flex flex-wrap justify-center gap-4 text-xs text-stone-400">
        <Link href="/collection" className="underline">
          {t("v3.collection.link")}
        </Link>
        <Link href="/campaign" className="underline">
          {t("v3.campaign.title")}
        </Link>
        <Link href="/" className="underline">
          {t("v2.ui.backHome")}
        </Link>
      </div>
    </main>
  );
}
