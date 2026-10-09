import { describe, expect, it } from "vitest";
import { ENEMY_HP, MAX_HP, RULES_V2 as R, personOf } from "./data";
import { castSkill, createBattle, resolveGoliath, skillBlockReason, skillDamage, skillTargets, startNextTurn } from "./engine";
import type { BattleState, CharacterId } from "./types";

function seeded(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A battle with Adam, Eve and David, cards cleared and energy set. */
function battle(energy: Partial<BattleState["energy"]> = {}): BattleState {
  const s = createBattle(seeded(), ["david", "adam", "eve"]);
  s.hand = [];
  s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
  return s;
}

describe("line-up", () => {
  it("only the line-up is in the battle", () => {
    const s = createBattle(seeded(), ["adam", "eve"]);
    expect(s.lineup).toEqual(["adam", "eve"]);
    expect(s.party.adam.hp).toBe(MAX_HP.adam);
    expect(s.party.david.hp).toBe(0);
    // Characters who sat out can't be raised.
    s.energy.guard = 2;
    expect(skillTargets(s, "arise")).toEqual([]);
  });

  it("the default line-up is David, Samuel and Jonathan", () => {
    expect(createBattle(seeded()).lineup).toEqual(["david", "samuel", "jonathan"]);
  });
});

describe("Adam", () => {
  it("Till the Ground deals 30 damage", () => {
    const s = castSkill(battle({ attack: 1 }), "till", "archer");
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 30); // earth → fire ×1
  });

  it("Keep the Garden gives Adam a Shield of 50", () => {
    const s = castSkill(battle({ guard: 1 }), "keep");
    expect(s.party.adam.shield).toBe(R.keepShield);
    expect(s.party.david.shield).toBe(0);
  });
});

describe("Eve", () => {
  it("Mother of All Living heals every ally, up to their maximum", () => {
    const start = battle({ guard: 2 });
    start.party.david.hp = 50;
    start.party.adam.hp = 120;
    const s = castSkill(start, "mother");
    expect(s.party.david.hp).toBe(50 + R.motherHeal);
    expect(s.party.adam.hp).toBe(MAX_HP.adam);
  });

  it("A Helper lets an ally who has acted act again, once per battle", () => {
    let s = castSkill(battle({ attack: 2, guard: 2 }), "sling", "bearer");
    expect(s.party.david.acted).toBe(true);
    expect(skillTargets(s, "helper")).toEqual(["david"]);
    s = castSkill(s, "helper", "david");
    expect(s.party.david.acted).toBe(false);
    expect(s.helperUsed).toBe(true);
    // David strikes again.
    s = castSkill(s, "sling", "bearer");
    expect(s.enemies.bearer.hp).toBe(0);
    // Once per battle.
    s.party.eve.acted = false;
    expect(skillBlockReason(s, "helper", "david")).toBe("v2.reason.ariseUsed");
  });

  it("A Helper needs an ally who has already acted", () => {
    const s = battle({ guard: 1 });
    expect(skillBlockReason(s, "helper")).toBe("v2.reason.noTarget");
  });
});

describe("Cain", () => {
  const cain = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["cain", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Fruit of the Ground deals 20 damage and gives 1 Faith", () => {
    const s = castSkill(cain({ attack: 1 }), "offering", "archer");
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 20); // earth → fire ×1
    expect(s.energy).toMatchObject({ attack: 0, faith: R.offeringFaith });
  });

  it("Fruit of the Ground never pushes Faith over its cap", () => {
    const s = castSkill(cain({ attack: 1, faith: R.maxFaith }), "offering", "archer");
    expect(s.energy.faith).toBe(R.maxFaith);
  });

  it("the Mark strikes back at every enemy that hits Cain this turn", () => {
    let s = castSkill(cain({ guard: 2 }), "mark");
    s.intents[0] = { action: "spear", targets: ["cain"] };
    s.archerTarget = "cain";
    s = resolveGoliath(s, seeded());
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - R.markRetaliate);
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - R.markRetaliate);
    expect(s.party.cain.hp).toBeLessThan(MAX_HP.cain);
  });

  it("the Mark lasts one turn and can be used once per battle", () => {
    let s = castSkill(cain({ guard: 4 }), "mark");
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = startNextTurn(resolveGoliath(s, seeded()), seeded());
    expect(s.marked).toBe(false);
    expect(skillBlockReason(s, "mark")).toBe("v2.reason.ariseUsed");
  });

  it("the Mark does nothing when nobody hits Cain", () => {
    let s = castSkill(cain({ guard: 2 }), "mark");
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath);
  });
});

describe("Abel", () => {
  const abel = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["abel", "cain", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Firstlings of the Flock heals one ally, up to their maximum", () => {
    const start = abel({ guard: 2 });
    start.party.david.hp = 50;
    expect(castSkill(start, "firstlings", "david").party.david.hp).toBe(50 + R.firstlingsHeal);
    start.party.david.hp = MAX_HP.david - 10;
    expect(castSkill(start, "firstlings", "david").party.david.hp).toBe(MAX_HP.david);
  });

  it("Faith Offering deals 20 damage", () => {
    const s = castSkill(abel({ attack: 1 }), "faithOffering", "archer");
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 20); // light → fire ×1
  });

  it("Yet Speaketh: when Abel falls, every ally gains Shield and Faith", () => {
    let s = abel();
    s.party.abel.hp = 10;
    s.intents[0] = { action: "spear", targets: ["abel"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.abel.hp).toBe(0);
    expect(s.party.cain.shield).toBe(R.speakethShield);
    expect(s.party.david.shield).toBe(R.speakethShield);
    expect(s.energy.faith).toBe(R.speakethFaith);
  });
});

describe("Noah", () => {
  const noah = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["noah", "david", "abel"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Build the Ark shields every ally", () => {
    const s = castSkill(noah({ guard: 2 }), "ark");
    expect([s.party.noah.shield, s.party.david.shield, s.party.abel.shield]).toEqual([R.arkShield, R.arkShield, R.arkShield]);
  });

  it("Rainbow Covenant heals every ally, lifts Shaken, once per battle", () => {
    const start = noah({ guard: 6 });
    start.party.david.hp = 30;
    start.party.abel.shaken = true;
    const s = castSkill(start, "rainbow");
    expect(s.party.david.hp).toBe(30 + R.rainbowHeal);
    expect(s.party.abel.shaken).toBe(false);
    expect(s.party.noah.hp).toBe(MAX_HP.noah);
    expect(skillBlockReason({ ...s, party: { ...s.party, noah: { ...s.party.noah, acted: false } } }, "rainbow")).toBe("v2.reason.ariseUsed");
  });
});

describe("Abraham", () => {
  const abraham = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["abraham", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Look Toward Heaven gives 2 Faith, up to the cap", () => {
    expect(castSkill(abraham({ guard: 1 }), "stars").energy).toMatchObject({ guard: 0, faith: R.starsFaith });
    expect(castSkill(abraham({ guard: 1, faith: R.maxFaith - 1 }), "stars").energy.faith).toBe(R.maxFaith);
  });

  it("The LORD Will Provide draws 3 cards, once per battle", () => {
    const start = abraham({ faith: 4 });
    const s = castSkill(start, "provide", undefined, seeded());
    expect(s.hand).toHaveLength(R.provideDraw);
    expect(s.energy.faith).toBe(2);
    expect(skillBlockReason({ ...s, party: { ...s.party, abraham: { ...s.party.abraham, acted: false } } }, "provide")).toBe("v2.reason.ariseUsed");
  });
});

describe("Isaac", () => {
  const isaac = (lineup: CharacterId[], energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), lineup);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Hundredfold Harvest deals 20, or 40 with Abraham beside him", () => {
    // wood → fire ×1
    expect(skillDamage(isaac(["isaac", "david"]), "harvest", "archer")).toBe(20);
    expect(skillDamage(isaac(["isaac", "abraham"]), "harvest", "archer")).toBe(20 + R.harvestBlessing);
  });

  it("The Ram spares the first ally who would fall this turn, once per battle", () => {
    let s = castSkill(isaac(["isaac", "david"], { guard: 2 }), "ram");
    s.party.david.hp = 20;
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(R.ramHp);
    expect(s.ramReady).toBe(false);
    s = startNextTurn(s, seeded());
    expect(skillBlockReason(s, "ram")).toBe("v2.reason.ariseUsed");
  });
});

describe("Jacob", () => {
  const jacob = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["jacob", "david", "isaac"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Wrestle Until Dawn: 40 damage, Jacob loses 10 HP, +1 Faith", () => {
    const s = castSkill(jacob({ attack: 2 }), "wrestle", "archer");
    expect(s.enemies.archer.hp).toBe(0); // earth → fire ×1, 40 fells the archer
    expect(s.party.jacob.hp).toBe(MAX_HP.jacob - R.wrestleCost);
    expect(s.energy.faith).toBe(R.wrestleFaith);
  });

  it("Jacob's Ladder lets every ally who has acted act again, once per battle", () => {
    let s = jacob({ attack: 2, faith: 3 });
    expect(skillBlockReason(s, "ladder")).toBe("v2.reason.noTarget");
    s = castSkill(s, "sling", "archer");
    s = castSkill(s, "harvest", "archer");
    s = castSkill(s, "ladder");
    expect([s.party.david.acted, s.party.isaac.acted, s.party.jacob.acted]).toEqual([false, false, true]);
    expect(s.ladderUsed).toBe(true);
  });
});

describe("Joseph", () => {
  const joseph = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["joseph", "david", "jacob"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Storehouses of Egypt heal and shield every ally", () => {
    const start = joseph({ guard: 2 });
    start.party.david.hp = 50;
    const s = castSkill(start, "granary");
    expect(s.party.david.hp).toBe(50 + R.granaryHeal);
    expect([s.party.joseph.shield, s.party.david.shield, s.party.jacob.shield]).toEqual([R.granaryShield, R.granaryShield, R.granaryShield]);
  });

  it("God Meant It for Good: half the lost HP to the boss, capped, once per battle", () => {
    const start = joseph({ faith: 4 });
    start.party.david.hp = 20; // lost 100
    start.party.jacob.hp = 90; // lost 40 → 140 / 2 = 70
    let s = castSkill(start, "meantForGood");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 70);
    expect(skillBlockReason({ ...s, party: { ...s.party, joseph: { ...s.party.joseph, acted: false } } }, "meantForGood")).toBe("v2.reason.ariseUsed");
    start.party.jacob.hp = 10;
    s = castSkill(start, "meantForGood");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - R.goodCap);
  });
});

describe("Moses", () => {
  const moses = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["moses", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Part the Red Sea hits every enemy, once per battle", () => {
    const s = castSkill(moses({ faith: 3 }), "sea");
    // fire → wood bearer ×1, fire → metal Goliath ×1.5, fire → fire archer ×1
    expect(s.enemies.bearer.hp).toBe(0);
    expect(s.enemies.archer.hp).toBe(0);
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 90);
    expect(s.seaUsed).toBe(true);
  });

  it("Hold Up His Hands: every attack +20 this turn only", () => {
    let s = castSkill(moses({ guard: 2, attack: 1 }), "handsUp");
    expect(skillDamage(s, "sling", "archer")).toBe(30 + R.handsBonus);
    s = startNextTurn(resolveGoliath(s, seeded()), seeded());
    expect(skillDamage(s, "sling", "archer")).toBe(30);
  });
});

describe("Aaron", () => {
  const aaron = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["aaron", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Aaron's Blessing heals and shields one ally", () => {
    const start = aaron({ guard: 1 });
    start.party.david.hp = 50;
    const s = castSkill(start, "blessing", "david");
    expect(s.party.david.hp).toBe(50 + R.blessingHeal);
    expect(s.party.david.shield).toBe(R.blessingShield);
  });

  it("the Breastplate halves the leader's damage for one turn", () => {
    let s = castSkill(aaron({ guard: 2 }), "breastplate");
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david - R.spear / 2); // metal → light ×1
    s = startNextTurn(s, seeded());
    expect(s.breastplate).toBe(false);
  });
});

describe("Miriam", () => {
  const miriam = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["miriam", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Timbrel of Praise hits every enemy for 10", () => {
    const s = castSkill(miriam({ attack: 1 }), "timbrel");
    expect(s.enemies.bearer.hp).toBe(ENEMY_HP.bearer - 10);
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 10);
  });

  it("Song of the Sea gives 2 Faith and lifts Shaken from everyone", () => {
    const start = miriam({ guard: 2 });
    start.party.david.shaken = true;
    const s = castSkill(start, "song");
    expect(s.energy.faith).toBe(R.songFaith);
    expect(s.party.david.shaken).toBe(false);
  });
});

describe("Moses on Mount Sinai", () => {
  const sinai = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["mosesSinai", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("is the same person as Moses", () => {
    expect(personOf("mosesSinai")).toBe(personOf("moses"));
    expect(personOf("aaron")).toBe("aaron");
  });

  it("The Ten Words shield every ally and give 1 Faith", () => {
    const s = castSkill(sinai({ guard: 2 }), "tenWords");
    expect([s.party.mosesSinai.shield, s.party.david.shield]).toEqual([R.tenWordsShield, R.tenWordsShield]);
    expect(s.energy.faith).toBe(R.tenWordsFaith);
  });

  it("His Face Shone makes the leader lose its next action, once per battle", () => {
    let s = castSkill(sinai({ faith: 3 }), "faceShone");
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(skillBlockReason(startNextTurn(s, seeded()), "faceShone")).toBe("v2.reason.ariseUsed");
  });
});

describe("Joshua", () => {
  const joshua = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["joshua", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Strong and Courageous can strike Goliath past the shield bearer", () => {
    const s0 = joshua({ attack: 1 });
    expect(skillTargets(s0, "courage")).toContain("goliath");
    const s = castSkill(s0, "courage", "goliath");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 30); // metal → metal ×1
  });

  it("Jericho Falls hits every enemy and fells the shield bearer, once per battle", () => {
    const s0 = joshua({ faith: 3 });
    s0.enemies.bearer.hp = 200; // even a sturdier bearer falls with the wall
    const s = castSkill(s0, "jericho");
    expect(s.enemies.bearer.hp).toBe(0);
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 40);
    expect(s.jerichoUsed).toBe(true);
  });
});

describe("Rahab", () => {
  const rahab = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["rahab", "david", "joshua"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Hide the Spies shields one ally and lifts Shaken", () => {
    const start = rahab({ guard: 1 });
    start.party.david.shaken = true;
    const s = castSkill(start, "hideSpies", "david");
    expect(s.party.david.shield).toBe(R.hideShield);
    expect(s.party.david.shaken).toBe(false);
  });

  it("the Scarlet Cord spares everyone this turn, once per battle", () => {
    let s = castSkill(rahab({ guard: 3 }), "scarletCord");
    s.party.david.hp = 20;
    s.party.joshua.hp = 30;
    s.intents[0] = { action: "swing", targets: [] };
    s = resolveGoliath(s, seeded());
    expect([s.party.david.hp, s.party.joshua.hp]).toEqual([R.ramHp, R.ramHp]);
    s = startNextTurn(s, seeded());
    expect(s.cordReady).toBe(false);
    expect(skillBlockReason(s, "scarletCord")).toBe("v2.reason.ariseUsed");
  });
});

describe("Deborah", () => {
  const deborah = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["deborah", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Up! This Is the Day turns 1 Attack into 2", () => {
    expect(castSkill(deborah({ attack: 1 }), "upToday").energy.attack).toBe(R.upTodayAttack);
  });

  it("Stars Fought from Heaven strikes the leader, once per battle", () => {
    const s = castSkill(deborah({ faith: 3 }), "starsFought");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 40); // wood → metal ×0.75 = 45 → 40
    expect(s.enemies.bearer.hp).toBe(ENEMY_HP.bearer);
    expect(s.starsFoughtUsed).toBe(true);
  });
});

describe("Gideon", () => {
  const gideon = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["gideon", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Sign of the Fleece gives 1 Faith and draws 1 card", () => {
    const s = castSkill(gideon({ guard: 1 }), "fleece", undefined, seeded());
    expect(s.energy.faith).toBe(R.fleeceFaith);
    expect(s.hand).toHaveLength(R.fleeceDraw);
  });

  it("Torches and Pitchers hit every enemy and confuse the leader, once per battle", () => {
    let s = castSkill(gideon({ faith: 3 }), "torches");
    expect(s.enemies.bearer.hp).toBe(ENEMY_HP.bearer - 30); // fire → wood ×1
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 40); // fire → metal ×1.5 = 45 → 40
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(s.torchesUsed).toBe(true);
  });
});
