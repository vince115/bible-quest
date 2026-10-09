import { describe, expect, it } from "vitest";
import { ENEMY_HP, MAX_HP, RULES_V2 as R } from "./data";
import { castSkill, createBattle, skillBlockReason, skillTargets } from "./engine";
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

/** A battle with Adam, Eve and David, cards cleared and energy set. */
function battle(energy: Partial<BattleState["energy"]> = {}): BattleState {
  const s = createBattle(seeded(), ["david", "adam", "eve"]);
  s.hand = [];
  s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
  return s;
}

describe("line-up", () => {
  it("only the line-up is in the battle", () => {
    const s = createBattle(seeded(), ["adam", "eve"]);
    expect(s.lineup).toEqual(["adam", "eve"]);
    expect(s.party.adam.hp).toBe(MAX_HP.adam);
    expect(s.party.david.hp).toBe(0);
    // Characters who sat out can't be raised.
    s.energy.guard = 2;
    expect(skillTargets(s, "arise")).toEqual([]);
  });

  it("the default line-up is David, Samuel and Jonathan", () => {
    expect(createBattle(seeded()).lineup).toEqual(["david", "samuel", "jonathan"]);
  });
});

describe("Adam", () => {
  it("Till the Ground deals 30 damage", () => {
    const s = castSkill(battle({ attack: 1 }), "till", "archer");
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 30); // earth → fire ×1
  });

  it("Keep the Garden gives Adam a Shield of 50", () => {
    const s = castSkill(battle({ guard: 1 }), "keep");
    expect(s.party.adam.shield).toBe(R.keepShield);
    expect(s.party.david.shield).toBe(0);
  });
});

describe("Eve", () => {
  it("Mother of All Living heals every ally, up to their maximum", () => {
    const start = battle({ guard: 2 });
    start.party.david.hp = 50;
    start.party.adam.hp = 120;
    const s = castSkill(start, "mother");
    expect(s.party.david.hp).toBe(50 + R.motherHeal);
    expect(s.party.adam.hp).toBe(MAX_HP.adam);
  });

  it("A Helper lets an ally who has acted act again, once per battle", () => {
    let s = castSkill(battle({ attack: 2, guard: 2 }), "sling", "bearer");
    expect(s.party.david.acted).toBe(true);
    expect(skillTargets(s, "helper")).toEqual(["david"]);
    s = castSkill(s, "helper", "david");
    expect(s.party.david.acted).toBe(false);
    expect(s.helperUsed).toBe(true);
    // David strikes again.
    s = castSkill(s, "sling", "bearer");
    expect(s.enemies.bearer.hp).toBe(0);
    // Once per battle.
    s.party.eve.acted = false;
    expect(skillBlockReason(s, "helper", "david")).toBe("v2.reason.ariseUsed");
  });

  it("A Helper needs an ally who has already acted", () => {
    const s = battle({ guard: 1 });
    expect(skillBlockReason(s, "helper")).toBe("v2.reason.noTarget");
  });
});
