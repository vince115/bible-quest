"use client";

// Turning the five cards of an opened pack over, one at a time, then all five together.
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { playSfx } from "@/game/sfx";
import { CHARACTER_ELEMENT } from "@/game/v2/data";
import type { CharacterId } from "@/game/v2/types";
import { useT } from "@/game/locale";
import { CharacterCardFace, figureArea } from "@/components/cards/CharacterCardFace";
import { HoloCard } from "@/components/cards/HoloCard";
import { CARD_RARITY, type Rarity } from "@/components/cards/rarity";
import { CARD_BACK } from "@/components/cards/ScriptureCardFace";
import { asset } from "@/game/assets";

export interface Pulled {
  card: CharacterId;
  isNew: boolean;
}

/** The glow around a card as it turns over: more for the rarer ones. */
const GLOW: Record<Rarity, string> = {
  N: "",
  R: "shadow-[0_0_28px_6px_rgb(56_189_248/0.55)]",
  SR: "shadow-[0_0_34px_8px_rgb(167_139_250/0.7)]",
  SSR: "shadow-[0_0_40px_10px_rgb(251_191_36/0.8)]",
  UR: "shadow-[0_0_46px_12px_rgb(244_114_182/0.85)]",
};

const Badge = ({ isNew, label }: { isNew: boolean; label: string }) => (
  <span className={`absolute -right-1 -top-1 z-10 rounded-full px-1.5 text-xs font-black shadow ${isNew ? "bg-red-600 text-white" : "bg-stone-700 text-stone-100"}`}>{label}</span>
);

export function PackReveal({ results, onAgain }: { results: Pulled[]; onAgain: () => void }) {
  const t = useT();
  const [at, setAt] = useState(0); // the card on show
  const [flipped, setFlipped] = useState(false);
  const [all, setAll] = useState(false);

  const current = results[at];
  const rare = (i: number) => ["SR", "SSR", "UR"].includes(CARD_RARITY[results[i].card]);
  // The cards land on the table one after another: a soft thud for each, as it arrives.
  useEffect(() => {
    if (!all) return;
    const timers = results.map((_, i) => window.setTimeout(() => playSfx(rare(i) ? "rare" : "land"), 220 * i + 380));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- results never change while the pack is shown
  }, [all]);
  const tap = () => {
    if (!flipped) {
      setFlipped(true);
      playSfx(rare(at) ? "rare" : "flip");
    }
    else if (at < results.length - 1) {
      setAt(at + 1);
      setFlipped(false);
    } else setAll(true);
  };

  if (all) {
    return (
      <div className="flex w-full flex-col items-center gap-5">
        <section aria-label={t("v3.gacha.result")} className="grid w-full max-w-4xl grid-cols-[repeat(auto-fill,minmax(130px,1fr))] justify-items-center gap-x-3 gap-y-5">
          {results.map(({ card, isNew }, i) => (
            // The cards come in one after another: each flies up from below the screen's middle, turning as it lands.
            <motion.div
              key={`${card}-${i}`}
              initial={{ opacity: 0, y: 260, scale: 0.4, rotate: i % 2 ? 14 : -14 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              transition={{ delay: i * 0.22, type: "spring", stiffness: 170, damping: 17 }}
              className={`relative rounded-md ${GLOW[CARD_RARITY[card]]}`}
            >
              <HoloCard element={CHARACTER_ELEMENT[card]} rarity={CARD_RARITY[card]} effects touchTilt={false} figure={figureArea(card)} className="w-[130px] text-[6.1px]">
                <CharacterCardFace id={card} />
              </HoloCard>
              <Badge isNew={isNew} label={isNew ? t("v3.gacha.new") : t("v3.gacha.copy")} />
            </motion.div>
          ))}
        </section>
        <button onClick={onAgain} className="rounded-2xl bg-amber-500 px-8 py-3 text-lg font-bold text-stone-950 shadow-lg hover:bg-amber-400">
          {t("v3.gacha.again")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="text-sm font-bold tabular-nums text-stone-400">
        {at + 1} / {results.length}
      </div>
      <button
        type="button"
        onClick={tap}
        aria-label={flipped ? t("v3.gacha.nextCard") : t("v3.gacha.tap")}
        className="relative w-[220px] text-[10.3px] [perspective:1000px]"
        style={{ aspectRatio: "63/88" }}
      >
        <div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : "none" }}>
          {/* The back: the card face down */}
          <div className="absolute inset-0 overflow-hidden rounded-md shadow-xl [backface-visibility:hidden]">
            {/* eslint-disable-next-line @next/next/no-img-element -- card art is a plain file */}
            <img src={asset(CARD_BACK)} alt="" draggable={false} className="h-full w-full select-none object-cover" />
          </div>
          {/* The front */}
          <div className={`absolute inset-0 rounded-md [backface-visibility:hidden] [transform:rotateY(180deg)] ${flipped ? GLOW[CARD_RARITY[current.card]] : ""}`}>
            <HoloCard element={CHARACTER_ELEMENT[current.card]} rarity={CARD_RARITY[current.card]} effects touchTilt={false} figure={figureArea(current.card)} className="w-full text-[10.3px]">
              <CharacterCardFace id={current.card} />
            </HoloCard>
            <Badge isNew={current.isNew} label={current.isNew ? t("v3.gacha.new") : t("v3.gacha.copy")} />
          </div>
        </div>
      </button>
      <p className="h-5 text-sm text-stone-300">{flipped ? (at < results.length - 1 ? t("v3.gacha.nextCard") : "") : t("v3.gacha.tap")}</p>
      <button onClick={() => setAll(true)} className="rounded-full border border-stone-500 px-4 py-1.5 text-sm text-stone-200 hover:bg-white/10">
        {t("v3.gacha.skip")}
      </button>
    </div>
  );
}
