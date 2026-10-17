import { afterEach, describe, expect, it, vi } from "vitest";
import { CARD_RARITY } from "@/components/cards/rarity";
import { CLEAR_POINTS, COPY_LIMIT, OVERFLOW_POINTS, PACK, STARTING_POINTS } from "./gacha";
import { freeModePool, ownedCards, useProgressStore } from "./progress";

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
    // Every card is kept, up to COPY_LIMIT copies; the rest came back as blessing points.
    const s = useProgressStore.getState();
    const overflow = [...first, ...again].reduce((n, r) => n + r.overflow, 0);
    expect(s.points).toBe(overflow);
    expect(Object.values(s.collection).every((v) => (v ?? 0) <= COPY_LIMIT)).toBe(true);
    expect(Object.values(s.collection).reduce((n, v) => n + (v ?? 0), 0)).toBe(10 - [...first, ...again].filter((r) => r.overflow > 0).length);
  });

  it("holds at most COPY_LIMIT copies of a card: past it a card turns into blessing points", () => {
    fresh(0);
    useProgressStore.setState({ collection: { satan: COPY_LIMIT } });
    const got = useProgressStore.getState().grant("satan", "temptation");
    expect(got).toEqual({ card: "satan", overflow: OVERFLOW_POINTS[CARD_RARITY.satan] });
    expect(useProgressStore.getState().collection.satan).toBe(COPY_LIMIT);
    expect(useProgressStore.getState().points).toBe(OVERFLOW_POINTS[CARD_RARITY.satan]);
    // Below the limit the card is added and nothing is paid.
    useProgressStore.setState({ collection: { satan: COPY_LIMIT - 1 } });
    expect(useProgressStore.getState().grant("satan", "temptation").overflow).toBe(0);
    expect(useProgressStore.getState().collection.satan).toBe(COPY_LIMIT);
  });

  it("a stage drop and a pack card past the limit pay their points too", () => {
    fresh(0);
    const full = Object.fromEntries(["adam", "eve", "cain", "abel", "seth", "enoch"].map((id) => [id, COPY_LIMIT]));
    useProgressStore.setState({ collection: full });
    const drop = useProgressStore.getState().clear("eden", steady);
    expect(drop.overflow).toBe(OVERFLOW_POINTS[CARD_RARITY[drop.card]]);
    expect(useProgressStore.getState().points).toBe(CLEAR_POINTS.first + drop.overflow);

    fresh(PACK.cost);
    const pack = useProgressStore.getState().buyPack("ministry", steady)!;
    useProgressStore.setState({ collection: Object.fromEntries(pack.map((r) => [r.card, COPY_LIMIT])), points: PACK.cost });
    const again = useProgressStore.getState().buyPack("ministry", steady)!;
    expect(again.every((r) => r.overflow === OVERFLOW_POINTS[CARD_RARITY[r.card]])).toBe(true);
    expect(useProgressStore.getState().points).toBe(again.reduce((n, r) => n + r.overflow, 0));
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
