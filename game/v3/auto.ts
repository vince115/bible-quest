// Auto-battle for the v3 board: the v2 heuristic plus front-line decisions.
import { cardsLeftToPlay, nextAutoAction as nextV2Action } from "../v2/auto";
import { HUNT_WEAKEST, MAX_HP, MULTI_TARGETS, SHOOTER_DAMAGE, SINGLE_TARGET } from "../v2/data";
import { actionBase, bossOf, enemyAlive, enemyDamage, hitsEveryone, isAlive, shooterOf } from "../v2/engine";
import type { CharacterId, EnemyId, SkillId } from "../v2/types";
import { backRow, boardBlockReason, canDrawOnBoard, canSwap, frontLiving, needsFront, standing, type Board } from "./engine";
import type { Target } from "../v2/engine";

export type BoardAutoAction =
  | { type: "draw" }
  | { type: "play"; uid: number; target?: CharacterId }
  | { type: "cast"; skill: SkillId; target?: Target }
  | { type: "basic"; who: CharacterId; target: EnemyId }
  | { type: "front"; id: CharacterId; out?: CharacterId }
  | { type: "end" };

/** Damage `id` is about to take this turn where they stand (the blows aimed at the front row are named in the telegraph). */
function incoming(b: Board, id: CharacterId): number {
  const s = b.battle;
  const shooter = shooterOf(s);
  let n = shooter && enemyAlive(s, shooter) && s.archerTarget === id ? enemyDamage(shooter, id, SHOOTER_DAMAGE[shooter] ?? 0, s.pools) : 0;
  const { action, targets } = s.intents[0];
  if (!s.goliath.stunned) {
    const charged = (action !== "crush" && action !== "deluge") || s.goliath.charging;
    const aimed = (SINGLE_TARGET.includes(action) || !!MULTI_TARGETS[action] || HUNT_WEAKEST.includes(action)) && targets.includes(id);
    if (charged && (aimed || hitsEveryone(s, action))) n += enemyDamage(bossOf(s), id, actionBase(s, action), s.pools);
  }
  return n;
}

/** HP and Shield `id` would have left after this turn's hits. */
const left = (b: Board, id: CharacterId) => b.battle.party[id].hp + b.battle.party[id].shield - incoming(b, id);

/** The sturdiest of `ids`: whoever is left with the most HP after this turn's hits. */
const sturdiest = (b: Board, ids: CharacterId[]): CharacterId => [...ids].sort((x, y) => left(b, y) - left(b, x) || MAX_HP[y] - MAX_HP[x])[0];

export function nextBoardAutoAction(b: Board): BoardAutoAction {
  const s = b.battle;
  if (s.result !== "ongoing") return { type: "end" };
  if (needsFront(b)) return { type: "front", id: sturdiest(b, backRow(b).filter((id) => isAlive(s, id))) };
  // Draw the turn's cards from the deck first.
  if (canDrawOnBoard(b)) return { type: "draw" };

  // Raise a fallen member of the line-up (the v2 AI doesn't know who sat this battle out).
  const fallen = b.lineup.filter((id) => !isAlive(s, id));
  if (!cardsLeftToPlay(s) && fallen.length) {
    const target = fallen.includes("david") ? "david" : fallen[0];
    if (boardBlockReason(b, "arise", target) === null) return { type: "cast", skill: "arise", target };
  }

  // Swap once the cards are in, before anyone acts: pull a front-row character who would fall out of harm's way,
  // and step up the sturdiest one behind (who is only reached by blows that hunt or hit all).
  if (!cardsLeftToPlay(s) && !b.swapped) {
    const doomed = frontLiving(b).filter((id) => left(b, id) <= 0);
    const reserve = backRow(b).filter((id) => isAlive(s, id) && left(b, id) > 0);
    if (doomed.length && reserve.length) {
      const out = doomed[0];
      const best = sturdiest(b, reserve);
      if (canSwap(b, best, out)) return { type: "front", id: best, out };
    }
  }

  // Everything else follows the v2 AI, with Arise hidden from it.
  const action = nextV2Action({ ...s, ariseUsed: true });
  if (action.type === "cast" && boardBlockReason(b, action.skill, action.target) !== null) return { type: "end" };
  return action;
}
