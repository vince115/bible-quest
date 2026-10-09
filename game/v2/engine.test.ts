import { describe, expect, it } from "vitest";
import { DEFAULT_LINEUP as PARTY_ORDER, ENEMY_HP, MAX_HP, RULES_V2 as R } from "./data";
import {
  attackableEnemies,
  canAct,
  castSkill,
  elementMultiplier,
  enemyDamage,
  skillDamage,
  createBattle,
  endTurn,
  payment,
  playCard,
  resolveGoliath,
  skillBlockReason,
  startNextTurn,
} from "./engine";
import type { BattleState, CardId, EnergyPool, SkillId } from "./types";

/** Deterministic RNG (mulberry32). */
function seeded(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh battle with the given hand (uids 101, …) and energy; the dealt hand goes back under the deck. */
function battle(cards: CardId[] = [], energy: Partial<EnergyPool> = {}, patch?: (s: BattleState) => void): BattleState {
  const s = createBattle(seeded());
  s.deck.push(...s.hand);
  s.hand = cards.map((card, i) => ({ uid: 101 + i, card }));
  s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
  patch?.(s);
  return s;
}

const totalCards = (s: BattleState) => s.deck.length + s.hand.length + s.discard.length;
const hpLost = (a: BattleState, b: BattleState) => a.enemies.goliath.hp - b.enemies.goliath.hp;
/** No shield bearer in the way, so attacks can reach Goliath. */
const noBearer = (s: BattleState) => (s.enemies.bearer.hp = 0);

describe("setup", () => {
  it("starts with 15 energy cards, 5 in hand and an empty pool", () => {
    const s = createBattle(seeded());
    expect(totalCards(s)).toBe(15);
    expect(s.hand).toHaveLength(R.openingHand);
    expect(s.energy).toEqual({ faith: 0, attack: 0, guard: 0 });
    expect(s.enemies).toEqual({ bearer: { hp: ENEMY_HP.bearer }, goliath: { hp: ENEMY_HP.goliath }, archer: { hp: ENEMY_HP.archer } });
    expect(s.archerTarget).not.toBeNull();
    expect(s.intents.map((i) => i.action)).toEqual(["defy", "spear"]);
  });
});

describe("cards become energy", () => {
  it("each card adds 1 of its energy kind and goes to the discard pile", () => {
    let s = battle(["stones", "covenant", "battle"]);
    s = playCard(s, 101);
    s = playCard(s, 102);
    s = playCard(s, 103);
    expect(s.energy).toEqual({ faith: 1, attack: 1, guard: 1 });
    expect(s.hand).toHaveLength(0);
    expect(s.discard).toHaveLength(3);
  });

  it("Attack resets each turn; Faith and Guard carry over", () => {
    let s = battle([], { faith: 2, attack: 1, guard: 1 });
    s = endTurn(s, seeded());
    expect(s.energy).toEqual({ faith: 2, attack: 0, guard: 1 });
  });

  it("Faith and Guard are capped", () => {
    expect(playCard(battle(["battle"], { faith: R.maxFaith }), 101).energy.faith).toBe(R.maxFaith);
    expect(playCard(battle(["wings"], { guard: R.maxGuard }), 101).energy.guard).toBe(R.maxGuard);
  });

  it("draws 3 per turn and never exceeds 7 in hand", () => {
    let s = createBattle(seeded());
    s = endTurn(s, seeded(2));
    expect(s.hand).toHaveLength(Math.min(R.maxHand, R.openingHand + R.drawPerTurn));
    s = endTurn(s, seeded(3));
    expect(s.hand.length).toBeLessThanOrEqual(R.maxHand);
    expect(totalCards(s)).toBe(15);
  });
});

describe("skills and payment", () => {
  it("attack skills spend Attack and hit the chosen enemy", () => {
    const s0 = battle([], { attack: 3 }, noBearer);
    let s = castSkill(s0, "sling", "goliath");
    s = castSkill(s, "sword", "goliath");
    s = castSkill(s, "rebuke", "archer");
    // light David → dark Goliath ×1.5 (45 → 40); fire Jonathan → dark ×1; water Samuel → fire archer ×1.5
    expect(hpLost(s0, s)).toBe(40 + 30);
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 30);
    expect(s.energy.attack).toBe(0);
  });

  it("attacks need an enemy target", () => {
    const s0 = battle([], { attack: 1 });
    expect(castSkill(s0, "sling")).toBe(s0);
  });

  it("Faith stands in when the matching energy runs out", () => {
    expect(payment(battle([], { faith: 1 }), "sword")).toEqual({ faith: 1, attack: 0, guard: 0 });
    expect(payment(battle([], { attack: 1, faith: 1 }), "sword")).toEqual({ faith: 0, attack: 1, guard: 0 });
    expect(payment(battle([], { guard: 1, faith: 1 }), "arise")).toEqual({ faith: 1, attack: 0, guard: 1 });
    expect(payment(battle([], { guard: 1 }), "sword")).toBeNull();
  });

  it("Sling Stone needs real Faith (3)", () => {
    expect(skillBlockReason(battle([], { faith: 2, attack: 5 }), "slingStone")).toBe("v2.reason.needFaith");
    expect(skillBlockReason(battle([], { faith: 3 }), "slingStone")).toBeNull();
  });

  it("not enough energy blocks a skill", () => {
    expect(skillBlockReason(battle(), "sling")).toBe("v2.reason.energy");
  });

  it("one skill per character per turn", () => {
    const s = castSkill(battle([], { attack: 2, guard: 1 }), "sword", "bearer");
    expect(skillBlockReason(s, "covshield")).toBe("v2.reason.acted");
    expect(canAct(s, "jonathan")).toBe(false);
  });

  it("Shaken or fallen characters can't use skills", () => {
    expect(skillBlockReason(battle([], { attack: 1 }, (s) => (s.party.david.shaken = true)), "sling")).toBe("v2.reason.shaken");
    expect(skillBlockReason(battle([], { attack: 1 }, (s) => (s.party.jonathan.hp = 0)), "sword")).toBe("v2.reason.fallen");
  });
});

describe("David: Against the Giant and Sling Stone", () => {
  it("holding 3+ Faith makes David's attacks +20 (only David's)", () => {
    const s0 = battle([], { faith: 3, attack: 2 }, noBearer);
    expect(hpLost(s0, castSkill(s0, "sling", "goliath"))).toBe(70); // (30 + 20) × 1.5 = 75 → 70
    expect(hpLost(s0, castSkill(s0, "sword", "goliath"))).toBe(30);
  });

  it("Sling Stone: always 140 (no bonus, no element), Stuns, spends 3 Faith, makes Goliath Enraged", () => {
    const s0 = battle([], { faith: 4 });
    const s = castSkill(s0, "slingStone");
    expect(hpLost(s0, s)).toBe(140);
    expect(s.energy.faith).toBe(1);
    expect(s.goliath).toMatchObject({ stunned: true, enraged: true });
    expect(s.intents[1].action).toBe("swing");
  });

  it("a Stunned Goliath skips his action, then phase 2 starts with Wild Swing", () => {
    let s = castSkill(battle([], { faith: 3 }, (s) => (s.enemies.archer.hp = 0)), "slingStone");
    const before = PARTY_ORDER.map((id) => s.party[id].hp);
    s = resolveGoliath(s, seeded());
    expect(PARTY_ORDER.map((id) => s.party[id].hp)).toEqual(before);
    s = startNextTurn(s, seeded());
    expect(s.intents[0].action).toBe("swing");
    s = resolveGoliath(s, seeded());
    expect(PARTY_ORDER.map((id) => s.party[id].hp)).toEqual(PARTY_ORDER.map((id, i) => before[i] - enemyDamage("goliath", id, R.swing)));
  });
});

describe("Samuel and Jonathan support skills", () => {
  it("Heal restores 50 HP to the chosen ally (needs a target)", () => {
    const s0 = battle([], { guard: 1 }, (s) => (s.party.david.hp = 30));
    expect(castSkill(s0, "heal")).toBe(s0);
    expect(castSkill(s0, "heal", "david").party.david.hp).toBe(30 + R.healAmount);
  });

  it("Arise revives with 7 HP once per battle; the revived ally can act", () => {
    let s = battle([], { guard: 4 }, (s) => {
      s.party.david.hp = 0;
      s.party.jonathan.hp = 0;
    });
    expect(skillBlockReason(battle([], { guard: 2 }), "arise")).toBe("v2.reason.noTarget");
    s = castSkill(s, "arise", "david");
    expect(s.party.david.hp).toBe(R.ariseHp);
    expect(canAct(s, "david")).toBe(true);
    s = endTurn(s, seeded());
    s.energy.guard = 2;
    s.party.samuel.shaken = false; // ignore whatever Goliath did; only the once-per-battle rule matters here
    expect(skillBlockReason(s, "arise")).toBe("v2.reason.ariseUsed");
  });

  it("Covenant Shield gives every ally a Shield, which absorbs damage and expires next turn", () => {
    let s = castSkill(battle([], { guard: 1 }, (s) => {
      s.intents[0] = { action: "spear", targets: ["samuel"] };
      s.enemies.archer.hp = 0;
    }), "covshield");
    expect(PARTY_ORDER.map((id) => s.party[id].shield)).toEqual([R.covShield, R.covShield, R.covShield]);
    s = resolveGoliath(s, seeded());
    // The Shield absorbs the first 30 of the Spear Thrust; the rest gets through.
    expect(s.party.samuel.hp).toBe(MAX_HP.samuel - Math.max(0, enemyDamage("goliath", "samuel", R.spear) - R.covShield));
    expect(s.party.samuel.shield).toBe(0);
    s = startNextTurn(s, seeded());
    expect(PARTY_ORDER.every((id) => s.party[id].shield === 0)).toBe(true);
  });
});

describe("Shaken", () => {
  it("Defy the Armies shakes unshielded targets for the next turn", () => {
    let s = createBattle(seeded());
    const targets = s.intents[0].targets;
    s = endTurn(s, seeded());
    for (const id of targets) expect(s.party[id].shaken).toBe(true);
    s = resolveGoliath(s, seeded());
    expect(targets.every((id) => !s.party[id].shaken)).toBe(true);
  });

  it("a Shield keeps an ally from being Shaken", () => {
    let s = castSkill(battle([], { guard: 1 }, (s) => {
      s.intents[0] = { action: "defy", targets: ["david", "samuel"] };
      s.enemies.archer.hp = 0; // the archer shoots first and could break the Shield
    }), "covshield");
    s = resolveGoliath(s, seeded());
    expect(PARTY_ORDER.some((id) => s.party[id].shaken)).toBe(false);
  });

  it("a Shield broken by the archer no longer protects from Shaken", () => {
    let s = castSkill(battle([], { guard: 1 }, (s) => {
      s.intents[0] = { action: "defy", targets: ["david", "samuel"] };
      s.archerTarget = "david";
    }), "covshield");
    s = resolveGoliath(s, seeded());
    expect(s.party.david.shaken).toBe(true);
    expect(s.party.samuel.shaken).toBe(false);
  });
});

describe("Goliath", () => {
  it("Crushing Blow only lands after Raise the Spear", () => {
    const s = battle([], {}, (s) => (s.intents[0] = { action: "crush", targets: ["jonathan"] }));
    expect(resolveGoliath(s, seeded()).party.jonathan.hp).toBe(MAX_HP.jonathan);
    s.goliath.charging = true;
    expect(resolveGoliath(s, seeded()).party.jonathan.hp).toBe(MAX_HP.jonathan - R.crush);
  });

  it("follows the phase 1 cycle", () => {
    let s = createBattle(seeded());
    const seen = [s.intents[0].action];
    for (let i = 0; i < 4; i++) {
      s = endTurn(s, seeded(i + 10));
      seen.push(s.intents[0].action);
    }
    expect(seen).toEqual(["defy", "spear", "raise", "crush", "defy"]);
  });
});

describe("enemy line-up", () => {
  it("Goliath can't be attacked while his shield bearer stands", () => {
    const s = battle([], { attack: 1 });
    expect(attackableEnemies(s)).toEqual(["bearer", "archer"]);
    expect(skillBlockReason(s, "sling", "goliath")).toBe("v2.reason.badTarget");
    expect(attackableEnemies(battle([], {}, noBearer))).toEqual(["goliath", "archer"]);
  });

  it("Sling Stone flies over the shield into Goliath", () => {
    const s0 = battle([], { faith: 3 });
    const s = castSkill(s0, "slingStone");
    expect(hpLost(s0, s)).toBe(140);
    expect(skillDamage(s0, "slingStone", "goliath")).toBe(140);
    expect(s.enemies.bearer.hp).toBe(ENEMY_HP.bearer);
  });

  it("the archer shoots its shown target each turn until it falls", () => {
    let s = battle([], {}, (s) => {
      s.archerTarget = "samuel";
      s.intents[0] = { action: "raise", targets: [] };
    });
    s = resolveGoliath(s, seeded());
    // water Samuel resists the fire archer: 30 × 0.75 = 22.5 → 20
    expect(s.party.samuel.hp).toBe(MAX_HP.samuel - enemyDamage("archer", "samuel", R.archerDamage));
    expect(enemyDamage("archer", "samuel", R.archerDamage)).toBe(20);
    const dead = resolveGoliath(battle([], {}, (s) => {
      s.enemies.archer.hp = 0;
      s.archerTarget = "samuel";
    }), seeded());
    expect(dead.party.samuel.hp).toBe(MAX_HP.samuel);
  });

  it("killing the shield bearer or archer doesn't win; Goliath falling does", () => {
    let s = battle([], { attack: 2 }, (s) => {
      s.enemies.bearer.hp = 2;
      s.enemies.archer.hp = 2;
    });
    s = castSkill(s, "sling", "bearer");
    s = castSkill(s, "sword", "archer");
    expect(s.enemies.bearer.hp + s.enemies.archer.hp).toBe(0);
    expect(s.result).toBe("ongoing");
    expect(s.archerTarget).toBeNull();
  });
});

describe("elements", () => {
  it("are switched on: light David and dark Goliath hit each other ×1.5", () => {
    expect(R.elements.enabled).toBe(true);
    expect(elementMultiplier("light", "dark")).toBe(1.5);
    expect(enemyDamage("goliath", "david", R.crush)).toBe(180);
    expect(enemyDamage("goliath", "jonathan", R.crush)).toBe(R.crush);
  });

  it("follow water → fire → wood → water and light ⇄ dark once switched on", () => {
    const on = (a: Parameters<typeof elementMultiplier>[0], d: Parameters<typeof elementMultiplier>[1]) => elementMultiplier(a, d, true);
    expect([on("water", "fire"), on("fire", "wood"), on("wood", "water")]).toEqual([1.5, 1.5, 1.5]);
    expect([on("fire", "water"), on("wood", "fire"), on("water", "wood")]).toEqual([0.75, 0.75, 0.75]);
    expect(on("light", "dark")).toBe(1.5);
    expect(on("dark", "light")).toBe(1.5); // light and dark counter each other
    expect([on("light", "water"), on("dark", "fire")]).toEqual([1, 1]);
    expect(on("water", "water")).toBe(1);
  });
});

describe("victory and defeat", () => {
  it("victory when Goliath reaches 0 HP", () => {
    expect(castSkill(battle([], { attack: 1 }, (s) => {
      noBearer(s);
      s.enemies.goliath.hp = 2;
    }), "sling", "goliath").result).toBe("victory");
  });

  it("defeat when every character has fallen", () => {
    const s = resolveGoliath(battle([], {}, (s) => {
      s.party.david.hp = 0;
      s.party.samuel.hp = 0;
      s.party.jonathan.hp = 3;
      s.intents[0] = { action: "swing", targets: [] };
    }), seeded());
    expect(s.result).toBe("defeat");
  });

  it("random play always finishes and never loses or duplicates cards", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      let s = createBattle(rng);
      while (s.result === "ongoing" && s.turn < 60) {
        for (const c of [...s.hand]) s = playCard(s, c.uid);
        for (const k of ["slingStone", "sling", "sword", "rebuke", "covshield", "heal", "arise"] as SkillId[]) {
          const target = k === "arise" ? PARTY_ORDER.find((id) => s.party[id].hp <= 0) : k === "heal" ? "david" : attackableEnemies(s)[0];
          s = castSkill(s, k, target);
        }
        expect(totalCards(s)).toBe(15);
        if (s.result === "ongoing") s = endTurn(s, rng);
      }
      expect(s.result).not.toBe("ongoing");
    }
  });
});
