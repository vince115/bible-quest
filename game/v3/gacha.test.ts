import { describe, expect, it } from "vitest";
import { CARD_RARITY } from "@/components/cards/rarity";
import { CLEAR_POINTS, COLLECTIBLE, PACK, PACKS, STARTING_POINTS, openPack, packCards, rollRarity } from "./gacha";

/** A repeatable stream of numbers in [0, 1). */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("booster packs", () => {
  it("has five slots whose odds each add up to 100, and a card of every rarity they can give", () => {
    expect(PACK.slots).toHaveLength(5);
    for (const odds of PACK.slots) {
      expect(Object.values(odds).reduce((a, b) => a + (b ?? 0), 0)).toBe(100);
      for (const r of Object.keys(odds)) expect(COLLECTIBLE.some((id) => CARD_RARITY[id] === r), r).toBe(true);
    }
  });

  it("starts the player with a pack and pays a first clear a pack", () => {
    expect(STARTING_POINTS).toBeGreaterThanOrEqual(PACK.cost);
    expect(CLEAR_POINTS.first).toBeGreaterThanOrEqual(PACK.cost);
    expect(CLEAR_POINTS.first).toBeGreaterThan(CLEAR_POINTS.repeat);
  });

  it("maps a roll to the slot's rarity band", () => {
    const rare = PACK.slots[4];
    expect(rollRarity(rare, () => 0)).toBe("SR");
    expect(rollRarity(rare, () => 0.71)).toBe("SR");
    expect(rollRarity(rare, () => 0.8)).toBe("SSR");
    expect(rollRarity(rare, () => 0.999)).toBe("UR");
    expect(rollRarity(PACK.slots[0], () => 0.54)).toBe("N");
    expect(rollRarity(PACK.slots[0], () => 0.56)).toBe("R");
  });

  it("splits every collectible card into exactly one kind of pack", () => {
    const all = PACKS.flatMap(packCards);
    expect(new Set(all).size).toBe(all.length);
    // Every collectible card is in exactly one pack, except the GR cards, which no pack holds.
    expect([...all].sort()).toEqual(COLLECTIBLE.filter((id) => CARD_RARITY[id] !== "GR").sort());
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(PACKS.length);
    for (const p of PACKS) expect(packCards(p), `${p.id}: the featured card is in its own pack`).toContain(p.featured);
  });

  it("gives five cards of the pack's own period, and every pack holds an SR or better", () => {
    for (const pack of PACKS) {
      const own = new Set(packCards(pack));
      for (let s = 1; s <= 100; s++) {
        const cards = openPack(pack, seeded(s));
        expect(cards, pack.id).toHaveLength(5);
        expect(cards.every((id) => own.has(id)), `${pack.id}: a card from another period`).toBe(true);
        expect(["SR", "SSR", "UR"], pack.id).toContain(CARD_RARITY[cards[4]]);
      }
    }
  });

  it("draws the rare slot near its stated odds when the period has every rarity", () => {
    // A pack whose period has an SR, an SSR and a UR card to draw.
    const pack = PACKS.find((p) => ["SR", "SSR", "UR"].every((r) => packCards(p).some((id) => CARD_RARITY[id] === r)))!;
    const rng = seeded(11);
    const n = 20000;
    const seen: Record<string, number> = { SR: 0, SSR: 0, UR: 0 };
    for (let i = 0; i < n; i++) seen[CARD_RARITY[openPack(pack, rng)[4]]]++;
    for (const [r, pct] of Object.entries(PACK.slots[4])) expect(Math.abs((seen[r] / n) * 100 - pct!), r).toBeLessThan(1.2);
  });
});
