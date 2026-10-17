"use client";

// Campaign progress and the player's card collection, kept in this browser only (localStorage, no account or server).
// The collection starts empty and grows from stage drops; duplicates are counted, not merged.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../locale";
import type { Rng } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { dropFor, type CampaignStageId, type Cleared } from "./campaign";
import { CLEAR_POINTS, PACKS, STARTING_POINTS, openPack, packCost } from "./gacha";

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
  /** Blessing points to spend on draws; earned by clearing stages. */
  points: number;
  /** Records a clear, rolls the stage's drop, adds it to the collection and returns it. */
  clear: (stage: CampaignStageId, rng?: Rng) => CharacterId;
  /** Adds a card the hell level gives (no clear is recorded and no points are paid: the stage was cleared already). */
  grant: (card: CharacterId, stage: CampaignStageId) => void;
  /** Throws one copy of a card away (the last copy removes the card from the collection); false if there is none to throw. */
  discard: (card: CharacterId) => boolean;
  /** Spends the price of a pack and returns its cards in turn-over order, each marked new or a copy; null if the points do not cover it. */
  buyPack: (packId: string, rng?: Rng) => { card: CharacterId; isNew: boolean }[] | null;
}

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      cleared: {},
      collection: {},
      history: [],
      points: STARTING_POINTS,
      clear: (stage, rng = Math.random) => {
        const card = dropFor(stage, rng);
        const { cleared, collection, history, points } = get();
        const first = (cleared[stage] ?? 0) === 0;
        set({
          cleared: { ...cleared, [stage]: (cleared[stage] ?? 0) + 1 },
          collection: { ...collection, [card]: (collection[card] ?? 0) + 1 },
          history: [...history, { card, stage, at: Date.now() }],
          points: points + (first ? CLEAR_POINTS.first : CLEAR_POINTS.repeat),
        });
        return card;
      },
      grant: (card, stage) => {
        const { collection, history } = get();
        set({ collection: { ...collection, [card]: (collection[card] ?? 0) + 1 }, history: [...history, { card, stage, at: Date.now() }] });
      },
      discard: (card) => {
        const { collection } = get();
        const have = collection[card] ?? 0;
        if (have <= 0) return false;
        const next = { ...collection };
        if (have === 1) delete next[card];
        else next[card] = have - 1;
        set({ collection: next });
        return true;
      },
      buyPack: (packId, rng = Math.random) => {
        const { collection, points } = get();
        const kind = PACKS.find((p) => p.id === packId);
        const cost = packCost();
        if (!kind || points < cost) return null;
        const owned = { ...collection };
        const results = openPack(kind, rng).map((card) => {
          const isNew = (owned[card] ?? 0) === 0;
          owned[card] = (owned[card] ?? 0) + 1;
          return { card, isNew };
        });
        set({ collection: owned, points: points - cost });
        return results;
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

/**
 * The cards free mode offers: the ones the player owns (campaign drops, later gacha). NEXT_PUBLIC_DEBUG_ALL_CARDS=1
 * offers every card instead, for testing before there is a collection to speak of.
 */
export const freeModePool = (collection: ProgressStore["collection"], order: readonly CharacterId[]): CharacterId[] =>
  process.env.NEXT_PUBLIC_DEBUG_ALL_CARDS === "1" ? [...order] : ownedCards(collection, order).map((c) => c.id);
