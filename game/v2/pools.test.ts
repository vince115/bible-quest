import { describe, expect, it } from "vitest";
import { CHARACTER_SKILLS, MAX_HP, RULES_V2 as R, basicDamage, energyCap, mpCap, tableKind } from "./data";
import { basicAttack, canBasicAttack, cardValue, castSkill, paymentPreview, createBattle, elementAdjust, enemyDamage, gainFaith, mpCost, payment, pickCards, playCard, skillBlockReason, spCost, startNextTurn } from "./engine";
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
  const under = (red: number[] = [], green: number[] = [], blue: number[] = []) => ({ red, green, blue });
  const total = (a: number[]) => a.reduce((n, v) => n + v, 0);

  it("starts empty-handed: no energy under anyone, nothing attached yet", () => {
    const s = tabletop();
    for (const id of s.lineup) {
      expect(s.party[id].mp + s.party[id].sp).toBe(0);
      expect(s.party[id].cards).toEqual(under());
    }
    expect(s.attached).toBe(0);
  });

  it("sticks red, green and blue cards under the chosen character, with their printed values", () => {
    let s = withHand(tabletop(), "trains", "assurance", "wings");
    s = playCard(s, 200, "david"); // trains: red 2
    s = playCard(s, 201, "david"); // assurance: blue 2
    expect(s.party.david.cards).toEqual(under([2], [], [2]));
    expect([s.party.david.sp, s.party.david.mp]).toEqual([2, 2]);
    expect(s.attached).toBe(2);
    expect(playCard(s, 202, "david")).toBe(s); // wings (green) is a third card this turn
    s = startNextTurn(s, seeded(), 0);
    s = playCard(s, 202, "david");
    expect(s.party.david.cards).toEqual(under([2], [1], [2]));
  });

  it("allows only two energy cards a turn, whatever their colour", () => {
    let s = withHand(tabletop(), "stones", "stones", "shepherd");
    s = playCard(s, 200, "david");
    s = playCard(s, 201, "jonathan");
    expect(playCard(s, 202, "samuel")).toBe(s); // a green card counts too
    expect(s.attached).toBe(2);
    s = startNextTurn(s, seeded(), 0);
    expect(s.attached).toBe(0);
  });

  it("a character holds only up to their energy cap, by rarity", () => {
    let s = withHand(tabletop(), "spiritSword", "spiritSword", "trains");
    s.party.david.cards = under([], [], [1]); // needs some blue for the Spirit Sword
    s.party.david.mp = 1;
    expect(energyCap("david")).toBeGreaterThan(energyCap("samuel"));
    // Samuel (SR, cap 5) already holds 3: a 3-valued card does not fit, a smaller one does.
    s.party.samuel.cards = under([1, 1, 1]);
    s.party.samuel.sp = 3;
    expect(playCard(s, 200, "samuel")).toBe(s);
    s = playCard(s, 202, "samuel"); // trains is worth 2: 3 + 2 = 5, just fits
    expect(s.party.samuel.sp).toBe(5);
  });

  it("each colour pays its own kind of skill: strikes red, heals and defence green, magic blue", () => {
    let s = tabletop();
    s.party.david.cards = under([3]);
    s.party.david.sp = 3;
    expect(payment(s, "sling")).not.toBeNull(); // a strike: red, cost 1, the 3-card is spent and the extra is lost
    s = castSkill(s, "sling", "goliath", seeded());
    expect(s.party.david.cards).toEqual(under());
    // Samuel's Heal (guard) needs green; blue and red do not pay it.
    s.party.samuel.cards = under([2], [], [2]);
    expect(payment(s, "heal")).toBeNull();
    s.party.samuel.cards = under([], [1]);
    expect(payment(s, "heal")).not.toBeNull();
    // Jonathan's Covenant Shield is magic in the tabletop rules: blue pays it, green does not.
    s.party.jonathan.cards = under([2], [2]);
    expect(payment(s, "covshield")).toBeNull();
    s.party.jonathan.cards = under([], [], [1]);
    expect(payment(s, "covshield")).not.toBeNull();
    // David's Sling Stone (faith) needs 3 blue.
    s.party.david.cards = under([], [3], [2]);
    expect(payment(s, "slingStone")).toBeNull();
    s.party.david.cards = under([], [], [1, 2]);
    expect(payment(s, "slingStone")).not.toBeNull();
    // The cheapest set that covers the cost is chosen: 2 from [1, 2, 2] leaves a 1 and a 2.
    expect(pickCards([1, 2, 2], 2)).toEqual([1]);
    expect(pickCards([1, 1], 3)).toBeNull();
  });

  it("shows which cards would be spent and how much is wasted, and says so when it happens", () => {
    let s = tabletop();
    s.party.jonathan.cards = under([], [], [3]);
    // Covenant Shield costs 1: a blue 3 pays it and 2 of it is lost.
    expect(paymentPreview(s, "covshield")).toEqual({ spent: [3], waste: 2 });
    s = castSkill(s, "covshield", undefined, seeded());
    expect(s.log.some((l) => l.key === "v2.log.wasted" && l.params?.n === 2)).toBe(true);
    s.party.jonathan.cards = under();
    expect(paymentPreview(s, "covshield")).toBeNull(); // cannot pay at all
  });

  it("gives every character a blue (magic) skill in the tabletop rules, keeping the cheap ones green or red", () => {
    expect(tableKind("covshield")).toBe("faith");
    expect(tableKind("heal")).toBe("guard");
    expect(tableKind("sling")).toBe("attack");
    // Native faith skills stay blue.
    expect(tableKind("slingStone")).toBe("faith");
    // Everyone with more than one skill can use blue cards.
    const lonely = Object.entries(CHARACTER_SKILLS).filter(([, ks]) => ks.length > 1 && !ks.some((k) => tableKind(k) === "faith"));
    expect(lonely.map(([id]) => id)).toEqual([]);
  });

  it("does not regenerate between turns", () => {
    let s = tabletop();
    s.party.david.cards = under([1], [], [2]);
    s.party.david.sp = 1;
    s.party.david.mp = 2;
    s = startNextTurn(s, seeded(), 0);
    expect(s.party.david.cards).toEqual(under([1], [], [2]));
  });

  it("elements add or take away a flat 10 instead of multiplying", () => {
    expect(elementAdjust(30, 1.5, "table")).toBe(40);
    expect(elementAdjust(30, 0.75, "table")).toBe(20);
    expect(elementAdjust(30, 1, "table")).toBe(30);
    expect(elementAdjust(0, 0.75, "table")).toBe(0);
    expect(enemyDamage("goliath", "eve", 100, "table")).toBe(110); // metal beats wood: +10, not ×1.5
    expect(enemyDamage("goliath", "eve", 100)).toBe(150); // the digital rules still multiply
  });

  it("skills that give energy put value-1 cards of the right colour under the caster, up to the cap", () => {
    const s = tabletop();
    expect(gainFaith(s, "samuel", 9)).toBe(energyCap("samuel"));
    expect(s.party.samuel.cards!.blue).toEqual(Array(energyCap("samuel")).fill(1));
    expect(total(s.party.samuel.cards!.green)).toBe(0);
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
