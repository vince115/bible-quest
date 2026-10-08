"use client";

import { create } from "zustand";
import { nextAutoAction } from "./auto";
import { RULES_V2 } from "./data";
import { castSkill, createBattle, playCard, resolveGoliath, startNextTurn, type Target } from "./engine";
import type { BattleState, SkillId } from "./types";

/** Pause between auto-battle steps so the player can follow along (ms). */
const AUTO_STEP_DELAY = 450;

interface BattleV2Store {
  battle: BattleState | null;
  /** True while Goliath's turn plays out; player input is locked. */
  resolving: boolean;
  /** Auto-battle: the AI plays the player's side step by step. */
  auto: boolean;
  runId: number;
  start: () => void;
  play: (uid: number) => void;
  playAll: () => void;
  cast: (skill: SkillId, target?: Target) => void;
  endTurn: () => void;
  setAuto: (on: boolean) => void;
}

export const useBattleV2Store = create<BattleV2Store>((set, get) => {
  const act = (fn: (b: BattleState) => BattleState) => {
    const { battle, resolving } = get();
    if (battle && !resolving) set({ battle: fn(battle) });
  };

  /** One auto-battle step; reschedules itself until auto is switched off or the battle ends. */
  const autoStep = (runId: number) => {
    const { auto, battle, resolving } = get();
    if (!auto || get().runId !== runId || !battle || battle.result !== "ongoing" || resolving) return;
    const action = nextAutoAction(battle);
    if (action.type === "end") {
      get().endTurn(); // endTurn resumes the auto loop once the next turn has started
      return;
    }
    act((b) => (action.type === "play" ? playCard(b, action.uid) : castSkill(b, action.skill, action.target)));
    setTimeout(() => autoStep(runId), AUTO_STEP_DELAY);
  };

  return {
    battle: null,
    resolving: false,
    auto: false,
    runId: 0,
    start: () => set((st) => ({ battle: createBattle(), resolving: false, auto: false, runId: st.runId + 1 })),
    play: (uid) => act((b) => playCard(b, uid)),
    playAll: () => act((b) => b.hand.reduce((s, c) => playCard(s, c.uid), b)),
    cast: (skill, target) => act((b) => castSkill(b, skill, target)),
    endTurn: () => {
      const { battle, resolving, runId } = get();
      if (!battle || resolving || battle.result !== "ongoing") return;
      // Goliath acts, then (after a beat) the next turn starts.
      const after = resolveGoliath(battle);
      set({ battle: after, resolving: after.result === "ongoing" });
      if (after.result !== "ongoing") return;
      setTimeout(() => {
        if (get().runId !== runId) return;
        set({ battle: startNextTurn(get().battle!), resolving: false });
        if (get().auto) setTimeout(() => autoStep(runId), AUTO_STEP_DELAY);
      }, RULES_V2.stepDelay);
    },
    setAuto: (on) => {
      set({ auto: on });
      if (on) autoStep(get().runId);
    },
  };
});
