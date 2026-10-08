// Bible Quest v3 board rules: the v2 battle plus a chosen line-up and a front line.
// - Bring 1–3 characters. Characters left behind sit out the whole battle (HP 0, can't be revived).
// - A lone champion duels Goliath one-on-one (1 Sam 17): the shield bearer and the archer stand aside.
// - Spear Thrust, Crushing Blow and the archer's arrow hit the front line; Swing still hits everyone.
// - Once per turn the front line may be swapped for free. When the front line falls, the player picks
//   who steps up (also free) before doing anything else.
// Everything else is the v2 engine, unchanged.
import { PARTY_ORDER } from "../v2/data";
import {
  castSkill,
  createBattle,
  enemyAlive,
  isAlive,
  playCard,
  resolveGoliath,
  skillBlockReason,
  skillTargets,
  startNextTurn,
  type Rng,
  type Target,
} from "../v2/engine";
import type { BattleState, CharacterId, SkillId } from "../v2/types";

export interface Board {
  battle: BattleState;
  /** Who came to battle, in party order. */
  lineup: CharacterId[];
  front: CharacterId;
  /** The free swap has been used this turn. */
  swapped: boolean;
}

const clone = (b: Board): Board => structuredClone(b);

function log(s: BattleState, key: string, params?: Record<string, string>) {
  s.log.push({ id: ++s.seq, turn: s.turn, key, params, kind: "player" });
}

/** Living members of the line-up. */
export const standing = (b: Board) => b.lineup.filter((id) => isAlive(b.battle, id));

/** One character against Goliath alone. */
export const isDuel = (b: Board) => b.lineup.length === 1;

/** The front line has fallen and someone must step up before anything else happens. */
export const needsFront = (b: Board) => b.battle.result === "ongoing" && !isAlive(b.battle, b.front) && standing(b).length > 0;

export function createBoard(lineup: CharacterId[], front: CharacterId = lineup[0], rng: Rng = Math.random): Board {
  const chosen = PARTY_ORDER.filter((id) => lineup.includes(id));
  if (!chosen.length) throw new Error("line-up needs at least one character");
  const battle = createBattle(rng);
  for (const id of PARTY_ORDER) {
    if (!chosen.includes(id)) battle.party[id].hp = 0;
  }
  if (chosen.length === 1) {
    battle.enemies.bearer.hp = 0;
    battle.enemies.archer.hp = 0;
    log(battle, "v3.log.duel", { char: chosen[0] });
  }
  const board: Board = { battle, lineup: chosen, front: chosen.includes(front) ? front : chosen[0], swapped: false };
  return aim(board, rng);
}

/** Can `id` be moved to the front line right now? (A fallen front line is replaced for free.) */
export function canSwap(b: Board, id: CharacterId): boolean {
  if (b.battle.result !== "ongoing" || id === b.front || !b.lineup.includes(id) || !isAlive(b.battle, id)) return false;
  return needsFront(b) || !b.swapped;
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
 * Points the enemies at the front line: single-target hits and the arrow go to the front line,
 * and Defy re-picks its targets if any of them has left the battle.
 */
function aim(b: Board, rng: Rng): Board {
  const s = b.battle;
  const front = isAlive(s, b.front) ? b.front : null;
  for (const intent of s.intents) {
    if (intent.action === "spear" || intent.action === "crush") intent.targets = front ? [front] : [];
    if (intent.action === "defy" && intent.targets.some((id) => !isAlive(s, id))) {
      const pool = [...standing(b)];
      intent.targets = [];
      while (pool.length && intent.targets.length < 2) intent.targets.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
  }
  s.archerTarget = enemyAlive(s, "archer") && front ? front : null;
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

export function playCardOnBoard(board: Board, uid: number): Board {
  const battle = playCard(board.battle, uid);
  return battle === board.battle ? board : { ...board, battle };
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
  const battle = startNextTurn(board.battle, rng);
  if (battle === board.battle) return board;
  return aim({ ...board, battle, swapped: false }, rng);
}

/** Convenience for tests and simulations. */
export function endBoardTurn(board: Board, rng: Rng = Math.random): Board {
  const resolved = resolveBoard(board, rng);
  return resolved === board ? board : startNextBoardTurn(resolved, rng);
}
