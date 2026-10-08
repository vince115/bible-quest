// Bible Quest v2 battle model (energy-card version). Independent of the v1 engine in game/engine.ts.
// Scripture cards are energy; characters act through skills paid with that energy.

export type CharacterId = "david" | "samuel" | "jonathan";

/** ✨ Faith can stand in for Attack or Guard; Faith and 🕊️ Guard carry over, 🗡️ Attack resets each turn. */
export type EnergyKind = "faith" | "attack" | "guard";

export type SkillId = "sling" | "slingStone" | "rebuke" | "heal" | "arise" | "sword" | "covshield";

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
export type Element = "water" | "fire" | "wood" | "light" | "dark";

/** The enemy line-up: Goliath, his shield bearer (1 Sam 17:7) and a Philistine archer. */
export type EnemyId = "bearer" | "goliath" | "archer";

/** Who an effect must be aimed at, chosen by the player before it resolves. */
export type TargetKind = "none" | "ally" | "fallenAlly" | "enemy";

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

export type GoliathActionId = "defy" | "spear" | "raise" | "crush" | "swing";

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
  goliath: GoliathState;
  /** Goliath's [current intent, next intent]; both are always shown. */
  intents: [Intent, Intent];
  /** Who the archer will shoot this turn. */
  archerTarget: CharacterId | null;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  /** Arise can be used once per battle. */
  ariseUsed: boolean;
  log: LogEntry[];
  seq: number;
  result: BattleResult;
}
