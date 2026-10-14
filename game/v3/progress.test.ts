import { afterEach, describe, expect, it, vi } from "vitest";
import { freeModePool, ownedCards } from "./progress";

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
