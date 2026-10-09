// Auto-battle: picks the player's next action from the current state, one step at a time.
// Heuristic, not optimal: it saves Faith for Sling Stone and answers Goliath's telegraphed threats.
import { CARDS_V2, CHARACTER_SKILLS, ENEMY_ORDER, MAX_HP, RULES_V2 as R, SKILLS } from "./data";
import { attackableEnemies, enemyAlive, goodDamage, isAlive, payment, skillBlockReason, skillDamage, type Target } from "./engine";
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
  if (action === "defy" || action === "tempt") return targets.some((id) => isAlive(s, id) && s.party[id].shield === 0);
  if (action === "fang" || action === "coil") return true;
  return false;
}

/** Will an enemy hit Cain this turn (so his Mark strikes back)? */
function cainTargeted(s: BattleState): boolean {
  if (!isAlive(s, "cain")) return false;
  if (s.archerTarget === "cain" && enemyAlive(s, "archer")) return true;
  if (s.goliath.stunned) return false;
  const { action, targets } = s.intents[0];
  if (action === "swing" || action === "coil") return true;
  if (action === "crush" && !s.goliath.charging) return false;
  return (action === "spear" || action === "crush" || action === "fang") && targets.includes("cain");
}

function attackTarget(s: BattleState, skill: SkillId): EnemyId | undefined {
  const options = attackableEnemies(s);
  const dmg = skillDamage(s, skill, "archer");
  // Finish the archer if this hit kills it; otherwise break the shield bearer, then go for Goliath.
  if (options.includes("archer") && s.enemies.archer.hp <= dmg) return "archer";
  if (options.includes("bearer")) return "bearer";
  if (options.includes("goliath")) return "goliath";
  if (options.includes("serpent")) return "serpent";
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

  // 2b. Moses parts the Red Sea over every enemy; raises his hands when the others still have Attack to spend.
  if (canCast(s, "sea")) return { type: "cast", skill: "sea" };
  if (canCast(s, "jericho")) return { type: "cast", skill: "jericho" };
  if (canCast(s, "starsFought")) return { type: "cast", skill: "starsFought" };
  if (underThreat(s) && canCast(s, "torches")) return { type: "cast", skill: "torches" };
  // Deborah rouses the others when someone still has an attack to make.
  const ready = s.lineup.filter((id) => id !== "deborah" && isAlive(s, id) && !s.party[id].acted && !s.party[id].shaken && CHARACTER_SKILLS[id].some((k) => SKILLS[k].kind === "attack")).length;
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "upToday")) return { type: "cast", skill: "upToday" };
  const strikers = s.lineup.filter((id) => id !== "moses" && isAlive(s, id) && !s.party[id].acted && CHARACTER_SKILLS[id].some((k) => SKILLS[k].kind === "attack")).length;
  if (!s.handsUp && strikers >= 1 && s.energy.attack >= 2 && canCast(s, "handsUp")) return { type: "cast", skill: "handsUp" };

  // 3. Bring back the fallen (David first).
  const fallen = s.lineup.filter((id) => !isAlive(s, id));
  if (fallen.length) {
    const target: CharacterId = fallen.includes("david") ? "david" : fallen[0];
    if (canCast(s, "arise", target)) return { type: "cast", skill: "arise", target };
  }


  // 4. Answer the telegraphed threat.
  if (underThreat(s) && canCast(s, "covshield")) return { type: "cast", skill: "covshield" };
  if (underThreat(s) && canCast(s, "keep")) return { type: "cast", skill: "keep" };
  if (underThreat(s) && canCast(s, "ark")) return { type: "cast", skill: "ark" };
  if (underThreat(s) && !s.breastplate && canCast(s, "breastplate")) return { type: "cast", skill: "breastplate" };
  if (underThreat(s) && canCast(s, "faceShone")) return { type: "cast", skill: "faceShone" };
  if (underThreat(s) && canCast(s, "tenWords")) return { type: "cast", skill: "tenWords" };
  if (cainTargeted(s) && canCast(s, "mark")) return { type: "cast", skill: "mark" };
  // Isaac's Ram when a real blow is coming and someone is low enough to fall.
  if (underThreat(s) && s.lineup.some((id) => isAlive(s, id) && s.party[id].hp <= 60) && canCast(s, "ram")) return { type: "cast", skill: "ram" };
  if (underThreat(s) && s.lineup.filter((id) => isAlive(s, id) && s.party[id].hp <= 60).length >= 2 && canCast(s, "scarletCord")) return { type: "cast", skill: "scarletCord" };
  if (underThreat(s)) {
    const exposed = s.lineup.filter((id) => isAlive(s, id) && s.party[id].shield === 0).sort((a, b) => s.party[a].hp - s.party[b].hp)[0];
    if (exposed && canCast(s, "hideSpies", exposed)) return { type: "cast", skill: "hideSpies", target: exposed };
  }
  if (underThreat(s) && canCast(s, "beguile")) return { type: "cast", skill: "beguile" };
  if (underThreat(s)) {
    const cover = s.lineup.filter((id) => isAlive(s, id) && s.party[id].shield === 0).sort((a, b) => s.party[a].hp - s.party[b].hp)[0];
    if (cover && canCast(s, "shieldUp", cover)) return { type: "cast", skill: "shieldUp", target: cover };
  }

  // Defiance (and Miriam's timbrel) when two or more enemies stand.
  if (attackableEnemies(s).length + (enemyAlive(s, "goliath") && enemyAlive(s, "bearer") ? 1 : 0) >= 2 && canCast(s, "taunt")) return { type: "cast", skill: "taunt" };
  if (ENEMY_ORDER.filter((id) => enemyAlive(s, id)).length >= 2 && canCast(s, "timbrel")) return { type: "cast", skill: "timbrel" };

  // 4b. Eve's Mother of All Living when two or more allies are hurt enough to use the full heal.
  const hurt = s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.motherHeal);
  const shaken = s.lineup.filter((id) => isAlive(s, id) && s.party[id].shaken && !s.party[id].acted);
  if ((hurt.length >= 2 || shaken.length >= 1) && canCast(s, "mother")) return { type: "cast", skill: "mother" };
  // Noah's Rainbow Covenant (once per battle) when two or more allies would use the full heal.
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.rainbowHeal).length >= 2 && canCast(s, "rainbow")) return { type: "cast", skill: "rainbow" };

  // 5. Heal whoever is in danger.
  const low = s.lineup.filter((id) => isAlive(s, id) && s.party[id].hp <= 6).sort((a, b) => s.party[a].hp - s.party[b].hp)[0];
  if (low && canCast(s, "heal", low)) return { type: "cast", skill: "heal", target: low };

  // 4b2. Joseph: Storehouses when two allies are hurt or a blow is coming; God Meant It for Good once it hits hard.
  if (canCast(s, "meantForGood") && goodDamage(s) >= 60) return { type: "cast", skill: "meantForGood" };
  if ((underThreat(s) || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.granaryHeal).length >= 2) && canCast(s, "granary")) return { type: "cast", skill: "granary" };

  // 4c. Abraham: The LORD Will Provide as soon as it's affordable; Look Toward Heaven while Faith has room.
  if (canCast(s, "provide")) return { type: "cast", skill: "provide" };
  if (s.energy.faith <= R.maxFaith - R.starsFaith && canCast(s, "stars")) return { type: "cast", skill: "stars" };
  if (s.energy.faith < R.maxFaith && canCast(s, "fleece")) return { type: "cast", skill: "fleece" };
  // Miriam sings when someone is Shaken or Faith has room for the full gift.
  if ((shaken.length >= 1 || s.energy.faith <= R.maxFaith - R.songFaith) && canCast(s, "song")) return { type: "cast", skill: "song" };

  // 5a. Abel's Firstlings of the Flock on whoever has lost the most, once the full heal fits.
  const sore = s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.firstlingsHeal).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (sore && canCast(s, "firstlings", sore)) return { type: "cast", skill: "firstlings", target: sore };
  const worn = s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.blessingHeal).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (worn && canCast(s, "blessing", worn)) return { type: "cast", skill: "blessing", target: worn };

  // 5b. Eve's Helper: an ally who has already acted strikes again if there is energy for it (David first).
  const again = (["david", "jonathan", "adam", "cain", "samuel"] as CharacterId[]).find(
    (id) => canCast(s, "helper", id) && CHARACTER_SKILLS[id].some((k) => SKILLS[k].damage && (k === "slingStone" ? s.energy.faith >= SKILLS.slingStone.cost : s.energy.attack > 0)),
  );
  if (again) return { type: "cast", skill: "helper", target: again };
  // Jacob's Ladder once two allies have acted and there is still Attack to spend.
  const acted = s.lineup.filter((id) => id !== "jacob" && isAlive(s, id) && s.party[id].acted).length;
  if (acted >= 2 && s.energy.attack >= 2 && canCast(s, "ladder")) return { type: "cast", skill: "ladder" };

  // 6. Attack with whatever 🗡️ is left.
  // The archer's Volley ignores the shield bearer: go straight for the boss.
  const boss = s.stage === "eden" ? "serpent" : "goliath";
  if (enemyAlive(s, boss) && canCast(s, "volley", boss)) return { type: "cast", skill: "volley", target: boss };
  if (enemyAlive(s, boss) && canCast(s, "courage", boss)) return { type: "cast", skill: "courage", target: boss };
  for (const skill of ["wrestle", "sling", "spearThrust", "venom", "sword", "till", "offering", "faithOffering", "harvest", "bash", "rebuke", "timbrel"] as SkillId[]) {
    const target = attackTarget(s, skill);
    if (target && enemyAlive(s, target) && canCast(s, skill, target)) return { type: "cast", skill, target };
  }

  return { type: "end" };
}
