import { describe, expect, it } from "vitest";
import { ENEMY_HP, RULES_V2 as R } from "../v2/data";
import { attackableEnemies, enemyDamage, enemyMaxHp, isAlive } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { earnedBy } from "./achievements";
import { nextBoardAutoAction } from "./auto";
import {
  arrange,
  backRow,
  boardSkillTargets,
  canMove,
  castOnBoard,
  createBoard,
  drawOnBoard,
  endBoardTurn,
  frontRow,
  isDuel,
  moveTo,
  nextRoundBoard,
  playCardOnBoard,
  resolveBoard,
  type Board,
} from "./engine";

function seeded(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A board whose Goliath is about to throw his spear. */
function spearTurn(lineup: CharacterId[]): Board {
  const b = createBoard(lineup, undefined, seeded());
  b.battle.intents[0] = { action: "spear", targets: [] };
  b.battle.enemies.archer.hp = 0;
  return b;
}

function autoBattle(lineup: CharacterId[], seed: number): Board {
  const rng = seeded(seed);
  let b = createBoard(lineup, undefined, rng);
  for (let steps = 0; b.battle.result === "ongoing" && steps < 800; steps++) {
    const a = nextBoardAutoAction(b);
    const next =
      a.type === "draw"
        ? drawOnBoard(b, rng)
        : a.type === "play"
        ? playCardOnBoard(b, a.uid, a.target)
        : a.type === "cast"
          ? castOnBoard(b, a.skill, a.target, rng)
          : a.type === "move"
            ? moveTo(b, a.id, a.to, rng)
            : endBoardTurn(b, rng);
    expect(next).not.toBe(b);
    b = next;
  }
  return b;
}

describe("energy deck", () => {
  it("deals no cards: the player draws them one at a time, up to the turn's allowance", () => {
    let b = createBoard(["david", "samuel"], undefined, seeded());
    expect(b.battle.hand).toHaveLength(0);
    expect(b.draws).toBe(R.openingHand);
    for (let i = 0; i < R.openingHand; i++) b = drawOnBoard(b, seeded(i));
    expect(b.battle.hand).toHaveLength(R.openingHand);
    expect(b.draws).toBe(0);
    expect(drawOnBoard(b)).toBe(b);
  });

  it("a played card frees a slot, and unused draws don't carry over", () => {
    let b = createBoard(["david", "samuel"], undefined, seeded());
    b.battle.deck[0] = { ...b.battle.deck[0], card: "delivered" };
    b = drawOnBoard(b);
    b = playCardOnBoard(b, b.battle.hand[0].uid);
    expect(b.battle.hand).toHaveLength(0);
    b = drawOnBoard(b);
    expect(b.battle.hand).toHaveLength(1);
    b = endBoardTurn(b, seeded(3));
    expect(b.draws).toBe(R.drawPerTurn);
    expect(b.battle.hand).toHaveLength(1);
  });
});

describe("line-up", () => {
  it("characters left behind sit the battle out", () => {
    const b = createBoard(["david"], undefined, seeded());
    expect(b.lineup).toEqual(["david"]);
    expect(isAlive(b.battle, "samuel")).toBe(false);
    expect(isAlive(b.battle, "jonathan")).toBe(false);
    expect(b.battle.intents.flatMap((i) => i.targets).every((id) => id === "david")).toBe(true);
  });

  it("a lone champion duels Goliath: the shield bearer and the archer stand aside", () => {
    const duel = createBoard(["david"], undefined, seeded());
    expect(duel.battle.enemies.bearer.hp).toBe(0);
    expect(duel.battle.enemies.archer.hp).toBe(0);
    expect(duel.battle.archerTarget).toBeNull();
    expect(duel.battle.result).toBe("ongoing");
    const team = createBoard(["david", "jonathan"], undefined, seeded());
    expect(team.battle.enemies.bearer.hp).toBeGreaterThan(0);
    expect(team.battle.enemies.archer.hp).toBeGreaterThan(0);
  });

  it("a lone champion may instead face every enemy, and keeps that choice into the next round", () => {
    const all = createBoard(["david"], undefined, seeded(), "goliath", "table", undefined, true);
    expect(all.battle.enemies.bearer.hp).toBeGreaterThan(0);
    expect(all.battle.enemies.archer.hp).toBeGreaterThan(0);
    expect(isDuel(all)).toBe(false);
    expect(isDuel(createBoard(["david"], undefined, seeded()))).toBe(true);
    all.battle.result = "victory";
    expect(isDuel(nextRoundBoard(all, "goliath", seeded()))).toBe(false);
  });

  it("Arise can't bring in someone who stayed behind", () => {
    const b = createBoard(["samuel", "jonathan"], undefined, seeded());
    b.battle.energy.guard = 2;
    expect(boardSkillTargets(b, "arise")).toEqual([]);
    expect(castOnBoard(b, "arise", "david")).toBe(b);
  });
});

describe("formation", () => {
  it("arranges a line-up into three front places and three back places: the sturdiest in front, the front row first", () => {
    const three = arrange(["david", "samuel", "jonathan"]);
    expect(three.slice(3)).toEqual([null, null, null]);
    expect(three.slice(0, 3).filter(Boolean).sort()).toEqual(["david", "jonathan", "samuel"]);
    const lineup: CharacterId[] = ["david", "samuel", "jonathan", "peter", "moses"];
    const five = arrange(lineup);
    expect(five.filter(Boolean)).toHaveLength(5);
    expect(five.slice(0, 3).every(Boolean)).toBe(true);
    // A placement is kept as far as it names the line-up; everyone else fills the empty places.
    const kept = arrange(lineup, [null, null, null, "david", null, "samuel"]);
    expect(kept[3]).toBe("david");
    expect(kept[5]).toBe("samuel");
    expect(kept.slice(0, 3).filter(Boolean).sort()).toEqual(["jonathan", "moses", "peter"]);
  });

  it("blows aimed at the front row never reach the back row", () => {
    const b = createBoard(["david", "samuel", "jonathan"], ["samuel", "david", null, null, "jonathan", null], seeded());
    expect(frontRow(b)).toEqual(["samuel", "david"]);
    expect(backRow(b)).toEqual(["jonathan"]);
    b.battle.intents[0] = { action: "spear", targets: [] };
    const after = resolveBoard(b);
    const lost = (id: CharacterId) => b.battle.party[id].hp - after.battle.party[id].hp;
    expect(lost("jonathan")).toBe(0);
    expect(frontRow(b)).toContain(after.battle.archerTarget);
    expect(lost("samuel") + lost("david")).toBeGreaterThan(0);
  });

  it("with nobody standing in front, the blows fall on the back row", () => {
    const b = createBoard(["david", "samuel"], [null, null, null, "david", "samuel", null], seeded());
    b.battle.intents[0] = { action: "spear", targets: [] };
    b.battle.enemies.archer.hp = 0;
    const after = resolveBoard(b);
    expect(["david", "samuel"]).toContain(after.battle.intents[0].targets[0]);
    const lost = (id: CharacterId) => b.battle.party[id].hp - after.battle.party[id].hp;
    expect(lost("david") + lost("samuel")).toBeGreaterThan(0);
    // ...and so when the whole front row has fallen.
    const c = createBoard(["david", "samuel"], ["david", null, null, "samuel", null, null], seeded());
    c.battle.party.david.hp = 0;
    c.battle.intents[0] = { action: "spear", targets: [] };
    c.battle.enemies.archer.hp = 0;
    expect(resolveBoard(c).battle.party.samuel.hp).toBeLessThan(c.battle.party.samuel.hp);
  });

  it("the front row takes the blows one at a time, telegraphed in advance", () => {
    const b = createBoard(["david", "samuel", "jonathan"], ["david", "samuel", null, "jonathan", null, null], seeded());
    b.battle.intents[0] = { action: "spear", targets: [] };
    b.battle.intents[1] = { action: "spear", targets: [] };
    const aimed = moveTo(b, "jonathan", 2); // re-aims
    const [now, next] = aimed.battle.intents.map((i) => i.targets[0]);
    expect(frontRow(aimed)).toContain(now);
    expect(frontRow(aimed)).toContain(next);
    expect(now).not.toBe(next);
  });

  it("the element of whoever is hit decides the damage", () => {
    // Metal Goliath hits light David normally; fire Jonathan resists metal (x0.75).
    const b = spearTurn(["david", "jonathan"]);
    const after = resolveBoard(b);
    const hit = frontRow(b).find((id) => b.battle.party[id].hp - after.battle.party[id].hp > 0)!;
    expect(b.battle.party[hit].hp - after.battle.party[hit].hp).toBe(enemyDamage("goliath", hit, R.spear));
    expect(enemyDamage("goliath", "jonathan", R.spear)).toBe(Math.floor((R.spear * 0.75) / 10) * 10);
  });

  it("a blow that hunts the weakest reaches the back row", () => {
    const b = createBoard(["david", "samuel", "jonathan"], ["david", "samuel", null, "jonathan", null, null], seeded());
    b.battle.party.jonathan.hp = 20;
    b.battle.intents[0] = { action: "maul", targets: [] };
    const after = resolveBoard(b);
    expect(after.battle.party.jonathan.hp).toBeLessThan(20);
  });

  it("allows one free move a turn, to an empty place or in place of whoever stands there", () => {
    let b = createBoard(["david", "samuel", "jonathan"], ["david", "samuel", null, "jonathan", null, null], seeded());
    expect(canMove(b, "david", 0)).toBe(false); // already there
    expect(canMove(b, "david", 6)).toBe(false);
    b = moveTo(b, "jonathan", 1);
    expect(b.slots).toEqual(["david", "jonathan", null, "samuel", null, null]);
    expect(canMove(b, "david", 5)).toBe(false); // used this turn
    expect(moveTo(b, "david", 5)).toBe(b);
    b = endBoardTurn(b, seeded(2));
    if (b.battle.result === "ongoing" && isAlive(b.battle, "david")) {
      b = moveTo(b, "david", 5);
      expect(b.slots[5]).toBe("david");
      expect(b.slots[0]).toBeNull();
    }
  });

  it("a fallen character keeps their place and can't move; nothing waits on replacing them", () => {
    const b = createBoard(["david", "samuel", "jonathan"], ["david", "samuel", null, "jonathan", null, null], seeded());
    b.battle.party.samuel.hp = 0;
    expect(canMove(b, "samuel")).toBe(false);
    expect(resolveBoard(b)).not.toBe(b);
    expect(moveTo(b, "jonathan", 1).slots).toEqual(["david", "jonathan", null, "samuel", null, null]);
  });

  it("the enemy's front row shields its back row: the boss and the archer can't be hit while the shield bearer stands", () => {
    const b = createBoard(["david", "samuel"], undefined, seeded());
    expect(attackableEnemies(b.battle)).toEqual(["bearer"]);
    b.battle.enemies.bearer.hp = 0;
    expect(attackableEnemies(b.battle).sort()).toEqual(["archer", "goliath"]);
  });

  it("a big party meets more of the stage's guards in the enemy's front row: one for each ally past three, up to two", () => {
    const six: CharacterId[] = ["david", "samuel", "jonathan", "peter", "moses", "daniel"];
    expect(createBoard(six.slice(0, 3), undefined, seeded()).aides).toEqual([]);
    expect(createBoard(six.slice(0, 4), undefined, seeded()).aides).toEqual(["bearer#1"]);
    const b = createBoard(six, undefined, seeded());
    expect(b.aides).toEqual(["bearer#1", "bearer#2"]);
    expect(b.battle.enemies["bearer#2"].hp).toBe(b.battle.enemies.bearer.hp * R.aideHpMult);
    // While any of them stands, the back row can't be hit.
    b.battle.enemies.bearer.hp = 0;
    expect(attackableEnemies(b.battle).sort()).toEqual(["bearer#1", "bearer#2"]);
    // Each strikes a member of the front row, telegraphed.
    const aimed = b.battle.aideTargets!["bearer#1"]!;
    expect(frontRow(b)).toContain(aimed);
    b.battle.intents[0] = { action: "cry", targets: [] };
    b.battle.archerTarget = null;
    const before = b.battle.party[aimed].hp;
    expect(resolveBoard(b).battle.party[aimed].hp).toBeLessThan(before);
  });

  it("where no reinforcements come, a big party meets a boss with more HP, its half-HP phase later with it", () => {
    const five: CharacterId[] = ["adam", "eve", "cain", "abel", "seth"];
    const b = createBoard(five, undefined, seeded(), "eden", "table");
    expect(b.aides).toEqual([]);
    const full = Math.round((ENEMY_HP.serpent * (1 + R.bossHpPerAlly * 2)) / 10) * 10;
    expect(b.battle.enemies.serpent.hp).toBe(full);
    expect(enemyMaxHp(b.battle, "serpent")).toBe(full);
    // Three or fewer: the card's HP.
    expect(createBoard(five.slice(0, 3), undefined, seeded(), "eden", "table").battle.enemies.serpent.hp).toBe(ENEMY_HP.serpent);
    // A stage with reinforcements keeps its boss's HP.
    expect(createBoard(five, undefined, seeded(), "goliath", "table").battle.enemies.goliath.hp).toBe(ENEMY_HP.goliath);
  });

  it("losing the only character is a defeat", () => {
    const b = createBoard(["jonathan"], undefined, seeded());
    b.battle.party.jonathan.hp = 10;
    b.battle.intents[0] = { action: "spear", targets: [] };
    expect(resolveBoard(b).battle.result).toBe("defeat");
  });
});

describe("achievements", () => {
  it("only David's duel victory earns an achievement", () => {
    const b = createBoard(["david"], undefined, seeded());
    b.battle.result = "victory";
    expect(earnedBy(b)).toEqual(["solo-david"]);
    const jonathan = createBoard(["jonathan"], undefined, seeded());
    jonathan.battle.result = "victory";
    expect(earnedBy(jonathan)).toEqual([]);
    const team = createBoard(["david", "samuel"], undefined, seeded());
    team.battle.result = "victory";
    expect(earnedBy(team)).toEqual([]);
  });
});

describe("auto-battle on the board", () => {
  it("finishes every battle with the full line-up and still wins nearly all of them", () => {
    const results = Array.from({ length: 200 }, (_, i) => autoBattle(["david", "samuel", "jonathan"], i + 1));
    expect(results.every((b) => b.battle.result !== "ongoing")).toBe(true);
    expect(results.filter((b) => b.battle.result === "victory").length).toBeGreaterThanOrEqual(180);
  });

  it("David wins most of his duels", () => {
    const results = Array.from({ length: 100 }, (_, i) => autoBattle(["david"], i + 1));
    expect(results.filter((b) => b.battle.result === "victory").length).toBeGreaterThanOrEqual(75);
  });

  it("finishes every solo battle", () => {
    for (const id of ["david", "samuel", "jonathan"] as CharacterId[]) {
      const results = Array.from({ length: 50 }, (_, i) => autoBattle([id], i + 1));
      expect(results.every((b) => b.battle.result !== "ongoing")).toBe(true);
    }
  });
});
