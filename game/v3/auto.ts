// Auto-battle for the v3 board: the v2 heuristic plus front-line decisions.
import { cardsLeftToPlay, nextAutoAction as nextV2Action } from "../v2/auto";
import { MAX_HP, MULTI_TARGETS, SHOOTER_DAMAGE, SINGLE_TARGET } from "../v2/data";
import { actionBase, bossOf, enemyAlive, enemyDamage, hitsEveryone, isAlive, shooterOf } from "../v2/engine";
import type { CharacterId, EnemyId, SkillId } from "../v2/types";
import { boardBlockReason, canDrawOnBoard, canSwap, needsFront, standing, type Board } from "./engine";
import type { Target } from "../v2/engine";

export type BoardAutoAction =
  | { type: "draw" }
  | { type: "play"; uid: number; target?: CharacterId }
  | { type: "cast"; skill: SkillId; target?: Target }
  | { type: "basic"; who: CharacterId; target: EnemyId }
  | { type: "front"; id: CharacterId }
  | { type: "end" };

/** Damage `id` is about to take this turn if they stand at the front (the lions' Maul picks its own prey). */
function incoming(b: Board, id: CharacterId): number {
  const s = b.battle;
  const shooter = shooterOf(s);
  let n = shooter && enemyAlive(s, shooter) ? enemyDamage(shooter, id, SHOOTER_DAMAGE[shooter] ?? 0, s.pools) : 0;
  const { action, targets } = s.intents[0];
  if (!s.goliath.stunned) {
    const charged = (action !== "crush" && action !== "deluge") || s.goliath.charging;
    const hits = SINGLE_TARGET.includes(action) || hitsEveryone(s, action) || (!!MULTI_TARGETS[action] && targets.includes(id)) || ((action === "maul" || action === "pinnacle") && targets.includes(id));
    if (charged && hits) n += enemyDamage(bossOf(s), id, actionBase(s, action), s.pools);
  }
  return n;
}

/** Who should stand in front: whoever is left with the most HP after this turn's hits. */
function bestFront(b: Board): CharacterId {
  const left = (id: CharacterId) => b.battle.party[id].hp + b.battle.party[id].shield - incoming(b, id);
  return [...standing(b)].sort((x, y) => left(y) - left(x) || MAX_HP[y] - MAX_HP[x])[0];
}

export function nextBoardAutoAction(b: Board): BoardAutoAction {
  const s = b.battle;
  if (s.result !== "ongoing") return { type: "end" };
  if (needsFront(b)) return { type: "front", id: bestFront(b) };
  // Draw the turn's cards from the deck first.
  if (canDrawOnBoard(b)) return { type: "draw" };

  // Raise a fallen member of the line-up (the v2 AI doesn't know who sat this battle out).
  const fallen = b.lineup.filter((id) => !isAlive(s, id));
  if (!cardsLeftToPlay(s) && fallen.length) {
    const target = fallen.includes("david") ? "david" : fallen[0];
    if (boardBlockReason(b, "arise", target) === null) return { type: "cast", skill: "arise", target };
  }

  // Swap once the cards are in, before anyone acts: put the sturdiest character in harm's way.
  if (!cardsLeftToPlay(s) && !b.swapped) {
    const best = bestFront(b);
    if (best !== b.front && canSwap(b, best)) return { type: "front", id: best };
  }

  // Everything else follows the v2 AI, with Arise hidden from it.
  const action = nextV2Action({ ...s, ariseUsed: true });
  if (action.type === "cast" && boardBlockReason(b, action.skill, action.target) !== null) return { type: "end" };
  return action;
}
