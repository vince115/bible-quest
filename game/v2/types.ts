// Bible Quest v2 battle model (energy-card version). Independent of the v1 engine in game/engine.ts.
// Scripture cards are energy; characters act through skills paid with that energy.

/** Playable characters. The *P ids are the enemy cards' playable versions (a card can be drawn and fielded by the player). */
export type CharacterId = "david" | "samuel" | "jonathan" | "adam" | "eve" | "cain" | "abel" | "noah" | "abraham" | "isaac" | "jacob" | "joseph" | "moses" | "aaron" | "miriam" | "mosesSinai" | "joshua" | "rahab" | "deborah" | "gideon" | "archerP" | "bearerP" | "goliathP" | "serpentP";

/** ✨ Faith can stand in for Attack or Guard; Faith and 🕊️ Guard carry over, 🗡️ Attack resets each turn. */
export type EnergyKind = "faith" | "attack" | "guard";

export type SkillId =
  | "sling" | "slingStone" | "rebuke" | "heal" | "arise" | "sword" | "covshield" | "till" | "keep" | "mother" | "helper" | "offering" | "mark" | "firstlings" | "faithOffering" | "ark" | "rainbow" | "stars" | "provide" | "harvest" | "ram" | "wrestle" | "ladder" | "granary" | "meantForGood" | "sea" | "handsUp" | "blessing" | "breastplate" | "timbrel" | "song" | "tenWords" | "faceShone" | "courage" | "jericho" | "hideSpies" | "scarletCord" | "upToday" | "starsFought" | "fleece" | "torches"
  | "volley" | "shieldUp" | "bash" | "spearThrust" | "taunt" | "venom" | "beguile";

export type CardId =
  // ✨ Faith
  | "delivered"
  | "battle"
  | "trust"
  | "assurance"
  // 🗡️ Attack
  | "inname"
  | "trains"
  | "stones"
  // 🕊️ Guard
  | "wings"
  | "shepherd"
  | "renewed"
  | "bestrong"
  | "covenant";

/**
 * Elements (reserved, switched off by RULES_V2.elements.enabled):
 * 💧 water → 🔥 fire → 🌿 wood → 💧 water, and ✨ light ⇄ 🌑 dark (they counter each other).
 * Any side may use any element (PvP opponents can field dark cards); enemies simply tend to be dark.
 */
export type Element = "metal" | "wood" | "water" | "fire" | "earth" | "light" | "dark";

/** The enemy line-up: Goliath, his shield bearer (1 Sam 17:7) and a Philistine archer. */
export type EnemyId = "bearer" | "goliath" | "archer" | "serpent";

/** Which battle is being fought: Goliath with his shield bearer and archer, or the Serpent of Eden alone. */
export type StageId = "goliath" | "eden";

/** Who an effect must be aimed at, chosen by the player before it resolves. */
/** actedAlly: an ally who has already acted this turn (Eve's Helper lets them act again). */
/** anyEnemy: any standing enemy, ignoring the shield bearer's protection (the archer's Volley). */
export type TargetKind = "none" | "ally" | "fallenAlly" | "actedAlly" | "enemy" | "anyEnemy";

export interface SkillDef {
  id: SkillId;
  owner: CharacterId;
  /** Paid with this energy kind (Faith can stand in for Attack/Guard; Sling Stone needs real Faith). */
  kind: EnergyKind;
  cost: number;
  damage?: number;
}

export interface CardDef {
  id: CardId;
  energy: EnergyKind;
}

export interface CardInstance {
  uid: number;
  card: CardId;
}

export type EnergyPool = Record<EnergyKind, number>;

export interface CharacterState {
  hp: number;
  shield: number;
  shaken: boolean;
  /** Used a skill this turn (one per turn). */
  acted: boolean;
}

/** The boss's actions: Goliath's, then the Serpent's (tempt, fang, coil). */
export type GoliathActionId = "defy" | "spear" | "raise" | "crush" | "swing" | "tempt" | "fang" | "coil";

export interface Intent {
  action: GoliathActionId;
  /** Single target (Spear Thrust, Crushing Blow) or the allies Defy the Armies will shake. */
  targets: CharacterId[];
}

export interface EnemyState {
  hp: number;
}

/** Goliath's own status; his HP lives in `enemies.goliath`. */
export interface GoliathState {
  /** After the first Sling Stone Goliath switches to his phase 2 cycle. */
  enraged: boolean;
  charging: boolean;
  stunned: boolean;
  /** Index of the current intent within the phase cycle. */
  cycle: number;
}

export interface LogEntry {
  id: number;
  turn: number;
  key: string;
  params?: Record<string, string | number | boolean | undefined>;
  kind: "player" | "enemy" | "system" | "detail";
}

export type BattleResult = "ongoing" | "victory" | "defeat";

export interface BattleState {
  turn: number;
  energy: EnergyPool;
  party: Record<CharacterId, CharacterState>;
  enemies: Record<EnemyId, EnemyState>;
  /** The boss's status (Goliath, or the Serpent in Eden); the name is kept from stage 1. */
  goliath: GoliathState;
  stage: StageId;
  /** The ally the Serpent coiled around: they can't be swapped out of the front line this turn. */
  coiled: CharacterId | null;
  /** Goliath's [current intent, next intent]; both are always shown. */
  intents: [Intent, Intent];
  /** Who the archer will shoot this turn. */
  archerTarget: CharacterId | null;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  /** Arise can be used once per battle. */
  ariseUsed: boolean;
  /** Eve's Helper can be used once per battle. */
  helperUsed: boolean;
  /** The Serpent card's Beguile can be used once per battle. */
  beguileUsed: boolean;
  /** Cain's Mark can be used once per battle; marked: it holds through this turn's enemy phase. */
  markUsed: boolean;
  marked: boolean;
  /** Noah's Rainbow Covenant can be used once per battle. */
  rainbowUsed: boolean;
  /** Abraham's The LORD Will Provide can be used once per battle. */
  provideUsed: boolean;
  /** Isaac's Ram in the Thicket can be used once per battle; ramReady: it spares the next ally who would fall this turn. */
  ramUsed: boolean;
  ramReady: boolean;
  /** Jacob's Ladder can be used once per battle. */
  ladderUsed: boolean;
  /** Joseph's God Meant It for Good can be used once per battle. */
  goodUsed: boolean;
  /** Moses: Part the Red Sea once per battle; handsUp: his raised hands strengthen every attack this turn. */
  seaUsed: boolean;
  handsUp: boolean;
  /** Aaron's Breastplate: the enemy leader's damage is halved this turn. */
  breastplate: boolean;
  /** Moses at Sinai: His Face Shone can be used once per battle. */
  shoneUsed: boolean;
  /** Joshua's Jericho Falls can be used once per battle. */
  jerichoUsed: boolean;
  /** Rahab's Scarlet Cord can be used once per battle; cordReady: no ally can fall this turn. */
  cordUsed: boolean;
  cordReady: boolean;
  /** Deborah's Stars Fought from Heaven can be used once per battle. */
  starsFoughtUsed: boolean;
  /** Gideon's Torches and Pitchers can be used once per battle. */
  torchesUsed: boolean;
  /** The characters in this battle; everyone else sits it out (HP 0, never targeted). */
  lineup: CharacterId[];
  log: LogEntry[];
  seq: number;
  result: BattleResult;
}
