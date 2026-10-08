// Auto-battle for the v3 board: the v2 heuristic plus front-line decisions.
import { nextAutoAction as nextV2Action } from "../v2/auto";
import { MAX_HP, RULES_V2 as R } from "../v2/data";
import { enemyAlive, enemyDamage, isAlive } from "../v2/engine";
import type { CharacterId, SkillId } from "../v2/types";
import { boardBlockReason, canSwap, needsFront, standing, type Board } from "./engine";
import type { Target } from "../v2/engine";

export type BoardAutoAction =
  | { type: "play"; uid: number }
  | { type: "cast"; skill: SkillId; target?: Target }
  | { type: "front"; id: CharacterId }
  | { type: "end" };

/** Damage the front line is about to take from single-target hits this turn. */
function incoming(b: Board, id: CharacterId): number {
  const s = b.battle;
  let n = enemyAlive(s, "archer") ? enemyDamage("archer", id, R.archerDamage) : 0;
  const { action } = s.intents[0];
  if (!s.goliath.stunned) {
    if (action === "spear") n += enemyDamage("goliath", id, R.spear);
    if (action === "crush" && s.goliath.charging) n += enemyDamage("goliath", id, R.crush);
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

  // Raise a fallen member of the line-up (the v2 AI doesn't know who sat this battle out).
  const fallen = b.lineup.filter((id) => !isAlive(s, id));
  if (!s.hand.length && fallen.length) {
    const target = fallen.includes("david") ? "david" : fallen[0];
    if (boardBlockReason(b, "arise", target) === null) return { type: "cast", skill: "arise", target };
  }

  // Swap once the cards are in, before anyone acts: put the sturdiest character in harm's way.
  if (!s.hand.length && !b.swapped) {
    const best = bestFront(b);
    if (best !== b.front && canSwap(b, best)) return { type: "front", id: best };
  }

  // Everything else follows the v2 AI, with Arise hidden from it.
  const action = nextV2Action({ ...s, ariseUsed: true });
  if (action.type === "cast" && boardBlockReason(b, action.skill, action.target) !== null) return { type: "end" };
  return action;
}
