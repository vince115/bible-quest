// The gacha: spend blessing points to draw character cards. Free play only: the points come from clearing stages
// (see progress.ts), not from money. Rates and costs are all here so they are easy to tune.
import { CHARACTER_ELEMENT } from "../v2/data";
import type { Rng } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { CARD_RARITY, type Rarity } from "@/components/cards/rarity";
import { TIMELINE, TIMELINE_ERAS } from "@/components/cards/timeline";

/** Every card that can be collected (the three player versions of Goliath's army are not). */
export const COLLECTIBLE: CharacterId[] = TIMELINE.filter((id): id is CharacterId => id in CHARACTER_ELEMENT);

/** The kinds of pack on the stage: each draws only from the cards of its own stretch of the Bible. */
export interface PackKind {
  id: string;
  /** The periods (see timeline.ts) whose cards go into this pack. */
  eras: string[];
  /** The card whose art is printed on the pack. */
  featured: CharacterId;
}

export const PACKS: PackKind[] = [
  { id: "beginnings", eras: ["creation", "patriarchs"], featured: "adam" },
  { id: "exodus", eras: ["exodus"], featured: "moses" },
  { id: "kingdom", eras: ["judges", "kingdom"], featured: "david" },
  { id: "prophets", eras: ["prophets"], featured: "elijah" },
  { id: "exile", eras: ["exile"], featured: "daniel" },
  { id: "nativity", eras: ["nativity"], featured: "mary" },
  { id: "ministry", eras: ["ministry"], featured: "peter" },
  { id: "passion", eras: ["passion"], featured: "simonCyrene" },
  { id: "church", eras: ["church", "revelation"], featured: "paul" },
];

/** How many packs stand on the ring: all of the one kind the player has chosen. */
export const PACKS_ON_RING = 12;

/** A booster pack: five cards, each position with its own rarity odds (percent). */
export const PACK = {
  cost: 300,
  /** The odds for each of the five cards, in the order they are turned over; the last is the rare slot. */
  slots: [
    { N: 55, R: 45 },
    { N: 55, R: 45 },
    { N: 55, R: 45 },
    { R: 60, SR: 40 },
    { SR: 72, SSR: 22, UR: 6 },
  ] as Partial<Record<Rarity, number>>[],
};

/** What a pack costs now: NEXT_PUBLIC_DEBUG_FREE_PACKS=1 makes them free, for testing. */
export const packCost = () => (process.env.NEXT_PUBLIC_DEBUG_FREE_PACKS === "1" ? 0 : PACK.cost);

/** Blessing points earned by clearing a stage: more the first time. */
export const CLEAR_POINTS = { first: 300, repeat: 100 };
/** What a new player starts with: one pack. */
export const STARTING_POINTS = 500;

const RARITY_ORDER: Rarity[] = ["N", "R", "SR", "SSR", "UR", "GR"];

const pick = <T,>(list: T[], rng: Rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** The collectible cards in a kind of pack. */
export function packCards(pack: PackKind): CharacterId[] {
  const inEra = new Set<string>(TIMELINE_ERAS.filter((e) => pack.eras.includes(e.era)).flatMap((e) => e.cards));
  // GR (God Rate: the Father, the Son and the Holy Spirit) is never in a pack; those cards are given some other way.
  return COLLECTIBLE.filter((id) => inEra.has(id) && CARD_RARITY[id] !== "GR");
}

/** The rarity of one card in a pack slot, given that slot's odds. */
export function rollRarity(odds: Partial<Record<Rarity, number>>, rng: Rng = Math.random): Rarity {
  const entries = RARITY_ORDER.filter((r) => odds[r]).map((r) => [r, odds[r]!] as const);
  const total = entries.reduce((n, [, p]) => n + p, 0);
  let roll = rng() * total;
  for (const [r, p] of entries) {
    if (roll < p) return r;
    roll -= p;
  }
  return entries[entries.length - 1][0];
}

/**
 * One card of a rolled rarity from `cards`; a period may have none of that rarity, so the nearest rarity that it has
 * is used instead (the one below first). `min` keeps a slot's floor, so the rare slot never falls below SR.
 */
function cardOfRarity(cards: CharacterId[], rarity: Rarity, rng: Rng, min: Rarity = "N"): CharacterId {
  const at = RARITY_ORDER.indexOf(rarity);
  const floor = RARITY_ORDER.indexOf(min);
  for (let d = 0; d < RARITY_ORDER.length; d++) {
    for (const i of d === 0 ? [at] : [at - d, at + d]) {
      if (i < floor || i >= RARITY_ORDER.length) continue;
      const list = cards.filter((id) => CARD_RARITY[id] === RARITY_ORDER[i]);
      if (list.length) return pick(list, rng);
    }
  }
  return pick(cards, rng);
}

/** One pack of the given kind: a rarity for each slot, then a card of that rarity from the pack's period. */
export function openPack(pack: PackKind, rng: Rng = Math.random): CharacterId[] {
  const cards = packCards(pack);
  return PACK.slots.map((odds) => {
    const lowest = RARITY_ORDER.find((r) => odds[r])!;
    return cardOfRarity(cards, rollRarity(odds, rng), rng, lowest);
  });
}
