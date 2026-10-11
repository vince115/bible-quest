"use client";

// Campaign progress and the player's card collection, kept in this browser only (localStorage, no account or server).
// The collection starts empty and grows from stage drops; duplicates are counted, not merged.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../locale";
import type { Rng } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { dropFor, type CampaignStageId, type Cleared } from "./campaign";

export interface Drop {
  card: CharacterId;
  stage: CampaignStageId;
  /** When it dropped (ms since the epoch). */
  at: number;
}

interface ProgressStore {
  cleared: Cleared;
  /** How many copies of each card the player owns. */
  collection: Partial<Record<CharacterId, number>>;
  /** Every drop so far, oldest first. */
  history: Drop[];
  /** Records a clear, rolls the stage's drop, adds it to the collection and returns it. */
  clear: (stage: CampaignStageId, rng?: Rng) => CharacterId;
}

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      cleared: {},
      collection: {},
      history: [],
      clear: (stage, rng = Math.random) => {
        const card = dropFor(stage, rng);
        const { cleared, collection, history } = get();
        set({
          cleared: { ...cleared, [stage]: (cleared[stage] ?? 0) + 1 },
          collection: { ...collection, [card]: (collection[card] ?? 0) + 1 },
          history: [...history, { card, stage, at: Date.now() }],
        });
        return card;
      },
    }),
    {
      name: "bible-quest-campaign",
      storage: createJSONStorage(() => safeStorage),
      // Rehydrated after mount (see the campaign screens) so server and first client render match.
      skipHydration: true,
    },
  ),
);

/** Cards owned, in the given order, with their counts. */
export const ownedCards = (collection: ProgressStore["collection"], order: readonly CharacterId[]) =>
  order.filter((id) => (collection[id] ?? 0) > 0).map((id) => ({ id, count: collection[id]! }));
