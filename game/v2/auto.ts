// Auto-battle: picks the player's next action from the current state, one step at a time.
// Heuristic, not optimal: it saves Faith for Sling Stone and answers Goliath's telegraphed threats.
import { CARDS_V2, PARTY_ORDER, SKILLS } from "./data";
import { attackableEnemies, enemyAlive, isAlive, payment, skillBlockReason, skillDamage, type Target } from "./engine";
import type { BattleState, CharacterId, EnemyId, SkillId } from "./types";

export type AutoAction =
  | { type: "play"; uid: number }
  | { type: "cast"; skill: SkillId; target?: Target }
  | { type: "end" };

/** Faith is only worth spending in place of 🗡️/🕊️ when David can't throw Sling Stone anyway, or it would overflow. */
function faithIsFree(s: BattleState): boolean {
  return !isAlive(s, "david") || s.energy.faith >= 6;
}

function canCast(s: BattleState, skill: SkillId, target?: Target): boolean {
  if (skillBlockReason(s, skill, target) !== null) return false;
  const pay = payment(s, skill)!;
  return SKILLS[skill].kind === "faith" || pay.faith === 0 || faithIsFree(s);
}

/** Does Goliath (or the archer) threaten real damage or Shaken this turn? */
function underThreat(s: BattleState): boolean {
  const { action, targets } = s.intents[0];
  if (s.goliath.stunned) return false;
  if (action === "swing") return true;
  if (action === "crush" && s.goliath.charging) return true;
  if (action === "defy") return targets.some((id) => isAlive(s, id) && s.party[id].shield === 0);
  return false;
}

function attackTarget(s: BattleState, skill: SkillId): EnemyId | undefined {
  const options = attackableEnemies(s);
  const dmg = skillDamage(s, skill, "archer");
  // Finish the archer if this hit kills it; otherwise break the shield bearer, then go for Goliath.
  if (options.includes("archer") && s.enemies.archer.hp <= dmg) return "archer";
  if (options.includes("bearer")) return "bearer";
  if (options.includes("goliath")) return "goliath";
  return options[0];
}

export function nextAutoAction(s: BattleState): AutoAction {
  if (s.result !== "ongoing") return { type: "end" };

  // 1. Turn every card into energy (Faith first, so the Sling Stone check sees it).
  const order = ["faith", "guard", "attack"];
  const card = [...s.hand].sort((a, b) => order.indexOf(CARDS_V2[a.card].energy) - order.indexOf(CARDS_V2[b.card].energy))[0];
  if (card) return { type: "play", uid: card.uid };

  // 2. The climax.
  if (canCast(s, "slingStone")) return { type: "cast", skill: "slingStone" };

  // 3. Bring back the fallen (David first).
  const fallen = PARTY_ORDER.filter((id) => !isAlive(s, id));
  if (fallen.length) {
    const target: CharacterId = fallen.includes("david") ? "david" : fallen[0];
    if (canCast(s, "arise", target)) return { type: "cast", skill: "arise", target };
  }

  // 4. Answer the telegraphed threat.
  if (underThreat(s) && canCast(s, "covshield")) return { type: "cast", skill: "covshield" };

  // 5. Heal whoever is in danger.
  const low = PARTY_ORDER.filter((id) => isAlive(s, id) && s.party[id].hp <= 6).sort((a, b) => s.party[a].hp - s.party[b].hp)[0];
  if (low && canCast(s, "heal", low)) return { type: "cast", skill: "heal", target: low };

  // 6. Attack with whatever 🗡️ is left.
  for (const skill of ["sling", "sword", "rebuke"] as SkillId[]) {
    const target = attackTarget(s, skill);
    if (target && enemyAlive(s, target) && canCast(s, skill, target)) return { type: "cast", skill, target };
  }

  return { type: "end" };
}
