// Bible Quest v3 board rules: the v2 battle plus a chosen line-up and a front line.
// - Bring 1–3 characters. Characters left behind sit out the whole battle (HP 0, can't be revived).
// - A lone champion duels the boss one-on-one (1 Sam 17): the stage's guard and shooter stand aside.
// - Spear Thrust, Crushing Blow and the archer's arrow hit the front line; Swing still hits everyone.
// - Formation: the front row holds two characters (fewer when fewer came), everyone else stands in the back row.
//   Single-target blows and the shooter's arrow fall on the front row, one of its members a turn (telegraphed);
//   a blow that hunts the weakest, and every blow that hits all, reach the back row too.
// - Once per turn a back-row character may swap places with a front-row one for free. When a front-row character
//   falls, the player picks who steps up (also free) before doing anything else.
// - Energy cards are not dealt: the player draws them one at a time from the deck on the table, up to
//   openingHand draws on turn 1 and drawPerTurn on later turns (unused draws don't carry over).
// Everything else is the v2 engine, unchanged.
import { HUNT_WEAKEST, MULTI_TARGETS, NEVER_FALLS, PARTY_ORDER, PERSONAL_POOL_STAGES, RULES_V2 as R, SINGLE_TARGET, STAGE_GUARD, STAGE_SHOOTER } from "../v2/data";
import {
  canDraw,
  basicAttack,
  canBasicAttack,
  castSkill,
  createBattle,
  drawCard,
  enemyAlive,
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
  /** The front row: up to FRONT_SLOTS characters (a fallen one keeps its slot until someone steps up). */
  front: CharacterId[];
  /** The free swap has been used this turn. */
  swapped: boolean;
  /** Cards still to be drawn from the deck this turn. */
  draws: number;
}

/** How many characters stand in the front row. */
export const FRONT_SLOTS = 2;

const clone = (b: Board): Board => structuredClone(b);

function log(s: BattleState, key: string, params?: Record<string, string>) {
  s.log.push({ id: ++s.seq, turn: s.turn, key, params, kind: "player" });
}

/** Living members of the line-up. */
export const standing = (b: Board) => b.lineup.filter((id) => isAlive(b.battle, id));

/** Is `id` in the front row? */
export const inFront = (b: Board, id: CharacterId) => b.front.includes(id);

/** The living members of the front row, and the back row (everyone else who came). */
export const frontLiving = (b: Board) => b.front.filter((id) => isAlive(b.battle, id));
export const backRow = (b: Board) => b.lineup.filter((id) => !b.front.includes(id));

/** The first living front-row character (where a card goes by default). */
export const leader = (b: Board): CharacterId => frontLiving(b)[0] ?? b.front[0];

/** One character against the boss alone. */
export const isDuel = (b: Board) => b.lineup.length === 1;

/** A front-row character has fallen while someone stands behind: they must step up before anything else happens. */
export const needsFront = (b: Board) =>
  b.battle.result === "ongoing" && frontLiving(b).length < Math.min(FRONT_SLOTS, standing(b).length);

/** How a board plays its energy: the free digital rules by default, or the tabletop rules (cards stuck under characters). */
export function createBoard(lineup: CharacterId[], front: CharacterId = lineup[0], rng: Rng = Math.random, stage: StageId = "goliath", mode?: PoolMode): Board {
  const chosen = PARTY_ORDER.filter((id) => lineup.includes(id));
  if (!chosen.length) throw new Error("line-up needs at least one character");
  const battle = createBattle(rng, chosen, stage, 0, mode ?? (PERSONAL_POOL_STAGES.includes(stage) ? "personal" : "team"));
  const minions = [STAGE_GUARD[stage], STAGE_SHOOTER[stage]].filter((e) => e !== undefined);
  if (chosen.length === 1 && minions.length) {
    for (const e of minions) battle.enemies[e].hp = 0;
    battle.archerTarget = null;
    log(battle, "v3.log.duel", { char: chosen[0] });
  }
  // The chosen leader and the next in party order form the front row; the rest stand behind them.
  const lead = chosen.includes(front) ? front : chosen[0];
  const row = [lead, ...chosen.filter((id) => id !== lead)].slice(0, Math.min(FRONT_SLOTS, chosen.length));
  const board: Board = { battle, lineup: chosen, front: row, swapped: false, draws: R.openingHand };
  return aim(board, rng);
}

/**
 * The next round of a stage fought in two rounds: a new battle against the next enemies, with the same party. Everyone
 * keeps the HP they have left (a fallen ally stays down), the deck, hand and discard carry on, and the rest of the
 * battle starts fresh (Shields, energy stuck under a character, once-a-battle skills and the turn count).
 */
export function nextRoundBoard(prev: Board, stage: StageId, rng: Rng = Math.random): Board {
  const next = createBoard(prev.lineup, prev.front[0], rng, stage, prev.battle.pools);
  for (const id of prev.lineup) next.battle.party[id].hp = prev.battle.party[id].hp;
  next.battle.deck = prev.battle.deck;
  next.battle.hand = prev.battle.hand;
  next.battle.discard = prev.battle.discard;
  // The formation carries over; a fallen front-row character is replaced at the start of the new round.
  next.front = [...prev.front];
  for (let i = 0; i < next.front.length; i++) {
    if (isAlive(next.battle, next.front[i])) continue;
    const sub = backRow(next).find((id) => isAlive(next.battle, id));
    if (sub) next.front[i] = sub;
  }
  return aim(next, rng);
}

/**
 * Can `id` (standing in the back row) take a place in the front row right now? A fallen front-row character is replaced
 * for free; otherwise one free swap a turn, trading places with a living front-row character (`out`, or any when left out).
 */
export function canSwap(b: Board, id: CharacterId, out?: CharacterId): boolean {
  if (b.battle.result !== "ongoing" || !b.lineup.includes(id) || b.front.includes(id) || !isAlive(b.battle, id)) return false;
  if (needsFront(b)) return true;
  if (b.swapped) return false;
  // The Serpent's Coil holds its victim in place this turn.
  const leaving = out === undefined ? frontLiving(b).filter((f) => b.battle.coiled !== f) : [out].filter((f) => frontLiving(b).includes(f) && b.battle.coiled !== f);
  return leaving.length > 0;
}

/** Steps `id` forward: into the empty place of a fallen front-row character, or in place of `out`, who falls back. */
export function swapFront(board: Board, id: CharacterId, out?: CharacterId, rng: Rng = Math.random): Board {
  if (!canSwap(board, id, out)) return board;
  const b = clone(board);
  const promote = needsFront(b);
  if (promote) {
    const gap = b.front.findIndex((f) => !isAlive(b.battle, f));
    if (gap >= 0) b.front[gap] = id;
    else b.front.push(id);
  } else {
    const leaving = out ?? frontLiving(b).filter((f) => b.battle.coiled !== f)[0];
    b.front[b.front.indexOf(leaving)] = id;
    b.swapped = true;
  }
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
  // Cards that never fall can stand in the front row, but the blows land on someone else in it (or, failing that, anyone).
  const open = (ids: CharacterId[]) => ids.filter((id) => isAlive(s, id) && !NEVER_FALLS.has(id));
  const row = open(b.front);
  const mark = row.length ? row : open(b.lineup);
  // One member of the front row takes each blow, by turn: the first blow of a turn on one, the next turn's on the other (so both are in
  // the telegraph before they happen, and who stands in front can change it).
  const pick = (offset: number) => (mark.length ? mark[(s.turn + offset) % mark.length] : null);
  s.intents.forEach((intent, i) => {
    if (SINGLE_TARGET.includes(intent.action)) {
      const t = pick(i);
      intent.targets = t ? [t] : [];
    }
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
  });
  const shooter = STAGE_SHOOTER[s.stage];
  // The arrow goes to the other member of the front row than the boss's blow this turn.
  const arrow = pick(1);
  s.archerTarget = shooter && enemyAlive(s, shooter) && arrow ? arrow : null;
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
  const battle = playCard(board.battle, uid, board.battle.pools !== "team" ? (target ?? leader(board)) : undefined);
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
