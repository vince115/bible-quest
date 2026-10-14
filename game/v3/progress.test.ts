import { afterEach, describe, expect, it, vi } from "vitest";
import { CLEAR_POINTS, PULL_COST, STARTING_POINTS, TEN_PULL } from "./gacha";
import { freeModePool, ownedCards, pullCost, useProgressStore } from "./progress";

const ORDER = ["david", "samuel", "jonathan", "adam"] as const;

describe("free mode pool", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("offers only the cards in the collection, in print order", () => {
    expect(freeModePool({}, ORDER)).toEqual([]);
    expect(freeModePool({ adam: 1, david: 2 }, ORDER)).toEqual(["david", "adam"]);
    expect(ownedCards({ adam: 1, david: 2 }, ORDER)).toEqual([
      { id: "david", count: 2 },
      { id: "adam", count: 1 },
    ]);
  });

  it("offers every card when the debug switch is on", () => {
    vi.stubEnv("NEXT_PUBLIC_DEBUG_ALL_CARDS", "1");
    expect(freeModePool({}, ORDER)).toEqual([...ORDER]);
  });
});

const fresh = (points = STARTING_POINTS) => useProgressStore.setState({ cleared: {}, collection: {}, history: [], points });
const steady = () => 0.5;

describe("points and draws", () => {
  it("pays blessing points for a clear: more the first time", () => {
    fresh(0);
    useProgressStore.getState().clear("eden");
    expect(useProgressStore.getState().points).toBe(CLEAR_POINTS.first);
    useProgressStore.getState().clear("eden");
    expect(useProgressStore.getState().points).toBe(CLEAR_POINTS.first + CLEAR_POINTS.repeat);
  });

  it("spends the cost, adds the cards to the collection and marks new ones", () => {
    fresh(PULL_COST * 3);
    const first = useProgressStore.getState().pull(1, steady)!;
    expect(first).toHaveLength(1);
    expect(first[0].isNew).toBe(true);
    const again = useProgressStore.getState().pull(1, steady)!;
    expect(again[0].card).toBe(first[0].card); // a steady roll draws the same card
    expect(again[0].isNew).toBe(false);
    const s = useProgressStore.getState();
    expect(s.points).toBe(PULL_COST);
    expect(s.collection[first[0].card]).toBe(2);
  });

  it("does nothing when the points do not cover the draw", () => {
    fresh(pullCost(10) - 1);
    expect(useProgressStore.getState().pull(10)).toBeNull();
    expect(useProgressStore.getState().points).toBe(pullCost(10) - 1);
    expect(useProgressStore.getState().collection).toEqual({});
  });

  it("a ten-draw costs the discounted price and gives ten cards", () => {
    fresh(TEN_PULL.cost);
    const cards = useProgressStore.getState().pull(10)!;
    expect(cards).toHaveLength(10);
    expect(useProgressStore.getState().points).toBe(0);
    expect(Object.values(useProgressStore.getState().collection).reduce((n, v) => n + (v ?? 0), 0)).toBe(10);
  });
});
