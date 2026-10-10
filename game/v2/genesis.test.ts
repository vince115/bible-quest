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

  it("the special card cleanses the leper, and prays in Gethsemane once per battle", () => {
    const s0 = createBattle(seeded(), ["jesus", "david"]);
    s0.hand = [];
    s0.energy = { faith: 0, attack: 0, guard: 2 };
    s0.party.david.hp = 30;
    s0.party.david.shaken = true;
    const healed = castSkill(s0, "leper", "david");
    expect([healed.party.david.hp, healed.party.david.shaken]).toEqual([30 + R.leperHeal, false]);
    const s = castSkill(s0, "gethsemane");
    expect(s.party.david.shield).toBe(R.gethsemaneShield);
    expect(s.energy.faith).toBe(R.gethsemaneFaith);
    expect(s.gethsemaneUsed).toBe(true);
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
