import { describe, expect, it } from "vitest";
import { CARD_RARITY } from "@/components/cards/rarity";
import { CLEAR_POINTS, COLLECTIBLE, GACHA_RATES, PULL_COST, STARTING_POINTS, TEN_PULL, drawCard, drawMany, rollRarity } from "./gacha";

/** A repeatable stream of numbers in [0, 1). */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("gacha", () => {
  it("has rates that add up to 100 and a card of every rarity to draw", () => {
    expect(Object.values(GACHA_RATES).reduce((a, b) => a + b, 0)).toBe(100);
    for (const r of Object.keys(GACHA_RATES)) expect(COLLECTIBLE.some((id) => CARD_RARITY[id] === r), r).toBe(true);
  });

  it("starts the player with enough for a few draws, and a ten-draw is cheaper than ten single draws", () => {
    expect(STARTING_POINTS).toBeGreaterThanOrEqual(PULL_COST * 3);
    expect(TEN_PULL.cost).toBeLessThan(PULL_COST * TEN_PULL.count);
    expect(CLEAR_POINTS.first).toBeGreaterThan(CLEAR_POINTS.repeat);
  });

  it("maps a roll to its rarity band", () => {
    expect(rollRarity(() => 0)).toBe("N");
    expect(rollRarity(() => 0.39)).toBe("N");
    expect(rollRarity(() => 0.41)).toBe("R");
    expect(rollRarity(() => 0.75)).toBe("SR");
    expect(rollRarity(() => 0.95)).toBe("SSR");
    expect(rollRarity(() => 0.999)).toBe("UR");
  });

  it("raises an N or R result to SR when SR is guaranteed", () => {
    expect(rollRarity(() => 0, true)).toBe("SR");
    expect(rollRarity(() => 0.999, true)).toBe("UR");
    expect(CARD_RARITY[drawCard(() => 0, true)]).toBe("SR");
  });

  it("always ends a ten-draw with SR or better", () => {
    for (let s = 1; s <= 50; s++) {
      const cards = drawMany(10, seeded(s));
      expect(cards).toHaveLength(10);
      expect(["SR", "SSR", "UR"]).toContain(CARD_RARITY[cards[9]]);
    }
  });

  it("draws near the stated rates over many draws", () => {
    const rng = seeded(7);
    const n = 20000;
    const seen: Record<string, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
    for (let i = 0; i < n; i++) seen[CARD_RARITY[drawCard(rng)]]++;
    for (const [r, pct] of Object.entries(GACHA_RATES)) expect(Math.abs((seen[r] / n) * 100 - pct), r).toBeLessThan(1);
  });
});
