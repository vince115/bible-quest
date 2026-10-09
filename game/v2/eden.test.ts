import { describe, expect, it } from "vitest";
import { ENEMY_HP, MAX_HP, RULES_V2 as R } from "./data";
import { attackableEnemies, castSkill, createBattle, resolveGoliath, skillDamage, startNextTurn, supportAmount } from "./engine";
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

function eden(): BattleState {
  const s = createBattle(seeded(), ["david", "adam", "eve"], "eden");
  s.hand = [];
  return s;
}

describe("story bonuses", () => {
  it("Adam tills harder in Eden, and Eve adds +20 to every attack on the Serpent", () => {
    const s = eden();
    // 30 + Adam's +20 + Eve's +20; wood vs dark is neutral.
    expect(skillDamage(s, "till", "serpent")).toBe(30 + R.edenTillBonus + R.edenSeedBonus);
    expect(skillDamage(s, "sling", "serpent")).toBe(Math.floor(((30 + R.edenSeedBonus) * 1.5) / 10) * 10);
    expect(supportAmount(s, "mother")).toBe(R.motherHeal + R.edenMotherBonus);
  });

  it("no story bonus outside their story", () => {
    const s = createBattle(seeded(), ["david", "adam", "eve"]);
    expect(skillDamage(s, "till", "bearer")).toBe(30);
    expect(supportAmount(s, "mother")).toBe(R.motherHeal);
  });

  it("David's Against the Giant only works against Goliath", () => {
    const s = eden();
    s.energy.faith = 3;
    expect(skillDamage(s, "sling")).toBe(30);
  });
});

describe("Eden", () => {
  it("only the Serpent is on the field, and it can be attacked", () => {
    const s = eden();
    expect(s.enemies.serpent.hp).toBe(ENEMY_HP.serpent);
    expect(s.enemies.goliath.hp).toBe(0);
    expect(attackableEnemies(s)).toEqual(["serpent"]);
    expect(s.intents.map((i) => i.action)).toEqual(["tempt", "fang"]);
  });

  it("Temptation stops an ally next turn and costs Faith; a Shield holds firm", () => {
    let s = eden();
    s.energy.faith = 2;
    s.intents[0] = { action: "tempt", targets: ["adam"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.adam.shaken).toBe(true);
    expect(s.energy.faith).toBe(2 - R.temptFaith);

    let t = eden();
    t.party.adam.shield = 10;
    t.intents[0] = { action: "tempt", targets: ["adam"] };
    t = resolveGoliath(t, seeded());
    expect(t.party.adam.shaken).toBe(false);
  });

  it("Venom Fang hits harder once the Serpent has shed its skin at half HP", () => {
    let s = eden();
    s.intents[0] = { action: "fang", targets: ["adam"] };
    expect(130 - resolveGoliath(s, seeded()).party.adam.hp).toBe(R.fang);
    s.energy.attack = 1;
    s.enemies.serpent.hp = ENEMY_HP.serpent / 2 + 10;
    s = castSkill(s, "till", "serpent");
    expect(s.goliath.enraged).toBe(true);
    s.intents[0] = { action: "fang", targets: ["adam"] };
    expect(130 - resolveGoliath(s, seeded()).party.adam.hp).toBe(R.fangShed);
  });

  it("Coil damages and holds the target until the next end of turn", () => {
    let s = eden();
    s.intents[0] = { action: "coil", targets: ["adam"] };
    s = resolveGoliath(s, seeded());
    expect(130 - s.party.adam.hp).toBe(R.coil);
    expect(s.coiled).toBe("adam");
    // It lasts through the next player turn and wears off when the Serpent acts again.
    s = startNextTurn(s, seeded());
    expect(s.coiled).toBe("adam");
    s.intents[0] = { action: "fang", targets: ["adam"] };
    s = resolveGoliath(s, seeded());
    expect(s.coiled).toBeNull();
  });

  it("away from Goliath, Sling Stone is an ordinary 80 with no Stun", () => {
    let s = eden();
    s.energy.faith = 3;
    s = castSkill(s, "slingStone");
    expect(s.enemies.serpent.hp).toBe(ENEMY_HP.serpent - R.slingStoneElsewhere);
    expect(s.goliath.stunned).toBe(false);
  });

  it("Coil hits every ally", () => {
    let s = eden();
    s.intents[0] = { action: "coil", targets: ["adam"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.eve.hp).toBe(MAX_HP.eve - R.coil);
    expect(s.party.adam.hp).toBe(MAX_HP.adam - R.coil);
  });
  it("the battle is won when the Serpent falls", () => {
    let s = eden();
    s.energy.attack = 1;
    s.enemies.serpent.hp = 10;
    s = castSkill(s, "till", "serpent");
    expect(s.result).toBe("victory");
  });
});
