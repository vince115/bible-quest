import { describe, expect, it } from "vitest";
import { MAX_HP, RULES_V2 as R } from "../v2/data";
import { enemyDamage, isAlive } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { earnedBy } from "./achievements";
import { nextBoardAutoAction } from "./auto";
import {
  backRow,
  boardBlockReason,
  boardSkillTargets,
  canSwap,
  castOnBoard,
  createBoard,
  drawOnBoard,
  endBoardTurn,
  frontLiving,
  needsFront,
  playCardOnBoard,
  resolveBoard,
  swapFront,
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
function spearTurn(lineup: CharacterId[], front: CharacterId): Board {
  const b = createBoard(lineup, front, seeded());
  b.battle.intents[0] = { action: "spear", targets: [] };
  b.battle.enemies.archer.hp = 0;
  return b;
}

function autoBattle(lineup: CharacterId[], seed: number): Board {
  const rng = seeded(seed);
  let b = createBoard(lineup, lineup[0], rng);
  for (let steps = 0; b.battle.result === "ongoing" && steps < 800; steps++) {
    const a = nextBoardAutoAction(b);
    const next =
      a.type === "draw"
        ? drawOnBoard(b, rng)
        : a.type === "play"
        ? playCardOnBoard(b, a.uid, a.target)
        : a.type === "cast"
          ? castOnBoard(b, a.skill, a.target, rng)
          : a.type === "front"
            ? swapFront(b, a.id, a.out, rng)
            : endBoardTurn(b, rng);
    expect(next).not.toBe(b);
    b = next;
  }
  return b;
}

describe("energy deck", () => {
  it("deals no cards: the player draws them one at a time, up to the turn's allowance", () => {
    let b = createBoard(["david", "samuel"], "david", seeded());
    expect(b.battle.hand).toHaveLength(0);
    expect(b.draws).toBe(R.openingHand);
    for (let i = 0; i < R.openingHand; i++) b = drawOnBoard(b, seeded(i));
    expect(b.battle.hand).toHaveLength(R.openingHand);
    expect(b.draws).toBe(0);
    expect(drawOnBoard(b)).toBe(b);
  });

  it("a played card frees a slot, and unused draws don't carry over", () => {
    let b = createBoard(["david", "samuel"], "david", seeded());
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
    const b = createBoard(["david"], "david", seeded());
    expect(b.lineup).toEqual(["david"]);
    expect(isAlive(b.battle, "samuel")).toBe(false);
    expect(isAlive(b.battle, "jonathan")).toBe(false);
    expect(b.battle.intents.flatMap((i) => i.targets).every((id) => id === "david")).toBe(true);
  });

  it("a lone champion duels Goliath: the shield bearer and the archer stand aside", () => {
    const duel = createBoard(["david"], "david", seeded());
    expect(duel.battle.enemies.bearer.hp).toBe(0);
    expect(duel.battle.enemies.archer.hp).toBe(0);
    expect(duel.battle.archerTarget).toBeNull();
    expect(duel.battle.result).toBe("ongoing");
    const team = createBoard(["david", "jonathan"], "david", seeded());
    expect(team.battle.enemies.bearer.hp).toBeGreaterThan(0);
    expect(team.battle.enemies.archer.hp).toBeGreaterThan(0);
  });

  it("Arise can't bring in someone who stayed behind", () => {
    const b = createBoard(["samuel", "jonathan"], "jonathan", seeded());
    b.battle.energy.guard = 2;
    expect(boardSkillTargets(b, "arise")).toEqual([]);
    expect(castOnBoard(b, "arise", "david")).toBe(b);
  });
});

describe("formation", () => {
  it("a team stands in two rows: two in front, the rest behind; blows aimed at the front row never reach the back row", () => {
    const b = createBoard(["david", "samuel", "jonathan"], "samuel", seeded());
    expect(b.front).toEqual(["samuel", "david"]);
    expect(backRow(b)).toEqual(["jonathan"]);
    b.battle.intents[0] = { action: "spear", targets: [] };
    const after = resolveBoard(b);
    const lost = (id: CharacterId) => b.battle.party[id].hp - after.battle.party[id].hp;
    expect(lost("jonathan")).toBe(0);
    // the spear and the arrow each fall on one front-row character, and not on the same one
    const spear = after.battle.intents[0].targets;
    expect(b.front).toContain(after.battle.archerTarget);
    expect(lost("samuel") + lost("david")).toBeGreaterThan(0);
    expect(spear.length).toBeLessThanOrEqual(1);
  });

  it("the front row takes the blows one at a time, telegraphed in advance, and the turn changes who", () => {
    const b = createBoard(["david", "samuel", "jonathan"], "david", seeded());
    b.battle.intents[0] = { action: "spear", targets: [] };
    b.battle.intents[1] = { action: "spear", targets: [] };
    const aimed = swapFront(b, "jonathan", "samuel"); // re-aims
    const [now, next] = aimed.battle.intents.map((i) => i.targets[0]);
    expect(aimed.front).toContain(now);
    expect(aimed.front).toContain(next);
    expect(now).not.toBe(next);
  });

  it("the element of whoever is hit decides the damage", () => {
    // Metal Goliath hits light David normally; fire Jonathan resists metal (x0.75).
    const b = spearTurn(["david", "jonathan"], "david");
    const after = resolveBoard(b);
    const victim = after.battle.intents[0].targets[0] ?? b.battle.intents[0].targets[0];
    const hit = b.front.find((id) => b.battle.party[id].hp - after.battle.party[id].hp > 0)!;
    expect(["david", "jonathan"]).toContain(victim ?? hit);
    expect(b.battle.party[hit].hp - after.battle.party[hit].hp).toBe(enemyDamage("goliath", hit, R.spear));
    expect(enemyDamage("goliath", "jonathan", R.spear)).toBe(Math.floor((R.spear * 0.75) / 10) * 10);
  });

  it("a blow that hunts the weakest reaches the back row", () => {
    const b = createBoard(["david", "samuel", "jonathan"], "david", seeded());
    b.battle.party.jonathan.hp = 20;
    b.battle.intents[0] = { action: "maul", targets: [] };
    const after = resolveBoard(b);
    expect(after.battle.party.jonathan.hp).toBeLessThan(20);
  });

  it("allows one free swap a turn: a back-row character takes the place of a front-row one", () => {
    let b = createBoard(["david", "samuel", "jonathan"], "david", seeded());
    expect(b.front).toEqual(["david", "samuel"]);
    expect(canSwap(b, "david", "samuel")).toBe(false); // already in front
    expect(canSwap(b, "jonathan", "jonathan")).toBe(false); // not in front, can't step back
    b = swapFront(b, "jonathan", "samuel");
    expect(b.front).toEqual(["david", "jonathan"]);
    expect(backRow(b)).toEqual(["samuel"]);
    expect(canSwap(b, "samuel", "david")).toBe(false);
    expect(swapFront(b, "samuel", "david")).toBe(b);
    b = endBoardTurn(b, seeded(2));
    expect(canSwap(b, "samuel", "david")).toBe(b.battle.result === "ongoing" && isAlive(b.battle, "samuel") && isAlive(b.battle, "david"));
  });

  it("a fallen front-row character must be replaced before anything else, for free", () => {
    let b = createBoard(["david", "samuel", "jonathan"], "david", seeded());
    b.battle.party.samuel.hp = 0;
    b.battle.energy.attack = 1;
    expect(needsFront(b)).toBe(true);
    expect(boardBlockReason(b, "sling", "bearer")).toBe("v3.reason.chooseFront");
    expect(resolveBoard(b)).toBe(b);
    b = swapFront(b, "jonathan");
    expect(b.front).toEqual(["david", "jonathan"]);
    expect(needsFront(b)).toBe(false);
  });

  it("with nobody left behind a fallen front-row character leaves the front row short, not stuck", () => {
    const b = createBoard(["david", "jonathan"], "david", seeded());
    b.battle.party.jonathan.hp = 0;
    expect(needsFront(b)).toBe(false);
    expect(frontLiving(b)).toEqual(["david"]);
  });

  it("losing the only character is a defeat", () => {
    const b = createBoard(["jonathan"], "jonathan", seeded());
    b.battle.party.jonathan.hp = 10;
    b.battle.intents[0] = { action: "spear", targets: [] };
    expect(resolveBoard(b).battle.result).toBe("defeat");
  });
});

describe("achievements", () => {
  it("only David's duel victory earns an achievement", () => {
    const b = createBoard(["david"], "david", seeded());
    b.battle.result = "victory";
    expect(earnedBy(b)).toEqual(["solo-david"]);
    const jonathan = createBoard(["jonathan"], "jonathan", seeded());
    jonathan.battle.result = "victory";
    expect(earnedBy(jonathan)).toEqual([]);
    const team = createBoard(["david", "samuel"], "david", seeded());
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
