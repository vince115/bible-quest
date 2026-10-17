// Bible Quest v3 board rules: the v2 battle plus a chosen line-up and a formation.
// - Bring 1–6 characters. Characters left behind sit out the whole battle (HP 0, can't be revived).
// - A lone champion duels the boss one-on-one (1 Sam 17): the stage's guard and shooter stand aside.
// - Formation: six places, a front row of three and a back row of three. The player puts each character in a place
//   (or lets them be arranged: the sturdiest in front); places can stay empty. A fallen character keeps their place.
// - Single-target blows and the shooter's arrow fall on the front row, one of its members a turn (telegraphed). When
//   nobody stands in the front row, they fall on the back row. A blow that hunts the weakest, and every blow that hits
//   all, reach the back row too.
// - The enemy stands in two rows too: the guard in front, the boss and the shooter behind, and nothing behind can be hit
//   while anyone stands in front. Against more than three allies the stage sends more of its guards (one for each ally
//   past three, up to two, at three times their HP); each strikes one member of the front row a turn (telegraphed like
//   the arrow). The boss hits 20% harder for each ally past three.
// - Once per turn one character may move to another place for free (swapping with whoever stands there).
// - Energy cards are not dealt: the player draws them one at a time from the deck on the table, up to
//   openingHand draws on turn 1 and drawPerTurn on later turns (unused draws don't carry over).
// Everything else is the v2 engine, unchanged.
import { HUNT_WEAKEST, MAX_HP, MULTI_TARGETS, NEVER_FALLS, PARTY_ORDER, PERSONAL_POOL_STAGES, ENEMY_HP, RULES_V2 as R, SINGLE_TARGET, STAGE_GUARD, STAGE_SHOOTER, SUMMONED, aidesOf } from "../v2/data";
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

/** The formation's places: 0–2 the front row and 3–5 the back row, left to right. An empty place is null. */
export type Slots = (CharacterId | null)[];

export interface Board {
  battle: BattleState;
  /** Who came to battle, in party order. */
  lineup: CharacterId[];
  /** Where everyone stands (a fallen character keeps their place). */
  slots: Slots;
  /** The free move has been used this turn. */
  swapped: boolean;
  /** Cards still to be drawn from the deck this turn. */
  draws: number;
  /** The reinforcements that joined the enemy's front row (they stay on the board when they fall). */
  aides: EnemyId[];
}

/** How many reinforcements a party of `n` meets: one for each ally past three, up to two. */
export const aideCount = (n: number) => Math.max(0, Math.min(2, n - ROW));

/** Places in a row, and in the whole formation. */
export const ROW = 3;
export const SLOTS = ROW * 2;
/** How many characters can come to battle. */
export const MAX_LINEUP = SLOTS;

const clone = (b: Board): Board => structuredClone(b);

function log(s: BattleState, key: string, params?: Record<string, string>) {
  s.log.push({ id: ++s.seq, turn: s.turn, key, params, kind: "player" });
}

const placed = (ids: Slots): CharacterId[] => ids.filter((id): id is CharacterId => id !== null);

/** Living members of the line-up. */
export const standing = (b: Board) => b.lineup.filter((id) => isAlive(b.battle, id));

/** The place `id` stands in (-1 when they did not come). */
export const slotOf = (b: Board, id: CharacterId) => b.slots.indexOf(id);
export const isFrontSlot = (i: number) => i >= 0 && i < ROW;

/** Is `id` in the front row? */
export const inFront = (b: Board, id: CharacterId) => isFrontSlot(slotOf(b, id));

/** The front row and the back row, left to right (fallen characters included). */
export const frontRow = (b: Board) => placed(b.slots.slice(0, ROW));
export const backRow = (b: Board) => placed(b.slots.slice(ROW));
/** The living members of the front row. */
export const frontLiving = (b: Board) => frontRow(b).filter((id) => isAlive(b.battle, id));

/** The first living character, the front row first (where a card goes by default). */
export const leader = (b: Board): CharacterId => [...frontRow(b), ...backRow(b)].find((id) => isAlive(b.battle, id)) ?? b.lineup[0];

/** One character against the boss alone. */
export const isDuel = (b: Board) => b.lineup.length === 1;

/** The order empty places are filled in: the middle of the front row first, then its sides, then the back row the same way. */
const FILL_ORDER = [1, 0, 2, 4, 3, 5];

/** Who should stand in front: the sturdiest first; cards that never fall go last (blows pass them by anyway). */
export const sturdyOrder = (ids: CharacterId[]) => [...ids].sort((x, y) => Number(NEVER_FALLS.has(x)) - Number(NEVER_FALLS.has(y)) || MAX_HP[y] - MAX_HP[x]);

/**
 * The formation for `lineup`: the places in `placement` that still hold a member of the line-up are kept, and everyone
 * else is arranged into the empty places, the sturdiest first and the front row first.
 */
export function arrange(lineup: CharacterId[], placement: readonly (CharacterId | null)[] = []): Slots {
  const slots: Slots = Array(SLOTS).fill(null);
  placement.slice(0, SLOTS).forEach((id, i) => {
    if (id && lineup.includes(id) && !slots.includes(id)) slots[i] = id;
  });
  for (const id of sturdyOrder(lineup.filter((x) => !slots.includes(x)))) {
    const i = FILL_ORDER.find((n) => slots[n] === null);
    if (i === undefined) break;
    slots[i] = id;
  }
  return slots;
}

/** How a board plays its energy: the free digital rules by default, or the tabletop rules (cards stuck under characters). */
export function createBoard(lineup: CharacterId[], placement?: readonly (CharacterId | null)[], rng: Rng = Math.random, stage: StageId = "goliath", mode?: PoolMode): Board {
  const chosen = PARTY_ORDER.filter((id) => lineup.includes(id)).slice(0, MAX_LINEUP);
  if (!chosen.length) throw new Error("line-up needs at least one character");
  const battle = createBattle(rng, chosen, stage, 0, mode ?? (PERSONAL_POOL_STAGES.includes(stage) ? "personal" : "team"));
  battle.rows = true;
  const minions = [STAGE_GUARD[stage], STAGE_SHOOTER[stage]].filter((e) => e !== undefined);
  if (chosen.length === 1 && minions.length) {
    for (const e of minions) battle.enemies[e].hp = 0;
    battle.archerTarget = null;
    log(battle, "v3.log.duel", { char: chosen[0] });
  }
  // A big party meets reinforcements in the enemy's front row (not where the guard is summoned, nor where there is none).
  const aides = SUMMONED.has(stage) || !STAGE_GUARD[stage] ? [] : aidesOf(stage).slice(0, aideCount(chosen.length));
  for (const e of aides) battle.enemies[e].hp = ENEMY_HP[e];
  // ...and a boss who hits harder for each ally past three.
  battle.bossBoost = (battle.bossBoost ?? 0) + R.bossBoostPerAlly * Math.max(0, chosen.length - ROW);
  const board: Board = { battle, lineup: chosen, slots: arrange(chosen, placement), swapped: false, draws: R.openingHand, aides };
  return aim(board, rng);
}

/**
 * The next round of a stage fought in two rounds: a new battle against the next enemies, with the same party in the same
 * places. Everyone keeps the HP they have left (a fallen ally stays down), the deck, hand and discard carry on, and the
 * rest of the battle starts fresh (Shields, energy stuck under a character, once-a-battle skills and the turn count).
 */
export function nextRoundBoard(prev: Board, stage: StageId, rng: Rng = Math.random): Board {
  const next = createBoard(prev.lineup, prev.slots, rng, stage, prev.battle.pools);
  for (const id of prev.lineup) next.battle.party[id].hp = prev.battle.party[id].hp;
  next.battle.deck = prev.battle.deck;
  next.battle.hand = prev.battle.hand;
  next.battle.discard = prev.battle.discard;
  return aim(next, rng);
}

/**
 * Can `id` use this turn's free move (to place `to`, when given)? The mover must be standing and not held by the Serpent's
 * Coil; whoever stands in the place they move to (living or fallen) takes their old place, unless the Coil holds them.
 */
export function canMove(b: Board, id: CharacterId, to?: number): boolean {
  const s = b.battle;
  if (s.result !== "ongoing" || b.swapped || !b.lineup.includes(id) || !isAlive(s, id) || s.coiled === id) return false;
  if (to === undefined) return true;
  if (!Number.isInteger(to) || to < 0 || to >= SLOTS || b.slots[to] === id) return false;
  const other = b.slots[to];
  return !(other && s.coiled === other);
}

/** Moves `id` to place `to` (once a turn, free); whoever stood there takes `id`'s old place. */
export function moveTo(board: Board, id: CharacterId, to: number, rng: Rng = Math.random): Board {
  if (!canMove(board, id, to)) return board;
  const b = clone(board);
  const from = slotOf(b, id);
  const other = b.slots[to];
  b.slots[to] = id;
  b.slots[from] = other;
  b.swapped = true;
  const wasFront = isFrontSlot(from);
  const nowFront = isFrontSlot(to);
  log(b.battle, wasFront === nowFront ? "v3.log.move" : nowFront ? "v3.log.toFront" : "v3.log.toBack", { char: id });
  return aim(b, rng);
}

/**
 * Points the enemies at the formation: single-target hits and the arrow go to the front row (the back row when nobody
 * stands in front), the lions' Maul hunts the weakest ally wherever they stand, and multi-target actions (Defy,
 * Pursuit, Roar, ...) re-pick their targets if any of them has left the battle.
 */
function aim(b: Board, rng: Rng): Board {
  const s = b.battle;
  // Cards that never fall can stand in a row, but the blows land on someone else in it (or, failing that, the other row).
  const open = (ids: CharacterId[]) => ids.filter((id) => isAlive(s, id) && !NEVER_FALLS.has(id));
  const front = open(frontRow(b));
  const mark = front.length ? front : open(backRow(b));
  // One member of the row takes each blow, by turn: the first blow of a turn on one, the next on the one beside them (so
  // the telegraph names who is hit before it happens, and who stands where can change it).
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
  // The arrow goes to the member of the row beside the one the boss's blow falls on this turn, and each reinforcement's
  // strike to the next one along.
  const arrow = pick(1);
  s.archerTarget = shooter && enemyAlive(s, shooter) && arrow ? arrow : null;
  s.aideTargets = {};
  b.aides.forEach((e, k) => {
    const t = pick(2 + k);
    if (enemyAlive(s, e) && t) s.aideTargets![e] = t;
  });
  return b;
}

/** Ally targets are limited to the line-up (nobody can be raised into a battle they never joined). */
export function boardSkillTargets(b: Board, skill: SkillId): Target[] {
  return skillTargets(b.battle, skill).filter((t) => !PARTY_ORDER.includes(t as CharacterId) || b.lineup.includes(t as CharacterId));
}

export function boardBlockReason(b: Board, skill: SkillId, target?: Target): string | null {
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
  if (!canBasicAttack(board.battle, who)) return board;
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

/** The enemies act (aimed at the formation). */
export function resolveBoard(board: Board, rng: Rng = Math.random): Board {
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
  return startNextBoardTurn(resolveBoard(board, rng), rng);
}
