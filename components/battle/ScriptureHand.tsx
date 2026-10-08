"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CARD_BY_ID } from "@/game/data/cards";
import { RULES } from "@/game/data/rules";
import { canPlayCard } from "@/game/engine";
import type { BattleState, CardDef } from "@/game/types";
import { useT } from "@/game/locale";

function cardTone(card: CardDef) {
  const e = card.effect;
  if (e.damage || e.davidStrike) return "border-red-500/60 from-red-950/80";
  if (e.faith) return "border-amber-400/60 from-amber-950/80";
  if (e.courage || e.removeFearAll) return "border-orange-500/60 from-orange-950/80";
  if (e.revive) return "border-emerald-300 from-emerald-900/80";
  if (e.healLowest || e.healAll) return "border-emerald-500/60 from-emerald-950/80";
  return "border-sky-400/60 from-sky-950/80";
}

export function ScriptureHand({
  battle,
  locked,
  onPlay,
  pendingRevive,
  onCancelRevive,
}: {
  battle: BattleState;
  locked: boolean;
  onPlay: (handIndex: number) => void;
  pendingRevive: number | null;
  onCancelRevive: () => void;
}) {
  const t = useT();
  return (
    <section>
      <div className="mb-2 flex items-center justify-between text-xs text-stone-400">
        <span className="font-semibold text-stone-200">
          {t("ui.hand", { n: battle.hand.length, max: RULES.maxHand })}
        </span>
        <span>{t("ui.deck", { deck: battle.drawPile.length, discard: battle.discard.length })}</span>
      </div>
      {pendingRevive !== null && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-emerald-500/60 bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-200">
          <span>✝ {t("ui.chooseRevive")}</span>
          <button onClick={onCancelRevive} className="font-semibold text-stone-300 hover:text-white">
            {t("ui.cancel")}
          </button>
        </div>
      )}
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
                className={`relative flex w-36 flex-col rounded-xl border-2 bg-gradient-to-b to-stone-900 p-2.5 text-left shadow-lg disabled:cursor-not-allowed disabled:opacity-45 ${cardTone(card)} ${pendingRevive === i ? "ring-2 ring-emerald-300" : ""}`}
              >
                <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-stone-900 shadow">
                  {card.cost}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-wider text-stone-400">
                  {t(`card.${card.id}.ref`)}
                </span>
                <span className="mt-0.5 text-sm font-bold leading-tight text-stone-100">
                  {t(`card.${card.id}.name`)}
                </span>
                <span className="mt-auto pt-2 text-xs leading-snug text-stone-300">{t(`card.${card.id}.text`, { ...card.effect })}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
