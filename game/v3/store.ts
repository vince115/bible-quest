"use client";

import { create } from "zustand";
import { RULES_V2 } from "../v2/data";
import type { Target } from "../v2/engine";
import type { CharacterId, SkillId, StageId } from "../v2/types";
import { earnedBy, useAchievementStore, type AchievementId } from "./achievements";
import { nextBoardAutoAction } from "./auto";
import { castOnBoard, createBoard, playCardOnBoard, resolveBoard, startNextBoardTurn, swapFront, type Board } from "./engine";

/** Pause between auto-battle steps so the player can follow along (ms). */
const AUTO_STEP_DELAY = 450;

interface BattleV3Store {
  /** null while the player picks a line-up. */
  board: Board | null;
  /** The last line-up, preselected when picking again. */
  lastLineup: { lineup: CharacterId[]; front: CharacterId; stage: StageId };
  resolving: boolean;
  auto: boolean;
  runId: number;
  /** Achievements unlocked by the battle that just ended. */
  newAchievements: AchievementId[];
  start: (lineup: CharacterId[], front: CharacterId, stage: StageId) => void;
  restart: () => void;
  pickLineup: () => void;
  play: (uid: number) => void;
  playAll: () => void;
  cast: (skill: SkillId, target?: Target) => void;
  swap: (id: CharacterId) => void;
  endTurn: () => void;
  setAuto: (on: boolean) => void;
}

export const useBattleV3Store = create<BattleV3Store>((set, get) => {
  /** Stores the new board and records achievements when the battle has just been won. */
  const commit = (board: Board) => {
    const was = get().board?.battle.result;
    set({ board });
    if (was === "ongoing" && board.battle.result !== "ongoing") {
      set({ newAchievements: useAchievementStore.getState().unlock(earnedBy(board)) });
    }
  };

  const act = (fn: (b: Board) => Board) => {
    const { board, resolving } = get();
    if (board && !resolving) commit(fn(board));
  };

  const autoStep = (runId: number) => {
    const { auto, board, resolving } = get();
    if (!auto || get().runId !== runId || !board || board.battle.result !== "ongoing" || resolving) return;
    const action = nextBoardAutoAction(board);
    if (action.type === "end") {
      get().endTurn(); // endTurn resumes the auto loop once the next turn has started
      return;
    }
    act((b) =>
      action.type === "play"
        ? playCardOnBoard(b, action.uid)
        : action.type === "front"
          ? swapFront(b, action.id)
          : castOnBoard(b, action.skill, action.target),
    );
    setTimeout(() => autoStep(runId), AUTO_STEP_DELAY);
  };

  return {
    board: null,
    lastLineup: { lineup: ["david", "samuel", "jonathan"], front: "david", stage: "goliath" },
    resolving: false,
    auto: false,
    runId: 0,
    newAchievements: [],
    start: (lineup, front, stage) =>
      set((st) => ({
        board: createBoard(lineup, front, Math.random, stage),
        lastLineup: { lineup, front, stage },
        resolving: false,
        auto: false,
        runId: st.runId + 1,
        newAchievements: [],
      })),
    restart: () => get().start(get().lastLineup.lineup, get().lastLineup.front, get().lastLineup.stage),
    pickLineup: () => set((st) => ({ board: null, resolving: false, auto: false, runId: st.runId + 1, newAchievements: [] })),
    play: (uid) => act((b) => playCardOnBoard(b, uid)),
    playAll: () => act((b) => b.battle.hand.reduce((x, c) => playCardOnBoard(x, c.uid), b)),
    cast: (skill, target) => act((b) => castOnBoard(b, skill, target)),
    swap: (id) => act((b) => swapFront(b, id)),
    endTurn: () => {
      const { board, resolving, runId } = get();
      if (!board || resolving || board.battle.result !== "ongoing") return;
      const after = resolveBoard(board);
      if (after === board) return; // the front line must be filled first
      commit(after);
      if (after.battle.result !== "ongoing") return;
      set({ resolving: true });
      setTimeout(() => {
        if (get().runId !== runId) return;
        set({ board: startNextBoardTurn(get().board!), resolving: false });
        if (get().auto) setTimeout(() => autoStep(runId), AUTO_STEP_DELAY);
      }, RULES_V2.stepDelay);
    },
    setAuto: (on) => {
      set({ auto: on });
      if (on) autoStep(get().runId);
    },
  };
});
