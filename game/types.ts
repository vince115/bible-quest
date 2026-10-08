export type CharacterId = "david" | "samuel" | "jonathan";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  role: string;
  maxHp: number;
  attack: number;
  skill: {
    name: string;
    cost: number;
    description: string;
  };
}

export interface CharacterState {
  id: CharacterId;
  hp: number;
  fear: number;
  shield: number;
  skillUsed: boolean;
}

export interface CardEffect {
  faith?: number;
  courage?: number;
  /** Remove N Fear from every living ally ("all" clears it). */
  removeFearAll?: number | "all";
  removeDavidFear?: boolean;
  shieldAll?: number;
  healLowest?: number;
  damage?: number;
  energy?: number;
  draw?: number;
}

export interface CardDef {
  id: string;
  reference: string;
  name: string;
  cost: number;
  text: string;
  effect: CardEffect;
}

export type GoliathActionId =
  | "defy"
  | "spear"
  | "taunt"
  | "roar"
  | "swing"
  | "crush";

export interface GoliathAction {
  id: GoliathActionId;
  name: string;
  description: string;
  fearAll?: number;
  damageAll?: number;
  /** Single-target attack; target is chosen when the intent is revealed. */
  damageOne?: number;
  /** Fear applied to the single target. */
  fearOne?: number;
  /** Prefer David as the single target while he stands. */
  targetsDavid?: boolean;
}

export interface Intent {
  actionId: GoliathActionId;
  targetId?: CharacterId;
}

export interface GoliathState {
  hp: number;
  armored: boolean;
  staggered: boolean;
  patternIndex: number;
}

export type BattleResult = "ongoing" | "victory" | "defeat";

export type FxTarget = CharacterId | "goliath";

export interface Fx {
  id: number;
  target: FxTarget;
  text: string;
  kind: "damage" | "heal" | "fear" | "shield" | "buff" | "miss";
}

export interface LogEntry {
  id: number;
  turn: number;
  text: string;
  kind: "player" | "ally" | "enemy" | "system";
}

export interface BattleState {
  turn: number;
  energy: number;
  courage: number;
  faith: number;
  slingStoneUsed: boolean;
  goliath: GoliathState;
  intent: Intent | null;
  party: Record<CharacterId, CharacterState>;
  drawPile: string[];
  hand: string[];
  discard: string[];
  log: LogEntry[];
  fx: Fx[];
  seq: number;
  result: BattleResult;
}
