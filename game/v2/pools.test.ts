import { describe, expect, it } from "vitest";
import { MAX_HP, RULES_V2 as R, basicDamage, energyCap, mpCap } from "./data";
import { basicAttack, canBasicAttack, cardValue, castSkill, createBattle, elementAdjust, enemyDamage, gainFaith, mpCost, payment, pickCards, playCard, skillBlockReason, spCost, startNextTurn } from "./engine";
import type { BattleState, CardId, CharacterId } from "./types";

function seeded(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A personal-pools battle in Gerasa with the given line-up and no cards in hand. */
function battle(lineup: CharacterId[] = ["jesusUR", "peter", "johnApostle"]): BattleState {
  const s = createBattle(seeded(), lineup, "gerasa", 0, "personal");
  s.hand = [];
  s.enemies.uncleanSpirits.hp = 0;
  s.enemies.swine.hp = 0;
  return s;
}

const hand = (s: BattleState, ...cards: CardId[]) => {
  s.hand = cards.map((card, i) => ({ uid: 100 + i, card }));
  return s;
};

describe("personal pools", () => {
  it("MP is on the HP scale: the cap follows HP, and each character starts with half of it, plus a little SP", () => {
    const s = battle();
    for (const id of s.lineup) {
      expect(mpCap(id)).toBe(MAX_HP[id]);
      expect(s.party[id].mp).toBe(Math.round((MAX_HP[id] / 2) / 10) * 10);
      expect(s.party[id].sp).toBe(R.pools.startSp);
    }
    expect(s.energy).toEqual({ faith: 0, attack: 0, guard: 0 }); // the team pool stays empty
    expect(mpCap("jesusUR")).toBeGreaterThan(mpCap("samuel"));
    expect(mpCost("walkOnWater")).toBe(90); // a cost-2 ultimate
  });

  it("strikes are paid with the caster's SP, other skills with their MP", () => {
    let s = battle();
    s.party.jesusUR.sp = spCost("comeOut");
    s.party.jesusUR.mp = 0;
    expect(payment(s, "comeOut")).not.toBeNull(); // a strike: SP only
    expect(payment(s, "walkOnWater")).toBeNull(); // a spell: needs MP
    s = castSkill(s, "comeOut", "legion", seeded());
    expect(s.party.jesusUR.sp).toBe(0);
    expect(s.energy.attack).toBe(0);
    s.party.jesusUR.mp = mpCost("walkOnWater") - 10;
    expect(payment(s, "walkOnWater")).toBeNull(); // a little short
    s.party.jesusUR.mp = mpCost("walkOnWater") + 20;
    s.party.jesusUR.acted = false;
    expect(skillBlockReason(s, "walkOnWater")).toBeNull();
    s = castSkill(s, "walkOnWater", undefined, seeded());
    expect(s.party.jesusUR.mp).toBe(20);
  });

  it("another character's pool does not pay", () => {
    const s = battle();
    s.party.jesusUR.sp = 0;
    s.party.peter.sp = R.pools.spCap;
    expect(payment(s, "comeOut")).toBeNull();
  });

  it("scripture cards go to a chosen ally: red gives SP, blue gives MP, green shields", () => {
    let s = hand(battle(), "trains", "assurance", "shepherd");
    s.party.peter.sp = 0;
    s.party.peter.mp = 0;
    s = playCard(s, 100, "peter"); // trains: red +2 points = 2 × spUnit SP
    expect(s.party.peter.sp).toBe(2 * R.pools.spUnit);
    s = playCard(s, 101, "peter"); // assurance: blue +2 points = 2 × mpUnit MP
    expect(s.party.peter.mp).toBe(2 * R.pools.mpUnit);
    s = playCard(s, 102, "peter"); // shepherd: green +1 → Shield
    expect(s.party.peter.shield).toBe(R.pools.cardShield);
    expect(s.hand).toHaveLength(0);
  });

  it("a card needs a living target in this mode, and fills only up to the caps", () => {
    const s = hand(battle(), "trains");
    expect(playCard(s, 100)).toBe(s);
    s.party.peter.sp = R.pools.spCap - 5;
    expect(playCard(s, 100, "peter").party.peter.sp).toBe(R.pools.spCap);
    s.party.peter.hp = 0;
    expect(playCard(s, 100, "peter")).toBe(s);
  });

  it("a new turn gives every living character a little SP and MP, up to the caps, and Shields end", () => {
    let s = battle();
    s.party.peter.sp = R.pools.spCap;
    s.party.peter.mp = 0;
    s.party.peter.shield = 30;
    s = startNextTurn(s, seeded(), 0);
    expect(s.party.peter.sp).toBe(R.pools.spCap);
    expect(s.party.peter.mp).toBe(R.pools.mpRegen * R.pools.mpUnit);
    expect(s.party.peter.shield).toBe(0);
    expect(s.party.jesusUR.sp).toBe(Math.min(R.pools.spCap, R.pools.startSp + R.pools.spRegen));
  });

  it("MP stays within HP-sized numbers for every character, in steps of 10", () => {
    for (const id of Object.keys(MAX_HP) as CharacterId[]) {
      expect(mpCap(id) % 10).toBe(0);
      expect(mpCap(id)).toBeGreaterThanOrEqual(MAX_HP[id] / 2);
    }
  });
});

describe("Noah", () => {
  it("strikes with Judgment of the Flood, paid with his own SP", () => {
    let s = createBattle(seeded(), ["noah", "adam"], "ark", 0, "personal");
    s.hand = [];
    s.enemies.fountains.hp = 0;
    s.enemies.windows.hp = 0;
    s.party.noah.sp = spCost("greatFlood");
    const before = s.enemies.flood.hp;
    s = castSkill(s, "greatFlood", "flood", seeded());
    expect(before - s.enemies.flood.hp).toBeGreaterThan(0);
    expect(s.party.noah.sp).toBe(0);
  });
});

describe("tabletop mode", () => {
  /** A tabletop battle at Goliath with David, Jonathan and Samuel and nothing in hand. */
  function tabletop(): BattleState {
    const s = createBattle(seeded(), ["david", "jonathan", "samuel"], "goliath", 0, "table");
    s.hand = [];
    s.enemies.bearer.hp = 0;
    s.enemies.archer.hp = 0;
    return s;
  }
  const withHand = (s: BattleState, ...cards: CardId[]) => {
    s.hand = cards.map((card, i) => ({ uid: 200 + i, card }));
    return s;
  };

  it("starts empty-handed: no energy under anyone, nothing attached yet", () => {
    const s = tabletop();
    for (const id of s.lineup) {
      expect(s.party[id].mp + s.party[id].sp).toBe(0);
      expect(s.party[id].cards).toEqual({ red: [], blue: [] });
    }
    expect(s.attached).toBe(0);
  });

  it("sticks red and blue cards under the chosen character, with their printed values", () => {
    let s = withHand(tabletop(), "trains", "assurance");
    s = playCard(s, 200, "david"); // trains: red 2
    s = playCard(s, 201, "david"); // assurance: blue 2
    expect(s.party.david.cards).toEqual({ red: [2], blue: [2] });
    expect([s.party.david.sp, s.party.david.mp]).toEqual([2, 2]);
    expect(s.attached).toBe(2);
  });

  it("allows only two energy cards a turn, and a Shield card does not count", () => {
    let s = withHand(tabletop(), "stones", "stones", "stones", "shepherd");
    s = playCard(s, 200, "david");
    s = playCard(s, 201, "jonathan");
    const third = playCard(s, 202, "samuel");
    expect(third).toBe(s); // blocked: two attached already
    s = playCard(s, 203, "samuel"); // a green card is a Shield, not energy
    expect(s.party.samuel.shield).toBe(R.table.cardGreen * 1); // at full HP a green card gives extra HP
    expect(s.attached).toBe(2);
    s = startNextTurn(s, seeded(), 0);
    expect(s.attached).toBe(0);
    expect(s.party.samuel.shield).toBe(R.table.cardGreen * 1); // extra HP stays until damage uses it up
  });

  it("a character holds only up to their energy cap, by rarity", () => {
    let s = withHand(tabletop(), "spiritSword", "spiritSword", "trains");
    s.party.david.cards = { red: [], blue: [1] }; // needs some blue for the Spirit Sword
    s.party.david.mp = 1;
    expect(energyCap("david")).toBeGreaterThan(energyCap("samuel"));
    // Samuel (SR, cap 5) already holds 3: a 3-valued card does not fit, a smaller one does.
    s.party.samuel.cards = { red: [1, 1, 1], blue: [] };
    s.party.samuel.sp = 3;
    expect(playCard(s, 200, "samuel")).toBe(s);
    s = playCard(s, 202, "samuel"); // trains is worth 2: 3 + 2 = 5, just fits
    expect(s.party.samuel.sp).toBe(5);
  });

  it("pays with the owner's cards of the right colour, giving no change", () => {
    let s = tabletop();
    s.party.david.cards = { red: [3], blue: [] };
    s.party.david.sp = 3;
    expect(payment(s, "sling")).not.toBeNull(); // cost 1: the 3-card is spent, the extra is lost
    s = castSkill(s, "sling", "goliath", seeded());
    expect(s.party.david.cards).toEqual({ red: [], blue: [] });
    expect(s.party.david.sp).toBe(0);
    // Blue cards do not pay a strike.
    s.party.david.cards = { red: [], blue: [1, 1, 1] };
    s.party.david.mp = 3;
    s.party.david.acted = false;
    expect(payment(s, "sling")).toBeNull();
    // The cheapest set that covers the cost is chosen: 2 from [1, 2, 2] leaves a 1 and a 2.
    expect(pickCards([1, 2, 2], 2)).toEqual([1]);
    expect(pickCards([1, 1], 3)).toBeNull();
  });

  it("a green card heals a hurt character (not past their maximum) and shields one who is unhurt", () => {
    let s = withHand(tabletop(), "renewed", "renewed", "shepherd");
    s.turn = 3; // "renewed" can be played from turn 3
    s.party.samuel.hp = MAX_HP.samuel - 50;
    s = playCard(s, 200, "samuel"); // renewed: green 3 = 60, but only 50 was lost
    expect(s.party.samuel.hp).toBe(MAX_HP.samuel);
    expect(s.party.samuel.shield).toBe(0);
    s = playCard(s, 201, "samuel"); // unhurt now: the same 60 as extra HP, up to the cap
    expect(s.party.samuel.shield).toBe(Math.min(R.table.bonusCap, R.table.cardGreen * 3));
    s.party.david.hp = MAX_HP.david - 10;
    s = playCard(s, 202, "david"); // shepherd: green 1 = 20, heals the 10 lost
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(s.attached).toBe(0); // green cards are not energy
  });

  it("does not regenerate between turns", () => {
    let s = tabletop();
    s.party.david.cards = { red: [1], blue: [2] };
    s.party.david.sp = 1;
    s.party.david.mp = 2;
    s = startNextTurn(s, seeded(), 0);
    expect(s.party.david.cards).toEqual({ red: [1], blue: [2] });
  });

  it("elements add or take away a flat 10 instead of multiplying", () => {
    expect(elementAdjust(30, 1.5, "table")).toBe(40);
    expect(elementAdjust(30, 0.75, "table")).toBe(20);
    expect(elementAdjust(30, 1, "table")).toBe(30);
    expect(elementAdjust(0, 0.75, "table")).toBe(0);
    expect(enemyDamage("goliath", "eve", 100, "table")).toBe(110); // metal beats wood: +10, not ×1.5
    expect(enemyDamage("goliath", "eve", 100)).toBe(150); // the digital rules still multiply
  });

  it("skills that give energy put value-1 cards under the caster, up to the cap", () => {
    const s = tabletop();
    expect(gainFaith(s, "samuel", 9)).toBe(energyCap("samuel"));
    expect(s.party.samuel.cards!.blue).toEqual(Array(energyCap("samuel")).fill(1));
    expect(cardValue("assurance")).toBe(2);
  });
});

describe("the free basic attack (tabletop mode)", () => {
  function tabletop(): BattleState {
    const s = createBattle(seeded(), ["david", "jonathan", "samuel"], "goliath", 0, "table");
    s.hand = [];
    return s;
  }

  it("costs no energy but takes the character's action, and hits for the damage printed on their card", () => {
    let s = tabletop();
    expect(basicDamage("david")).toBe(R.table.basicDamage.SSR);
    expect(canBasicAttack(s, "david")).toBe(true);
    const before = s.enemies.bearer.hp; // the shield bearer stands in front of Goliath
    s = basicAttack(s, "david", "bearer");
    expect(before - s.enemies.bearer.hp).toBeGreaterThan(0);
    expect(s.party.david.acted).toBe(true);
    expect(canBasicAttack(s, "david")).toBe(false); // one action a turn
    expect(s.party.david.sp + s.party.david.mp).toBe(0);
  });

  it("cannot reach Goliath while his shield bearer stands, and not when shaken", () => {
    const s = tabletop();
    expect(basicAttack(s, "david", "goliath")).toBe(s);
    s.party.samuel.shaken = true;
    expect(canBasicAttack(s, "samuel")).toBe(false);
  });

  it("is only in the tabletop rules", () => {
    const team = createBattle(seeded(), ["david"], "goliath");
    expect(canBasicAttack(team, "david")).toBe(false);
    const personal = createBattle(seeded(), ["david"], "goliath", 0, "personal");
    expect(canBasicAttack(personal, "david")).toBe(false);
  });
});
