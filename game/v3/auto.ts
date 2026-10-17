// Auto-battle for the v3 board: the v2 heuristic plus where everyone stands.
import { cardsLeftToPlay, nextAutoAction as nextV2Action } from "../v2/auto";
import { HUNT_WEAKEST, MAX_HP, MULTI_TARGETS, RULES_V2 as R, SHOOTER_DAMAGE, SINGLE_TARGET } from "../v2/data";
import { actionBase, bossOf, enemyAlive, enemyDamage, hitsEveryone, isAlive, shooterOf } from "../v2/engine";
import type { CharacterId, EnemyId, SkillId } from "../v2/types";
import { boardBlockReason, canDrawOnBoard, canMove, frontLiving, ROW, SLOTS, slotOf, type Board } from "./engine";
import type { Target } from "../v2/engine";

export type BoardAutoAction =
  | { type: "draw" }
  | { type: "play"; uid: number; target?: CharacterId }
  | { type: "cast"; skill: SkillId; target?: Target }
  | { type: "basic"; who: CharacterId; target: EnemyId }
  | { type: "move"; id: CharacterId; to: number }
  | { type: "end" };

/** Damage `id` is about to take this turn where they stand (the blows aimed at a row are named in the telegraph). */
function incoming(b: Board, id: CharacterId): number {
  const s = b.battle;
  const shooter = shooterOf(s);
  let n = shooter && enemyAlive(s, shooter) && s.archerTarget === id ? enemyDamage(shooter, id, SHOOTER_DAMAGE[shooter] ?? 0, s.pools) : 0;
  for (const [aide, aimed] of Object.entries(s.aideTargets ?? {}) as [EnemyId, CharacterId][]) {
    if (aimed === id && enemyAlive(s, aide)) n += enemyDamage(aide, id, R.aideDamage, s.pools);
  }
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
  // Draw the turn's cards from the deck first.
  if (canDrawOnBoard(b)) return { type: "draw" };

  // Raise a fallen member of the line-up (the v2 AI doesn't know who sat this battle out).
  const fallen = b.lineup.filter((id) => !isAlive(s, id));
  if (!cardsLeftToPlay(s) && fallen.length) {
    const target = fallen.includes("david") ? "david" : fallen[0];
    if (boardBlockReason(b, "arise", target) === null) return { type: "cast", skill: "arise", target };
  }

  // Move once the cards are in, before anyone acts: pull a front-row character who would fall out of harm's way. The
  // sturdiest living character behind takes their place; with nobody fit to step up, they step back into an empty place
  // when someone else is left in front to take the blows.
  if (!cardsLeftToPlay(s) && !b.swapped) {
    const front = frontLiving(b);
    const doomed = front.filter((id) => left(b, id) <= 0 && canMove(b, id));
    if (doomed.length) {
      const out = doomed[0];
      const reserve = b.slots.slice(ROW).filter((id): id is CharacterId => !!id && isAlive(s, id) && left(b, id) > 0);
      if (reserve.length) {
        const best = sturdiest(b, reserve);
        if (canMove(b, best, slotOf(b, out))) return { type: "move", id: best, to: slotOf(b, out) };
      }
      const gap = b.slots.findIndex((id, i) => i >= ROW && id === null);
      if (gap >= ROW && gap < SLOTS && front.length > 1) return { type: "move", id: out, to: gap };
    }
  }

  // Everything else follows the v2 AI, with Arise hidden from it.
  const action = nextV2Action({ ...s, ariseUsed: true });
  if (action.type === "cast" && boardBlockReason(b, action.skill, action.target) !== null) return { type: "end" };
  return action;
}
