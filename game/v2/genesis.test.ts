import { describe, expect, it } from "vitest";
import { ENEMY_HP, MAX_HP, RULES_V2 as R, personOf } from "./data";
import { castSkill, createBattle, endTurn, resolveGoliath, skillBlockReason, skillDamage, skillTargets, startNextTurn } from "./engine";
import type { BattleState, CharacterId } from "./types";

/** Damage is shown in steps of 10. */
const tens = (n: number) => Math.floor(n / 10) * 10;

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
    expect(s.party.david.hp).toBe(MAX_HP.david - tens(R.spear / 2)); // metal → light ×1
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

describe("Samson", () => {
  const samson = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["samson", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("the Jawbone hits every enemy for 30", () => {
    const s = castSkill(samson({ attack: 2 }), "jawbone");
    expect(s.enemies.bearer.hp).toBe(ENEMY_HP.bearer - 20); // wood beats earth: 30 × 0.75 = 22 → 20
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 30); // earth → fire ×1
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 30); // earth → metal ×1
  });

  it("Pull Down the Pillars: 100 to the leader, and Samson falls", () => {
    const s = castSkill(samson({ faith: 3 }), "pillars");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 100); // earth → metal ×1
    expect(s.party.samson.hp).toBe(0);
    expect(s.result).toBe("ongoing"); // David still stands
  });
});

describe("Ruth", () => {
  const ruth = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["ruth", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Gleaning draws 2 cards", () => {
    expect(castSkill(ruth({ guard: 1 }), "glean", undefined, seeded()).hand).toHaveLength(R.gleanDraw);
  });

  it("Whither Thou Goest: Ruth takes the blow meant for the ally, for one turn", () => {
    const s0 = ruth({ guard: 1 });
    expect(skillTargets(s0, "whither")).toEqual(["david"]);
    let s = castSkill(s0, "whither", "david");
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(s.party.ruth.hp).toBe(MAX_HP.ruth - tens(R.spear * 1.5)); // metal → wood ×1.5
    s = startNextTurn(s, seeded());
    expect(s.covered).toBeNull();
  });
});

describe("Naomi", () => {
  const naomi = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["naomi", "ruth", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Mother's Counsel heals 30, or 60 for Ruth", () => {
    const start = naomi({ guard: 1 });
    start.party.david.hp = 50;
    start.party.ruth.hp = 50;
    expect(castSkill(start, "counsel", "david").party.david.hp).toBe(50 + R.counselHeal);
    expect(castSkill(start, "counsel", "ruth").party.ruth.hp).toBe(50 + R.counselHeal * 2);
  });

  it("Restorer of Life raises a fallen ally with 50 HP, once per battle", () => {
    const start = naomi({ guard: 2 });
    start.party.david.hp = 0;
    const s = castSkill(start, "restorer", "david");
    expect(s.party.david.hp).toBe(R.restorerHp);
    expect(s.restorerUsed).toBe(true);
  });
});

describe("Boaz", () => {
  const boaz = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["boaz", "naomi", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Under His Wings gives one ally Shield 60", () => {
    expect(castSkill(boaz({ guard: 2 }), "wings", "naomi").party.naomi.shield).toBe(R.wingsShield);
  });

  it("Kinsman Redeemer lifts everyone below half HP back to half, once per battle", () => {
    const start = boaz({ guard: 2 });
    start.party.david.hp = 20; // max 120 → 60
    start.party.naomi.hp = 10; // max 90 → 40 (tens)
    start.party.boaz.hp = 100; // above half: unchanged
    const s = castSkill(start, "redeemer");
    expect([s.party.david.hp, s.party.naomi.hp, s.party.boaz.hp]).toEqual([60, 40, 100]);
    expect(s.redeemerUsed).toBe(true);
  });
});

describe("Hannah", () => {
  const hannah = (lineup: CharacterId[], energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), lineup);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Silent Prayer gives 1 Faith, or 2 with Samuel", () => {
    expect(castSkill(hannah(["hannah", "david"], { guard: 1 }), "prayer").energy.faith).toBe(R.prayerFaith);
    expect(castSkill(hannah(["hannah", "samuel"], { guard: 1 }), "prayer").energy.faith).toBe(R.prayerSamuelFaith);
  });

  it("Hannah's Song heals every ally and strikes the leader, once per battle", () => {
    const start = hannah(["hannah", "david"], { faith: 3 });
    start.party.david.hp = 50;
    const s = castSkill(start, "hannahSong");
    expect(s.party.david.hp).toBe(50 + R.hannahSongHeal);
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 40); // water → metal ×1
    expect(s.hannahSongUsed).toBe(true);
  });
});

describe("King Saul", () => {
  const saul = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["saul", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Javelin deals 30 (less against fire, which beats metal)", () => {
    expect(castSkill(saul({ attack: 1 }), "javelin", "bearer").enemies.bearer.hp).toBe(ENEMY_HP.bearer - 40); // metal → wood ×1.5 = 45 → 40
    expect(castSkill(saul({ attack: 1 }), "javelin", "archer").enemies.archer.hp).toBe(ENEMY_HP.archer - 20); // metal → fire ×0.75 = 22 → 20
  });

  it("Rash Offering: 2 Faith now, and Saul is Shaken next turn", () => {
    let s = castSkill(saul({ guard: 1 }), "rashOffering");
    expect(s.energy.faith).toBe(R.rashFaith);
    s = endTurn(s, seeded());
    expect(s.party.saul.shaken).toBe(true);
    expect(skillBlockReason(s, "javelin")).toBe("v2.reason.shaken");
    s = endTurn(s, seeded());
    expect(s.party.saul.shaken).toBe(false);
  });
});

describe("Abigail", () => {
  const abigail = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["abigail", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Bread and Wine heals every ally 20", () => {
    const start = abigail({ guard: 1 });
    start.party.david.hp = 50;
    start.party.abigail.hp = 50;
    const s = castSkill(start, "provision");
    expect([s.party.david.hp, s.party.abigail.hp]).toEqual([50 + R.provisionHeal, 50 + R.provisionHeal]);
  });

  it("Wise Intercession softens every hit by 20 for one turn", () => {
    let s = castSkill(abigail({ guard: 2 }), "intercede");
    s.intents[0] = { action: "swing", targets: [] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david - (R.swing - R.intercedeBlock)); // metal → light ×1
    s = startNextTurn(s, seeded());
    expect(s.intercede).toBe(false);
  });
});

describe("King Solomon", () => {
  const solomon = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["solomon", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Ask for Wisdom gives 1 Faith and 1 Attack", () => {
    expect(castSkill(solomon({ guard: 1 }), "wisdom").energy).toMatchObject({ faith: R.wisdomFaith, attack: R.wisdomAttack, guard: 0 });
  });

  it("Fire from Heaven hits every enemy and heals every ally, once per battle", () => {
    const start = solomon({ faith: 3 });
    start.party.david.hp = 50;
    const s = castSkill(start, "templeFire");
    expect(s.enemies.bearer.hp).toBe(ENEMY_HP.bearer - 50); // fire → wood ×1
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 70); // fire → metal ×1.5 = 75 → 70
    expect(s.party.david.hp).toBe(50 + R.templeFireHeal);
    expect(s.templeFireUsed).toBe(true);
  });
});

describe("Elijah", () => {
  const elijah = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["elijah", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Fed by Ravens heals Elijah 40 and draws 1 card", () => {
    const start = elijah({ guard: 1 });
    start.party.elijah.hp = 50;
    const s = castSkill(start, "ravens", undefined, seeded());
    expect(s.party.elijah.hp).toBe(50 + R.ravensHeal);
    expect(s.hand).toHaveLength(R.ravensDraw);
  });

  it("Fire on Carmel strikes the leader for 80, once per battle", () => {
    const s = castSkill(elijah({ faith: 3 }), "carmel");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 120); // fire → metal ×1.5
    expect(s.carmelUsed).toBe(true);
  });
});

describe("Elisha", () => {
  const elisha = (lineup: CharacterId[], energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), lineup);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Healing the Waters heals every ally 20 (40 with Elijah) and lifts Shaken", () => {
    const start = elisha(["elisha", "david"], { guard: 1 });
    start.party.david.hp = 50;
    start.party.david.shaken = true;
    const s = castSkill(start, "healWaters");
    expect(s.party.david.hp).toBe(50 + R.healWatersHeal);
    expect(s.party.david.shaken).toBe(false);
    const withElijah = elisha(["elisha", "elijah"], { guard: 1 });
    withElijah.party.elijah.hp = 50;
    expect(castSkill(withElijah, "healWaters").party.elijah.hp).toBe(50 + R.healWatersHeal * 2);
  });

  it("Chariots of Fire shield every ally, once per battle", () => {
    const s = castSkill(elisha(["elisha", "david"], { faith: 2 }), "chariots");
    expect([s.party.elisha.shield, s.party.david.shield]).toEqual([R.chariotsShield, R.chariotsShield]);
    expect(s.chariotsUsed).toBe(true);
  });
});

describe("Jonah", () => {
  const jonah = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["jonah", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Cast Me Into the Sea draws the blows meant for allies to Jonah", () => {
    let s = castSkill(jonah({ guard: 1 }), "castIntoSea");
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(s.party.jonah.hp).toBeLessThan(MAX_HP.jonah);
  });

  it("Preach to Nineveh hits every enemy", () => {
    const s = castSkill(jonah({ attack: 2 }), "nineveh");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 20);
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 30); // water → fire ×1.5
  });

  it("Out of the Fish: the first fall brings Jonah back next turn with 50 HP, only once", () => {
    let s = jonah();
    s.party.jonah.hp = 10;
    s.intents[0] = { action: "spear", targets: ["jonah"] };
    s = endTurn(s, seeded());
    expect(s.party.jonah.hp).toBe(R.fishHp);
    expect(s.fish).toBe("used");
    s.party.jonah.hp = 10;
    s.intents[0] = { action: "spear", targets: ["jonah"] };
    s = endTurn(s, seeded());
    expect(s.party.jonah.hp).toBe(0);
  });
});

describe("Isaiah", () => {
  it("Here Am I deals 30, and A Great Light strikes the leader and lifts Shaken, once per battle", () => {
    const s0 = createBattle(seeded(), ["isaiah", "david"], "eden");
    s0.hand = [];
    s0.energy = { faith: 3, attack: 1, guard: 0 };
    s0.party.david.shaken = true;
    const s = castSkill(s0, "greatLight");
    expect(s.enemies.serpent.hp).toBe(ENEMY_HP.serpent - 90); // light → dark ×1.5
    expect(s.party.david.shaken).toBe(false);
    expect(s.greatLightUsed).toBe(true);
    expect(skillDamage(s0, "sendMe", "serpent")).toBe(40); // 30 × 1.5 = 45 → 40
  });
});

describe("Esther", () => {
  const esther = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["esther", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Three Days of Fasting: 2 Faith for 10 of Esther's HP", () => {
    const s = castSkill(esther({ guard: 1 }), "fasting");
    expect(s.energy.faith).toBe(R.fastingFaith);
    expect(s.party.esther.hp).toBe(MAX_HP.esther - R.fastingCost);
  });

  it("Turned to the Contrary: the leader's blows fall back on it this turn, once per battle", () => {
    let s = castSkill(esther({ faith: 3 }), "contrary");
    s.intents[0] = { action: "swing", targets: [] };
    s = resolveGoliath(s, seeded());
    expect([s.party.esther.hp, s.party.david.hp]).toEqual([MAX_HP.esther, MAX_HP.david]);
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 2 * R.swing); // metal → metal, metal → light ×1
    s = startNextTurn(s, seeded());
    expect(s.contrary).toBe(false);
    expect(skillBlockReason(s, "contrary")).toBe("v2.reason.ariseUsed");
  });
});

describe("Daniel", () => {
  const daniel = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["daniel", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Stone Cut Without Hands deals 50", () => {
    expect(castSkill(daniel({ attack: 2 }), "stoneCut", "archer").enemies.archer.hp).toBe(0); // earth → fire ×1
  });

  it("Shut the Lions' Mouths: the leader's blows do no harm this turn, once per battle", () => {
    let s = castSkill(daniel({ faith: 2 }), "lionsDen");
    s.intents[0] = { action: "swing", targets: [] };
    s = resolveGoliath(s, seeded());
    expect([s.party.daniel.hp, s.party.david.hp]).toEqual([MAX_HP.daniel, MAX_HP.david]);
    s = startNextTurn(s, seeded());
    expect(s.lionsDen).toBe(false);
    expect(skillBlockReason(s, "lionsDen")).toBe("v2.reason.ariseUsed");
  });
});

describe("Nehemiah", () => {
  const nehemiah = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["nehemiah", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Rebuild the Wall shields everyone, higher with each course, up to 50", () => {
    let s = castSkill(nehemiah({ guard: 1 }), "buildWall");
    expect(s.party.david.shield).toBe(20);
    const shields: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = { ...s, energy: { ...s.energy, guard: 1 }, party: { ...s.party, nehemiah: { ...s.party.nehemiah, acted: false }, david: { ...s.party.david, shield: 0 } } };
      s = castSkill(s, "buildWall");
      shields.push(s.party.david.shield);
    }
    expect(shields).toEqual([30, 40, 50, 50]);
  });

  it("Sword and Trowel deals 20 and shields Nehemiah", () => {
    const s = castSkill(nehemiah({ attack: 1 }), "swordAndTrowel", "archer");
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 20);
    expect(s.party.nehemiah.shield).toBe(R.trowelShield);
  });
});

describe("Zechariah", () => {
  const zechariah = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["zechariah", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Incense gives 1 Faith and shields everyone 10", () => {
    const s = castSkill(zechariah({ guard: 1 }), "incense");
    expect(s.energy.faith).toBe(R.incenseFaith);
    expect(s.party.david.shield).toBe(R.incenseShield);
  });

  it("His Name Is John stays silent until turn 3, then heals all and gives Faith, once", () => {
    const early = zechariah({ guard: 2 });
    expect(skillBlockReason(early, "nameIsJohn")).toBe("v2.reason.silent");
    const s0 = { ...early, turn: R.johnTurn };
    s0.party.david.hp = 50;
    const s = castSkill(s0, "nameIsJohn");
    expect(s.party.david.hp).toBe(50 + R.johnHeal);
    expect(s.energy.faith).toBe(R.johnFaith);
    expect(s.johnUsed).toBe(true);
  });
});

describe("Mary", () => {
  const mary = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["mary", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("Be It unto Me gives 1 Faith and lifts Shaken", () => {
    const start = mary({ guard: 1 });
    start.party.david.shaken = true;
    const s = castSkill(start, "handmaid");
    expect(s.energy.faith).toBe(R.handmaidFaith);
    expect(s.party.david.shaken).toBe(false);
  });

  it("the Magnificat takes a quarter of the leader's HP and restores the lowest ally, once", () => {
    const start = mary({ faith: 3 });
    start.party.david.hp = 20;
    const s = castSkill(start, "magnificat");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 50); // 220 / 4 = 55 → 50
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(s.magnificatUsed).toBe(true);
  });
});

describe("Joseph of Nazareth", () => {
  const joseph = (energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), ["josephNaz", "mary", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    s.archerTarget = null;
    return s;
  };

  it("Carpenter's Hands shield and heal one ally, double for Mary", () => {
    const start = joseph({ guard: 1 });
    start.party.david.hp = 50;
    start.party.mary.hp = 50;
    const d = castSkill(start, "carpenter", "david");
    expect([d.party.david.hp, d.party.david.shield]).toEqual([50 + R.carpenterHeal, R.carpenterShield]);
    const m = castSkill(start, "carpenter", "mary");
    expect([m.party.mary.hp, m.party.mary.shield]).toEqual([50 + R.carpenterHeal * 2, R.carpenterShield * 2]);
  });

  it("Warned in a Dream makes the leader lose its next action, once per battle", () => {
    let s = castSkill(joseph({ faith: 2 }), "dreamWarning");
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(s.dreamUsed).toBe(true);
  });
});

describe("John the Baptist", () => {
  const john = (lineup: CharacterId[], energy: Partial<BattleState["energy"]> = {}) => {
    const s = createBattle(seeded(), lineup);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 0, ...energy };
    return s;
  };

  it("the Axe deals 40, double against the wood shield bearer", () => {
    const s = john(["johnBaptist", "david"], { attack: 2 });
    expect(skillDamage(s, "axe", "bearer")).toBe(80);
    expect(skillDamage(s, "axe", "goliath")).toBe(40); // water → metal ×1
  });

  it("Baptism heals everyone 30 and lifts Shaken; +1 Faith with Zechariah", () => {
    const start = john(["johnBaptist", "zechariah"], { guard: 2 });
    start.party.zechariah.hp = 50;
    start.party.zechariah.shaken = true;
    const s = castSkill(start, "baptism");
    expect(s.party.zechariah.hp).toBe(50 + R.baptismHeal);
    expect(s.party.zechariah.shaken).toBe(false);
    expect(s.energy.faith).toBe(1);
  });
});

describe("Jesus", () => {
  it("the special card never falls: never targeted, never hurt, and not counted for defeat", () => {
    let s = createBattle(seeded(), ["jesus", "david"]);
    s.archerTarget = null;
    s.intents[0] = { action: "swing", targets: [] };
    s = resolveGoliath(s, seeded());
    expect(s.party.jesus.hp).toBe(MAX_HP.jesus);
    expect(s.party.david.hp).toBe(MAX_HP.david - R.swing);
    for (let i = 0; i < 20; i++) expect(s.intents.flatMap((x) => x.targets)).not.toContain("jesus");
    s.party.david.hp = 0;
    s.intents[0] = { action: "swing", targets: [] };
    s = resolveGoliath(s, seeded());
    expect(s.result).toBe("defeat");
  });

  it("the risen Jesus gives peace to one ally, and is with them alway once per battle", () => {
    const s0 = createBattle(seeded(), ["jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.david.hp = 30;
    s0.party.david.shaken = true;
    const healed = castSkill(s0, "peaceBeUnto", "david");
    expect([healed.party.david.hp, healed.party.david.shaken]).toEqual([30 + R.risenPeaceHeal, false]);
    const s = castSkill(s0, "withYouAlway");
    expect(s.party.david.shield).toBe(R.alwayShield);
    expect(s.energy.faith).toBe(R.alwayFaith);
    expect(s.withYouUsed).toBe(true);
  });

  it("the UR card walks on water and feeds the five thousand", () => {
    const s0 = createBattle(seeded(), ["jesusUR", "david"]);
    s0.hand = [];
    s0.energy = { faith: 5, attack: 0, guard: 0 };
    s0.party.david.hp = 30;
    const fed = castSkill(s0, "loaves", undefined, seeded());
    expect(fed.party.david.hp).toBe(30 + R.loavesHeal);
    expect(fed.hand).toHaveLength(R.loavesDraw);
    let s = castSkill(s0, "walkOnWater");
    s.archerTarget = null;
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(30);
    expect(personOf("jesusUR")).toBe(personOf("jesus"));
  });
});

describe("Jesus (UR): risen on the third day", () => {
  it("falls, lies in the tomb for a turn, and rises with full HP on the third day, once", () => {
    let s = createBattle(seeded(), ["jesusUR", "david"]);
    s.archerTarget = null;
    s.party.jesusUR.hp = 10;
    s.intents[0] = { action: "spear", targets: ["jesusUR"] };
    s = endTurn(s, seeded()); // falls on turn 1
    expect(s.party.jesusUR.hp).toBe(0);
    s.intents[0] = { action: "defy", targets: [] };
    s = endTurn(s, seeded()); // turn 3: risen
    expect(s.turn).toBe(3);
    expect(s.party.jesusUR.hp).toBe(MAX_HP.jesusUR);
    expect(s.risenUsed).toBe(true);
  });

  it("the battle is not lost while Jesus lies in the tomb", () => {
    let s = createBattle(seeded(), ["jesusUR"]);
    s.archerTarget = null;
    s.party.jesusUR.hp = 10;
    s.intents[0] = { action: "spear", targets: ["jesusUR"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.jesusUR.hp).toBe(0);
    expect(s.result).toBe("ongoing");
  });
});

describe("Peter", () => {
  it("the Great Catch draws 2 and gives Attack; Drawing the Sword hits harder with Jesus", () => {
    const s0 = createBattle(seeded(), ["peter", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const s = castSkill(s0, "greatCatch", undefined, seeded());
    expect(s.hand).toHaveLength(R.catchDraw);
    expect(s.energy.attack).toBe(R.catchAttack);
    expect(skillDamage(s0, "drawSword", "archer")).toBe(50); // earth → fire ×1
    expect(skillDamage(createBattle(seeded(), ["peter", "jesus"]), "drawSword", "archer")).toBe(50 + R.peterWithJesus);
  });
});

describe("Andrew", () => {
  it("Come and See lets an ally act again once; A Lad Here draws 2 and gives Faith", () => {
    let s = createBattle(seeded(), ["andrew", "peter"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 2, guard: 3 };
    s = castSkill(s, "drawSword", "archer");
    expect(skillTargets(s, "comeAndSee")).toEqual(["peter"]);
    s = castSkill(s, "comeAndSee", "peter");
    expect(s.party.peter.acted).toBe(false);
    expect(s.comeAndSeeUsed).toBe(true);
    const lad = castSkill({ ...s, party: { ...s.party, andrew: { ...s.party.andrew, acted: false } } }, "aLadHere", undefined, seeded());
    expect(lad.hand).toHaveLength(R.ladDraw);
    expect(lad.energy.faith).toBe(R.ladFaith);
  });
});

describe("John the Apostle", () => {
  it("Love One Another heals and shields everyone, double with Jesus", () => {
    const mk = (lineup: CharacterId[]) => {
      const s = createBattle(seeded(), lineup);
      s.hand = [];
      s.energy = { faith: 0, attack: 1, guard: 2 };
      s.party.johnApostle.hp = 50;
      return s;
    };
    const plain = castSkill(mk(["johnApostle", "david"]), "loveOneAnother");
    expect([plain.party.johnApostle.hp, plain.party.david.shield]).toEqual([50 + R.loveHeal, R.loveShield]);
    const withJesus = castSkill(mk(["johnApostle", "jesus"]), "loveOneAnother");
    expect([withJesus.party.johnApostle.hp, withJesus.party.johnApostle.shield]).toEqual([50 + R.loveHeal * 2, R.loveShield * 2]);
    expect(skillDamage(mk(["johnApostle", "david"]), "thunder", "goliath")).toBe(40); // fire → metal ×1.5 = 45 → 40
  });
});

describe("Matthew", () => {
  it("Leaving the Tax Booth gives 2 Attack; the Feast heals everyone and draws a card", () => {
    const s0 = createBattle(seeded(), ["matthew", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    expect(castSkill(s0, "taxBooth").energy).toMatchObject({ attack: R.taxBoothAttack, guard: 1 });
    s0.party.david.hp = 50;
    const s = castSkill(s0, "feast", undefined, seeded());
    expect(s.party.david.hp).toBe(50 + R.feastHeal);
    expect(s.hand).toHaveLength(R.feastDraw);
  });
});

describe("James son of Zebedee", () => {
  it("Boanerges hits harder with John; when James falls, every attack +10", () => {
    const pair = createBattle(seeded(), ["jamesZeb", "johnApostle", "david"]);
    expect(skillDamage(pair, "boanerges", "archer")).toBe(30 + R.boanergesWithJohn); // fire → fire ×1
    let s = createBattle(seeded(), ["jamesZeb", "david"]);
    s.archerTarget = null;
    s.party.jamesZeb.hp = 10;
    s.intents[0] = { action: "spear", targets: ["jamesZeb"] };
    s = resolveGoliath(s, seeded());
    expect(s.cupDrunk).toBe(true);
    expect(skillDamage(s, "sling", "archer")).toBe(30 + R.cupBonus);
  });
});

describe("Thomas", () => {
  it("can't say My Lord and My God until he has reached out his finger and believed", () => {
    let s = createBattle(seeded(), ["thomas", "david"]);
    s.hand = [];
    s.energy = { faith: 2, attack: 0, guard: 1 };
    expect(skillBlockReason(s, "myLord")).toBe("v2.reason.unbelief");
    s = castSkill(s, "reachFinger");
    expect(s.thomasBelieves).toBe(true);
    s = { ...s, party: { ...s.party, thomas: { ...s.party.thomas, acted: false } } };
    s = castSkill(s, "myLord");
    expect(s.enemies.goliath.hp).toBe(ENEMY_HP.goliath - 30); // metal beats wood: 50 × 0.75 = 37 → 30
  });
});

describe("Mary Magdalene", () => {
  it("I Have Seen the Lord raises a fallen ally with 60, or Jesus in the tomb at once in full", () => {
    const s0 = createBattle(seeded(), ["maryMagdalene", "david", "jesusUR"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 0 };
    s0.party.david.hp = 0;
    expect(castSkill(s0, "seenTheLord", "david").party.david.hp).toBe(R.seenHp);
    s0.party.jesusUR.hp = 0;
    s0.tomb = s0.turn + R.riseAfter;
    s0.risenUsed = true;
    const s = castSkill(s0, "seenTheLord", "jesusUR");
    expect(s.party.jesusUR.hp).toBe(MAX_HP.jesusUR);
    expect(s.tomb).toBeNull();
    expect(s.seenUsed).toBe(true);
  });
});

describe("Martha", () => {
  it("Much Serving gives 2 Guard; Thy Brother Shall Rise Again brings the next fallen ally back once", () => {
    let s = createBattle(seeded(), ["martha", "david"]);
    s.hand = [];
    s.energy = { faith: 2, attack: 1, guard: 0 };
    expect(castSkill(s, "serving").energy.guard).toBe(R.servingGuard);
    s = castSkill(s, "riseAgain");
    s.archerTarget = null;
    s.party.david.hp = 10;
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = endTurn(s, seeded());
    expect(s.party.david.hp).toBe(R.riseAgainHp);
    expect(s.riseAgain).toBe("used");
  });
});

describe("Zacchaeus", () => {
  it("up the sycamore he is out of reach for a turn; Restore Fourfold gives 2 Attack and 2 Faith once", () => {
    let s = createBattle(seeded(), ["zacchaeus", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 2 };
    s = castSkill(s, "sycamore");
    s.archerTarget = null;
    s.intents[0] = { action: "swing", targets: [] };
    s = resolveGoliath(s, seeded());
    expect(s.party.zacchaeus.hp).toBe(MAX_HP.zacchaeus);
    expect(s.party.david.hp).toBe(MAX_HP.david - R.swing);
    s = startNextTurn(s, seeded());
    expect(s.inTree).toBe(false);
    s.energy = { faith: 0, attack: 0, guard: 1 };
    s = castSkill(s, "fourfold");
    expect(s.energy).toMatchObject({ attack: R.fourfoldAttack, faith: R.fourfoldFaith });
  });
});

describe("Mary of Bethany", () => {
  it("At His Feet gives 2 Faith (+1 Guard with Martha); Spikenard heals and shields everyone once", () => {
    const solo = createBattle(seeded(), ["maryBethany", "david"]);
    solo.hand = [];
    solo.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(solo, "atHisFeet").energy).toMatchObject({ faith: R.feetFaith, guard: 0 });
    const sisters = createBattle(seeded(), ["maryBethany", "martha"]);
    sisters.hand = [];
    sisters.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(sisters, "atHisFeet").energy).toMatchObject({ faith: R.feetFaith, guard: 1 });
    solo.energy = { faith: 2, attack: 0, guard: 0 };
    solo.party.david.hp = 50;
    const s = castSkill(solo, "spikenard");
    expect([s.party.david.hp, s.party.david.shield]).toEqual([50 + R.spikenardHeal, R.spikenardShield]);
  });
});

describe("Lazarus", () => {
  const fall = (lineup: CharacterId[]) => {
    const s = createBattle(seeded(), lineup);
    s.archerTarget = null;
    s.party.lazarus.hp = 10;
    s.intents[0] = { action: "spear", targets: ["lazarus"] };
    return endTurn(s, seeded());
  };

  it("comes forth with full HP the turn after he falls — only with Jesus in the line-up", () => {
    expect(fall(["lazarus", "jesus"]).party.lazarus.hp).toBe(MAX_HP.lazarus);
    expect(fall(["lazarus", "david"]).party.lazarus.hp).toBe(0);
  });
});

describe("Stephen", () => {
  it("Full of Grace and Power deals 30; the Heavens Opened heal and steady everyone once", () => {
    const s0 = createBattle(seeded(), ["stephen", "david"], "eden");
    s0.hand = [];
    s0.energy = { faith: 2, attack: 1, guard: 0 };
    expect(skillDamage(s0, "gracePower", "serpent")).toBe(40); // light → dark ×1.5 = 45 → 40
    s0.party.david.hp = 50;
    s0.party.david.shaken = true;
    const s = castSkill(s0, "heavensOpened");
    expect([s.party.david.hp, s.party.david.shaken]).toEqual([50 + R.heavensHeal, false]);
    expect(s.heavensUsed).toBe(true);
  });
});

describe("Philip", () => {
  it("Here Is Water heals and steadies one ally; Preaching in Samaria hits every enemy and gives Faith", () => {
    const s0 = createBattle(seeded(), ["philip", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    s0.party.david.hp = 50;
    s0.party.david.shaken = true;
    const h = castSkill(s0, "hereIsWater", "david");
    expect([h.party.david.hp, h.party.david.shaken]).toEqual([50 + R.waterHeal, false]);
    const s = castSkill(s0, "samaria");
    expect(s.enemies.bearer.hp).toBe(ENEMY_HP.bearer - 20);
    expect(s.enemies.archer.hp).toBe(ENEMY_HP.archer - 30); // water → fire ×1.5
    expect(s.energy.faith).toBe(R.samariaFaith);
  });
});

describe("Paul", () => {
  it("the Armour of God shields and steadies everyone; the Sword of the Spirit is stronger when he is weak", () => {
    const s0 = createBattle(seeded(), ["paul", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 2 };
    s0.party.david.shaken = true;
    const a = castSkill(s0, "armourOfGod");
    expect([a.party.david.shield, a.party.david.shaken]).toEqual([R.armourShield, false]);
    expect(skillDamage(s0, "swordOfSpirit", "archer")).toBe(30); // fire beats metal: 50 × 0.75 = 37 → 30
    s0.party.paul.hp = 60;
    expect(skillDamage(s0, "swordOfSpirit", "archer")).toBe(50); // (50 + 20) × 0.75 = 52 → 50
    expect(castSkill(s0, "swordOfSpirit", "archer").energy.faith).toBe(R.swordFaith);
  });
});

describe("Barnabas", () => {
  it("Encouragement steadies everyone, gives Attack and shields Paul; Sold His Field gives 3 Faith once", () => {
    const s0 = createBattle(seeded(), ["barnabas", "paul"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.paul.shaken = true;
    const e = castSkill(s0, "encourage");
    expect([e.party.paul.shaken, e.party.paul.shield, e.energy.attack]).toEqual([false, R.encouragePaulShield, R.encourageAttack]);
    const f = castSkill(s0, "soldField");
    expect(f.energy.faith).toBe(R.fieldFaith);
    expect(f.fieldSold).toBe(true);
  });
});

describe("Silas", () => {
  it("Hymns at Midnight steady everyone and give Faith (2 with Paul); the Prison Doors Opened shake every enemy once", () => {
    const solo = createBattle(seeded(), ["silas", "david"]);
    solo.hand = [];
    solo.energy = { faith: 0, attack: 0, guard: 1 };
    solo.party.david.shaken = true;
    const h = castSkill(solo, "midnightHymns");
    expect([h.party.david.shaken, h.energy.faith]).toEqual([false, R.hymnsFaith]);
    const pair = createBattle(seeded(), ["silas", "paul"]);
    pair.hand = [];
    pair.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(pair, "midnightHymns").energy.faith).toBe(R.hymnsPaulFaith);
    solo.energy = { faith: 2, attack: 0, guard: 0 };
    const p = castSkill(solo, "prisonOpened");
    expect(p.enemies.bearer.hp).toBe(ENEMY_HP.bearer - 40); // metal → wood ×1.5 = 45 → 40
    expect(p.prisonOpened).toBe(true);
  });
});

describe("Timothy", () => {
  it("Be an Example adds 10 to every attack this turn; Stir Up the Gift hits harder with Paul", () => {
    let s = createBattle(seeded(), ["timothy", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 1 };
    s = castSkill(s, "example");
    expect(skillDamage(s, "sling", "archer")).toBe(30 + R.exampleBonus);
    s = startNextTurn(resolveGoliath(s, seeded()), seeded());
    expect(skillDamage(s, "sling", "archer")).toBe(30);
    expect(skillDamage(createBattle(seeded(), ["timothy", "paul"]), "stirUpGift", "bearer")).toBe(50); // fire → wood ×1
  });
});

describe("Lydia", () => {
  it("Purple Cloth shields one ally and gives Faith; Abide in My House heals everyone, +1 Faith with Paul", () => {
    const s0 = createBattle(seeded(), ["lydia", "paul"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    const p = castSkill(s0, "purpleCloth", "paul");
    expect([p.party.paul.shield, p.energy.faith]).toEqual([R.purpleShield, R.purpleFaith]);
    s0.party.paul.hp = 50;
    const a = castSkill(s0, "abideHouse");
    expect([a.party.paul.hp, a.energy.faith]).toEqual([50 + R.abideHeal, 1]);
  });
});

describe("Priscilla", () => {
  it("Tentmaking shields everyone; Expounding the Way makes one ally hit harder this turn", () => {
    const s0 = createBattle(seeded(), ["priscilla", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 1, guard: 2 };
    expect(castSkill(s0, "tentmaking").party.david.shield).toBe(R.tentShield);
    expect(skillTargets(s0, "expound")).toEqual(["david"]);
    let s = castSkill(s0, "expound", "david");
    expect(skillDamage(s, "sling", "archer")).toBe(30 + R.expoundBonus);
    s = startNextTurn(resolveGoliath(s, seeded()), seeded());
    expect(s.taught).toBeNull();
  });
});

describe("Eli", () => {
  it("Go in Peace heals and gives Faith (double for Hannah); Speak, Lord lets an ally act again once", () => {
    const s0 = createBattle(seeded(), ["eli", "hannah", "samuel"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 1, guard: 3 };
    s0.party.hannah.hp = 50;
    const p = castSkill(s0, "goInPeace", "hannah");
    expect([p.party.hannah.hp, p.energy.faith]).toEqual([50 + R.peaceHeal * 2, R.peaceFaith * 2]);
    let s = castSkill(s0, "rebuke", "archer");
    s = castSkill(s, "speakLord", "samuel");
    expect(s.party.samuel.acted).toBe(false);
    expect(s.energy.faith).toBe(1);
    expect(s.speakUsed).toBe(true);
  });
});

describe("Aquila", () => {
  it("takes the blow meant for an ally this turn, with a Shield when Priscilla is there", () => {
    let s = createBattle(seeded(), ["aquila", "priscilla", "david"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 1 };
    s.archerTarget = null;
    s = castSkill(s, "layDownNeck", "david");
    expect(s.party.aquila.shield).toBe(R.aquilaShield);
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(s.party.aquila.hp).toBe(MAX_HP.aquila - (R.spear - R.aquilaShield)); // metal → earth ×1
    s = startNextTurn(s, seeded());
    expect(s.aquilaCovers).toBeNull();
  });
});

describe("Dorcas", () => {
  it("rises with full HP the turn after she falls — only with Peter in the line-up", () => {
    const fall = (lineup: CharacterId[]) => {
      const s = createBattle(seeded(), lineup);
      s.archerTarget = null;
      s.party.dorcas.hp = 10;
      s.intents[0] = { action: "spear", targets: ["dorcas"] };
      return endTurn(s, seeded());
    };
    expect(fall(["dorcas", "peter"]).party.dorcas.hp).toBe(MAX_HP.dorcas);
    expect(fall(["dorcas", "david"]).party.dorcas.hp).toBe(0);
  });

  it("Garments heal and shield everyone a little", () => {
    const s0 = createBattle(seeded(), ["dorcas", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.david.hp = 50;
    const s = castSkill(s0, "garments");
    expect([s.party.david.hp, s.party.david.shield]).toEqual([50 + R.garmentHeal, R.garmentShield]);
  });
});

describe("Cornelius", () => {
  it("Centurion's Command deals 40; Prayers and Alms give Faith, and Attack with Peter", () => {
    const s0 = createBattle(seeded(), ["cornelius", "peter"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(skillDamage(s0, "centurionCommand", "bearer")).toBe(60); // metal → wood ×1.5
    expect(castSkill(s0, "prayersAlms").energy).toMatchObject({ faith: R.memorialFaith, attack: 1 });
  });
});

describe("Apollos", () => {
  it("Mighty in the Scriptures hits harder with Priscilla or Aquila; Watered heals everyone", () => {
    expect(skillDamage(createBattle(seeded(), ["apollos", "david"]), "mightyScriptures", "bearer")).toBe(30); // water → wood ×1
    expect(skillDamage(createBattle(seeded(), ["apollos", "aquila"]), "mightyScriptures", "bearer")).toBe(30 + R.scripturesWithTeachers);
    const s0 = createBattle(seeded(), ["apollos", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.david.hp = 50;
    expect(castSkill(s0, "watered").party.david.hp).toBe(50 + R.wateredHeal);
  });
});

describe("Phoebe", () => {
  it("Succourer heals and gives Guard; Bearer of the Letter gives Faith and draws, double with Paul", () => {
    const s0 = createBattle(seeded(), ["phoebe", "paul"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.paul.hp = 50;
    const h = castSkill(s0, "succourer", "paul");
    expect([h.party.paul.hp, h.energy.guard]).toEqual([50 + R.succourHeal, 1]);
    const l = castSkill(s0, "bearLetter", undefined, seeded());
    expect([l.energy.faith, l.hand.length]).toEqual([R.letterFaith * 2, R.letterDraw * 2]);
  });
});

describe("Luke", () => {
  it("heals double for Paul, draws 2, and is shielded each turn beside Paul", () => {
    let s = createBattle(seeded(), ["luke", "paul"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 2 };
    s.party.paul.hp = 30;
    expect(castSkill(s, "physician", "paul").party.paul.hp).toBe(30 + R.physicianHeal * 2);
    expect(castSkill(s, "inOrder", undefined, seeded()).hand).toHaveLength(R.orderDraw);
    s.archerTarget = null;
    s.intents[0] = { action: "defy", targets: [] };
    s = endTurn(s, seeded());
    expect(s.party.luke.shield).toBe(R.lukeShield);
  });
});

describe("John Mark", () => {
  it("Departing gives 2 Faith but he is Shaken next turn; Profitable hits harder with Barnabas", () => {
    let s = createBattle(seeded(), ["johnMark", "barnabas"]);
    s.hand = [];
    s.energy = { faith: 0, attack: 0, guard: 1 };
    expect(skillDamage(s, "profitable", "archer")).toBe(20 + R.profitableWith); // wood → fire ×1
    s = castSkill(s, "departed");
    expect(s.energy.faith).toBe(R.departFaith);
    s = endTurn(s, seeded());
    expect(s.party.johnMark.shaken).toBe(true);
  });
});

describe("Titus", () => {
  it("Set in Order turns 1 Faith into a Guard and an Attack; Earnest Care shields everyone, 30 with Paul", () => {
    const s0 = createBattle(seeded(), ["titus", "paul"]);
    s0.hand = [];
    s0.energy = { faith: 1, attack: 0, guard: 2 };
    expect(castSkill(s0, "setInOrder").energy).toEqual({ faith: 0, attack: 1, guard: 3 });
    expect(castSkill(s0, "earnestCare").party.paul.shield).toBe(R.earnestPaulShield);
  });
});

describe("Philemon", () => {
  it("Refreshed heals and steadies everyone; Receive Him raises a fallen ally, 80 with Paul", () => {
    const s0 = createBattle(seeded(), ["philemon", "paul", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.paul.hp = 50;
    s0.party.paul.shaken = true;
    const r = castSkill(s0, "refreshed");
    expect([r.party.paul.hp, r.party.paul.shaken]).toEqual([50 + R.refreshHeal, false]);
    s0.party.david.hp = 0;
    const s = castSkill(s0, "receiveHim", "david");
    expect(s.party.david.hp).toBe(R.receivePaulHp);
    expect(s.receiveUsed).toBe(true);
  });
});

describe("Onesimus", () => {
  it("Now Profitable deals double with Philemon; A Brother Beloved gives Faith and steadies him", () => {
    expect(skillDamage(createBattle(seeded(), ["onesimus", "david"]), "nowProfitable", "archer")).toBe(20);
    expect(skillDamage(createBattle(seeded(), ["onesimus", "philemon"]), "nowProfitable", "archer")).toBe(40);
    const s0 = createBattle(seeded(), ["onesimus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const s = castSkill(s0, "belovedBrother");
    expect(s.energy.faith).toBe(R.brotherFaith);
  });
});

describe("Nicodemus", () => {
  it("By Night draws 2 with Jesus; Born Again restores one ally to full, once", () => {
    const s0 = createBattle(seeded(), ["nicodemus", "jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect(castSkill(s0, "byNight", undefined, seeded()).hand).toHaveLength(R.nightDraw * 2);
    s0.party.david.hp = 10;
    s0.party.david.shaken = true;
    const s = castSkill(s0, "bornAgain", "david");
    expect([s.party.david.hp, s.party.david.shaken, s.bornAgainUsed]).toEqual([MAX_HP.david, false, true]);
  });
});

describe("Samaritan woman", () => {
  it("Living Water heals everyone, double with Jesus; Come, See gives Faith and Attack", () => {
    const s0 = createBattle(seeded(), ["samaritan", "jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.david.hp = 50;
    expect(castSkill(s0, "livingWater").party.david.hp).toBe(50 + R.livingHeal * 2);
    expect(castSkill(s0, "comeSee").energy).toMatchObject({ faith: 1, attack: 1 });
  });
});

describe("Simeon", () => {
  it("Waiting gives Faith now and every other turn; Depart in Peace heals everyone, then Simeon departs", () => {
    let s = createBattle(seeded(), ["simeon", "david"]);
    s.hand = [];
    s.archerTarget = null;
    s.energy = { faith: 0, attack: 0, guard: 1 };
    s = castSkill(s, "waiting");
    expect(s.energy.faith).toBe(1);
    s.intents[0] = { action: "defy", targets: [] };
    s = endTurn(s, seeded()); // turn 2
    expect(s.energy.faith).toBe(2);
    s.party.david.hp = 50;
    s = castSkill(s, "nuncDimittis");
    expect([s.party.david.hp, s.party.david.shield, s.party.simeon.hp]).toEqual([50 + R.nuncHeal, R.nuncShield, 0]);
    expect(s.result).toBe("ongoing");
  });
});

describe("Anna", () => {
  it("Night and Day shields everyone and gives Faith; She Gave Thanks gives 2 Faith with Simeon", () => {
    const s0 = createBattle(seeded(), ["anna", "simeon"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    const n = castSkill(s0, "nightAndDay");
    expect([n.party.simeon.shield, n.energy.faith]).toEqual([R.annaShield, 1]);
    s0.party.simeon.shaken = true;
    const t = castSkill(s0, "gaveThanks");
    expect([t.energy.faith, t.party.simeon.shaken]).toEqual([2, false]);
  });
});

describe("The boy with the loaves", () => {
  it("Offering the Basket gives 3 Faith once, and heals everyone with Jesus", () => {
    const s0 = createBattle(seeded(), ["loavesBoy", "jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.david.hp = 50;
    const s = castSkill(s0, "giveBasket");
    expect([s.energy.faith, s.party.david.hp, s.basketGiven]).toEqual([R.basketFaith, 50 + R.basketHeal, true]);
  });
});

describe("Judas Iscariot", () => {
  it("Thirty Pieces of Silver give 3 Faith but cost the most wounded ally 20 HP", () => {
    const s0 = createBattle(seeded(), ["judas", "david", "samuel"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.samuel.hp = 50;
    const s = castSkill(s0, "thirtySilver");
    expect(s.energy.faith).toBe(R.silverFaith);
    expect([s.party.samuel.hp, s.party.david.hp]).toEqual([50 - R.silverCost, MAX_HP.david]);
  });
});

describe("Philip the Apostle", () => {
  it("Come and See gives Faith; Two Hundred Pennyworth deals 30", () => {
    const s0 = createBattle(seeded(), ["philipApostle", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "philipComeSee").energy.faith).toBe(1);
    expect(skillDamage(s0, "twoHundredPence", "archer")).toBe(30);
  });
});

describe("Nathanael", () => {
  it("hits harder with Philip; Philip's Come and See readies him with an Attack", () => {
    const s0 = createBattle(seeded(), ["nathanael", "philipApostle"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    expect(skillDamage(s0, "noGuile", "archer")).toBe(50); // wood → fire ×1
    expect(castSkill(s0, "philipComeSee").energy).toMatchObject({ faith: 1, attack: 1 });
    expect(castSkill(s0, "figTree", undefined, seeded()).hand).toHaveLength(1);
  });
});

describe("James son of Alphaeus", () => {
  it("One of the Twelve grows with each other apostle; Quiet Faithfulness shields him and gives Faith", () => {
    expect(skillDamage(createBattle(seeded(), ["jamesAlph", "david"]), "oneOfTwelve", "archer")).toBe(20);
    expect(skillDamage(createBattle(seeded(), ["jamesAlph", "peter", "andrew"]), "oneOfTwelve", "archer")).toBe(40);
    const s0 = createBattle(seeded(), ["jamesAlph", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const s = castSkill(s0, "quietFaith");
    expect([s.party.jamesAlph.shield, s.energy.faith]).toEqual([30, 1]);
  });
});

describe("Thaddaeus", () => {
  it("A Disciple's Question draws 2 with Jesus, and he counts among the Twelve", () => {
    const s0 = createBattle(seeded(), ["thaddaeus", "jesus", "jamesAlph"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const s = castSkill(s0, "aQuestion", undefined, seeded());
    expect([s.hand.length, s.energy.faith]).toEqual([2, 1]);
    expect(skillDamage(s0, "oneOfTwelve", "archer")).toBe(30);
  });
});

describe("Simon the Zealot", () => {
  it("Zeal burns hotter once the leader is at half HP; Laying Down the Sword steadies everyone", () => {
    const s0 = createBattle(seeded(), ["simonZealot", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(skillDamage(s0, "zeal", "archer")).toBe(30); // fire → fire ×1
    s0.enemies.goliath.hp = 100;
    expect(skillDamage(s0, "zeal", "archer")).toBe(50);
    s0.party.david.shaken = true;
    const s = castSkill(s0, "swordDown");
    expect([s.party.david.shaken, s.party.simonZealot.shield]).toEqual([false, 20]);
  });
});

describe("Matthias", () => {
  it("The Lot Fell raises a fallen ally once; Numbered with the Eleven grows with each apostle", () => {
    const s0 = createBattle(seeded(), ["matthias", "peter", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(skillDamage(s0, "withEleven", "archer")).toBe(30);
    s0.party.david.hp = 0;
    const s = castSkill(s0, "lotFell", "david");
    expect([s.party.david.hp, s.lotUsed]).toEqual([50, true]);
  });
});

describe("Elisabeth", () => {
  it("The Babe Leaped heals everyone (+1 Faith with Mary); Blessed Among Women heals and shields, double for Mary", () => {
    const s0 = createBattle(seeded(), ["elizabeth", "mary", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    s0.party.david.hp = 50;
    s0.party.mary.hp = 20;
    const l = castSkill(s0, "leaped");
    expect([l.party.david.hp, l.party.mary.hp, l.energy.faith]).toEqual([50 + R.leapHeal, 20 + R.leapHeal, 3]);
    const m = castSkill(s0, "blessedAmong", "mary");
    expect([m.party.mary.hp, m.party.mary.shield]).toEqual([20 + R.blessedHeal * 2, R.blessedShield * 2]);
    const d = castSkill(s0, "blessedAmong", "david");
    expect([d.party.david.hp, d.party.david.shield]).toEqual([50 + R.blessedHeal, R.blessedShield]);
    const alone = createBattle(seeded(), ["elizabeth", "david"]);
    alone.hand = [];
    alone.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(alone, "leaped").energy.faith).toBe(0);
  });
});

describe("Mordecai", () => {
  it("Bowed Not shields him and steadies everyone; For Such a Time gives 2 Faith with Esther", () => {
    const s0 = createBattle(seeded(), ["mordecai", "esther"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.esther.shaken = true;
    const b = castSkill(s0, "wouldNotBow");
    expect([b.party.mordecai.shield, b.party.esther.shaken]).toEqual([R.bowShield, false]);
    expect(castSkill(s0, "suchATime").energy.faith).toBe(2);
    const alone = createBattle(seeded(), ["mordecai", "david"]);
    alone.hand = [];
    alone.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(alone, "suchATime").energy.faith).toBe(1);
  });
});

describe("Sarah", () => {
  it("Laughter heals everyone and gives 2 Faith with Abraham; Too Hard restores an ally to full once", () => {
    const s0 = createBattle(seeded(), ["sarah", "abraham"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    s0.party.abraham.hp = 30;
    const l = castSkill(s0, "laughter");
    expect([l.party.abraham.hp, l.energy.faith]).toEqual([30 + R.laughHeal, 4]);
    const t = castSkill(s0, "tooHard", "abraham");
    expect([t.party.abraham.hp, t.tooHardUsed]).toEqual([MAX_HP.abraham, true]);
    t.energy.faith = 2;
    t.party.sarah.acted = false;
    expect(skillBlockReason(t, "tooHard", "abraham")).toBe("v2.reason.ariseUsed");
  });
});

describe("Rebekah", () => {
  it("Drink, My Lord heals an ally; Water for the Camels heals and shields everyone, +1 Faith with Isaac", () => {
    const s0 = createBattle(seeded(), ["rebekah", "isaac"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.isaac.hp = 40;
    expect(castSkill(s0, "drinkMyLord", "isaac").party.isaac.hp).toBe(40 + R.drinkHeal);
    const w = castSkill(s0, "waterCamels");
    expect([w.party.isaac.hp, w.party.isaac.shield, w.energy.faith]).toEqual([40 + R.camelsHeal, R.camelsShield, 1]);
  });
});

describe("Rachel", () => {
  it("She Kept Them shields everyone (double with Jacob); But a Few Days gives 2 Faith with Jacob", () => {
    const s0 = createBattle(seeded(), ["rachel", "jacob"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "keepSheep").party.jacob.shield).toBe(R.sheepShield * 2);
    expect(castSkill(s0, "fewDays").energy.faith).toBe(2);
    const alone = createBattle(seeded(), ["rachel", "david"]);
    alone.hand = [];
    alone.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(alone, "keepSheep").party.david.shield).toBe(R.sheepShield);
    expect(castSkill(alone, "fewDays").energy.faith).toBe(1);
  });
});

describe("Barak", () => {
  it("If Thou Wilt Go gives 2 Attack with Deborah; Down from Tabor strikes harder with her", () => {
    const s0 = createBattle(seeded(), ["barak", "deborah"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "ifThouGo").energy.attack).toBe(R.thouGoAttack * 2);
    const alone = createBattle(seeded(), ["barak", "david"]);
    alone.hand = [];
    alone.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(alone, "ifThouGo").energy.attack).toBe(R.thouGoAttack);
    expect(skillDamage(s0, "downTabor", "archer") - skillDamage(alone, "downTabor", "archer")).toBe(20);
  });
});

describe("Jael", () => {
  it("Blessed Above Women gives 2 Faith with Deborah; the Tent Peg strikes harder at a weakened foe", () => {
    const s0 = createBattle(seeded(), ["jael", "deborah"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "blessedAbove").energy.faith).toBe(2);
    const full = skillDamage(s0, "tentPeg", "bearer");
    s0.enemies.bearer.hp = 30;
    expect([full, skillDamage(s0, "tentPeg", "bearer")]).toEqual([60, 100]); // metal → wood ×1.5
  });
});

describe("Joseph of Arimathaea", () => {
  it("Went In Boldly steadies everyone; Fine Linen heals and shields; his new tomb lets Jesus rise a turn sooner", () => {
    const s0 = createBattle(seeded(), ["josephArimathea", "jesusUR"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.jesusUR.shaken = true;
    s0.party.jesusUR.hp = 60;
    const b = castSkill(s0, "wentInBoldly");
    expect([b.energy.faith, b.party.jesusUR.shaken]).toEqual([1, false]);
    const l = castSkill(s0, "fineLinen", "jesusUR");
    expect([l.party.jesusUR.hp, l.party.jesusUR.shield]).toEqual([60 + R.linenHeal, R.linenShield]);
  });

  it("with Joseph beside him, Jesus (UR) rises on the very next turn", () => {
    let s = createBattle(seeded(), ["jesusUR", "josephArimathea"]);
    s.archerTarget = null;
    s.party.jesusUR.hp = 10;
    s.intents[0] = { action: "spear", targets: ["jesusUR"] };
    s = endTurn(s, seeded()); // falls on turn 1, rises on turn 2
    expect(s.turn).toBe(2);
    expect(s.party.jesusUR.hp).toBe(MAX_HP.jesusUR);
  });
});

describe("Ananias", () => {
  it("Brother Saul heals double for Paul; the Scales Fell shields everyone and gives Faith with Paul", () => {
    const s0 = createBattle(seeded(), ["ananias", "paul"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.paul.hp = 40;
    s0.party.paul.shaken = true;
    const b = castSkill(s0, "brotherSaul", "paul");
    expect([b.party.paul.hp, b.party.paul.shaken]).toEqual([40 + R.brotherHeal * 2, false]);
    const sc = castSkill(s0, "scalesFell");
    expect([sc.party.paul.shield, sc.party.paul.shaken, sc.energy.faith]).toEqual([R.scalesShield, false, 1]);
  });
});

describe("Shadrach, Meshach and Abednego", () => {
  it("But If Not gives 2 Faith with Daniel; the Fourth in the Fire keeps everyone unhurt for a turn, once", () => {
    const s0 = createBattle(seeded(), ["threeFriends", "daniel"]);
    s0.hand = [];
    s0.archerTarget = null;
    s0.energy = { faith: 3, attack: 0, guard: 1 };
    s0.party.daniel.shaken = true;
    const b = castSkill(s0, "butIfNot");
    expect([b.energy.faith, b.party.daniel.shaken]).toEqual([5, false]);
    let f = castSkill(s0, "fourthMan");
    expect(f.fiery).toBe(true);
    f.intents[0] = { action: "spear", targets: ["daniel"] };
    f = resolveGoliath(f, seeded());
    expect(f.party.daniel.hp).toBe(MAX_HP.daniel);
    expect(f.fourthManUsed).toBe(true);
  });
});

describe("Job", () => {
  it("The LORD Gave shields him (+1 Faith when low); Turned His Captivity restores him twice over, once", () => {
    const s0 = createBattle(seeded(), ["job", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect([castSkill(s0, "lordGave").party.job.shield, castSkill(s0, "lordGave").energy.faith]).toEqual([R.jobShield, 2]);
    s0.party.job.hp = 50;
    expect(castSkill(s0, "lordGave").energy.faith).toBe(3);
    const t = castSkill(s0, "turnedCaptivity");
    expect([t.party.job.hp, t.party.job.shield, t.captivityUsed]).toEqual([MAX_HP.job, R.captivityShieldMax, true]);
  });
});

describe("Enoch", () => {
  it("Walked with God shields him and gives Faith; when God takes him, everyone heals and gains Faith, once", () => {
    let s = createBattle(seeded(), ["enoch", "david"]);
    s.hand = [];
    s.archerTarget = null;
    s.energy = { faith: 0, attack: 0, guard: 1 };
    const w = castSkill(s, "walkedWithGod");
    expect([w.party.enoch.shield, w.energy.faith]).toEqual([R.walkShield, 1]);
    s.party.enoch.hp = 10;
    s.party.david.hp = 50;
    s.intents[0] = { action: "spear", targets: ["enoch"] };
    s = resolveGoliath(s, seeded());
    expect([s.party.enoch.hp, s.party.david.hp, s.energy.faith, s.enochTaken]).toEqual([0, 50 + R.takenHeal, R.takenFaith, true]);
  });
});

describe("Melchizedek", () => {
  it("Bread and Wine heals everyone (+1 Faith with Abraham); Tithes of All gives 3 Faith with Abraham", () => {
    const s0 = createBattle(seeded(), ["melchizedek", "abraham"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.abraham.hp = 50;
    const b = castSkill(s0, "breadAndWine");
    expect([b.party.abraham.hp, b.energy.faith]).toEqual([50 + R.breadHeal, 1]);
    expect(castSkill(s0, "tenthOfAll").energy.faith).toBe(R.titheFaith + 1);
  });
});

describe("Caleb", () => {
  it("Go Up at Once gives 2 Attack with Joshua and steadies everyone; Give Me This Mountain is stronger at full HP", () => {
    const s0 = createBattle(seeded(), ["caleb", "joshua"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.joshua.shaken = true;
    const g = castSkill(s0, "goUpAtOnce");
    expect([g.energy.attack, g.party.joshua.shaken]).toEqual([R.goUpAttack * 2, false]);
    const full = skillDamage(s0, "thisMountain", "archer");
    s0.party.caleb.hp -= 10;
    expect(full).toBeGreaterThan(skillDamage(s0, "thisMountain", "archer"));
  });
});

describe("Jeremiah", () => {
  it("The Almond Rod gives Faith and draws; Fire in My Bones burns hotter at half HP", () => {
    const s0 = createBattle(seeded(), ["jeremiah", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const a = castSkill(s0, "almondRod");
    expect([a.energy.faith, a.hand.length]).toEqual([1, 1]);
    const full = skillDamage(s0, "fireInBones", "bearer");
    s0.party.jeremiah.hp = 50;
    expect(skillDamage(s0, "fireInBones", "bearer")).toBeGreaterThan(full);
  });
});

describe("Ezekiel", () => {
  it("the Watchman shields everyone; Ye Shall Live raises every fallen ally once", () => {
    const s0 = createBattle(seeded(), ["ezekiel", "david", "samuel"]);
    s0.hand = [];
    s0.energy = { faith: 3, attack: 0, guard: 1 };
    const w = castSkill(s0, "watchman");
    expect([w.party.david.shield, w.energy.faith]).toEqual([R.watchmanShield, 4]);
    expect(skillBlockReason(s0, "dryBones")).toBe("v2.reason.noTarget");
    s0.party.david.hp = 0;
    s0.party.samuel.hp = 0;
    const d = castSkill(s0, "dryBones");
    expect([d.party.david.hp, d.party.samuel.hp, d.dryBonesUsed]).toEqual([R.dryBonesHp, R.dryBonesHp, true]);
  });
});

describe("Ezra", () => {
  it("Prepared His Heart draws 2; Read in the Book gives 3 Faith with Nehemiah and steadies everyone", () => {
    const s0 = createBattle(seeded(), ["ezra", "nehemiah"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    expect(castSkill(s0, "preparedHeart").hand.length).toBe(R.ezraDraw);
    s0.party.nehemiah.shaken = true;
    const r = castSkill(s0, "readTheLaw");
    expect([r.energy.faith, r.party.nehemiah.shaken]).toEqual([R.lawFaith + 1, false]);
  });
});

describe("Nathan", () => {
  it("Thou Art the Man strikes the leader harder; Thy House Established shields David most", () => {
    const s0 = createBattle(seeded(), ["nathan", "david", "samuel"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const h = castSkill(s0, "houseForever");
    expect([h.party.david.shield, h.party.samuel.shield, h.energy.faith]).toEqual([R.houseKingShield, R.houseShield, 1]);
    expect(skillDamage(s0, "thouArtTheMan", "goliath")).toBe(30 + R.manBonus); // metal → metal ×1
  });
});

describe("Hezekiah", () => {
  it("Spread the Letter strikes every enemy once; Fifteen Years heals him, double with Isaiah", () => {
    const s0 = createBattle(seeded(), ["hezekiah", "isaiah"]);
    s0.hand = [];
    s0.energy = { faith: 3, attack: 0, guard: 1 };
    const l = castSkill(s0, "spreadLetter");
    expect(ENEMY_HP.goliath - l.enemies.goliath.hp).toBeGreaterThan(0);
    expect(ENEMY_HP.bearer - l.enemies.bearer.hp).toBeGreaterThan(0);
    expect(l.letterUsed).toBe(true);
    s0.party.hezekiah.hp = 10;
    expect(castSkill(s0, "fifteenYears").party.hezekiah.hp).toBe(10 + R.fifteenHeal * 2);
  });
});

describe("Josiah", () => {
  it("He Heard the Book steadies everyone; Put Down the Idols breaks the leader's gathered blow", () => {
    const s0 = createBattle(seeded(), ["josiah", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    s0.party.david.shaken = true;
    const h = castSkill(s0, "heardTheBook");
    expect([h.energy.faith, h.party.david.shaken]).toEqual([1, false]);
    s0.enemies.bearer.hp = 0;
    s0.goliath.charging = true;
    const p = castSkill(s0, "purgeIdols", "goliath");
    expect([p.goliath.charging, p.enemies.goliath.hp < ENEMY_HP.goliath]).toEqual([false, true]);
  });
});

describe("The Magi", () => {
  it("His Star gives 2 Faith with Mary; the Three Gifts give Attack, heal and shield everyone once", () => {
    const s0 = createBattle(seeded(), ["magi", "mary"]);
    s0.hand = [];
    s0.energy = { faith: 3, attack: 0, guard: 1 };
    expect(castSkill(s0, "hisStar").energy.faith).toBe(5);
    s0.party.mary.hp = 50;
    const g = castSkill(s0, "threeGifts");
    expect([g.energy.attack, g.party.mary.hp, g.party.mary.shield, g.giftsGiven]).toEqual([R.giftAttack, 50 + R.giftHeal, R.giftShield, true]);
  });
});

describe("The shepherds", () => {
  it("Good Tidings steadies everyone; Glory to God heals and shields everyone", () => {
    const s0 = createBattle(seeded(), ["shepherds", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    s0.party.david.shaken = true;
    s0.party.david.hp = 50;
    const t = castSkill(s0, "goodTidings");
    expect([t.energy.faith, t.party.david.shaken]).toEqual([3, false]);
    const g = castSkill(s0, "gloryHighest");
    expect([g.party.david.hp, g.party.david.shield]).toEqual([50 + R.gloryHeal, R.gloryShield]);
  });
});

describe("Bartimaeus", () => {
  it("Son of David gives 2 Faith with Jesus; Casting Away His Garment strikes harder with him", () => {
    const s0 = createBattle(seeded(), ["bartimaeus", "jesus"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "sonOfDavid").energy.faith).toBe(2);
    const alone = createBattle(seeded(), ["bartimaeus", "david"]);
    expect(skillDamage(s0, "castGarment", "archer") - skillDamage(alone, "castGarment", "archer")).toBeGreaterThan(0);
  });
});

describe("The centurion", () => {
  it("Speak the Word heals another ally (more with Jesus); Under Authority lets an ally act again", () => {
    const s0 = createBattle(seeded(), ["centurion", "jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 2 };
    s0.party.david.hp = 30;
    s0.party.david.shaken = true;
    const w = castSkill(s0, "speakTheWord", "david");
    expect([w.party.david.hp, w.party.david.shaken]).toEqual([30 + R.wordHealJesus, false]);
    expect(skillTargets(s0, "speakTheWord")).not.toContain("centurion");
    s0.party.david.shaken = false;
    s0.party.david.acted = true;
    expect(castSkill(s0, "underAuthority", "david").party.david.acted).toBe(false);
  });
});

describe("Jairus", () => {
  it("Only Believe gives 2 Faith with Jesus; Talitha Cumi raises a fallen ally once, at full HP with Jesus", () => {
    const s0 = createBattle(seeded(), ["jairus", "jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect(castSkill(s0, "onlyBelieve").energy.faith).toBe(4);
    s0.party.david.hp = 0;
    const t = castSkill(s0, "talithaCumi", "david");
    expect([t.party.david.hp, t.talithaUsed]).toEqual([MAX_HP.david, true]);
    const alone = createBattle(seeded(), ["jairus", "david"]);
    alone.hand = [];
    alone.energy = { faith: 2, attack: 0, guard: 0 };
    alone.party.david.hp = 0;
    expect(castSkill(alone, "talithaCumi", "david").party.david.hp).toBe(R.talithaHp);
  });
});

describe("Simon of Cyrene", () => {
  it("Bear His Cross takes the blow meant for an ally; Coming Out of the Country heals him", () => {
    let s = createBattle(seeded(), ["simonCyrene", "david"]);
    s.hand = [];
    s.archerTarget = null;
    s.energy = { faith: 0, attack: 0, guard: 1 };
    s = castSkill(s, "bearHisCross", "david");
    expect([s.simonCovers, s.party.simonCyrene.shield]).toEqual(["david", R.crossShield]);
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david);
    expect(s.party.simonCyrene.hp + s.party.simonCyrene.shield).toBeLessThan(MAX_HP.simonCyrene + R.crossShield);
    const h = createBattle(seeded(), ["simonCyrene", "david"]);
    h.hand = [];
    h.energy = { faith: 0, attack: 0, guard: 1 };
    h.party.simonCyrene.hp = 50;
    expect(castSkill(h, "comingFromCountry").party.simonCyrene.hp).toBe(50 + R.countryHeal);
  });
});

describe("The repentant thief", () => {
  it("Remember Me gives 2 Faith with Jesus; To Day in Paradise needs Jesus, heals everyone, then he departs", () => {
    const alone = createBattle(seeded(), ["thief", "david"]);
    alone.hand = [];
    alone.energy = { faith: 1, attack: 0, guard: 1 };
    expect(skillBlockReason(alone, "paradise")).toBe("v2.reason.needJesus");
    const s0 = createBattle(seeded(), ["thief", "jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 1, attack: 0, guard: 1 };
    expect(castSkill(s0, "rememberMe").energy.faith).toBe(3);
    s0.party.david.hp = 50;
    const p = castSkill(s0, "paradise");
    expect([p.party.thief.hp, p.party.david.hp, p.energy.faith, p.result]).toEqual([0, 50 + R.paradiseHeal, R.paradiseFaith, "ongoing"]);
  });
});

describe("James the Lord's brother", () => {
  it("Swift to Hear shields everyone (+1 Faith with Peter); Faith by My Works grows with Faith held", () => {
    const s0 = createBattle(seeded(), ["jamesJust", "peter"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const h = castSkill(s0, "swiftToHear");
    expect([h.party.peter.shield, h.energy.faith]).toEqual([R.hearShield, 1]);
    const none = skillDamage(s0, "faithWorks", "goliath");
    s0.energy.faith = 5;
    expect(skillDamage(s0, "faithWorks", "goliath")).toBeGreaterThan(none);
  });
});

describe("The mocking criminal", () => {
  it("Railing hits hard but costs him 20 HP, never below 10", () => {
    const s0 = createBattle(seeded(), ["mockingThief", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 3, guard: 0 };
    const r = castSkill(s0, "railedOn", "bearer");
    expect(r.party.mockingThief.hp).toBe(MAX_HP.mockingThief - R.railCost);
    s0.party.mockingThief.hp = 15;
    expect(castSkill(s0, "railedOn", "bearer").party.mockingThief.hp).toBe(10);
  });
});

describe("Jesus on the cross", () => {
  it("counts as Jesus; Forgive Them steadies everyone; Into Thy Hands strikes all, heals all, then he gives up the ghost", () => {
    expect(personOf("jesusCross")).toBe(personOf("jesus"));
    const s0 = createBattle(seeded(), ["jesusCross", "thief", "david"]);
    s0.hand = [];
    s0.energy = { faith: 3, attack: 0, guard: 1 };
    expect(castSkill(s0, "rememberMe").energy.faith).toBe(5); // the thief sees Jesus beside him
    s0.party.david.shaken = true;
    expect(castSkill(s0, "forgiveThem").party.david.shaken).toBe(false);
    s0.party.david.hp = 50;
    const f = castSkill(s0, "commitSpirit");
    expect([f.party.jesusCross.hp, f.party.david.hp, f.spiritUsed, f.result]).toEqual([0, 50 + R.spiritHeal, true, "ongoing"]);
    expect(f.enemies.bearer.hp).toBeLessThan(ENEMY_HP.bearer);
  });
});

describe("The poor widow", () => {
  it("Two Mites turns every energy left into Faith; All Her Living gives half her HP to every ally", () => {
    const s0 = createBattle(seeded(), ["widow", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 2 };
    const m = castSkill(s0, "twoMites");
    expect([m.energy.faith, m.energy.attack, m.energy.guard]).toEqual([4, 0, 0]);
    s0.party.david.hp = 30;
    const a = castSkill(s0, "allHerLiving");
    expect([a.party.widow.hp, a.party.david.hp]).toEqual([MAX_HP.widow / 2, 30 + MAX_HP.widow / 2]);
  });
});

describe("A Galilean fisherman", () => {
  it("Toiled All the Night gives Attack; At Thy Word strikes harder with Peter", () => {
    const s0 = createBattle(seeded(), ["fisherman", "peter"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "toiledAllNight").energy.attack).toBe(1);
    const alone = createBattle(seeded(), ["fisherman", "david"]);
    expect(skillDamage(s0, "atThyWord", "archer")).toBeGreaterThan(skillDamage(alone, "atThyWord", "archer"));
  });
});

describe("The four friends", () => {
  it("Through the Roof heals another ally (double with Jesus); Their Faith gives 3 Faith with Jesus", () => {
    const s0 = createBattle(seeded(), ["fourFriends", "jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.david.hp = 30;
    expect(castSkill(s0, "throughTheRoof", "david").party.david.hp).toBe(30 + R.roofHeal * 2);
    expect(skillTargets(s0, "throughTheRoof")).not.toContain("fourFriends");
    expect(castSkill(s0, "theirFaith").energy.faith).toBe(R.theirFaith + 1);
  });
});

describe("The good Samaritan", () => {
  it("Oil and Wine heals another ally; Two Pence heals an ally at the start of the next 2 turns", () => {
    let s = createBattle(seeded(), ["goodSamaritan", "david"]);
    s.hand = [];
    s.archerTarget = null;
    s.energy = { faith: 0, attack: 0, guard: 1 };
    s.party.david.hp = 30;
    expect(castSkill(s, "oilAndWine", "david").party.david.hp).toBe(30 + R.oilHeal);
    s = castSkill(s, "twoPence", "david");
    const hps: number[] = [];
    for (let turn = 0; turn < 3; turn++) {
      s = startNextTurn(s, seeded());
      hps.push(s.party.david.hp);
    }
    expect(hps).toEqual([30 + R.innHeal, 30 + R.innHeal * 2, 30 + R.innHeal * 2]);
    expect(s.inn).toBeNull();
  });
});

describe("Pharaoh", () => {
  it("a Hardened Heart shields him; More Bricks gives Attack but wears down every other ally", () => {
    const s0 = createBattle(seeded(), ["pharaoh", "moses"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "hardenedHeart").party.pharaoh.shield).toBe(R.hardShield);
    const b = castSkill(s0, "makeBricks");
    expect([b.energy.attack, b.party.moses.hp, b.party.pharaoh.hp]).toEqual([R.bricksAttack, MAX_HP.moses - R.bricksCost, MAX_HP.pharaoh]);
  });
});

describe("The Egyptian charioteer and Jezebel", () => {
  it("the Pursuit strikes harder with Pharaoh; Sealed Letters reach the leader behind the shield bearer", () => {
    const s0 = createBattle(seeded(), ["charioteer", "pharaoh", "jezebel"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    const alone = createBattle(seeded(), ["charioteer", "david"]);
    expect(skillDamage(s0, "pursued", "archer")).toBeGreaterThan(skillDamage(alone, "pursued", "archer"));
    expect(castSkill(s0, "chosenChariots").party.charioteer.shield).toBe(R.chariotShield);
    expect(castSkill(s0, "royalCommand").party.jezebel.shield).toBe(R.queenShield);
    expect(skillTargets(s0, "sealedLetters")).toContain("goliath");
    expect(castSkill(s0, "sealedLetters", "goliath").enemies.goliath.hp).toBeLessThan(ENEMY_HP.goliath);
  });
});

describe("The prophet of Baal and Haman", () => {
  it("Call on Baal grows each turn; Cutting Themselves costs HP; Haman's Decree comes back on him with Mordecai", () => {
    const s0 = createBattle(seeded(), ["baalProphet", "haman", "mordecai"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    const first = skillDamage(s0, "callOnBaal", "archer");
    s0.turn = 3;
    expect(skillDamage(s0, "callOnBaal", "archer")).toBeGreaterThan(first);
    const c = castSkill(s0, "cutThemselves");
    expect([c.energy.attack, c.party.baalProphet.hp]).toEqual([2 + R.cutAttack, MAX_HP.baalProphet - R.cutCost]);
    expect(castSkill(s0, "kingsRing").energy.attack).toBe(2 + R.ringAttack);
    const d = castSkill(s0, "hamansDecree");
    expect([d.party.haman.hp, d.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([MAX_HP.haman - R.gallowsCost, true]);
  });
});

describe("Delilah", () => {
  it("Silver gives Attack and Faith; Wherein Thy Strength Lieth strikes, but shakes Samson", () => {
    const s0 = createBattle(seeded(), ["delilah", "samson"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    const p = castSkill(s0, "pieceOfSilver");
    expect([p.energy.attack, p.energy.faith]).toEqual([3, 1]);
    const w = castSkill(s0, "whereinStrength", "bearer");
    expect([w.party.samson.shaken, w.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([true, true]);
  });
});

describe("Nebuchadnezzar", () => {
  it("Seven Times Hotter strikes every enemy; Praise the King of Heaven heals all and gives Faith once", () => {
    const s0 = createBattle(seeded(), ["nebuchadnezzar", "daniel"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 2, guard: 1 };
    const h = castSkill(s0, "sevenTimesHotter");
    expect([h.enemies.bearer.hp < ENEMY_HP.bearer, h.enemies.goliath.hp < ENEMY_HP.goliath]).toEqual([true, true]);
    s0.party.daniel.hp = 50;
    const p = castSkill(s0, "praiseKingOfHeaven");
    expect([p.party.daniel.hp, p.energy.faith, p.praisedHeaven]).toEqual([50 + R.heavenHeal, R.heavenFaith, true]);
  });
});

describe("Ahab", () => {
  it("Naboth's Vineyard gives 3 Attack with Jezebel; He Humbled Himself heals him and steadies everyone, once", () => {
    const s0 = createBattle(seeded(), ["ahab", "jezebel"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect(castSkill(s0, "covetVineyard").energy.attack).toBe(R.vineyardAttack + 1);
    s0.party.ahab.hp = 40;
    s0.party.jezebel.shaken = true;
    const h = castSkill(s0, "humbledHimself");
    expect([h.party.ahab.hp, h.party.jezebel.shaken, h.ahabHumbled]).toEqual([40 + R.humbledHeal, false, true]);
  });
});

describe("The widow of Zarephath", () => {
  it("the Meal Not Spent heals everyone (double with Elijah); a Little Cake heals another ally", () => {
    const s0 = createBattle(seeded(), ["zarephath", "elijah"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.elijah.hp = 50;
    const m = castSkill(s0, "mealNotSpent");
    expect([m.party.elijah.hp, m.energy.faith]).toEqual([50 + R.mealHeal * 2, 1]);
    expect(castSkill(s0, "littleCake", "elijah").party.elijah.hp).toBe(50 + R.cakeHeal);
    expect(skillTargets(s0, "littleCake")).not.toContain("zarephath");
  });
});

describe("The Shunammite woman", () => {
  it("a Little Chamber shields everyone (double with Elisha); It Is Well raises a fallen ally once, at full HP with Elisha", () => {
    const s0 = createBattle(seeded(), ["shunammite", "elisha", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect(castSkill(s0, "littleChamber").party.david.shield).toBe(R.chamberShield * 2);
    s0.party.david.hp = 0;
    const w = castSkill(s0, "itIsWell", "david");
    expect([w.party.david.hp, w.itIsWellUsed]).toEqual([MAX_HP.david, true]);
  });
});

describe("Naaman, the little maid, Bathsheba and Absalom", () => {
  it("Seven Times in Jordan restores Naaman once (+Faith with Elisha); Would God gives 2 Faith with Naaman", () => {
    const s0 = createBattle(seeded(), ["naaman", "elisha", "maid"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.naaman.hp = 30;
    s0.party.elisha.shaken = true;
    const j = castSkill(s0, "sevenTimesJordan");
    expect([j.party.naaman.hp, j.party.elisha.shaken, j.energy.faith, j.jordanUsed]).toEqual([MAX_HP.naaman, false, R.jordanFaith, true]);
    expect(castSkill(s0, "wouldGod").energy.faith).toBe(2);
    expect(castSkill(s0, "littleMaid", "naaman").party.naaman.hp).toBe(30 + R.maidHeal);
  });

  it("Remember the Oath gives 2 Faith with Nathan; the King's Mother heals and shields Solomon double", () => {
    const s0 = createBattle(seeded(), ["bathsheba", "nathan", "solomon"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect(castSkill(s0, "rememberOath").energy.faith).toBe(4);
    s0.party.solomon.hp = 30;
    const k = castSkill(s0, "kingsMother", "solomon");
    expect([k.party.solomon.hp, k.party.solomon.shield]).toEqual([30 + R.queenMotherHeal * 2, R.queenMotherShield * 2]);
  });

  it("Stole the Hearts gives Faith but shakes David", () => {
    const s0 = createBattle(seeded(), ["absalom", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const h = castSkill(s0, "stoleHearts");
    expect([h.energy.faith, h.party.david.shaken]).toEqual([R.heartsFaith, true]);
  });
});

describe("Mephibosheth", () => {
  it("the King's Table heals him double with David; Such a Dead Dog steadies everyone", () => {
    const s0 = createBattle(seeded(), ["mephibosheth", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.mephibosheth.hp = 20;
    const t = castSkill(s0, "kingsTable");
    expect([t.party.mephibosheth.hp, t.energy.faith]).toEqual([20 + R.tableHeal * 2, 1]);
    s0.party.david.shaken = true;
    const d = castSkill(s0, "deadDog");
    expect([d.party.david.shaken, d.energy.guard]).toEqual([false, 1]);
  });
});

describe("The Queen of Sheba", () => {
  it("Hard Questions draw 2 with Solomon; Spices and Gold give Attack and heal everyone", () => {
    const s0 = createBattle(seeded(), ["sheba", "solomon"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    const q = castSkill(s0, "hardQuestions");
    expect([q.hand.length, q.energy.faith]).toEqual([2, 3]);
    s0.party.solomon.hp = 50;
    const g = castSkill(s0, "spicesAndGold");
    expect([g.energy.attack, g.party.solomon.hp]).toEqual([R.goldAttack, 50 + R.spiceHeal]);
  });
});

describe("Leah", () => {
  it("Looked Upon My Affliction heals her (+Faith when low); Now Will I Praise gives 3 Faith with Jacob", () => {
    const s0 = createBattle(seeded(), ["leah", "jacob"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.leah.hp = 40;
    const a = castSkill(s0, "lookedUpon");
    expect([a.party.leah.hp, a.energy.faith]).toEqual([40 + R.afflictionHeal, 1]);
    expect(castSkill(s0, "nowPraise").energy.faith).toBe(R.praiseFaith + 1);
  });
});

describe("Esau", () => {
  it("the Cunning Hunter strikes harder with Isaac; Ran to Meet Him shields everyone, Jacob most", () => {
    const s0 = createBattle(seeded(), ["esau", "isaac", "jacob"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 1, guard: 1 };
    const alone = createBattle(seeded(), ["esau", "david"]);
    expect(skillDamage(s0, "cunningHunter", "archer")).toBeGreaterThan(skillDamage(alone, "cunningHunter", "archer"));
    s0.party.isaac.shaken = true;
    const r = castSkill(s0, "ranToMeet");
    expect([r.party.jacob.shield, r.party.isaac.shield, r.party.isaac.shaken]).toEqual([R.embraceJacobShield, R.embraceShield, false]);
  });
});

describe("Hagar and Ishmael", () => {
  it("God Heard gives 3 Faith with Abraham; the Well Opened heals and steadies everyone once", () => {
    const s0 = createBattle(seeded(), ["hagar", "abraham"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect(castSkill(s0, "godHeard").energy.faith).toBe(5);
    s0.party.abraham.hp = 50;
    s0.party.abraham.shaken = true;
    const w = castSkill(s0, "wellOpened");
    expect([w.party.abraham.hp, w.party.abraham.shaken, w.wellUsed]).toEqual([50 + R.wellHeal, false, true]);
  });
});

describe("Lot and his wife", () => {
  it("Escape for Thy Life shields everyone (+Faith with Abraham); Looking Back gives Attack but shakes them", () => {
    const s0 = createBattle(seeded(), ["lot", "abraham"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const e = castSkill(s0, "escapeForLife");
    expect([e.party.abraham.shield, e.energy.faith]).toEqual([R.escapeShield, 1]);
    const b = castSkill(s0, "lookedBack");
    expect([b.energy.attack, b.party.lot.shaken]).toEqual([R.lookBackAttack, true]);
  });
});

describe("Jochebed", () => {
  it("the Ark of Bulrushes shields Moses most; Nurse Him heals and gives 2 Faith with Moses", () => {
    const s0 = createBattle(seeded(), ["jochebed", "moses"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "arkOfBulrushes", "moses").party.moses.shield).toBe(R.bulrushMosesShield);
    s0.party.moses.hp = 50;
    const n = castSkill(s0, "nurseHim", "moses");
    expect([n.party.moses.hp, n.energy.faith]).toEqual([50 + R.nurseHeal, 2]);
  });
});

describe("Pharaoh's daughter", () => {
  it("Had Compassion heals Moses double; Drew Him Out gives 3 Faith with Jochebed", () => {
    const s0 = createBattle(seeded(), ["pharaohDaughter", "moses", "jochebed"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.moses.hp = 30;
    expect(castSkill(s0, "hadCompassion", "moses").party.moses.hp).toBe(30 + R.compassionHeal * 2);
    expect(castSkill(s0, "drewHimOut").energy.faith).toBe(R.drewFaith + 1);
  });
});

describe("Jethro", () => {
  it("Share the Burden gives Attack, Guard and Faith with Moses; Greater Than All gives 3 Faith with Moses", () => {
    const s0 = createBattle(seeded(), ["jethro", "moses"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    const b = castSkill(s0, "shareBurden");
    expect([b.energy.attack, b.energy.guard, b.energy.faith]).toEqual([1, 2, 1]);
    expect(castSkill(s0, "greaterThanAll").energy.faith).toBe(R.greaterFaith + 1);
  });
});

describe("Zipporah", () => {
  it("Watered the Flock heals everyone and shields them with Moses; a Stranger gives 2 Faith with Jethro", () => {
    const s0 = createBattle(seeded(), ["zipporah", "moses", "jethro"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.jethro.hp = 50;
    const w = castSkill(s0, "wateredFlock");
    expect([w.party.jethro.hp, w.party.jethro.shield]).toEqual([50 + R.flockHeal, R.flockShield]);
    expect(castSkill(s0, "strangerLand").energy.faith).toBe(2);
  });
});

describe("Lois and Eunice", () => {
  it("Unfeigned Faith gives 2 Faith with Timothy; From a Child draws and shields Timothy most", () => {
    const s0 = createBattle(seeded(), ["loisEunice", "timothy"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "unfeignedFaith").energy.faith).toBe(2);
    const c = castSkill(s0, "fromAChild");
    expect([c.hand.length, c.party.timothy.shield, c.party.loisEunice.shield]).toEqual([1, R.childTimothyShield, R.childShield]);
  });
});

describe("Ananias and Sapphira", () => {
  it("Kept Back Part gives Faith unseen, but with Peter the lie is found out", () => {
    const hid = createBattle(seeded(), ["sapphira", "david"]);
    hid.hand = [];
    hid.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(hid, "keptBackPart").energy.faith).toBe(R.keptFaith);
    expect(castSkill(hid, "soldPossession").energy.attack).toBe(R.soldAttack);
    const seen = createBattle(seeded(), ["sapphira", "peter"]);
    seen.hand = [];
    seen.energy = { faith: 0, attack: 0, guard: 1 };
    const f = castSkill(seen, "keptBackPart");
    expect([f.energy.faith, f.party.sapphira.hp, f.party.sapphira.shaken]).toEqual([0, MAX_HP.sapphira - R.keptCost, true]);
  });
});

describe("Pilate", () => {
  it("No Fault shields everyone; Washed His Hands guards Pilate but strips the others' Shields", () => {
    const s0 = createBattle(seeded(), ["pilate", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    const n = castSkill(s0, "noFault");
    expect(n.party.david.shield).toBe(R.noFaultShield);
    n.party.pilate.acted = false;
    const w = castSkill(n, "washedHands");
    expect([w.party.david.shield, w.party.pilate.shield, w.energy.attack]).toEqual([0, R.noFaultShield + R.washShield, 1]);
  });
});

describe("Caiaphas", () => {
  it("One Man Should Die gives Faith but costs the sturdiest other ally 20 HP", () => {
    const s0 = createBattle(seeded(), ["caiaphas", "david", "samson"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const o = castSkill(s0, "oneManDie");
    expect([o.energy.faith, o.party.samson.hp, o.party.david.hp]).toEqual([R.expedientFaith, MAX_HP.samson - R.expedientCost, MAX_HP.david]);
  });
});

describe("Herod Antipas", () => {
  it("Hoped to See a Miracle draws 2; the Gorgeous Robe shields him, gives Attack, and Faith with Pilate", () => {
    const s0 = createBattle(seeded(), ["herod", "pilate"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "hopedSign").hand.length).toBe(R.signDraw);
    const r = castSkill(s0, "gorgeousRobe");
    expect([r.party.herod.shield, r.energy.attack, r.energy.faith]).toEqual([R.robeShield, 1, 1]);
  });
});

describe("Barabbas", () => {
  it("Released unto Them restores him once, +2 Faith with Jesus in his place", () => {
    const s0 = createBattle(seeded(), ["barabbas", "jesusCross"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.barabbas.hp = 30;
    const r = castSkill(s0, "releasedUnto");
    expect([r.party.barabbas.hp, r.energy.faith, r.releasedUsed]).toEqual([MAX_HP.barabbas, R.releasedFaith, true]);
  });
});

describe("Herodias", () => {
  it("a Convenient Day gives Attack and Faith with Herod; the Grudge strikes but shakes John the Baptist", () => {
    const s0 = createBattle(seeded(), ["herodias", "herod", "johnBaptist"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    const c = castSkill(s0, "convenientDay");
    expect([c.energy.attack, c.energy.faith]).toEqual([2 + R.convenientAttack, 1]);
    const g = castSkill(s0, "heldGrudge", "bearer");
    expect([g.party.johnBaptist.shaken, g.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([true, true]);
  });
});

describe("The Roman infantryman", () => {
  it("Shield Wall shields him and his allies; the Gladius strikes harder under a centurion", () => {
    const s0 = createBattle(seeded(), ["romanSoldier", "centurion"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 1, guard: 1 };
    const w = castSkill(s0, "shieldWall");
    expect([w.party.romanSoldier.shield, w.party.centurion.shield]).toEqual([R.scutumShield, R.wallAllyShield]);
    const alone = createBattle(seeded(), ["romanSoldier", "david"]);
    expect(skillDamage(s0, "gladius", "archer")).toBeGreaterThan(skillDamage(alone, "gladius", "archer"));
  });
});

describe("The Roman spearman", () => {
  it("Brace Spears takes the blow meant for an ally; the Pilum reaches the leader behind the shield bearer", () => {
    let s = createBattle(seeded(), ["romanSpearman", "david"]);
    s.hand = [];
    s.archerTarget = null;
    s.energy = { faith: 0, attack: 1, guard: 1 };
    expect(skillTargets(s, "pilum")).toContain("goliath");
    s = castSkill(s, "braceSpears", "david");
    expect([s.spearCovers, s.party.romanSpearman.shield]).toEqual(["david", R.braceShield]);
    s.intents[0] = { action: "spear", targets: ["david"] };
    s = resolveGoliath(s, seeded());
    expect(s.party.david.hp).toBe(MAX_HP.david);
  });
});

describe("The Roman archer", () => {
  it("an Aimed Shot reaches the leader behind the shield bearer; a Volley strikes every enemy", () => {
    const s0 = createBattle(seeded(), ["romanArcher", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 0 };
    expect(skillTargets(s0, "aimedShot")).toContain("goliath");
    const v = castSkill(s0, "arrowVolley");
    expect([v.enemies.bearer.hp < ENEMY_HP.bearer, v.enemies.goliath.hp < ENEMY_HP.goliath]).toEqual([true, true]);
  });
});

describe("The Roman cavalryman", () => {
  it("Ride Out gives Attack and draws; the Charge reaches the leader behind the shield bearer", () => {
    const s0 = createBattle(seeded(), ["romanCavalry", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const r = castSkill(s0, "rideOut");
    expect([r.energy.attack, r.hand.length]).toEqual([1, 1]);
    expect(skillTargets(s0, "cavalryCharge")).toContain("goliath");
  });
});

describe("The Roman centurion", () => {
  it("Command the Century grows with Roman soldiers; Truly the Son of God gives 3 Faith with Jesus on the cross", () => {
    const s0 = createBattle(seeded(), ["romanCenturion", "romanSoldier", "romanArcher"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    expect(castSkill(s0, "commandCohort").energy.attack).toBe(3);
    const c = createBattle(seeded(), ["romanCenturion", "jesusCross"]);
    c.hand = [];
    c.energy = { faith: 0, attack: 0, guard: 2 };
    expect(castSkill(c, "trulySonOfGod").energy.faith).toBe(3);
  });
});

describe("Sennacherib", () => {
  it("the Fenced Cities strike every enemy, but with Hezekiah the angel smites his camp", () => {
    const s0 = createBattle(seeded(), ["sennacherib", "hezekiah"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    const t = castSkill(s0, "whomTrust");
    expect([t.energy.attack, t.energy.faith]).toEqual([4, 1]);
    const f = castSkill(s0, "fencedCities");
    expect([f.party.sennacherib.hp, f.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([MAX_HP.sennacherib - R.campSmitten, true]);
  });
});

describe("Belshazzar", () => {
  it("the Golden Vessels give Attack but shake him; the Writing gives 3 Faith with Daniel and clothes him in scarlet", () => {
    const s0 = createBattle(seeded(), ["belshazzar", "daniel"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const v = castSkill(s0, "goldenVessels");
    expect([v.energy.attack, v.party.belshazzar.shaken]).toEqual([R.vesselsAttack, true]);
    const w = castSkill(s0, "writingOnWall");
    expect([w.energy.faith, w.party.daniel.shield]).toEqual([3, R.scarletShield]);
  });
});

describe("Balaam and his donkey", () => {
  it("the Donkey Saw the Angel shields and steadies everyone; How Shall I Curse heals everyone", () => {
    const s0 = createBattle(seeded(), ["balaam", "moses"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    s0.party.moses.shaken = true;
    const d = castSkill(s0, "donkeySaw");
    expect([d.party.moses.shield, d.party.moses.shaken]).toEqual([R.donkeyShield, false]);
    s0.party.moses.shaken = false;
    s0.party.moses.hp = 50;
    const b = castSkill(s0, "blessNotCurse");
    expect([b.party.moses.hp, b.energy.faith]).toEqual([50 + R.blessHeal, 1]);
  });
});

describe("The man freed from Legion, the prodigal son and the Ethiopian", () => {
  it("In His Right Mind steadies everyone (Faith with Jesus); Tell How Great draws and heals", () => {
    const s0 = createBattle(seeded(), ["legionFreed", "jesusUR", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    s0.party.david.shaken = true;
    s0.party.david.hp = 50;
    const m = castSkill(s0, "rightMind");
    expect([m.party.david.shaken, m.party.legionFreed.shield, m.energy.faith]).toEqual([false, R.legionShield, 2 + R.legionFaith]);
    const t = castSkill(s0, "tellHowGreat");
    expect([t.hand.length, t.party.david.hp]).toEqual([R.tellDraw, 50 + R.tellHeal]);
  });

  it("the prodigal comes to himself (more Faith when low) and is given the best robe", () => {
    const s0 = createBattle(seeded(), ["prodigal", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect(castSkill(s0, "cameToHimself").energy.faith).toBe(2 + R.prodigalFaith);
    s0.party.prodigal.hp = 40;
    expect(castSkill(s0, "cameToHimself").energy.faith).toBe(2 + R.prodigalLowFaith);
    const r = castSkill(s0, "bestRobe");
    expect([r.party.prodigal.hp, r.party.prodigal.shield]).toEqual([40 + R.prodigalRobeHeal, R.prodigalRobeShield]);
  });

  it("the Ethiopian understands with Philip beside him, and goes on his way rejoicing", () => {
    const s0 = createBattle(seeded(), ["ethiopian", "philip"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(s0, "readingIsaiah").energy.faith).toBe(R.eunuchPhilipFaith);
    const alone = createBattle(seeded(), ["ethiopian", "david"]);
    alone.hand = [];
    alone.energy = { faith: 2, attack: 0, guard: 1 };
    alone.party.david.hp = 50;
    expect(castSkill(alone, "readingIsaiah").energy.faith).toBe(2 + R.eunuchFaith);
    const w = castSkill(alone, "wentRejoicing");
    expect([w.party.david.hp, w.energy.attack]).toEqual([50 + R.rejoicingHeal, 1]);
  });
});

describe("John on Patmos", () => {
  it("counts as John; In the Spirit gives Faith and a card; a New Heaven heals and steadies everyone", () => {
    expect(personOf("johnPatmos")).toBe(personOf("johnApostle"));
    const s0 = createBattle(seeded(), ["johnPatmos", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const sp = castSkill(s0, "inTheSpirit");
    expect([sp.energy.faith, sp.hand.length]).toEqual([R.patmosFaith, 1]);
    s0.energy = { faith: 3, attack: 0, guard: 0 };
    s0.party.david.hp = 50;
    s0.party.david.shaken = true;
    const n = castSkill(s0, "newHeaven");
    expect([n.party.david.hp, n.party.david.shaken, n.energy.attack]).toEqual([50 + R.newHeavenHeal, false, 1]);
  });
});

describe("Ehud", () => {
  it("the left-handed dagger strikes harder at an unhurt enemy; the trumpet gives Attack and Shield", () => {
    const s0 = createBattle(seeded(), ["ehud", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    const t = castSkill(s0, "blewTrumpet");
    expect([t.energy.attack, t.party.ehud.shield]).toEqual([R.trumpetAttack, R.trumpetShield]);
    const fresh = skillDamage(s0, "leftHanded", "bearer");
    s0.enemies.bearer.hp -= 1;
    expect(fresh).toBeGreaterThan(skillDamage(s0, "leftHanded", "bearer")); // +20 before the element multiplier
  });
});

describe("Jephthah", () => {
  it("The LORD Be Judge gives Faith and Shield; the rash vow strikes hard and costs him", () => {
    const s0 = createBattle(seeded(), ["jephthah", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    const j = castSkill(s0, "judgeThisDay");
    expect([j.energy.faith, j.party.jephthah.shield]).toEqual([R.judgeFaith, R.judgeShield]);
    const v = castSkill(s0, "rashVow", "bearer");
    expect([v.party.jephthah.hp, v.party.jephthah.shaken, v.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([MAX_HP.jephthah - R.vowCost, true, true]);
  });
});

describe("Joab", () => {
  it("Play the Men shields everyone; with Absalom on the team, the three darts find him too", () => {
    const s0 = createBattle(seeded(), ["joab", "absalom"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    const p = castSkill(s0, "playTheMen");
    expect([p.party.joab.shield, p.party.absalom.shield, p.energy.attack]).toEqual([R.joabShield, R.joabShield, 3]);
    const d = castSkill(s0, "threeDarts", "bearer");
    expect([d.party.absalom.hp, d.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([MAX_HP.absalom - R.dartsCost, true]);
  });
});

describe("Uriah and Simon the sorcerer", () => {
  it("Uriah would not go home; the hottest battle costs him more with David there", () => {
    const s0 = createBattle(seeded(), ["uriah", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 1, guard: 1 };
    const h = castSkill(s0, "wouldNotGoHome");
    expect([h.party.uriah.shield, h.energy.faith]).toEqual([R.uriahShield, R.uriahFaith]);
    expect(castSkill(s0, "hottestBattle", "bearer").party.uriah.hp).toBe(MAX_HP.uriah - R.hottestBetrayed);
    const alone = createBattle(seeded(), ["uriah", "joab"]);
    alone.hand = [];
    alone.energy = { faith: 0, attack: 1, guard: 0 };
    expect(castSkill(alone, "hottestBattle", "bearer").party.uriah.hp).toBe(MAX_HP.uriah - R.hottestCost);
  });

  it("Simon believes with Philip; his money perishes with Peter", () => {
    const s0 = createBattle(seeded(), ["simonMagus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 3, guard: 1 };
    expect(castSkill(s0, "sorceries").energy.attack).toBe(3 + R.sorceryAttack);
    const m = castSkill(s0, "offeredMoney");
    expect([m.energy.attack, m.energy.faith]).toEqual([0, 3]);
    const p = createBattle(seeded(), ["simonMagus", "philip", "peter"]);
    p.hand = [];
    p.energy = { faith: 0, attack: 3, guard: 1 };
    expect(castSkill(p, "sorceries").energy.faith).toBe(R.sorceryFaith);
    const lost = castSkill(p, "offeredMoney");
    expect([lost.energy.attack, lost.energy.faith, lost.party.simonMagus.shaken]).toEqual([0, 0, true]);
  });
});

describe("Herod Agrippa I", () => {
  it("pleasing the crowd gives Attack unless Peter is freed; the voice of a god strikes all, then he is smitten", () => {
    const s0 = createBattle(seeded(), ["herodAgrippa", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    expect(castSkill(s0, "pleasedJews").energy.attack).toBe(2 + R.agrippaAttack);
    const v = castSkill(s0, "voiceOfGod");
    expect([v.party.herodAgrippa.hp, v.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([MAX_HP.herodAgrippa - R.voiceCost, true]);
    const p = createBattle(seeded(), ["herodAgrippa", "peter"]);
    p.hand = [];
    p.energy = { faith: 0, attack: 0, guard: 1 };
    const f = castSkill(p, "pleasedJews");
    expect([f.energy.attack, f.party.herodAgrippa.shaken]).toEqual([0, true]);
  });
});

describe("Cyrus", () => {
  it("the decree gives Faith (and Attack with Ezra); returning the vessels shields everyone", () => {
    const s0 = createBattle(seeded(), ["cyrus", "ezra"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    const d = castSkill(s0, "cyrusDecree");
    expect([d.energy.faith, d.energy.attack]).toEqual([2 + R.cyrusFaith, 1]);
    const v = castSkill(s0, "returnVessels");
    expect([v.party.cyrus.shield, v.party.ezra.shield]).toEqual([R.cyrusShield, R.cyrusShield]);
  });
});

describe("Zerubbabel and Vashti", () => {
  it("laying the foundation shields and gives Faith; Not by Might strikes every enemy", () => {
    const s0 = createBattle(seeded(), ["zerubbabel", "david"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    const f = castSkill(s0, "laidFoundation");
    expect([f.party.zerubbabel.shield, f.energy.faith]).toEqual([R.foundationShield, 2 + R.foundationFaith]);
    s0.energy = { faith: 3, attack: 0, guard: 0 };
    const n = castSkill(s0, "notByMight");
    expect([n.energy.faith, n.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([0, true]);
  });

  it("Vashti refuses to come; her feast heals everyone, with Faith if Esther is there", () => {
    const s0 = createBattle(seeded(), ["vashti", "esther"]);
    s0.hand = [];
    s0.energy = { faith: 2, attack: 0, guard: 1 };
    expect(castSkill(s0, "refusedToCome").party.vashti.shield).toBe(R.vashtiShield);
    s0.party.esther.hp = 50;
    const f = castSkill(s0, "royalFeast");
    expect([f.party.esther.hp, f.energy.faith]).toEqual([50 + R.vashtiFeastHeal, 1]);
  });
});

describe("Michal, Gehazi and Jehu", () => {
  it("Michal lets David down through the window, and lays an image in the bed", () => {
    const s0 = createBattle(seeded(), ["michal", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 1 };
    s0.party.david.shaken = true;
    const w = castSkill(s0, "letDownWindow", "david");
    expect([w.party.david.shield, w.party.david.shaken]).toEqual([R.michalDavidShield, false]);
    const b = castSkill(s0, "imageInBed");
    expect([b.party.michal.shield, b.hand.length]).toEqual([R.michalDecoyShield, 1]);
  });

  it("Gehazi's running is found out by Elisha; Jehu's zeal shakes the house of Ahab", () => {
    const g = createBattle(seeded(), ["gehazi", "elisha"]);
    g.hand = [];
    g.energy = { faith: 0, attack: 0, guard: 1 };
    const f = castSkill(g, "ranAfterNaaman");
    expect([f.energy.attack, f.party.gehazi.hp, f.party.gehazi.shaken]).toEqual([0, MAX_HP.gehazi - R.gehaziCost, true]);
    const alone = createBattle(seeded(), ["gehazi", "david"]);
    alone.hand = [];
    alone.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(alone, "ranAfterNaaman").energy.attack).toBe(R.gehaziAttack);
    const j = createBattle(seeded(), ["jehu", "jezebel"]);
    j.hand = [];
    j.energy = { faith: 0, attack: 0, guard: 1 };
    const z = castSkill(j, "zealForLord");
    expect([z.energy.attack, z.party.jezebel.shaken]).toEqual([R.jehuAttack, true]);
  });
});

describe("Sisera and Herod the Great", () => {
  it("Sisera's chariots are routed by Deborah, and Jael is waiting in the tent", () => {
    const s0 = createBattle(seeded(), ["sisera", "barak"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    const c = castSkill(s0, "ironChariots");
    expect([c.party.sisera.shaken, c.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([true, true]);
    const t = createBattle(seeded(), ["sisera", "jael"]);
    t.hand = [];
    t.energy = { faith: 0, attack: 0, guard: 1 };
    const p = castSkill(t, "fledToTent");
    expect([p.party.sisera.hp, p.party.sisera.shaken, p.energy.attack]).toEqual([MAX_HP.sisera - R.siseraPegCost, true, 1]);
    const safe = createBattle(seeded(), ["sisera", "david"]);
    safe.hand = [];
    safe.energy = { faith: 0, attack: 0, guard: 1 };
    safe.party.sisera.hp = 50;
    const f = castSkill(safe, "fledToTent");
    expect([f.party.sisera.hp, f.party.sisera.shield]).toEqual([50 + R.siseraMilkHeal, R.siseraMantleShield]);
  });

  it("Herod draws when he privily calls the wise men, unless the Magi are warned; his wrath costs him", () => {
    const s0 = createBattle(seeded(), ["herodGreat", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 2, guard: 1 };
    expect(castSkill(s0, "privilyCalled").hand.length).toBe(R.privilyDraw);
    const w = castSkill(s0, "exceedingWroth", "bearer");
    expect([w.party.herodGreat.hp, w.enemies.bearer.hp < ENEMY_HP.bearer]).toEqual([MAX_HP.herodGreat - R.wrothCost, true]);
    const m = createBattle(seeded(), ["herodGreat", "magi"]);
    m.hand = [];
    m.energy = { faith: 0, attack: 0, guard: 1 };
    const f = castSkill(m, "privilyCalled");
    expect([f.hand.length, f.party.herodGreat.shaken]).toEqual([0, true]);
  });
});

describe("Korah and Achan", () => {
  it("Korah shakes Moses and pays when the earth opens; Achan is found out by Joshua", () => {
    const k = createBattle(seeded(), ["korah", "moses"]);
    k.hand = [];
    k.energy = { faith: 0, attack: 2, guard: 1 };
    const t = castSkill(k, "takeTooMuch");
    expect([t.energy.attack, t.party.moses.shaken]).toEqual([4, true]);
    expect(castSkill(k, "strangeCensers").party.korah.hp).toBe(MAX_HP.korah - R.censerCost);
    const a = createBattle(seeded(), ["achan", "joshua"]);
    a.hand = [];
    a.energy = { faith: 0, attack: 0, guard: 1 };
    const f = castSkill(a, "hiddenSpoil");
    expect([f.energy.faith, f.party.achan.hp, f.party.achan.shaken]).toEqual([0, MAX_HP.achan - R.spoilCost, true]);
    const hid = createBattle(seeded(), ["achan", "david"]);
    hid.hand = [];
    hid.energy = { faith: 0, attack: 0, guard: 1 };
    expect(castSkill(hid, "hiddenSpoil").energy.faith).toBe(R.spoilFaith);
  });
});
