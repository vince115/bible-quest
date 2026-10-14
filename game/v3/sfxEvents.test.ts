import { describe, expect, it } from "vitest";
import { MAX_HP } from "../v2/data";
import { createBattle, drawCard, playCard } from "../v2/engine";
import type { BattleState, CardId } from "../v2/types";
import { sfxEvents } from "./sfxEvents";

const seeded = (seed = 3) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** A tabletop battle at Goliath with David, Jonathan and Samuel and an empty hand. */
const battle = (): BattleState => {
  const s = createBattle(seeded(), ["david", "jonathan", "samuel"], "goliath", 0, "table");
  s.hand = [];
  return s;
};
const copy = (s: BattleState): BattleState => structuredClone(s);

describe("sound effects for a change in the battle", () => {
  it("is silent at the start and when nothing changed", () => {
    const s = battle();
    expect(sfxEvents(null, s)).toEqual([]);
    expect(sfxEvents(s, copy(s))).toEqual([]);
  });

  it("is silent when a different battle begins", () => {
    const s = battle();
    const other = createBattle(seeded(), ["david", "jonathan", "samuel"], "eden", 0, "table");
    expect(sfxEvents(s, other)).toEqual([]);
  });

  it("hits when an enemy loses HP, and says so when it falls", () => {
    const a = battle();
    const b = copy(a);
    b.enemies.goliath.hp -= 30;
    expect(sfxEvents(a, b)).toEqual(["hit"]);
    const c = copy(a);
    c.enemies.goliath.hp = 0;
    expect(sfxEvents(a, c)).toEqual(["hit", "enemyDown"]);
  });

  it("tells a hurt ally, a blow the shield took, a heal and a new shield apart", () => {
    const a = battle();
    a.party.david.hp = MAX_HP.david - 50;
    a.party.jonathan.shield = 30;
    const hurt = copy(a);
    hurt.party.david.hp -= 20;
    expect(sfxEvents(a, hurt)).toEqual(["hurt"]);
    const blocked = copy(a);
    blocked.party.jonathan.shield = 10;
    expect(sfxEvents(a, blocked)).toEqual(["block"]);
    const healed = copy(a);
    healed.party.david.hp += 40;
    expect(sfxEvents(a, healed)).toEqual(["heal"]);
    const shielded = copy(a);
    shielded.party.samuel.shield = 50;
    expect(sfxEvents(a, shielded)).toEqual(["shield"]);
  });

  it("marks an ally falling, and does not call a revive a heal", () => {
    const a = battle();
    const fell = copy(a);
    fell.party.samuel.hp = 0;
    expect(sfxEvents(a, fell)).toContain("down");
    const down = copy(a);
    down.party.samuel.hp = 0;
    const up = copy(down);
    up.party.samuel.hp = 60;
    expect(sfxEvents(down, up)).not.toContain("heal");
  });

  it("clicks when a card is stuck on a character and swishes when one is drawn", () => {
    const a = battle();
    const drawn = drawCard(a, seeded());
    expect(drawn.hand.length).toBe(1);
    expect(sfxEvents(a, drawn)).toEqual(["draw"]);
    const withCard = copy(a);
    withCard.hand = [{ uid: 7, card: "trains" as CardId }];
    const stuck = playCard(withCard, 7, "david");
    expect(stuck.attached).toBe(1);
    expect(sfxEvents(withCard, stuck)).toEqual(["attach"]);
  });

  it("ends with the victory or defeat sound, even in a busy turn, and never more than four sounds", () => {
    const a = battle();
    const won = copy(a);
    won.result = "victory";
    won.enemies.goliath.hp = 0;
    won.party.david.hp -= 10;
    won.party.jonathan.shield += 20;
    won.hand = [{ uid: 1, card: "trains" as CardId }];
    won.party.samuel.hp = Math.max(1, won.party.samuel.hp - 5);
    const events = sfxEvents(a, won);
    expect(events.length).toBeLessThanOrEqual(4);
    expect(events[events.length - 1]).toBe("victory");
    const lost = copy(a);
    lost.result = "defeat";
    expect(sfxEvents(a, lost)).toEqual(["defeat"]);
  });
});
