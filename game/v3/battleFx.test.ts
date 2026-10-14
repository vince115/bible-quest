import { describe, expect, it } from "vitest";
import { createBattle } from "../v2/engine";
import type { BattleState } from "../v2/types";
import { battleDeltas } from "./battleFx";

const battle = (): BattleState => {
  const s = createBattle(() => 0.5, ["david", "jonathan", "samuel"], "goliath", 0, "table");
  s.hand = [];
  return s;
};
const copy = (s: BattleState): BattleState => structuredClone(s);

describe("numbers to float over the cards", () => {
  it("shows nothing at the start, when nothing changed, or in another battle", () => {
    const s = battle();
    expect(battleDeltas(null, s)).toEqual([]);
    expect(battleDeltas(s, copy(s))).toEqual([]);
    expect(battleDeltas(s, createBattle(() => 0.5, ["david", "jonathan", "samuel"], "eden", 0, "table"))).toEqual([]);
  });

  it("shows the HP an enemy or an ally lost", () => {
    const a = battle();
    const b = copy(a);
    b.enemies.goliath.hp -= 30;
    b.party.david.hp -= 20;
    expect(battleDeltas(a, b)).toEqual([
      { id: "david", kind: "damage", amount: 20 },
      { id: "goliath", kind: "damage", amount: 30 },
    ]);
  });

  it("counts the shield that took a blow, and says when the shield took all of it", () => {
    const a = battle();
    a.party.jonathan.shield = 30;
    const mixed = copy(a);
    mixed.party.jonathan.shield = 0;
    mixed.party.jonathan.hp -= 10;
    expect(battleDeltas(a, mixed)).toEqual([{ id: "jonathan", kind: "damage", amount: 40 }]);
    const blocked = copy(a);
    blocked.party.jonathan.shield = 10;
    expect(battleDeltas(a, blocked)).toEqual([{ id: "jonathan", kind: "block", amount: 20 }]);
  });

  it("shows heals and new shields, but a revive is not a heal of the missing HP", () => {
    const a = battle();
    a.party.samuel.hp = 50;
    const b = copy(a);
    b.party.samuel.hp = 90;
    b.party.david.shield += 25;
    expect(battleDeltas(a, b)).toEqual([
      { id: "david", kind: "shield", amount: 25 },
      { id: "samuel", kind: "heal", amount: 40 },
    ]);
    const down = copy(a);
    down.party.samuel.hp = 0;
    const up = copy(down);
    up.party.samuel.hp = 60;
    expect(battleDeltas(down, up)).toEqual([]);
  });
});
