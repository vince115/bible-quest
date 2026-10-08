"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CARD_BY_ID } from "@/game/data/cards";
import { RULES } from "@/game/data/rules";
import { canPlayCard } from "@/game/engine";
import type { BattleState, CardDef } from "@/game/types";

function cardTone(card: CardDef) {
  const e = card.effect;
  if (e.damage) return "border-red-500/60 from-red-950/80";
  if (e.faith) return "border-amber-400/60 from-amber-950/80";
  if (e.courage || e.removeFearAll) return "border-orange-500/60 from-orange-950/80";
  if (e.shieldAll || e.healLowest) return "border-sky-400/60 from-sky-950/80";
  return "border-yellow-300/60 from-yellow-950/80";
}

export function ScriptureHand({
  battle,
  locked,
  onPlay,
}: {
  battle: BattleState;
  locked: boolean;
  onPlay: (handIndex: number) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between text-xs text-stone-400">
        <span className="font-semibold text-stone-200">
          Scripture Hand ({battle.hand.length}/{RULES.maxHand})
        </span>
        <span>
          Deck {battle.drawPile.length} · Discard {battle.discard.length}
        </span>
      </div>
      <div className="flex min-h-44 flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {battle.hand.map((cardId, i) => {
            const card = CARD_BY_ID[cardId];
            const playable = !locked && canPlayCard(battle, i);
            return (
              <motion.button
                key={cardId}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -60, scale: 0.8 }}
                whileHover={playable ? { y: -8 } : undefined}
                onClick={() => onPlay(i)}
                disabled={!playable}
                className={`relative flex w-36 flex-col rounded-xl border-2 bg-gradient-to-b to-stone-900 p-2.5 text-left shadow-lg disabled:cursor-not-allowed disabled:opacity-45 ${cardTone(card)}`}
              >
                <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-stone-900 shadow">
                  {card.cost}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-wider text-stone-400">
                  {card.reference}
                </span>
                <span className="mt-0.5 text-sm font-bold leading-tight text-stone-100">
                  {card.name}
                </span>
                <span className="mt-auto pt-2 text-xs leading-snug text-stone-300">{card.text}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
