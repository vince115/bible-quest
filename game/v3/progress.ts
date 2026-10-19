"use client";

// Campaign progress and the player's card collection, kept in this browser only (localStorage, no account or server).
// The collection starts empty and grows from stage drops and packs; duplicates are counted, not merged, up to COPY_LIMIT
// copies of a card; past it a card turns into blessing points.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../locale";
import type { Rng } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { dropFor, type CampaignStageId, type Cleared } from "./campaign";
import { CARD_RARITY } from "@/components/cards/rarity";
import { CLEAR_POINTS, COPY_LIMIT, OVERFLOW_POINTS, PACKS, STARTING_POINTS, openPack, packCost } from "./gacha";

/** A card gained: added to the collection, or, when the collection already holds COPY_LIMIT of it, this many blessing points. */
export interface Gained {
  card: CharacterId;
  /** Blessing points given instead of the card (0 when the card was added). */
  overflow: number;
}

/** Adds `card` to `collection` (changed in place) unless it is full; returns the blessing points given instead. */
function gain(collection: Partial<Record<CharacterId, number>>, card: CharacterId): number {
  const have = collection[card] ?? 0;
  if (have >= COPY_LIMIT) return OVERFLOW_POINTS[CARD_RARITY[card]];
  collection[card] = have + 1;
  return 0;
}

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
  /** Records a clear, rolls the stage's drop, adds it to the collection (or its points, when full) and returns it. */
  clear: (stage: CampaignStageId, rng?: Rng) => Gained;
  /** Adds a card the hell level gives (no clear is recorded and no clear points are paid: the stage was cleared already). */
  grant: (card: CharacterId, stage: CampaignStageId) => Gained;
  /** Throws one copy of a card away (the last copy removes the card from the collection); false if there is none to throw. */
  discard: (card: CharacterId) => boolean;
  /** Spends the price of a pack and returns its cards in turn-over order, each marked new or a copy; null if the points do not cover it. */
  buyPack: (packId: string, rng?: Rng) => (Gained & { isNew: boolean })[] | null;
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
        const owned = { ...collection };
        const overflow = gain(owned, card);
        set({
          cleared: { ...cleared, [stage]: (cleared[stage] ?? 0) + 1 },
          collection: owned,
          history: [...history, { card, stage, at: Date.now() }],
          points: points + (first ? CLEAR_POINTS.first : CLEAR_POINTS.repeat) + overflow,
        });
        return { card, overflow };
      },
      grant: (card, stage) => {
        const { collection, history, points } = get();
        const owned = { ...collection };
        const overflow = gain(owned, card);
        set({ collection: owned, history: [...history, { card, stage, at: Date.now() }], points: points + overflow });
        return { card, overflow };
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
          return { card, isNew, overflow: gain(owned, card) };
        });
        set({ collection: owned, points: points - cost + results.reduce((n, r) => n + r.overflow, 0) });
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

/** The cards free pick offers: every card in the game, GR cards included, whether the player owns it or not. */
export const freeModePool = (order: readonly CharacterId[]): CharacterId[] => [...order];

/** The cards the own-cards challenge offers: only those the player owns. */
export const ownedPool = (collection: ProgressStore["collection"], order: readonly CharacterId[]): CharacterId[] =>
  order.filter((id) => (collection[id] ?? 0) > 0);
