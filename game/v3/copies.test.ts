import { describe, expect, it } from "vitest";
import { translate } from "../i18n";
import { MAX_HP } from "../v2/data";
import { baseCharacter, copyNumber, copyOf } from "../v2/copies";
import { casterFor, isAlive } from "../v2/engine";
import type { CharacterId } from "../v2/types";
import { nextBoardAutoAction } from "./auto";
import { basicAttackOnBoard, castOnBoard, createBoard, drawOnBoard, endBoardTurn, moveTo, playCardOnBoard, type Board } from "./engine";

function seeded(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIX: CharacterId[] = [1, 2, 3, 4, 5, 6].map((n) => copyOf("david", n));

describe("copies of one card in a line-up", () => {
  it("names a copy after its card, with its number", () => {
    expect(SIX).toEqual(["david", "david#2", "david#3", "david#4", "david#5", "david#6"]);
    expect(baseCharacter("david#4")).toBe("david");
    expect(copyNumber("david#4")).toBe(4);
    expect(copyNumber("david")).toBe(1);
    expect(translate("zh", "char.david#2.name")).toBe(`${translate("zh", "char.david.name")} #2`);
  });

  it("each copy fights as its own character, with its own HP and turn", () => {
    const b = createBoard(["samuel", "david#2", "david"], undefined, seeded(), "goliath", "team");
    expect(b.lineup).toEqual(["david", "david#2", "samuel"]);
    expect(b.battle.party["david#2"].hp).toBe(MAX_HP.david);
    b.battle.energy.attack = 2;
    const after = castOnBoard(b, "sling", "bearer", seeded(), "david#2");
    expect(after.battle.party["david#2"].acted).toBe(true);
    expect(after.battle.party.david.acted).toBe(false);
    // Left unnamed, the skill goes to the first copy that can still act.
    expect(casterFor(after.battle, "sling")).toBe("david");
    const again = castOnBoard(after, "sling", "bearer", seeded());
    expect(again.battle.party.david.acted).toBe(true);
  });

  it("six Davids play a whole battle to its end", () => {
    for (const seed of [1, 2, 3]) {
      const rng = seeded(seed);
      let b: Board = createBoard(SIX, undefined, rng, "goliath", "table");
      expect(b.lineup).toHaveLength(6);
      for (let steps = 0; b.battle.result === "ongoing" && steps < 1500; steps++) {
        const a = nextBoardAutoAction(b);
        b =
          a.type === "draw"
            ? drawOnBoard(b, rng)
            : a.type === "play"
              ? playCardOnBoard(b, a.uid, a.target)
              : a.type === "cast"
                ? castOnBoard(b, a.skill, a.target, rng)
                : a.type === "move"
                  ? moveTo(b, a.id, a.to, rng)
                  : a.type === "basic"
                    ? basicAttackOnBoard(b, a.who, a.target, rng)
                    : endBoardTurn(b, rng);
      }
      expect(b.battle.result).not.toBe("ongoing");
      expect(SIX.some((id) => isAlive(b.battle, id)) || b.battle.result === "defeat").toBe(true);
    }
  });
});
