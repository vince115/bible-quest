import { describe, expect, it } from "vitest";
import { nextAutoAction } from "./auto";
import { castSkill, createBattle, endTurn, playCard } from "./engine";
import type { BattleState } from "./types";

function seeded(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plays a whole battle with the auto-battle AI. */
function autoBattle(seed: number): BattleState {
  const rng = seeded(seed);
  let s = createBattle(rng);
  for (let steps = 0; s.result === "ongoing" && steps < 500; steps++) {
    const a = nextAutoAction(s);
    const next =
      a.type === "play" ? playCard(s, a.uid) : a.type === "cast" ? castSkill(s, a.skill, a.target, rng) : endTurn(s, rng);
    // Every action must change the state, or the AI would loop forever.
    expect(next).not.toBe(s);
    s = next;
  }
  return s;
}

describe("auto-battle", () => {
  it("first turns its cards into energy", () => {
    const s = createBattle(seeded());
    expect(nextAutoAction(s).type).toBe("play");
  });

  it("throws Sling Stone as soon as it has ✨3", () => {
    const s = createBattle(seeded());
    s.hand = [];
    s.energy = { faith: 3, attack: 0, guard: 0 };
    expect(nextAutoAction(s)).toEqual({ type: "cast", skill: "slingStone" });
  });

  it("never attacks Goliath while the shield bearer stands", () => {
    const s = createBattle(seeded());
    s.hand = [];
    s.energy = { faith: 0, attack: 1, guard: 0 };
    expect(nextAutoAction(s)).toMatchObject({ type: "cast", target: "bearer" });
  });

  it("finishes every battle and wins nearly all of them in a few turns", () => {
    const results = Array.from({ length: 200 }, (_, i) => autoBattle(i + 1));
    expect(results.every((s) => s.result !== "ongoing")).toBe(true);
    const wins = results.filter((s) => s.result === "victory");
    expect(wins.length).toBeGreaterThanOrEqual(190);
    const avgTurns = wins.reduce((n, s) => n + s.turn, 0) / wins.length;
    expect(avgTurns).toBeLessThanOrEqual(5);
  });
});
