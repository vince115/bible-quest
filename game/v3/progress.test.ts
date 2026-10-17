import { afterEach, describe, expect, it, vi } from "vitest";
import { CLEAR_POINTS, PACK, STARTING_POINTS } from "./gacha";
import { freeModePool, ownedCards, useProgressStore } from "./progress";

const ORDER = ["david", "samuel", "jonathan", "adam"] as const;

describe("free mode pool", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("offers every card, owned or not, in print order", () => {
    expect(freeModePool(ORDER)).toEqual([...ORDER]);
    expect(ownedCards({ adam: 1, david: 2 }, ORDER)).toEqual([
      { id: "david", count: 2 },
      { id: "adam", count: 1 },
    ]);
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

  it("buying a pack spends its price, adds five cards to the collection and marks new ones", () => {
    fresh(PACK.cost * 2);
    const first = useProgressStore.getState().buyPack("ministry", steady)!;
    expect(first).toHaveLength(5);
    expect(first.every((r) => r.isNew || first.filter((x) => x.card === r.card).length > 1)).toBe(true);
    expect(useProgressStore.getState().points).toBe(PACK.cost);
    const again = useProgressStore.getState().buyPack("ministry", steady)!;
    // A steady roll draws the same five cards again, so none is new the second time.
    expect(again.map((r) => r.card)).toEqual(first.map((r) => r.card));
    expect(again.some((r) => r.isNew)).toBe(false);
    const s = useProgressStore.getState();
    expect(s.points).toBe(0);
    expect(Object.values(s.collection).reduce((n, v) => n + (v ?? 0), 0)).toBe(10);
  });

  it("does nothing for an unknown pack", () => {
    fresh(PACK.cost);
    expect(useProgressStore.getState().buyPack("nope")).toBeNull();
    expect(useProgressStore.getState().points).toBe(PACK.cost);
  });

  it("does nothing when the points do not cover a pack", () => {
    fresh(PACK.cost - 1);
    expect(useProgressStore.getState().buyPack("ministry")).toBeNull();
    expect(useProgressStore.getState().points).toBe(PACK.cost - 1);
    expect(useProgressStore.getState().collection).toEqual({});
  });

  it("throws a card away one copy at a time, and the last copy takes it out of the collection", () => {
    fresh();
    useProgressStore.setState({ collection: { david: 2, adam: 1 } });
    expect(useProgressStore.getState().discard("david")).toBe(true);
    expect(useProgressStore.getState().collection).toEqual({ david: 1, adam: 1 });
    expect(useProgressStore.getState().discard("david")).toBe(true);
    expect(useProgressStore.getState().collection).toEqual({ adam: 1 });
    expect(useProgressStore.getState().discard("david")).toBe(false); // none left
    expect(useProgressStore.getState().collection).toEqual({ adam: 1 });
  });
});
