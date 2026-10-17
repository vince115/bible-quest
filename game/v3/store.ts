"use client";

import { create } from "zustand";
import { MAGIC_VERSION_ENABLED, RULES_V2 } from "../v2/data";
import type { Target } from "../v2/engine";
import type { BattleState, CharacterId, EnemyId, PoolMode, SkillId, StageId } from "../v2/types";
import { earnedBy, useAchievementStore, type AchievementId } from "./achievements";
import { campaignStage, type CampaignStageId } from "./campaign";
import { useProgressStore } from "./progress";
import { nextBoardAutoAction } from "./auto";
import { basicAttackOnBoard, canDrawOnBoard, castOnBoard, createBoard, drawOnBoard, moveTo, nextRoundBoard, playCardOnBoard, resolveBoard, startNextBoardTurn, type Board, type Slots } from "./engine";

/** Auto battle's pauses at 1x (ms): between plays, and after the end of a turn while the enemy acts. 2x halves them. */
const AUTO_STEP_DELAY = 1500;
const AUTO_TURN_DELAY = 2200;
export type AutoSpeed = 1 | 2;
const SPEED_KEY = "bible-quest-auto-speed";
/** The speed this browser last chose (read after mount, so the prerendered page matches). */
export const savedSpeed = (): AutoSpeed => {
  try {
    return window.localStorage.getItem(SPEED_KEY) === "2" ? 2 : 1;
  } catch {
    return 1;
  }
};

interface BattleV3Store {
  /** null while the player picks a line-up. */
  board: Board | null;
  /** The last line-up, preselected when picking again. */
  lastLineup: { lineup: CharacterId[]; slots: Slots; stage: StageId; mode: PoolMode; foes?: BattleState["foes"] };
  resolving: boolean;
  auto: boolean;
  /** How fast auto battle plays: 1x (a readable pace) or 2x. */
  autoSpeed: AutoSpeed;
  setAutoSpeed: (speed: AutoSpeed) => void;
  runId: number;
  /** Achievements unlocked by the battle that just ended. */
  newAchievements: AchievementId[];
  /** The campaign stage being played, or null in free mode. */
  campaign: CampaignStageId | null;
  /** The card the campaign stage just dropped. */
  drop: CharacterId | null;
  /** Blessing points given instead of the dropped card, when the collection already held as many as it may (0 otherwise). */
  dropPoints: number;
  /** Between the two rounds of a stage: the battle the second round plays (the first round is won, the stage not yet). */
  interlude: StageId | null;
  /** Starts the second round of the stage with the same party. */
  nextRound: () => void;
  /** After the stage is cleared: takes on its hell level with the same party (and the HP it has left). */
  hellRound: () => void;
  /** Switches to a campaign stage (or free mode), back at the line-up when it is a different one. */
  enter: (campaign: CampaignStageId | null) => void;
  /** foes: free mode's own guard and shooter (left out: the stage's own). */
  start: (lineup: CharacterId[], slots: Slots, stage: StageId, mode?: PoolMode, foes?: BattleState["foes"]) => void;
  restart: () => void;
  pickLineup: () => void;
  play: (uid: number, target?: CharacterId) => void;
  playAll: () => void;
  /** Draw one card from the deck pile. */
  draw: () => void;
  /** Use up every draw left this turn. */
  drawAll: () => void;
  /** `who`: which copy of the skill's owner uses it (the first able one when left out). */
  cast: (skill: SkillId, target?: Target, who?: CharacterId) => void;
  /** The tabletop rules' free basic attack. */
  basic: (who: CharacterId, target: EnemyId) => void;
  /** This turn's free move: `id` to place `to`. */
  move: (id: CharacterId, to: number) => void;
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
      const stage = campaign ? campaignStage(campaign) : null;
      if (stage?.before && stage.battle && board.battle.stage === stage.before && board.battle.result === "victory") {
        set({ interlude: stage.battle, newAchievements: [], drop: null });
        return;
      }
      // The hell level is played after the clear: winning gives its card, losing takes nothing away.
      if (stage?.hell && board.battle.stage === stage.hell) {
        const won = board.battle.result === "victory";
        const got = won && stage.hellDrop ? useProgressStore.getState().grant(stage.hellDrop, stage.id) : null;
        set({ newAchievements: useAchievementStore.getState().unlock(earnedBy(board)), drop: got?.card ?? null, dropPoints: got?.overflow ?? 0 });
        return;
      }
      set({
        newAchievements: useAchievementStore.getState().unlock(earnedBy(board)),
        ...(() => {
          const got = campaign && board.battle.result === "victory" ? useProgressStore.getState().clear(campaign) : null;
          return { drop: got?.card ?? null, dropPoints: got?.overflow ?? 0 };
        })(),
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
        : action.type === "move"
          ? moveTo(b, action.id, action.to)
          : action.type === "basic"
            ? basicAttackOnBoard(b, action.who, action.target)
            : castOnBoard(b, action.skill, action.target),
    );
    setTimeout(() => autoStep(runId), AUTO_STEP_DELAY / get().autoSpeed);
  };

  return {
    board: null,
    lastLineup: { lineup: ["david", "samuel", "jonathan"], slots: [], stage: "goliath", mode: MAGIC_VERSION_ENABLED ? "personal" : "table" },
    resolving: false,
    auto: false,
    autoSpeed: 1,
    setAutoSpeed: (speed) => {
      set({ autoSpeed: speed });
      try {
        window.localStorage.setItem(SPEED_KEY, String(speed));
      } catch {}
    },
    runId: 0,
    newAchievements: [],
    campaign: null,
    drop: null,
    dropPoints: 0,
    interlude: null,
    enter: (campaign) => {
      if (get().campaign === campaign) return;
      set((st) => ({ campaign, board: null, drop: null, interlude: null, resolving: false, auto: false, runId: st.runId + 1, newAchievements: [] }));
    },
    start: (lineup, slots, stage, mode, foes) =>
      set((st) => {
        // A stage with a first round starts there; `stage` stays the last battle, so playing again starts over from the first round.
        const entry = st.campaign ? campaignStage(st.campaign) : null;
        const first = entry?.before && entry.battle === stage ? entry.before : stage;
        return {
          board: createBoard(lineup, slots, Math.random, first, mode ?? st.lastLineup.mode, entry ? undefined : foes),
          lastLineup: { lineup, slots, stage, mode: mode ?? st.lastLineup.mode, foes },
          resolving: false,
          auto: false,
          runId: st.runId + 1,
          newAchievements: [],
          drop: null,
          interlude: null,
        };
      }),
    nextRound: () => {
      const { board, interlude } = get();
      if (!board || !interlude || board.battle.result !== "victory") return;
      set((st) => ({ board: nextRoundBoard(board, interlude), interlude: null, resolving: false, auto: false, runId: st.runId + 1, newAchievements: [], drop: null }));
    },
    hellRound: () => {
      const { board, campaign } = get();
      const stage = campaign ? campaignStage(campaign) : null;
      if (!board || !stage?.hell || board.battle.stage !== stage.battle || board.battle.result !== "victory") return;
      set((st) => ({ board: nextRoundBoard(board, stage.hell!), interlude: null, resolving: false, auto: false, runId: st.runId + 1, newAchievements: [], drop: null }));
    },
    restart: () => get().start(get().lastLineup.lineup, get().lastLineup.slots, get().lastLineup.stage, get().lastLineup.mode, get().lastLineup.foes),
    pickLineup: () => set((st) => ({ board: null, resolving: false, auto: false, runId: st.runId + 1, newAchievements: [], drop: null, interlude: null })),
    play: (uid, target) => act((b) => playCardOnBoard(b, uid, target)),
    playAll: () => act((b) => b.battle.hand.reduce((x, c) => playCardOnBoard(x, c.uid), b)),
    draw: () => act((b) => drawOnBoard(b)),
    drawAll: () =>
      act((b) => {
        while (canDrawOnBoard(b)) b = drawOnBoard(b);
        return b;
      }),
    cast: (skill, target, who) => act((b) => castOnBoard(b, skill, target, Math.random, who)),
    basic: (who, target) => act((b) => basicAttackOnBoard(b, who, target)),
    move: (id, to) => act((b) => moveTo(b, id, to)),
    endTurn: () => {
      const { board, resolving, runId } = get();
      if (!board || resolving || board.battle.result !== "ongoing") return;
      const after = resolveBoard(board);
      commit(after);
      if (after.battle.result !== "ongoing") return;
      set({ resolving: true });
      setTimeout(() => {
        if (get().runId !== runId) return;
        set({ board: startNextBoardTurn(get().board!), resolving: false });
        if (get().auto) setTimeout(() => autoStep(runId), AUTO_STEP_DELAY / get().autoSpeed);
      }, get().auto ? AUTO_TURN_DELAY / get().autoSpeed : RULES_V2.stepDelay);
    },
    setAuto: (on) => {
      set({ auto: on });
      if (on) autoStep(get().runId);
    },
  };
});
