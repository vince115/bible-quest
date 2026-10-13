"use client";

import { create } from "zustand";
import { RULES_V2 } from "../v2/data";
import type { Target } from "../v2/engine";
import type { CharacterId, EnemyId, PoolMode, SkillId, StageId } from "../v2/types";
import { earnedBy, useAchievementStore, type AchievementId } from "./achievements";
import type { CampaignStageId } from "./campaign";
import { useProgressStore } from "./progress";
import { nextBoardAutoAction } from "./auto";
import { basicAttackOnBoard, canDrawOnBoard, castOnBoard, createBoard, drawOnBoard, playCardOnBoard, resolveBoard, startNextBoardTurn, swapFront, type Board } from "./engine";

/** Pause between auto-battle steps so the player can follow along (ms). */
const AUTO_STEP_DELAY = 450;

interface BattleV3Store {
  /** null while the player picks a line-up. */
  board: Board | null;
  /** The last line-up, preselected when picking again. */
  lastLineup: { lineup: CharacterId[]; front: CharacterId; stage: StageId; mode: PoolMode };
  resolving: boolean;
  auto: boolean;
  runId: number;
  /** Achievements unlocked by the battle that just ended. */
  newAchievements: AchievementId[];
  /** The campaign stage being played, or null in free mode. */
  campaign: CampaignStageId | null;
  /** The card the campaign stage just dropped. */
  drop: CharacterId | null;
  /** Switches to a campaign stage (or free mode), back at the line-up when it is a different one. */
  enter: (campaign: CampaignStageId | null) => void;
  start: (lineup: CharacterId[], front: CharacterId, stage: StageId, mode?: PoolMode) => void;
  restart: () => void;
  pickLineup: () => void;
  play: (uid: number, target?: CharacterId) => void;
  playAll: () => void;
  /** Draw one card from the deck pile. */
  draw: () => void;
  /** Use up every draw left this turn. */
  drawAll: () => void;
  cast: (skill: SkillId, target?: Target) => void;
  /** The tabletop rules' free basic attack. */
  basic: (who: CharacterId, target: EnemyId) => void;
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
      const { campaign } = get();
      set({
        newAchievements: useAchievementStore.getState().unlock(earnedBy(board)),
        drop: campaign && board.battle.result === "victory" ? useProgressStore.getState().clear(campaign) : null,
      });
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
      action.type === "draw"
        ? drawOnBoard(b)
        : action.type === "play"
        ? playCardOnBoard(b, action.uid, action.target)
        : action.type === "front"
          ? swapFront(b, action.id)
          : action.type === "basic"
            ? basicAttackOnBoard(b, action.who, action.target)
            : castOnBoard(b, action.skill, action.target),
    );
    setTimeout(() => autoStep(runId), AUTO_STEP_DELAY);
  };

  return {
    board: null,
    lastLineup: { lineup: ["david", "samuel", "jonathan"], front: "david", stage: "goliath", mode: "personal" },
    resolving: false,
    auto: false,
    runId: 0,
    newAchievements: [],
    campaign: null,
    drop: null,
    enter: (campaign) => {
      if (get().campaign === campaign) return;
      set((st) => ({ campaign, board: null, drop: null, resolving: false, auto: false, runId: st.runId + 1, newAchievements: [] }));
    },
    start: (lineup, front, stage, mode) =>
      set((st) => ({
        board: createBoard(lineup, front, Math.random, stage, mode ?? st.lastLineup.mode),
        lastLineup: { lineup, front, stage, mode: mode ?? st.lastLineup.mode },
        resolving: false,
        auto: false,
        runId: st.runId + 1,
        newAchievements: [],
        drop: null,
      })),
    restart: () => get().start(get().lastLineup.lineup, get().lastLineup.front, get().lastLineup.stage, get().lastLineup.mode),
    pickLineup: () => set((st) => ({ board: null, resolving: false, auto: false, runId: st.runId + 1, newAchievements: [], drop: null })),
    play: (uid, target) => act((b) => playCardOnBoard(b, uid, target)),
    playAll: () => act((b) => b.battle.hand.reduce((x, c) => playCardOnBoard(x, c.uid), b)),
    draw: () => act((b) => drawOnBoard(b)),
    drawAll: () =>
      act((b) => {
        while (canDrawOnBoard(b)) b = drawOnBoard(b);
        return b;
      }),
    cast: (skill, target) => act((b) => castOnBoard(b, skill, target)),
    basic: (who, target) => act((b) => basicAttackOnBoard(b, who, target)),
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
