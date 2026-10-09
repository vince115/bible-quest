import type { CardDef, CardId, CharacterId, Element, EnemyId, GoliathActionId, SkillDef, SkillId, StageId } from "./types";

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
  /** The Serpent of Eden. Coil hits every ally. */
  fang: 90,
  fangShed: 110,
  coil: 60,
  temptFaith: 1,

  /** Story bonuses: a character fighting in their own Bible story. */
  /** Sling Stone away from Goliath: ordinary damage, no Stun. */
  slingStoneElsewhere: 80,
  /** Adam in Eden: Till the Ground +20, Keep the Garden Shield +30. */
  edenTillBonus: 20,
  edenKeepBonus: 30,
  /** Eve in Eden: Mother of All Living +20, and every ally's attacks on the Serpent +20 (Genesis 3:15). */
  edenMotherBonus: 20,
  edenSeedBonus: 20,

  /** Enemy cards played on the player's side. */
  shieldUpAmount: 50,

  /** Adam's Keep the Garden: Shield on himself. */
  keepShield: 50,
  /** Eve's Mother of All Living: heals every ally. */
  motherHeal: 40,

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
export const CHARACTER_ELEMENT: Record<CharacterId, Element> = {
  david: "light",
  samuel: "water",
  jonathan: "fire",
  adam: "wood",
  eve: "wood",
  archerP: "fire",
  bearerP: "wood",
  goliathP: "dark",
  serpentP: "dark",
};
export const ENEMY_ELEMENT: Record<EnemyId, Element> = { bearer: "wood", goliath: "dark", archer: "fire", serpent: "dark" };

/** Every playable character, in display order. */
export const PARTY_ORDER: CharacterId[] = ["david", "samuel", "jonathan", "adam", "eve", "goliathP", "serpentP", "bearerP", "archerP"];
/** Who fights when no line-up is chosen (the v2 battle). */
export const DEFAULT_LINEUP: CharacterId[] = ["david", "samuel", "jonathan"];

export const ENEMY_ORDER: EnemyId[] = ["bearer", "goliath", "archer", "serpent"];

/** Each character's own Bible story: fighting in that stage turns on their story bonus. */
export const STORY: Partial<Record<CharacterId, StageId>> = { david: "goliath", adam: "eden", eve: "eden" };

/** Who fights in each stage, and the boss. */
export const STAGE_ENEMIES: Record<StageId, EnemyId[]> = { goliath: ["bearer", "goliath", "archer"], eden: ["serpent"] };
export const STAGE_BOSS: Record<StageId, EnemyId> = { goliath: "goliath", eden: "serpent" };

/** HP and damage use Pokémon-TCG-style numbers (steps of 10). */
export const ENEMY_HP: Record<EnemyId, number> = { bearer: 60, goliath: 220, archer: 40, serpent: 320 };

export const MAX_HP: Record<CharacterId, number> = { david: 120, samuel: 100, jonathan: 140, adam: 130, eve: 120, archerP: 70, bearerP: 110, goliathP: 120, serpentP: 100 };

export const SKILLS: Record<SkillId, SkillDef> = {
  sling: { id: "sling", owner: "david", kind: "attack", cost: 1, damage: 30 },
  slingStone: { id: "slingStone", owner: "david", kind: "faith", cost: 3, damage: 140 },
  rebuke: { id: "rebuke", owner: "samuel", kind: "attack", cost: 1, damage: 20 },
  heal: { id: "heal", owner: "samuel", kind: "guard", cost: 1 },
  arise: { id: "arise", owner: "samuel", kind: "guard", cost: 2 },
  sword: { id: "sword", owner: "jonathan", kind: "attack", cost: 1, damage: 30 },
  covshield: { id: "covshield", owner: "jonathan", kind: "guard", cost: 1 },
  till: { id: "till", owner: "adam", kind: "attack", cost: 1, damage: 30 },
  keep: { id: "keep", owner: "adam", kind: "guard", cost: 1 },
  mother: { id: "mother", owner: "eve", kind: "guard", cost: 1 },
  helper: { id: "helper", owner: "eve", kind: "guard", cost: 1 },
  volley: { id: "volley", owner: "archerP", kind: "attack", cost: 1, damage: 40 },
  shieldUp: { id: "shieldUp", owner: "bearerP", kind: "guard", cost: 1 },
  bash: { id: "bash", owner: "bearerP", kind: "attack", cost: 1, damage: 20 },
  spearThrust: { id: "spearThrust", owner: "goliathP", kind: "attack", cost: 1, damage: 30 },
  taunt: { id: "taunt", owner: "goliathP", kind: "attack", cost: 2, damage: 10 },
  venom: { id: "venom", owner: "serpentP", kind: "attack", cost: 1, damage: 30 },
  beguile: { id: "beguile", owner: "serpentP", kind: "guard", cost: 3 },
};

export const CHARACTER_SKILLS: Record<CharacterId, SkillId[]> = {
  david: ["sling", "slingStone"],
  samuel: ["rebuke", "heal", "arise"],
  jonathan: ["sword", "covshield"],
  adam: ["till", "keep"],
  eve: ["mother", "helper"],
  archerP: ["volley"],
  bearerP: ["shieldUp", "bash"],
  goliathP: ["spearThrust", "taunt"],
  serpentP: ["venom", "beguile"],
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
/** The Serpent keeps one cycle; after shedding its skin (half HP) its fang hits harder. */
export const SERPENT_CYCLE: GoliathActionId[] = ["tempt", "fang", "coil", "fang"];
