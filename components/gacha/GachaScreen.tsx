"use client";

// /gacha: pick a booster pack from the ring, tear it open, turn the five cards over. Blessing points (earned by
// clearing stages) pay for it; free play, no money involved.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/game/locale";
import { PACK, PACKS, PACKS_ON_RING, currentPack, nextRotation, packCost, type PackKind } from "@/game/v3/gacha";
import { useProgressStore } from "@/game/v3/progress";
import { PackStage } from "./PackStage";
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
  // One kind of pack is on offer at a time; the day (on the player's clock) decides which. Read after mount, so the prerendered page matches.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is read once on the client after mount
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(tick);
  }, []);
  const debugAll = process.env.NEXT_PUBLIC_DEBUG_ALL_PACKS === "1";
  const [forced, setForced] = useState<PackKind | null>(null);
  const offer = forced ?? (now ? currentPack(now) : null);
  const left = now ? Math.max(0, nextRotation(now).getTime() - now.getTime()) : 0;
  const hours = Math.floor(left / 3600000);
  const minutes = Math.floor((left % 3600000) / 60000);
  const enough = ready && points >= packCost();

  // The pack is paid for when it is torn open, so choosing and backing out costs nothing.
  const torn = (pack: PackKind) => {
    const results = buyPack(pack.id);
    setPhase(results ? { name: "reveal", results } : { name: "choose" });
  };

  return (
    <main className="flex min-h-[calc(100dvh-3rem)] flex-1 flex-col items-center gap-6 bg-gradient-to-b from-stone-900 via-stone-950 to-black px-4 py-8">
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

      {phase.name === "choose" && offer && (
        <>
          <div className="text-center">
            <div className="text-xs text-stone-400">{t("v3.gacha.onOffer")}</div>
            <div className="text-2xl font-black text-amber-200">{t(`v3.pack.${offer.id}.name`)}</div>
            {!forced && <div className="mt-1 text-xs text-stone-500">{t("v3.gacha.changesIn", { h: hours, m: minutes })}</div>}
          </div>
          {ready && !enough ? (
            <p className="text-sm text-amber-200">
              {t("v3.gacha.short")}{" "}
              <Link href="/campaign" className="ml-1 rounded-full border border-amber-300/70 px-3 py-0.5 font-semibold hover:bg-white/10">
                {t("v3.campaign.title")}
              </Link>
            </p>
          ) : (
            <p className="max-w-sm text-center text-xs text-stone-400">{t("v3.gacha.pickHint")}</p>
          )}
          <PackStage pack={offer} count={PACKS_ON_RING} canOpen={enough} onPick={(pack) => setPhase({ name: "tear", pack })} />
          {debugAll && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {PACKS.map((p) => (
                <button key={p.id} onClick={() => setForced(p)} className={`rounded-full border px-2.5 py-0.5 text-xs ${offer.id === p.id ? "border-amber-300 text-amber-200" : "border-stone-600 text-stone-400"}`}>
                  {t(`v3.pack.${p.id}.name`)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {phase.name === "tear" && (
        <>
          <PackTear pack={phase.pack} onTorn={() => torn(phase.pack)} />
          <button onClick={() => setPhase({ name: "choose" })} className="rounded-full border border-stone-500 px-4 py-1.5 text-sm text-stone-300 hover:bg-white/10">
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
    </main>
  );
}
