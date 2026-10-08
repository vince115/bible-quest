"use client";

import { useEffect } from "react";
import { PARTY_ORDER } from "@/game/data/characters";
import { useBattleStore } from "@/game/store";
import { useT } from "@/game/locale";
import { BattleLog } from "./BattleLog";
import { CharacterPanel } from "./CharacterPanel";
import { EnemyPanel } from "./EnemyPanel";
import { ResourceBar } from "./ResourceBar";
import { ResultOverlay } from "./ResultOverlay";
import { ScriptureHand } from "./ScriptureHand";

export function BattleScreen() {
  const t = useT();
  const battle = useBattleStore((s) => s.battle);
  const resolving = useBattleStore((s) => s.resolving);
  const start = useBattleStore((s) => s.start);
  const playCard = useBattleStore((s) => s.playCard);
  const activateSkill = useBattleStore((s) => s.activateSkill);
  const spendCourage = useBattleStore((s) => s.spendCourage);
  const endTurn = useBattleStore((s) => s.endTurn);
  const pendingRevive = useBattleStore((s) => s.pendingRevive);
  const chooseReviveTarget = useBattleStore((s) => s.chooseReviveTarget);
  const cancelRevive = useBattleStore((s) => s.cancelRevive);

  // The deck is shuffled on the client so prerendering stays deterministic.
  useEffect(() => {
    start();
  }, [start]);

  if (!battle) {
    return <div className="flex flex-1 items-center justify-center text-stone-400">{t("ui.preparing")}</div>;
  }

  const locked = resolving || battle.result !== "ongoing";

  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-4">
        <EnemyPanel battle={battle} />

        <div className="grid gap-3 sm:grid-cols-3">
          {PARTY_ORDER.map((id) => (
            <CharacterPanel
              key={id}
              battle={battle}
              id={id}
              locked={locked}
              onSkill={(skill) => activateSkill(id, skill)}
              onSpendCourage={() => spendCourage(id)}
              reviveMode={pendingRevive !== null}
              onRevive={() => chooseReviveTarget(id)}
            />
          ))}
        </div>

        <ResourceBar battle={battle} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <ScriptureHand
              battle={battle}
              locked={locked}
              onPlay={playCard}
              pendingRevive={pendingRevive}
              onCancelRevive={cancelRevive}
            />
          </div>
          <button
            onClick={endTurn}
            disabled={locked}
            className="rounded-2xl bg-red-700 px-6 py-4 text-lg font-bold text-white shadow-lg enabled:hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40 sm:mt-6"
          >
            {resolving ? t("ui.resolving") : t("ui.endTurn")}
          </button>
        </div>
      </div>

      <BattleLog log={battle.log} />

      {battle.result !== "ongoing" && <ResultOverlay battle={battle} onRetry={start} />}
    </div>
  );
}
