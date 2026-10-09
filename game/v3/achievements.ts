"use client";

// Achievements for the v3 board, kept in this browser only (localStorage, no account or server).
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../locale";
import type { Board } from "./engine";

export type AchievementId = "solo-david";

export const ACHIEVEMENTS: AchievementId[] = ["solo-david"];

/** Achievements a finished battle earns: David's duel with Goliath. */
export function earnedBy(b: Board): AchievementId[] {
  return b.battle.result === "victory" && b.battle.stage === "goliath" && b.lineup.length === 1 && b.lineup[0] === "david" ? ["solo-david"] : [];
}

interface AchievementStore {
  unlocked: AchievementId[];
  /** Adds the achievements and returns the ones that are new. */
  unlock: (ids: AchievementId[]) => AchievementId[];
}

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set, get) => ({
      unlocked: [],
      unlock: (ids) => {
        const fresh = ids.filter((id) => !get().unlocked.includes(id));
        if (fresh.length) set({ unlocked: [...get().unlocked, ...fresh] });
        return fresh;
      },
    }),
    {
      name: "bible-quest-v3-achievements",
      storage: createJSONStorage(() => safeStorage),
      // Rehydrated after mount (see BattleV3Screen) so server and first client render match.
      skipHydration: true,
    },
  ),
);
