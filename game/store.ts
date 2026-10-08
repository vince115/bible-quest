"use client";

import { create } from "zustand";
import { RULES } from "./data/rules";
import {
  activateSkill,
  createBattle,
  needsReviveTarget,
  playCard,
  resolveBasicAttacks,
  resolveGoliath,
  spendCourage,
  startNextTurn,
} from "./engine";
import type { BattleState, CharacterId, SkillId } from "./types";

interface BattleStore {
  battle: BattleState | null;
  /** True while end-of-turn steps are resolving; player input is locked. */
  resolving: boolean;
  runId: number;
  /** Hand index of a resurrection card waiting for the player to pick a fallen ally. */
  pendingRevive: number | null;
  start: () => void;
  playCard: (handIndex: number) => void;
  chooseReviveTarget: (id: CharacterId) => void;
  cancelRevive: () => void;
  activateSkill: (id: CharacterId, skill: SkillId) => void;
  spendCourage: (id: CharacterId) => void;
  endTurn: () => void;
}

export const useBattleStore = create<BattleStore>((set, get) => {
  const act = (fn: (b: BattleState) => BattleState) => {
    const { battle, resolving } = get();
    if (!battle || resolving) return;
    set({ battle: fn(battle), pendingRevive: null });
  };

  return {
    battle: null,
    resolving: false,
    runId: 0,
    pendingRevive: null,

    start: () =>
      set((st) => ({ battle: createBattle(), resolving: false, pendingRevive: null, runId: st.runId + 1 })),

    playCard: (i) => {
      const { battle, resolving } = get();
      if (battle && !resolving && needsReviveTarget(battle, i)) set({ pendingRevive: i });
      else act((b) => playCard(b, i));
    },
    chooseReviveTarget: (id) => {
      const i = get().pendingRevive;
      if (i !== null) act((b) => playCard(b, i, id));
    },
    cancelRevive: () => set({ pendingRevive: null }),
    activateSkill: (id, skill) => act((b) => activateSkill(b, id, skill)),
    spendCourage: (id) => act((b) => spendCourage(b, id)),

    endTurn: () => {
      const { battle, resolving, runId } = get();
      if (!battle || resolving || battle.result !== "ongoing") return;

      // Each step runs after a short delay so the player can follow what happens.
      const steps: ((b: BattleState) => BattleState)[] = [
        resolveBasicAttacks,
        (b) => resolveGoliath(b),
        (b) => startNextTurn(b),
      ];
      set({ resolving: true, pendingRevive: null });

      const run = (i: number) => {
        if (get().runId !== runId) return; // battle was restarted
        const next = steps[i](get().battle!);
        const done = i === steps.length - 1 || next.result !== "ongoing";
        set({ battle: next, resolving: !done });
        if (!done) setTimeout(() => run(i + 1), RULES.stepDelay);
      };
      run(0);
    },
  };
});
