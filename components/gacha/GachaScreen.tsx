"use client";

// /gacha: pick a booster pack from the ring, tear it open, turn the five cards over. Blessing points (earned by
// clearing stages) pay for it; free play, no money involved.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/game/locale";
import { PACK, PACKS, type PackKind } from "@/game/v3/gacha";
import { useProgressStore } from "@/game/v3/progress";
import { PackCarousel } from "./PackCarousel";
import { PackReveal, type Pulled } from "./PackReveal";
import { PackTear } from "./PackTear";

type Phase = { name: "choose" } | { name: "tear"; pack: PackKind } | { name: "reveal"; results: Pulled[] };

export function GachaScreen() {
  const t = useT();
  const points = useProgressStore((s) => s.points);
  const buyPack = useProgressStore((s) => s.buyPack);
  // Read from this browser after mount, so the prerendered page matches.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve(useProgressStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  const [phase, setPhase] = useState<Phase>({ name: "choose" });
  const enough = ready && points >= PACK.cost;

  // The pack is paid for when it is torn open, so choosing and backing out costs nothing.
  const torn = (pack: PackKind) => {
    const results = buyPack(pack.id);
    setPhase(results ? { name: "reveal", results } : { name: "choose" });
  };

  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center gap-6 bg-gradient-to-b from-stone-900 via-stone-950 to-black px-4 py-8">
      <div className="max-w-xl text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("v3.gacha.title")}</h1>
        <p className="mt-2 text-sm text-stone-400">{t("v3.gacha.hint")}</p>
      </div>

      <div className="flex items-baseline gap-3 rounded-full border-2 border-amber-400/70 bg-stone-900 px-5 py-2">
        <span className="text-sm text-stone-300">{t("v3.gacha.points")}</span>
        <span className="text-2xl font-black tabular-nums text-amber-300">{ready ? points : "–"}</span>
        <span className="text-xs text-stone-500">
          {t("v3.gacha.pack")} {PACK.cost}
        </span>
      </div>

      {phase.name === "choose" &&
        (enough ? (
          <>
            <p className="max-w-sm text-center text-xs text-stone-400">{t("v3.gacha.pickHint")}</p>
            <PackCarousel packs={PACKS} onPick={(pack) => setPhase({ name: "tear", pack })} />
          </>
        ) : (
          <p className="text-sm text-stone-400">
            {ready ? t("v3.gacha.short") : ""}{" "}
            {ready && (
              <Link href="/campaign" className="underline">
                {t("v3.campaign.title")}
              </Link>
            )}
          </p>
        ))}

      {phase.name === "tear" && (
        <>
          <PackTear pack={phase.pack} onTorn={() => torn(phase.pack)} />
          <button onClick={() => setPhase({ name: "choose" })} className="text-sm text-stone-400 underline">
            {t("v3.gacha.back")}
          </button>
        </>
      )}

      {phase.name === "reveal" && <PackReveal results={phase.results} onAgain={() => setPhase({ name: "choose" })} />}

      {phase.name === "choose" && (
        <div className="max-w-md text-center text-xs text-stone-500">
          <p>
            {t("v3.gacha.rates")}：
            {[
              [t("v3.gacha.slots13"), PACK.slots[0]],
              [t("v3.gacha.slot4"), PACK.slots[3]],
              [t("v3.gacha.slot5"), PACK.slots[4]],
            ].map(([label, odds]) => (
              <span key={label as string} className="mr-3 inline-block">
                {label as string} {Object.entries(odds as Record<string, number>).map(([r, p]) => `${r} ${p}%`).join("／")}
              </span>
            ))}
          </p>
          <p className="mt-1">{t("v3.gacha.guarantee")}</p>
        </div>
      )}

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
