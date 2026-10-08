import type { CardDef, CardId, CharacterId, Element, EnemyId, GoliathActionId, SkillDef, SkillId } from "./types";

// Prototype v2 (energy-card version) numbers. Change only with the designer's approval.
export const RULES_V2 = {
  openingHand: 5,
  drawPerTurn: 3,
  maxHand: 7,

  /** Faith and Guard carry over between turns up to these caps; Attack resets each turn. */
  maxFaith: 6,
  maxGuard: 6,
  /** David's passive "Against the Giant": while Faith ≥ this, David's attacks +giantBonus. */
  giantFaith: 3,
  giantBonus: 20,

  /** Victory when Goliath falls; the others flee (1 Sam 17:51). */
  archerDamage: 30,
  spear: 40,
  crush: 120,
  swing: 50,
  defyTargets: 2,

  healAmount: 50,
  ariseHp: 70,
  covShield: 30,

  /** Elements are reserved for multi-stage play: switched off, so damage is unaffected for now. */
  elements: {
    enabled: true,
    /** Attacker's element beats the defender's. */
    strong: 1.5,
    /** Defender's element beats the attacker's (water/fire/wood cycle). */
    weak: 0.75,
  },

  /** Delay between Goliath's action and the next turn in the UI (ms). */
  stepDelay: 800,
} as const;

/** Which elements each element beats. Light and dark counter each other (balanced for PvP). */
export const ELEMENT_BEATS: Record<Element, Element[]> = {
  water: ["fire"],
  fire: ["wood"],
  wood: ["water"],
  light: ["dark"],
  dark: ["light"],
};

/** Provisional assignments, to be decided with the designer before elements are switched on. */
export const CHARACTER_ELEMENT: Record<CharacterId, Element> = { david: "light", samuel: "water", jonathan: "fire" };
export const ENEMY_ELEMENT: Record<EnemyId, Element> = { bearer: "wood", goliath: "dark", archer: "fire" };

export const PARTY_ORDER: CharacterId[] = ["david", "samuel", "jonathan"];

export const ENEMY_ORDER: EnemyId[] = ["bearer", "goliath", "archer"];

/** HP and damage use Pokémon-TCG-style numbers (steps of 10). */
export const ENEMY_HP: Record<EnemyId, number> = { bearer: 60, goliath: 220, archer: 40 };

export const MAX_HP: Record<CharacterId, number> = { david: 120, samuel: 100, jonathan: 140 };

export const SKILLS: Record<SkillId, SkillDef> = {
  sling: { id: "sling", owner: "david", kind: "attack", cost: 1, damage: 30 },
  slingStone: { id: "slingStone", owner: "david", kind: "faith", cost: 3, damage: 140 },
  rebuke: { id: "rebuke", owner: "samuel", kind: "attack", cost: 1, damage: 20 },
  heal: { id: "heal", owner: "samuel", kind: "guard", cost: 1 },
  arise: { id: "arise", owner: "samuel", kind: "guard", cost: 2 },
  sword: { id: "sword", owner: "jonathan", kind: "attack", cost: 1, damage: 30 },
  covshield: { id: "covshield", owner: "jonathan", kind: "guard", cost: 1 },
};

export const CHARACTER_SKILLS: Record<CharacterId, SkillId[]> = {
  david: ["sling", "slingStone"],
  samuel: ["rebuke", "heal", "arise"],
  jonathan: ["sword", "covshield"],
};

export const CARDS_V2: Record<CardId, CardDef> = {
  delivered: { id: "delivered", energy: "faith" },
  battle: { id: "battle", energy: "faith" },
  trust: { id: "trust", energy: "faith" },
  assurance: { id: "assurance", energy: "faith" },
  inname: { id: "inname", energy: "attack" },
  trains: { id: "trains", energy: "attack" },
  stones: { id: "stones", energy: "attack" },
  wings: { id: "wings", energy: "guard" },
  shepherd: { id: "shepherd", energy: "guard" },
  renewed: { id: "renewed", energy: "guard" },
  bestrong: { id: "bestrong", energy: "guard" },
  covenant: { id: "covenant", energy: "guard" },
};

/** 15 energy cards: ✨ Faith 4, 🗡️ Attack 6, 🕊️ Guard 5. */
export const DECK_V2: CardId[] = [
  "delivered", "battle", "trust", "assurance",
  "inname", "inname", "trains", "trains", "stones", "stones",
  "wings", "shepherd", "renewed", "bestrong", "covenant",
];

export const PHASE1_CYCLE: GoliathActionId[] = ["defy", "spear", "raise", "crush"];
export const PHASE2_CYCLE: GoliathActionId[] = ["swing", "raise", "crush"];
