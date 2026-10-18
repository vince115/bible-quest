"use client";

// /gacha: pick a booster pack from the ring, tear it open, turn the five cards over. Blessing points (earned by
// clearing stages) pay for it; free play, no money involved.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/game/locale";
import { PACK, PACKS, PACKS_ON_RING, packCost, type PackKind } from "@/game/v3/gacha";
import { useProgressStore } from "@/game/v3/progress";
import { PackArt } from "./PackArt";
import { PackStage } from "./PackStage";
import { PackReveal, type Pulled } from "./PackReveal";
import { PackTear } from "./PackTear";
import { button } from "@/components/ui/buttons";

const CHOSEN_KEY = "bible-quest-gacha-pack";

type Phase = { name: "choose" } | { name: "tear"; pack: PackKind } | { name: "reveal"; results: Pulled[]; pack: PackKind };

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
  // The player picks the kind of pack; the choice is remembered in this browser.
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this browser after mount, so the prerendered page matches
      setChosen(window.localStorage.getItem(CHOSEN_KEY));
    } catch {}
  }, []);
  const offer = PACKS.find((p) => p.id === chosen) ?? PACKS[0];
  // The row of packs slides so the chosen one stands right above the big pack on the stage, in the middle of the page.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const mine = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !mine) return;
    row.scrollTo({ left: mine.offsetLeft + mine.offsetWidth / 2 - row.clientWidth / 2, behavior: "smooth" });
  }, [offer.id, phase.name]);
  const choose = (pack: PackKind) => {
    setChosen(pack.id);
    try {
      window.localStorage.setItem(CHOSEN_KEY, pack.id);
    } catch {}
  };
  const enough = ready && points >= packCost();

  // The pack is paid for when it is torn open, so choosing and backing out costs nothing.
  const torn = (pack: PackKind) => {
    const results = buyPack(pack.id);
    setPhase(results ? { name: "reveal", results, pack } : { name: "choose" });
  };

  return (
    <main className="flex min-h-[calc(100dvh-3rem)] flex-1 flex-col items-center gap-6 px-4 py-8">
      <div className="max-w-xl text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("v3.gacha.title")}</h1>
        <p className="mt-2 text-sm text-stone-400">{t("v3.gacha.hint")}</p>
      </div>

      <div className="flex items-baseline gap-3 rounded-full bg-[#d4b35f]/15 px-5 py-2">
        <span className="text-sm text-stone-300">{t("v3.gacha.points")}</span>
        <span className="text-2xl font-black tabular-nums text-amber-300">{ready ? points : "–"}</span>
        <span className="text-xs text-stone-500">
          {t("v3.gacha.pack")} {PACK.cost}
        </span>
      </div>

      {phase.name === "choose" && (
        <>
          <div className="w-full max-w-3xl text-center">
            <div className="text-xs text-stone-400">{t("v3.gacha.onOffer")}</div>
            <div ref={rowRef} className="relative mt-2 flex gap-2 overflow-x-auto py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingInline: "calc(50% - 2.125rem)" }} role="radiogroup" aria-label={t("v3.gacha.onOffer")}>
              {PACKS.map((p) => (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={offer.id === p.id}
                  onClick={() => choose(p)}
                  style={{ fontSize: "0.5rem" }}
                  className={`w-[4.25rem] shrink-0 rounded-md p-0.5 transition ${offer.id === p.id ? "scale-105 ring-2 ring-amber-300" : "opacity-60 hover:opacity-100"}`}
                >
                  <PackArt pack={p} />
                </button>
              ))}
            </div>
            <div className="mt-1 text-2xl font-black text-amber-200">{t(`v3.pack.${offer.id}.name`)}</div>
          </div>
          {ready && !enough ? (
            <p className="text-sm text-amber-200">
              {t("v3.gacha.short")}{" "}
              <Link href="/campaign" className={`ml-1 ${button("secondary", "sm")}`}>
                {t("v3.campaign.title")}
              </Link>
            </p>
          ) : (
            <p className="max-w-sm text-center text-xs text-stone-400">{t("v3.gacha.pickHint")}</p>
          )}
          <PackStage pack={offer} count={PACKS_ON_RING} canOpen={enough} onPick={(pack) => setPhase({ name: "tear", pack })} />
        </>
      )}

      {phase.name === "tear" && (
        <>
          <PackTear pack={phase.pack} onTorn={() => torn(phase.pack)} />
          <button onClick={() => setPhase({ name: "choose" })} className={button("secondary")}>
            {t("v3.gacha.back")}
          </button>
        </>
      )}

      {phase.name === "reveal" && <PackReveal results={phase.results} pack={phase.pack} onAgain={() => setPhase({ name: "choose" })} />}

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
