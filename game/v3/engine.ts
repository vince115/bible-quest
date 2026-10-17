// Bible Quest v3 board rules: the v2 battle plus a chosen line-up and a front line.
// - Bring 1–3 characters. Characters left behind sit out the whole battle (HP 0, can't be revived).
// - A lone champion duels the boss one-on-one (1 Sam 17): the stage's guard and shooter stand aside.
// - Spear Thrust, Crushing Blow and the archer's arrow hit the front line; Swing still hits everyone.
// - Once per turn the front line may be swapped for free. When the front line falls, the player picks
//   who steps up (also free) before doing anything else.
// - Energy cards are not dealt: the player draws them one at a time from the deck on the table, up to
//   openingHand draws on turn 1 and drawPerTurn on later turns (unused draws don't carry over).
// Everything else is the v2 engine, unchanged.
import { HUNT_WEAKEST, MULTI_TARGETS, NEVER_FALLS, PARTY_ORDER, PERSONAL_POOL_STAGES, RULES_V2 as R, SINGLE_TARGET } from "../v2/data";
import {
  canDraw,
  basicAttack,
  canBasicAttack,
  castSkill,
  createBattle,
  drawCard,
  enemyAlive,
  guardOf,
  shooterOf,
  isAlive,
  playCard,
  resolveGoliath,
  skillBlockReason,
  skillTargets,
  startNextTurn,
  weakestAlly,
  type Rng,
  type Target,
} from "../v2/engine";
import type { BattleState, CharacterId, EnemyId, PoolMode, SkillId, StageId } from "../v2/types";

export interface Board {
  battle: BattleState;
  /** Who came to battle, in party order. */
  lineup: CharacterId[];
  front: CharacterId;
  /** The free swap has been used this turn. */
  swapped: boolean;
  /** Cards still to be drawn from the deck this turn. */
  draws: number;
}

const clone = (b: Board): Board => structuredClone(b);

function log(s: BattleState, key: string, params?: Record<string, string>) {
  s.log.push({ id: ++s.seq, turn: s.turn, key, params, kind: "player" });
}

/** Living members of the line-up. */
export const standing = (b: Board) => b.lineup.filter((id) => isAlive(b.battle, id));

/** One character against the boss alone. */
export const isDuel = (b: Board) => b.lineup.length === 1;

/** The front line has fallen and someone must step up before anything else happens. */
export const needsFront = (b: Board) => b.battle.result === "ongoing" && !isAlive(b.battle, b.front) && standing(b).length > 0;

/** How a board plays its energy: the free digital rules by default, or the tabletop rules (cards stuck under characters). */
/** foes: free mode's own guard and shooter (see BattleState.foes). */
export function createBoard(lineup: CharacterId[], front: CharacterId = lineup[0], rng: Rng = Math.random, stage: StageId = "goliath", mode?: PoolMode, foes?: BattleState["foes"]): Board {
  const chosen = PARTY_ORDER.filter((id) => lineup.includes(id));
  if (!chosen.length) throw new Error("line-up needs at least one character");
  const battle = createBattle(rng, chosen, stage, 0, mode ?? (PERSONAL_POOL_STAGES.includes(stage) ? "personal" : "team"), foes);
  const minions = [guardOf(battle), shooterOf(battle)].filter((e) => e !== undefined);
  if (chosen.length === 1 && minions.length) {
    for (const e of minions) battle.enemies[e].hp = 0;
    battle.archerTarget = null;
    log(battle, "v3.log.duel", { char: chosen[0] });
  }
  const board: Board = { battle, lineup: chosen, front: chosen.includes(front) ? front : chosen[0], swapped: false, draws: R.openingHand };
  return aim(board, rng);
}

/**
 * The next round of a stage fought in two rounds: a new battle against the next enemies, with the same party. Everyone
 * keeps the HP they have left (a fallen ally stays down), the deck, hand and discard carry on, and the rest of the
 * battle starts fresh (Shields, energy stuck under a character, once-a-battle skills and the turn count).
 */
export function nextRoundBoard(prev: Board, stage: StageId, rng: Rng = Math.random): Board {
  const next = createBoard(prev.lineup, prev.front, rng, stage, prev.battle.pools);
  for (const id of prev.lineup) next.battle.party[id].hp = prev.battle.party[id].hp;
  next.battle.deck = prev.battle.deck;
  next.battle.hand = prev.battle.hand;
  next.battle.discard = prev.battle.discard;
  const front = isAlive(next.battle, prev.front) ? prev.front : (standing(next)[0] ?? prev.front);
  next.front = front;
  return aim(next, rng);
}

/** Can `id` be moved to the front line right now? (A fallen front line is replaced for free.) */
export function canSwap(b: Board, id: CharacterId): boolean {
  if (b.battle.result !== "ongoing" || id === b.front || !b.lineup.includes(id) || !isAlive(b.battle, id)) return false;
  if (needsFront(b)) return true;
  // The Serpent's Coil holds the front line in place this turn.
  return !b.swapped && b.battle.coiled !== b.front;
}

export function swapFront(board: Board, id: CharacterId, rng: Rng = Math.random): Board {
  if (!canSwap(board, id)) return board;
  const b = clone(board);
  const promote = needsFront(b);
  b.front = id;
  if (!promote) b.swapped = true;
  log(b.battle, promote ? "v3.log.promote" : "v3.log.swap", { char: id });
  return aim(b, rng);
}

/**
 * Points the enemies at the front line: single-target hits and the arrow go to the front line, the lions' Maul
 * hunts the weakest ally wherever they stand, and multi-target actions (Defy, Pursuit, Roar, ...) re-pick their
 * targets if any of them has left the battle.
 */
function aim(b: Board, rng: Rng): Board {
  const s = b.battle;
  // Cards that never fall can stand at the front, but the blows land on the next ally in line.
  const front = isAlive(s, b.front) && !NEVER_FALLS.has(b.front) ? b.front : (standing(b).find((id) => !NEVER_FALLS.has(id)) ?? null);
  for (const intent of s.intents) {
    if (SINGLE_TARGET.includes(intent.action)) intent.targets = front ? [front] : [];
    if (HUNT_WEAKEST.includes(intent.action)) {
      const w = weakestAlly(s);
      intent.targets = w ? [w] : [];
    }
    const many = MULTI_TARGETS[intent.action];
    if (many && intent.targets.some((id) => !isAlive(s, id))) {
      const pool = standing(b).filter((id) => !NEVER_FALLS.has(id));
      intent.targets = [];
      while (pool.length && intent.targets.length < many) intent.targets.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
  }
  const shooter = shooterOf(s);
  s.archerTarget = shooter && enemyAlive(s, shooter) && front ? front : null;
  return b;
}

/** Ally targets are limited to the line-up (nobody can be raised into a battle they never joined). */
export function boardSkillTargets(b: Board, skill: SkillId): Target[] {
  return skillTargets(b.battle, skill).filter((t) => !PARTY_ORDER.includes(t as CharacterId) || b.lineup.includes(t as CharacterId));
}

export function boardBlockReason(b: Board, skill: SkillId, target?: Target): string | null {
  if (needsFront(b)) return "v3.reason.chooseFront";
  const reason = skillBlockReason(b.battle, skill, target);
  if (reason) return reason;
  if (boardSkillTargets(b, skill).length === 0 && skillTargets(b.battle, skill).length > 0) return "v2.reason.noTarget";
  if (target !== undefined && skillTargets(b.battle, skill).length > 0 && !boardSkillTargets(b, skill).includes(target)) return "v2.reason.badTarget";
  return null;
}

/** Plays a scripture card. In the personal-pool battles `target` is the ally who receives it (the front line when left out). */
export function playCardOnBoard(board: Board, uid: number, target?: CharacterId): Board {
  const battle = playCard(board.battle, uid, board.battle.pools !== "team" ? (target ?? board.front) : undefined);
  return battle === board.battle ? board : { ...board, battle };
}

/** A card can be drawn from the deck pile now. */
export const canDrawOnBoard = (b: Board): boolean => b.draws > 0 && canDraw(b.battle);

/** Draw one card from the deck pile into the hand, using up one of this turn's draws. */
export function drawOnBoard(board: Board, rng: Rng = Math.random): Board {
  if (!canDrawOnBoard(board)) return board;
  return { ...board, battle: drawCard(board.battle, rng), draws: board.draws - 1 };
}

/** The tabletop rules' free basic attack (see the v2 engine). */
export function basicAttackOnBoard(board: Board, who: CharacterId, target: EnemyId, rng: Rng = Math.random): Board {
  if (needsFront(board) || !canBasicAttack(board.battle, who)) return board;
  const battle = basicAttack(board.battle, who, target);
  if (battle === board.battle) return board;
  return aim({ ...board, battle }, rng);
}

export function castOnBoard(board: Board, skill: SkillId, target?: Target, rng: Rng = Math.random): Board {
  if (boardBlockReason(board, skill, target) !== null) return board;
  const battle = castSkill(board.battle, skill, target, rng);
  if (battle === board.battle) return board;
  return aim({ ...board, battle }, rng);
}

/** The enemies act (aimed at the front line). The player can't end the turn while the front line is empty. */
export function resolveBoard(board: Board, rng: Rng = Math.random): Board {
  if (needsFront(board)) return board;
  const b = aim(clone(board), rng);
  return { ...b, battle: resolveGoliath(b.battle, rng) };
}

export function startNextBoardTurn(board: Board, rng: Rng = Math.random): Board {
  const battle = startNextTurn(board.battle, rng, 0);
  if (battle === board.battle) return board;
  return aim({ ...board, battle, swapped: false, draws: R.drawPerTurn }, rng);
}

/** Convenience for tests and simulations. */
export function endBoardTurn(board: Board, rng: Rng = Math.random): Board {
  const resolved = resolveBoard(board, rng);
  return resolved === board ? board : startNextBoardTurn(resolved, rng);
}
