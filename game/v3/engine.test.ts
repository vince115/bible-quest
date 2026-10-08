import { describe, expect, it } from "vitest";
import { RULES_V2 as R } from "../v2/data";
import { enemyDamage, isAlive } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { earnedBy } from "./achievements";
import { nextBoardAutoAction } from "./auto";
import {
  boardBlockReason,
  boardSkillTargets,
  canSwap,
  castOnBoard,
  createBoard,
  endBoardTurn,
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
      a.type === "play"
        ? playCardOnBoard(b, a.uid)
        : a.type === "cast"
          ? castOnBoard(b, a.skill, a.target, rng)
          : a.type === "front"
            ? swapFront(b, a.id, rng)
            : endBoardTurn(b, rng);
    expect(next).not.toBe(b);
    b = next;
  }
  return b;
}

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

describe("front line", () => {
  it("the archer and Goliath's spear hit the front line", () => {
    const b = createBoard(["david", "samuel", "jonathan"], "samuel", seeded());
    b.battle.intents[0] = { action: "spear", targets: ["david"] };
    const after = resolveBoard(b);
    const lost = (id: CharacterId) => b.battle.party[id].hp - after.battle.party[id].hp;
    expect(lost("samuel")).toBe(enemyDamage("archer", "samuel", R.archerDamage) + enemyDamage("goliath", "samuel", R.spear));
    expect(lost("david")).toBe(0);
    expect(lost("jonathan")).toBe(0);
  });

  it("the front line decides elemental damage", () => {
    // Dark Goliath hits light David ×1.5, fire Jonathan normally.
    const david = resolveBoard(spearTurn(["david", "jonathan"], "david"));
    const jonathan = resolveBoard(spearTurn(["david", "jonathan"], "jonathan"));
    expect(120 - david.battle.party.david.hp).toBe(60);
    expect(140 - jonathan.battle.party.jonathan.hp).toBe(40);
  });

  it("allows one free swap per turn", () => {
    let b = createBoard(["david", "samuel", "jonathan"], "david", seeded());
    b = swapFront(b, "jonathan");
    expect(b.front).toBe("jonathan");
    expect(canSwap(b, "samuel")).toBe(false);
    expect(swapFront(b, "samuel")).toBe(b);
    b = endBoardTurn(b, seeded(2));
    expect(canSwap(b, "samuel")).toBe(b.battle.result === "ongoing" && isAlive(b.battle, "samuel"));
  });

  it("a fallen front line must be replaced before anything else, for free", () => {
    let b = createBoard(["david", "jonathan"], "david", seeded());
    b = swapFront(b, "jonathan");
    b.battle.party.jonathan.hp = 0;
    b.battle.energy.attack = 1;
    expect(needsFront(b)).toBe(true);
    expect(boardBlockReason(b, "sling", "bearer")).toBe("v3.reason.chooseFront");
    expect(resolveBoard(b)).toBe(b);
    b = swapFront(b, "david");
    expect(b.front).toBe("david");
    expect(needsFront(b)).toBe(false);
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
