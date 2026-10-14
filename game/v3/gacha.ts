// The gacha: spend blessing points to draw character cards. Free play only: the points come from clearing stages
// (see progress.ts), not from money. Rates and costs are all here so they are easy to tune.
import { CHARACTER_ELEMENT } from "../v2/data";
import type { Rng } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { CARD_RARITY, type Rarity } from "@/components/cards/rarity";
import { TIMELINE } from "@/components/cards/timeline";

/** Every card that can be collected (the three player versions of Goliath's army are not). */
export const COLLECTIBLE: CharacterId[] = TIMELINE.filter((id): id is CharacterId => id in CHARACTER_ELEMENT);

/** Chance of each rarity on one draw (percent, adds up to 100). */
export const GACHA_RATES: Record<Rarity, number> = { N: 40, R: 30, SR: 20, SSR: 8, UR: 2 };

export const PULL_COST = 100;
/** Ten draws cost a draw less: the last one is guaranteed SR or better. */
export const TEN_PULL = { count: 10, cost: 900 };

/** Blessing points earned by clearing a stage: more the first time. */
export const CLEAR_POINTS = { first: 300, repeat: 100 };
/** What a new player starts with, enough for a few draws. */
export const STARTING_POINTS = 500;

const RARITY_ORDER: Rarity[] = ["N", "R", "SR", "SSR", "UR"];
const atLeastSR = (r: Rarity) => RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf("SR");

const byRarity = (r: Rarity) => COLLECTIBLE.filter((id) => CARD_RARITY[id] === r);
const pick = <T,>(list: T[], rng: Rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** The rarity of one draw; with `min` SR, a result below SR is raised to SR. */
export function rollRarity(rng: Rng, guaranteeSR = false): Rarity {
  let roll = rng() * 100;
  let result: Rarity = "N";
  for (const r of RARITY_ORDER) {
    result = r;
    if (roll < GACHA_RATES[r]) break;
    roll -= GACHA_RATES[r];
  }
  return guaranteeSR && !atLeastSR(result) ? "SR" : result;
}

/** One card: a rarity first, then any card of that rarity, each as likely as the next. */
export function drawCard(rng: Rng = Math.random, guaranteeSR = false): CharacterId {
  return pick(byRarity(rollRarity(rng, guaranteeSR)), rng);
}

/** A batch of draws; in a ten-draw the last card is guaranteed SR or better. */
export function drawMany(count: number, rng: Rng = Math.random): CharacterId[] {
  return Array.from({ length: count }, (_, i) => drawCard(rng, count === TEN_PULL.count && i === count - 1));
}
