import { describe, expect, it } from "vitest";
import { ENEMY_HP, MAX_HP, RULES_V2 as R, SHOOTER_DAMAGE, STAGE_BOSS, STAGE_ENEMIES, STAGE_GUARD, STAGE_ORDER, STAGE_SHOOTER } from "./data";
import { attackableEnemies, castSkill, createBattle, enemyDamage, resolveGoliath, startNextTurn, weakestAlly } from "./engine";
import type { BattleState, CharacterId, StageId } from "./types";

function seeded(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LINEUP: CharacterId[] = ["david", "samuel", "jonathan"];

/** A battle against the boss alone: the stage's guard and shooter are taken out so the boss's own moves can be measured. */
function battle(stage: StageId): BattleState {
  const s = createBattle(seeded(), LINEUP, stage);
  s.hand = [];
  for (const e of [STAGE_GUARD[stage], STAGE_SHOOTER[stage]]) if (e) s.enemies[e].hp = 0;
  s.archerTarget = null;
  return s;
}

/** Jonathan's Sword (30) takes the boss from just over half HP to under it: the second phase begins. */
function strikeUnderHalf(stage: StageId): BattleState {
  const s = battle(stage);
  const boss = STAGE_BOSS[stage];
  s.enemies[boss].hp = ENEMY_HP[boss] / 2 + 10;
  s.energy.attack = 3;
  return castSkill(s, "sword", boss, seeded());
}

const totalHp = (s: BattleState) => LINEUP.reduce((n, id) => n + s.party[id].hp, 0);
/** What a hit of `base` from the stage's boss takes off every ally together (elements apply). */
const onEveryone = (s: BattleState, base: number) => LINEUP.reduce((n, id) => n + enemyDamage(STAGE_BOSS[s.stage], id, base), 0);
const onOne = (s: BattleState, id: CharacterId, base: number) => enemyDamage(STAGE_BOSS[s.stage], id, base);

describe("every stage", () => {
  it("fields only its own enemies, with the boss attackable", () => {
    for (const stage of STAGE_ORDER) {
      const s = createBattle(seeded(), LINEUP, stage);
      for (const id of STAGE_ENEMIES[stage]) expect(s.enemies[id].hp, `${stage}: ${id}`).toBe(ENEMY_HP[id]);
      expect(attackableEnemies(s).every((id) => STAGE_ENEMIES[stage].includes(id)), stage).toBe(true);
      expect(s.intents).toHaveLength(2);
      expect(s.log[0].key.startsWith("v2.log.start")).toBe(true);
    }
  });

  it("is won when its boss falls", () => {
    for (const stage of STAGE_ORDER) {
      const s = battle(stage);
      const boss = STAGE_BOSS[stage];
      s.enemies[boss].hp = 10;
      s.energy.attack = 3;
      const won = castSkill(s, "sword", boss, seeded());
      expect(won.result, stage).toBe("victory");
      expect(won.log.at(-1)!.key.startsWith("v2.log.victory"), stage).toBe(true);
    }
  });
});

describe("guards and shooters", () => {
  it("the guard protects the boss while it stands, and the shooter hits the front line each turn", () => {
    for (const stage of STAGE_ORDER) {
      const guard = STAGE_GUARD[stage];
      const shooter = STAGE_SHOOTER[stage];
      if (!guard || !shooter) continue;
      let s = createBattle(seeded(), LINEUP, stage);
      s.hand = [];
      const boss = STAGE_BOSS[stage];
      expect(attackableEnemies(s), stage).not.toContain(boss);
      expect(attackableEnemies(s), stage).toContain(guard);
      expect(s.archerTarget, stage).not.toBeNull();
      // The shooter's hit lands on its target.
      s.intents[0] = { action: "repair", targets: [] }; // a harmless boss action for this check
      const target = s.archerTarget!;
      const hp = s.party[target].hp;
      s = resolveGoliath(s, seeded());
      expect(hp - s.party[target].hp, stage).toBe(enemyDamage(shooter, target, SHOOTER_DAMAGE[shooter]!));
      // Once the guard falls the boss is open; once the shooter falls nobody is targeted.
      s.enemies[guard].hp = 0;
      expect(attackableEnemies(s), stage).toContain(boss);
      s.energy.attack = 3;
      s.enemies[shooter].hp = 10;
      s = castSkill(s, "sword", shooter, seeded());
      expect(s.enemies[shooter].hp, stage).toBe(0);
      expect(s.archerTarget, stage).toBeNull();
    }
  });
});

describe("the Flood", () => {
  it("rains on everyone, and the Deluge only comes after the waters rise", () => {
    let s = battle("ark");
    expect(s.intents.map((i) => i.action)).toEqual(["rain", "surge"]);
    const before = totalHp(s);
    s = resolveGoliath(s, seeded());
    expect(before - totalHp(s)).toBe(onEveryone(s, R.rain));

    let d = battle("ark");
    d.intents[0] = { action: "deluge", targets: [] };
    const hp = totalHp(d);
    d = resolveGoliath(d, seeded());
    expect(totalHp(d)).toBe(hp); // not risen: nothing happens
    d.goliath.charging = true;
    d.intents[0] = { action: "deluge", targets: [] };
    d = resolveGoliath(d, seeded());
    expect(hp - totalHp(d)).toBe(onEveryone(d, R.deluge));
    expect(d.goliath.charging).toBe(false);
  });

  it("prevails from turn 4: every blow is heavier", () => {
    let s = battle("ark");
    s = startNextTurn(s, seeded());
    s = startNextTurn(s, seeded());
    expect(s.turn).toBe(3);
    expect(s.goliath.enraged).toBe(false);
    s = startNextTurn(s, seeded());
    expect(s.goliath.enraged).toBe(true);
    s.intents[0] = { action: "rain", targets: [] };
    const hp = totalHp(s);
    s = resolveGoliath(s, seeded());
    expect(hp - totalHp(s)).toBe(onEveryone(s, R.rain + R.prevailBonus));
  });
});

describe("Pharaoh's chariots", () => {
  it("pursue two allies at once", () => {
    let s = battle("redSea");
    expect(s.intents[0].action).toBe("pursue");
    expect(s.intents[0].targets).toHaveLength(R.pursueTargets);
    const [a, b] = s.intents[0].targets;
    const hp = totalHp(s);
    s = resolveGoliath(s, seeded());
    expect(hp - totalHp(s)).toBe(onOne(s, a, R.pursue) + onOne(s, b, R.pursue));
  });

  it("lose their wheels at half HP: a lost action, then a weaker Charge", () => {
    let s = strikeUnderHalf("redSea");
    expect(s.goliath.enraged).toBe(true);
    expect(s.goliath.stunned).toBe(true);
    s.intents[0] = { action: "charge", targets: ["jonathan"] };
    const hp = s.party.jonathan.hp;
    s = resolveGoliath(s, seeded());
    expect(s.party.jonathan.hp).toBe(hp); // the lost action
    s.intents[0] = { action: "charge", targets: ["jonathan"] };
    s = resolveGoliath(s, seeded());
    expect(hp - s.party.jonathan.hp).toBe(onOne(s, "jonathan", R.chargeWheelsOff));
  });
});

describe("the walls of Jericho", () => {
  it("mend themselves, but not past full HP", () => {
    let s = battle("jericho");
    s.enemies.walls.hp = ENEMY_HP.walls - 10;
    s.intents[0] = { action: "repair", targets: [] };
    s = resolveGoliath(s, seeded());
    expect(s.enemies.walls.hp).toBe(ENEMY_HP.walls);
  });

  it("crack at half HP: no more mending, boulders first", () => {
    let s = strikeUnderHalf("jericho");
    expect(s.goliath.enraged).toBe(true);
    expect(s.intents[1].action).toBe("boulder");
    s = resolveGoliath(s, seeded());
    s = startNextTurn(s, seeded());
    expect(s.intents.map((i) => i.action)).toEqual(["boulder", "stones"]);
    for (let i = 0; i < 6; i++) {
      expect(s.intents[0].action).not.toBe("repair");
      s = startNextTurn(resolveGoliath(s, seeded()), seeded());
    }
  });
});

describe("the prophets of Baal", () => {
  it("cry to no answer, then in a frenzy their cry drains Faith and Cut hits harder", () => {
    let s = battle("carmel");
    expect(s.intents[0].action).toBe("cry");
    s.energy.faith = 2;
    const hp = totalHp(s);
    s = resolveGoliath(s, seeded());
    expect(totalHp(s)).toBe(hp);
    expect(s.energy.faith).toBe(2);
    expect(s.log.some((l) => l.key === "v2.log.noVoice")).toBe(true);

    let f = strikeUnderHalf("carmel");
    expect(f.goliath.enraged).toBe(true);
    f.energy.faith = 2;
    f.intents[0] = { action: "cry", targets: [] };
    f = resolveGoliath(f, seeded());
    expect(f.energy.faith).toBe(2 - R.cryFaith);
    f.intents[0] = { action: "cut", targets: ["jonathan"] };
    const j = f.party.jonathan.hp;
    const b = f.enemies.baalProphets.hp;
    f = resolveGoliath(f, seeded());
    expect(j - f.party.jonathan.hp).toBe(onOne(f, "jonathan", R.cutFrenzy));
    expect(b - f.enemies.baalProphets.hp).toBe(R.cutSelf); // they wound themselves too
  });
});

describe("the lions", () => {
  it("roar to shake two allies unless Shielded, and Maul hunts the weakest", () => {
    let s = battle("lions");
    expect(s.intents[0].action).toBe("roar");
    expect(s.intents[0].targets).toHaveLength(R.roarTargets);
    const [a, b] = s.intents[0].targets;
    s.party[a].shield = 10;
    s = resolveGoliath(s, seeded());
    expect(s.party[a].shaken).toBe(false);
    expect(s.party[b].shaken).toBe(true);

    let m = battle("lions");
    m.party.samuel.hp = 30; // the weakest, though not at the front
    expect(weakestAlly(m)).toBe("samuel");
    m.intents[0] = { action: "maul", targets: ["david"] };
    m = resolveGoliath(m, seeded());
    // The planned target still stands, so the intent is honoured; a re-aim (the v3 board) sends it to the weakest.
    expect(m.party.david.hp).toBe(MAX_HP.david - onOne(m, "david", R.maul));
    let w = battle("lions");
    w.party.samuel.hp = 60;
    w.intents[0] = { action: "maul", targets: [] };
    w = resolveGoliath(w, seeded());
    expect(w.party.samuel.hp).toBe(60 - onOne(w, "samuel", R.maul));
  });
});

describe("Legion", () => {
  it("hits two allies, and everyone once unleashed at half HP", () => {
    let s = battle("gerasa");
    expect(s.intents[0].action).toBe("many");
    const [a, b] = s.intents[0].targets;
    const hp = totalHp(s);
    s = resolveGoliath(s, seeded());
    expect(hp - totalHp(s)).toBe(onOne(s, a, R.many) + onOne(s, b, R.many));

    let u = strikeUnderHalf("gerasa");
    expect(u.goliath.enraged).toBe(true);
    u.intents[0] = { action: "many", targets: ["david"] };
    const before = totalHp(u);
    u = resolveGoliath(u, seeded());
    expect(before - totalHp(u)).toBe(onEveryone(u, R.many));
  });
});

describe("Jesus (UR)", () => {
  it("pays Come Out of the Man with Attack energy, with no Faith at all", () => {
    let s = createBattle(seeded(), ["jesusUR"], "gerasa");
    s.hand = [];
    s.enemies.uncleanSpirits.hp = 0;
    s.energy = { faith: 0, attack: 2, guard: 0 };
    s = castSkill(s, "comeOut", "legion", seeded());
    expect(s.enemies.legion.hp).toBeLessThan(ENEMY_HP.legion);
    expect(s.energy.attack).toBe(0);
  });

  it("can strike every turn with Come Out of the Man, hitting dark Legion hardest", () => {
    let s = createBattle(seeded(), ["jesusUR"], "gerasa");
    s.hand = [];
    s.enemies.uncleanSpirits.hp = 0;
    s.energy.faith = 6;
    const before = s.enemies.legion.hp;
    s = castSkill(s, "comeOut", "legion", seeded());
    expect(before - s.enemies.legion.hp).toBe(100); // 70, light against dark ×1.5
    s = startNextTurn(s, seeded());
    s = castSkill(s, "comeOut", "legion", seeded());
    expect(before - s.enemies.legion.hp).toBe(200); // available again next turn
  });
});
