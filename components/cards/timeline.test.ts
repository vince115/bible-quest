import { describe, expect, it } from "vitest";
import { ENEMY_ORDER, PARTY_ORDER } from "@/game/v2/data";
import { TIMELINE } from "./timeline";

/** Player-side copies of Goliath's soldiers: battle-only, never shown in the card list. */
const BATTLE_ONLY = new Set(["goliathP", "bearerP", "archerP"]);

describe("card timeline", () => {
  it("lists every card exactly once", () => {
    const expected = [...PARTY_ORDER.filter((id) => !BATTLE_ONLY.has(id)), ...ENEMY_ORDER].sort();
    const dupes = TIMELINE.filter((id, i) => TIMELINE.indexOf(id) !== i);
    expect(dupes, "listed twice in timeline.ts").toEqual([]);
    expect(expected.filter((id) => !TIMELINE.includes(id)), "missing from timeline.ts").toEqual([]);
    expect(TIMELINE.filter((id) => !expected.includes(id)), "unknown id in timeline.ts").toEqual([]);
  });
});
