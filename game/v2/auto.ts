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
  if (canCast(s, "templeFire")) return { type: "cast", skill: "templeFire" };
  if (canCast(s, "spreadLetter")) return { type: "cast", skill: "spreadLetter" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.blessHeal).length >= 2 && canCast(s, "blessNotCurse")) return { type: "cast", skill: "blessNotCurse" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.wellHeal).length >= 2 && canCast(s, "wellOpened")) return { type: "cast", skill: "wellOpened" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.spiceHeal).length >= 2 && canCast(s, "spicesAndGold")) return { type: "cast", skill: "spicesAndGold" };
  if (isAlive(s, "barabbas") && s.party.barabbas.hp <= MAX_HP.barabbas / 2 && canCast(s, "releasedUnto")) return { type: "cast", skill: "releasedUnto" };
  if (isAlive(s, "naaman") && s.party.naaman.hp <= MAX_HP.naaman / 2 && canCast(s, "sevenTimesJordan")) return { type: "cast", skill: "sevenTimesJordan" };
  if (isAlive(s, "ahab") && (s.party.ahab.hp <= MAX_HP.ahab / 2 || s.lineup.filter((id) => isAlive(s, id) && s.party[id].shaken).length >= 2) && canCast(s, "humbledHimself")) return { type: "cast", skill: "humbledHimself" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.heavenHeal).length >= 2 && canCast(s, "praiseKingOfHeaven")) return { type: "cast", skill: "praiseKingOfHeaven" };
  // He commits his spirit to the Father, once there are others left to carry on.
  if (s.lineup.some((id) => id !== "jesusCross" && isAlive(s, id)) && canCast(s, "commitSpirit")) return { type: "cast", skill: "commitSpirit" };
  if ((underThreat(s) || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.gloryHeal).length >= 2) && canCast(s, "gloryHighest")) return { type: "cast", skill: "gloryHighest" };
  if ((underThreat(s) || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.giftHeal).length >= 2) && canCast(s, "threeGifts")) return { type: "cast", skill: "threeGifts" };
  if (canCast(s, "prisonOpened")) return { type: "cast", skill: "prisonOpened" };
  if (canCast(s, "carmel")) return { type: "cast", skill: "carmel" };
  if (canCast(s, "greatLight")) return { type: "cast", skill: "greatLight" };
  if (canCast(s, "myLord")) return { type: "cast", skill: "myLord" };
  if (!s.thomasBelieves && canCast(s, "reachFinger")) return { type: "cast", skill: "reachFinger" };
  if (canCast(s, "starsFought")) return { type: "cast", skill: "starsFought" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.hannahSongHeal).length >= 2 && canCast(s, "hannahSong")) return { type: "cast", skill: "hannahSong" };
  if (underThreat(s) && canCast(s, "torches")) return { type: "cast", skill: "torches" };
  // Samson brings down the pillars to finish the leader, or when he is about to fall anyway.
  const bossHp = s.enemies[s.stage === "eden" ? "serpent" : "goliath"].hp;
  if ((bossHp <= skillDamage(s, "pillars", s.stage === "eden" ? "serpent" : "goliath") || (isAlive(s, "samson") && s.party.samson.hp <= 40)) && canCast(s, "pillars")) return { type: "cast", skill: "pillars" };
  if (ENEMY_ORDER.filter((id) => enemyAlive(s, id)).length >= 2 && canCast(s, "jawbone")) return { type: "cast", skill: "jawbone" };
  if (ENEMY_ORDER.filter((id) => enemyAlive(s, id)).length >= 2 && canCast(s, "nineveh")) return { type: "cast", skill: "nineveh" };
  if (ENEMY_ORDER.filter((id) => enemyAlive(s, id)).length >= 2 && canCast(s, "samaria")) return { type: "cast", skill: "samaria" };
  // Deborah rouses the others when someone still has an attack to make.
  const ready = s.lineup.filter((id) => id !== "deborah" && isAlive(s, id) && !s.party[id].acted && !s.party[id].shaken && CHARACTER_SKILLS[id].some((k) => SKILLS[k].kind === "attack")).length;
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "upToday")) return { type: "cast", skill: "upToday" };
  if ((s.lineup.some((id) => isAlive(s, id) && s.party[id].shaken) || (ready >= 1 && s.energy.attack < 2)) && canCast(s, "goUpAtOnce")) return { type: "cast", skill: "goUpAtOnce" };
  if (ready >= 1 && s.energy.attack < 2 && s.lineup.every((id) => id === "pharaoh" || !isAlive(s, id) || s.party[id].hp > 40) && canCast(s, "makeBricks")) return { type: "cast", skill: "makeBricks" };
  if (ready >= 1 && s.energy.attack < 2 && !s.lineup.some((id) => id === "moses" || id === "mosesSinai" || id === "aaron") && canCast(s, "takeTooMuch")) return { type: "cast", skill: "takeTooMuch" };
  if (s.energy.faith <= R.maxFaith - R.spoilFaith && !s.lineup.includes("joshua") && canCast(s, "hiddenSpoil")) return { type: "cast", skill: "hiddenSpoil" };
  if (s.energy.faith <= R.maxFaith - R.judgeFaith && canCast(s, "judgeThisDay")) return { type: "cast", skill: "judgeThisDay" };
  if ((underThreat(s) || (ready >= 1 && s.energy.attack < 2)) && canCast(s, "playTheMen")) return { type: "cast", skill: "playTheMen" };
  if ((underThreat(s) || s.energy.faith < R.maxFaith) && canCast(s, "wouldNotGoHome")) return { type: "cast", skill: "wouldNotGoHome" };
  if ((s.lineup.includes("philip") || (ready >= 1 && s.energy.attack < 2)) && canCast(s, "sorceries")) return { type: "cast", skill: "sorceries" };
  if (ready === 0 && s.energy.attack >= 2 && s.energy.faith <= R.maxFaith - 2 && !s.lineup.includes("peter") && canCast(s, "offeredMoney")) return { type: "cast", skill: "offeredMoney" };
  if (ready >= 1 && s.energy.attack < 2 && !s.lineup.includes("peter") && canCast(s, "pleasedJews")) return { type: "cast", skill: "pleasedJews" };
  if (s.energy.faith <= R.maxFaith - R.cyrusFaith && canCast(s, "cyrusDecree")) return { type: "cast", skill: "cyrusDecree" };
  if (underThreat(s) && canCast(s, "returnVessels")) return { type: "cast", skill: "returnVessels" };
  if ((underThreat(s) || s.energy.faith < R.maxFaith) && canCast(s, "laidFoundation")) return { type: "cast", skill: "laidFoundation" };
  if (underThreat(s) && canCast(s, "refusedToCome")) return { type: "cast", skill: "refusedToCome" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.vashtiFeastHeal).length >= 2 && canCast(s, "royalFeast")) return { type: "cast", skill: "royalFeast" };
  const fleeing = isAlive(s, "david") && s.lineup.includes("michal") ? "david" : s.lineup.filter((id) => id !== "michal" && isAlive(s, id) && (s.party[id].shaken || s.party[id].shield === 0)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (fleeing && underThreat(s) && canCast(s, "letDownWindow", fleeing)) return { type: "cast", skill: "letDownWindow", target: fleeing };
  if (s.hand.length < R.maxHand && canCast(s, "imageInBed")) return { type: "cast", skill: "imageInBed" };
  if (ready >= 1 && s.energy.attack < 2 && !s.lineup.includes("elisha") && canCast(s, "ranAfterNaaman")) return { type: "cast", skill: "ranAfterNaaman" };
  if (s.hand.length < R.maxHand && s.energy.faith < R.maxFaith && canCast(s, "twoTalents")) return { type: "cast", skill: "twoTalents" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "zealForLord")) return { type: "cast", skill: "zealForLord" };
  const daughter = s.lineup.filter((id) => id !== "canaanite" && isAlive(s, id) && (s.party[id].shaken || MAX_HP[id] - s.party[id].hp >= R.crumbsHeal)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (daughter && canCast(s, "crumbs", daughter)) return { type: "cast", skill: "crumbs", target: daughter };
  if (s.energy.faith <= R.maxFaith - R.helpMeFaith && canCast(s, "lordHelpMe")) return { type: "cast", skill: "lordHelpMe" };
  if ((underThreat(s) || s.energy.faith < R.maxFaith) && canCast(s, "keptAllThese")) return { type: "cast", skill: "keptAllThese" };
  if (ready >= 2 && s.energy.attack < 2 && canCast(s, "greatPossessions")) return { type: "cast", skill: "greatPossessions" };
  if ((s.lineup.some((id) => isAlive(s, id) && s.party[id].shaken) || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.emmausHeal).length >= 2) && canCast(s, "breakingBread")) return { type: "cast", skill: "breakingBread" };
  if (s.energy.faith <= R.maxFaith - R.burnFaith && canCast(s, "heartsBurn")) return { type: "cast", skill: "heartsBurn" };
  if (isAlive(s, "malchus") && MAX_HP.malchus - s.party.malchus.hp >= R.earHeal && canCast(s, "earHealed")) return { type: "cast", skill: "earHealed" };
  if (ready >= 1 && s.energy.attack < 2 && s.hand.length < R.maxHand && canCast(s, "lanternsTorches")) return { type: "cast", skill: "lanternsTorches" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.stripesHeal).length >= 2 && canCast(s, "washedStripes")) return { type: "cast", skill: "washedStripes" };
  if (s.energy.faith <= R.maxFaith - R.jailerFaith && canCast(s, "whatMustIDo")) return { type: "cast", skill: "whatMustIDo" };
  if (s.lineup.some((id) => isAlive(s, id) && s.party[id].shaken) && canCast(s, "ranInTold")) return { type: "cast", skill: "ranInTold" };
  if (s.energy.faith <= R.maxFaith - R.gladFaith && canCast(s, "forGladness")) return { type: "cast", skill: "forGladness" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "blewTrumpet")) return { type: "cast", skill: "blewTrumpet" };
  if ((s.lineup.some((id) => isAlive(s, id) && s.party[id].shaken) || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.newHeavenHeal).length >= 2) && canCast(s, "newHeaven")) return { type: "cast", skill: "newHeaven" };
  if (s.energy.faith <= R.maxFaith - R.patmosFaith && s.hand.length < R.maxHand && canCast(s, "inTheSpirit")) return { type: "cast", skill: "inTheSpirit" };
  if (s.lineup.some((id) => isAlive(s, id) && s.party[id].shaken) && canCast(s, "rightMind")) return { type: "cast", skill: "rightMind" };
  if (s.hand.length <= R.maxHand - R.tellDraw && canCast(s, "tellHowGreat")) return { type: "cast", skill: "tellHowGreat" };
  if (isAlive(s, "prodigal") && s.party.prodigal.hp <= MAX_HP.prodigal - R.prodigalRobeHeal && canCast(s, "bestRobe")) return { type: "cast", skill: "bestRobe" };
  if (s.energy.faith <= R.maxFaith - R.prodigalLowFaith && canCast(s, "cameToHimself")) return { type: "cast", skill: "cameToHimself" };
  if (s.energy.faith <= R.maxFaith - R.eunuchPhilipFaith && canCast(s, "readingIsaiah")) return { type: "cast", skill: "readingIsaiah" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.rejoicingHeal).length >= 2 && canCast(s, "wentRejoicing")) return { type: "cast", skill: "wentRejoicing" };
  if (!s.lineup.includes("jael") && isAlive(s, "sisera") && s.party.sisera.hp <= MAX_HP.sisera - R.siseraMilkHeal && canCast(s, "fledToTent")) return { type: "cast", skill: "fledToTent" };
  if (s.hand.length <= R.maxHand - R.privilyDraw && !s.lineup.some((id) => id === "magi" || id === "josephNaz") && canCast(s, "privilyCalled")) return { type: "cast", skill: "privilyCalled" };
  if (ready >= 2 && s.energy.attack < 2 && canCast(s, "goldenVessels")) return { type: "cast", skill: "goldenVessels" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "whomTrust")) return { type: "cast", skill: "whomTrust" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "commandCohort")) return { type: "cast", skill: "commandCohort" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "rideOut")) return { type: "cast", skill: "rideOut" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "convenientDay")) return { type: "cast", skill: "convenientDay" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "gorgeousRobe")) return { type: "cast", skill: "gorgeousRobe" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "soldPossession")) return { type: "cast", skill: "soldPossession" };
  if (s.energy.faith <= R.maxFaith - R.expedientFaith && s.lineup.every((id) => id === "caiaphas" || !isAlive(s, id) || s.party[id].hp > 60) && canCast(s, "oneManDie")) return { type: "cast", skill: "oneManDie" };
  if (s.energy.faith <= R.maxFaith - R.keptFaith && !s.lineup.includes("peter") && canCast(s, "keptBackPart")) return { type: "cast", skill: "keptBackPart" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "shareBurden")) return { type: "cast", skill: "shareBurden" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "covetVineyard")) return { type: "cast", skill: "covetVineyard" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "pieceOfSilver")) return { type: "cast", skill: "pieceOfSilver" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "kingsRing")) return { type: "cast", skill: "kingsRing" };
  if (ready >= 1 && s.energy.attack < 2 && isAlive(s, "baalProphet") && s.party.baalProphet.hp > R.cutCost + 30 && canCast(s, "cutThemselves")) return { type: "cast", skill: "cutThemselves" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "chosenChariots")) return { type: "cast", skill: "chosenChariots" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "royalCommand")) return { type: "cast", skill: "royalCommand" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "toiledAllNight")) return { type: "cast", skill: "toiledAllNight" };
  if (ready >= 1 && s.energy.attack < 2 && canCast(s, "ifThouGo")) return { type: "cast", skill: "ifThouGo" };
  const strikersLeft = s.lineup.filter((id) => id !== "matthew" && isAlive(s, id) && !s.party[id].acted && !s.party[id].shaken && CHARACTER_SKILLS[id].some((k) => SKILLS[k].kind === "attack")).length;
  if (strikersLeft >= 1 && s.energy.attack < 2 && !underThreat(s) && canCast(s, "taxBooth")) return { type: "cast", skill: "taxBooth" };
  if (s.energy.faith >= 4 && s.energy.attack < 1 && canCast(s, "setInOrder")) return { type: "cast", skill: "setInOrder" };
  if (canCast(s, "comeSee")) return { type: "cast", skill: "comeSee" };
  if (s.energy.faith < R.maxFaith && canCast(s, "philipComeSee")) return { type: "cast", skill: "philipComeSee" };
  if (s.energy.faith < R.maxFaith && s.hand.length < R.maxHand && canCast(s, "figTree")) return { type: "cast", skill: "figTree" };
  if (s.energy.faith < R.maxFaith && s.hand.length < R.maxHand && canCast(s, "aQuestion")) return { type: "cast", skill: "aQuestion" };
  if (!s.simeonWaiting && canCast(s, "waiting")) return { type: "cast", skill: "waiting" };
  // Simeon departs in peace once the others badly need it and he has done his waiting.
  // The thief goes to paradise once he is nearly spent, or when the others need it most.
  if ((s.party.thief.hp <= MAX_HP.thief / 2 || s.lineup.filter((id) => id !== "thief" && isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.paradiseHeal).length >= 2) && canCast(s, "paradise")) return { type: "cast", skill: "paradise" };
  if (s.lineup.filter((id) => id !== "simeon" && isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.nuncHeal).length >= 2 && canCast(s, "nuncDimittis")) return { type: "cast", skill: "nuncDimittis" };
  const strikers = s.lineup.filter((id) => id !== "moses" && isAlive(s, id) && !s.party[id].acted && CHARACTER_SKILLS[id].some((k) => SKILLS[k].kind === "attack")).length;
  if (!s.handsUp && strikers >= 1 && s.energy.attack >= 2 && canCast(s, "handsUp")) return { type: "cast", skill: "handsUp" };
  const followers = s.lineup.filter((id) => id !== "timothy" && isAlive(s, id) && !s.party[id].acted && CHARACTER_SKILLS[id].some((k) => SKILLS[k].kind === "attack")).length;
  if (!s.example && followers >= 1 && s.energy.attack >= 2 && canCast(s, "example")) return { type: "cast", skill: "example" };
  // Priscilla teaches the ally with the strongest attack still to make.
  const pupil = s.taught ? undefined : s.lineup.find((id) => id !== "priscilla" && isAlive(s, id) && !s.party[id].acted && !s.party[id].shaken && CHARACTER_SKILLS[id].some((k) => SKILLS[k].kind === "attack" && SKILLS[k].cost <= s.energy.attack));
  if (pupil && canCast(s, "expound", pupil)) return { type: "cast", skill: "expound", target: pupil };

  // 3. Bring back the fallen (David first).
  const fallen = s.lineup.filter((id) => !isAlive(s, id));
  if (fallen.length) {
    const target: CharacterId = fallen.includes("david") ? "david" : fallen[0];
    if (canCast(s, "arise", target)) return { type: "cast", skill: "arise", target };
    if (canCast(s, "restorer", target)) return { type: "cast", skill: "restorer", target };
    if (canCast(s, "seenTheLord", target)) return { type: "cast", skill: "seenTheLord", target };
    if (canCast(s, "receiveHim", target)) return { type: "cast", skill: "receiveHim", target };
    if (canCast(s, "lotFell", target)) return { type: "cast", skill: "lotFell", target };
    if (canCast(s, "talithaCumi", target)) return { type: "cast", skill: "talithaCumi", target };
    if (canCast(s, "itIsWell", target)) return { type: "cast", skill: "itIsWell", target };
    if (canCast(s, "dryBones")) return { type: "cast", skill: "dryBones" };
  }


  // 4. Answer the telegraphed threat.
  if (underThreat(s) && canCast(s, "covshield")) return { type: "cast", skill: "covshield" };
  if (underThreat(s) && canCast(s, "keep")) return { type: "cast", skill: "keep" };
  if (underThreat(s) && canCast(s, "ark")) return { type: "cast", skill: "ark" };
  if (underThreat(s) && !s.breastplate && canCast(s, "breastplate")) return { type: "cast", skill: "breastplate" };
  if (underThreat(s) && canCast(s, "faceShone")) return { type: "cast", skill: "faceShone" };
  if (underThreat(s) && canCast(s, "dreamWarning")) return { type: "cast", skill: "dreamWarning" };
  if (underThreat(s) && canCast(s, "walkOnWater")) return { type: "cast", skill: "walkOnWater" };
  if (underThreat(s) && canCast(s, "withYouAlway")) return { type: "cast", skill: "withYouAlway" };
  // Martha speaks her word of faith once someone is in danger of falling.
  if (s.lineup.some((id) => isAlive(s, id) && s.party[id].hp <= 60) && canCast(s, "riseAgain")) return { type: "cast", skill: "riseAgain" };
  if (underThreat(s) && s.energy.guard < 2 && canCast(s, "serving")) return { type: "cast", skill: "serving" };
  // Esther turns the leader's heaviest blows back on it.
  const heavy = !s.goliath.stunned && (["crush", "swing", "fang", "coil"] as const).some((a) => s.intents[0].action === a) && !(s.intents[0].action === "crush" && !s.goliath.charging);
  if (heavy && canCast(s, "contrary")) return { type: "cast", skill: "contrary" };
  if (isAlive(s, "job") && s.party.job.hp <= MAX_HP.job / 2 && canCast(s, "turnedCaptivity")) return { type: "cast", skill: "turnedCaptivity" };
  if (heavy && !s.contrary && !s.lionsDen && canCast(s, "fourthMan")) return { type: "cast", skill: "fourthMan" };
  if (heavy && !s.contrary && canCast(s, "lionsDen")) return { type: "cast", skill: "lionsDen" };
  if (underThreat(s) && canCast(s, "tenWords")) return { type: "cast", skill: "tenWords" };
  if (underThreat(s) && canCast(s, "chariots")) return { type: "cast", skill: "chariots" };
  if (underThreat(s) && canCast(s, "buildWall")) return { type: "cast", skill: "buildWall" };
  if (underThreat(s) && canCast(s, "armourOfGod")) return { type: "cast", skill: "armourOfGod" };
  if (underThreat(s) && canCast(s, "tentmaking")) return { type: "cast", skill: "tentmaking" };
  if (underThreat(s) && canCast(s, "garments")) return { type: "cast", skill: "garments" };
  if (underThreat(s) && canCast(s, "earnestCare")) return { type: "cast", skill: "earnestCare" };
  if (underThreat(s) && canCast(s, "nightAndDay")) return { type: "cast", skill: "nightAndDay" };
  if (underThreat(s) && s.intents[0].targets.includes("jamesAlph") && canCast(s, "quietFaith")) return { type: "cast", skill: "quietFaith" };
  // Abigail's Intercession pays off most against blows that hit several allies or the archer as well.
  if (underThreat(s) && !s.intercede && canCast(s, "intercede")) return { type: "cast", skill: "intercede" };
  if (cainTargeted(s) && canCast(s, "mark")) return { type: "cast", skill: "mark" };
  // Isaac's Ram when a real blow is coming and someone is low enough to fall.
  if (underThreat(s) && s.lineup.some((id) => isAlive(s, id) && s.party[id].hp <= 60) && canCast(s, "ram")) return { type: "cast", skill: "ram" };
  if (underThreat(s) && s.lineup.filter((id) => isAlive(s, id) && s.party[id].hp <= 60).length >= 2 && canCast(s, "scarletCord")) return { type: "cast", skill: "scarletCord" };
  // Jonah throws himself into the sea when a blow is coming and he is the sturdiest (or the fish is still waiting for him).
  if (underThreat(s) && isAlive(s, "jonah") && (s.fish === "ready" || s.lineup.every((id) => !isAlive(s, id) || s.party[id].hp <= s.party.jonah.hp)) && canCast(s, "castIntoSea")) return { type: "cast", skill: "castIntoSea" };
  // Ruth steps in front of a weaker ally the leader is aiming at.
  const aimed = s.intents[0].targets[0];
  if (underThreat(s) && aimed && aimed !== "romanSpearman" && isAlive(s, aimed) && isAlive(s, "romanSpearman") && s.party[aimed].hp < s.party.romanSpearman.hp && canCast(s, "braceSpears", aimed)) return { type: "cast", skill: "braceSpears", target: aimed };
  if (underThreat(s) && aimed && aimed !== "simonCyrene" && isAlive(s, aimed) && isAlive(s, "simonCyrene") && s.party[aimed].hp < s.party.simonCyrene.hp && canCast(s, "bearHisCross", aimed)) return { type: "cast", skill: "bearHisCross", target: aimed };
  if (underThreat(s) && aimed && aimed !== "aquila" && isAlive(s, aimed) && isAlive(s, "aquila") && s.party[aimed].hp < s.party.aquila.hp && canCast(s, "layDownNeck", aimed)) return { type: "cast", skill: "layDownNeck", target: aimed };
  if (underThreat(s) && aimed && aimed !== "ruth" && isAlive(s, aimed) && isAlive(s, "ruth") && s.party[aimed].hp < s.party.ruth.hp && canCast(s, "whither", aimed)) return { type: "cast", skill: "whither", target: aimed };
  // Boaz redeems when two allies are below half HP; shields the most exposed ally under a real threat.
  if (s.lineup.filter((id) => isAlive(s, id) && s.party[id].hp < MAX_HP[id] / 2).length >= 2 && canCast(s, "redeemer")) return { type: "cast", skill: "redeemer" };
  if (underThreat(s)) {
    const shelter = s.lineup.filter((id) => isAlive(s, id) && s.party[id].shield === 0).sort((a, b) => s.party[a].hp - s.party[b].hp)[0];
    if (shelter && canCast(s, "wings", shelter)) return { type: "cast", skill: "wings", target: shelter };
  }
  if (underThreat(s)) {
    const robed = s.lineup.filter((id) => isAlive(s, id) && s.party[id].shield === 0).sort((a, b) => s.party[a].hp - s.party[b].hp)[0];
    if (robed && canCast(s, "purpleCloth", robed)) return { type: "cast", skill: "purpleCloth", target: robed };
  }
  if (underThreat(s)) {
    const steady = s.lineup.filter((id) => isAlive(s, id) && s.party[id].shield === 0).sort((a, b) => s.party[a].hp - s.party[b].hp)[0];
    if (steady && canCast(s, "looseHim", steady)) return { type: "cast", skill: "looseHim", target: steady };
  }
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
  if ((shaken.length >= 1 || s.energy.faith < R.maxFaith) && canCast(s, "gaveThanks")) return { type: "cast", skill: "gaveThanks" };
  if ((shaken.length >= 1 || s.energy.faith < R.maxFaith) && canCast(s, "goodTidings")) return { type: "cast", skill: "goodTidings" };
  if (isAlive(s, "simonCyrene") && MAX_HP.simonCyrene - s.party.simonCyrene.hp >= R.countryHeal && canCast(s, "comingFromCountry")) return { type: "cast", skill: "comingFromCountry" };
  // The widow casts in everything once the turn's other work is done.
  if (s.energy.faith < R.maxFaith - 1 && s.energy.attack === 0 && canCast(s, "twoMites")) return { type: "cast", skill: "twoMites" };
  if (isAlive(s, "widow") && s.party.widow.hp >= 40 && s.lineup.filter((id) => id !== "widow" && isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= 20).length >= 2 && canCast(s, "allHerLiving")) return { type: "cast", skill: "allHerLiving" };
  if ((shaken.length >= 1 || s.energy.faith < R.maxFaith) && canCast(s, "forgiveThem")) return { type: "cast", skill: "forgiveThem" };
  if (s.energy.faith < R.maxFaith && canCast(s, "wouldGod")) return { type: "cast", skill: "wouldGod" };
  if (isAlive(s, "mephibosheth") && MAX_HP.mephibosheth - s.party.mephibosheth.hp >= R.tableHeal && canCast(s, "kingsTable")) return { type: "cast", skill: "kingsTable" };
  if (shaken.length >= 1 && canCast(s, "deadDog")) return { type: "cast", skill: "deadDog" };
  if (isAlive(s, "leah") && MAX_HP.leah - s.party.leah.hp >= R.afflictionHeal && canCast(s, "lookedUpon")) return { type: "cast", skill: "lookedUpon" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.flockHeal).length >= 2 && canCast(s, "wateredFlock")) return { type: "cast", skill: "wateredFlock" };
  if (s.energy.faith < R.maxFaith && canCast(s, "writingOnWall")) return { type: "cast", skill: "writingOnWall" };
  if (s.energy.faith < R.maxFaith && canCast(s, "unfeignedFaith")) return { type: "cast", skill: "unfeignedFaith" };
  if ((underThreat(s) || s.hand.length < R.maxHand) && canCast(s, "fromAChild")) return { type: "cast", skill: "fromAChild" };
  if (s.energy.faith < R.maxFaith && canCast(s, "strangerLand")) return { type: "cast", skill: "strangerLand" };
  if ((shaken.length >= 1 || s.energy.faith <= R.maxFaith - 2) && canCast(s, "trulySonOfGod")) return { type: "cast", skill: "trulySonOfGod" };
  if (s.energy.faith <= R.maxFaith - R.greaterFaith && canCast(s, "greaterThanAll")) return { type: "cast", skill: "greaterThanAll" };
  if (s.energy.faith <= R.maxFaith - R.drewFaith && canCast(s, "drewHimOut")) return { type: "cast", skill: "drewHimOut" };
  if (s.energy.faith <= R.maxFaith - 2 && canCast(s, "godHeard")) return { type: "cast", skill: "godHeard" };
  if (s.energy.faith <= R.maxFaith - R.praiseFaith && canCast(s, "nowPraise")) return { type: "cast", skill: "nowPraise" };
  if (s.energy.faith < R.maxFaith && canCast(s, "rememberOath")) return { type: "cast", skill: "rememberOath" };
  if (s.energy.faith <= R.maxFaith - R.heartsFaith && !s.lineup.includes("david") && canCast(s, "stoleHearts")) return { type: "cast", skill: "stoleHearts" };
  if (s.energy.faith < R.maxFaith && canCast(s, "rememberMe")) return { type: "cast", skill: "rememberMe" };
  if (s.energy.faith < R.maxFaith && canCast(s, "onlyBelieve")) return { type: "cast", skill: "onlyBelieve" };
  if (s.energy.faith < R.maxFaith && canCast(s, "sonOfDavid")) return { type: "cast", skill: "sonOfDavid" };
  if (s.energy.faith < R.maxFaith && canCast(s, "hisStar")) return { type: "cast", skill: "hisStar" };
  if ((shaken.length >= 1 || s.energy.faith < R.maxFaith) && canCast(s, "heardTheBook")) return { type: "cast", skill: "heardTheBook" };
  if ((shaken.length >= 1 || s.energy.faith <= R.maxFaith - R.lawFaith) && canCast(s, "readTheLaw")) return { type: "cast", skill: "readTheLaw" };
  if (s.energy.faith <= R.maxFaith - R.theirFaith && canCast(s, "theirFaith")) return { type: "cast", skill: "theirFaith" };
  if (s.energy.faith <= R.maxFaith - R.titheFaith && canCast(s, "tenthOfAll")) return { type: "cast", skill: "tenthOfAll" };
  if ((underThreat(s) || s.energy.faith < R.maxFaith) && canCast(s, "walkedWithGod")) return { type: "cast", skill: "walkedWithGod" };
  if ((underThreat(s) || s.party.job.hp <= MAX_HP.job / 2) && canCast(s, "lordGave")) return { type: "cast", skill: "lordGave" };
  if ((shaken.length >= 1 || s.energy.faith < R.maxFaith) && canCast(s, "butIfNot")) return { type: "cast", skill: "butIfNot" };
  if ((shaken.length >= 1 || underThreat(s)) && canCast(s, "scalesFell")) return { type: "cast", skill: "scalesFell" };
  if (underThreat(s) && canCast(s, "hardenedHeart")) return { type: "cast", skill: "hardenedHeart" };
  if (underThreat(s) && canCast(s, "swiftToHear")) return { type: "cast", skill: "swiftToHear" };
  if ((underThreat(s) || s.energy.faith < R.maxFaith) && canCast(s, "houseForever")) return { type: "cast", skill: "houseForever" };
  if ((underThreat(s) || s.energy.faith < R.maxFaith) && canCast(s, "watchman")) return { type: "cast", skill: "watchman" };
  const aimedAt = s.intents[0].targets[0];
  if (underThreat(s) && aimedAt && aimedAt !== "jochebed" && isAlive(s, aimedAt) && canCast(s, "arkOfBulrushes", aimedAt)) return { type: "cast", skill: "arkOfBulrushes", target: aimedAt };
  if ((underThreat(s) || shaken.length >= 1) && canCast(s, "donkeySaw")) return { type: "cast", skill: "donkeySaw" };
  if (underThreat(s) && canCast(s, "shieldWall")) return { type: "cast", skill: "shieldWall" };
  if (underThreat(s) && canCast(s, "noFault")) return { type: "cast", skill: "noFault" };
  if (underThreat(s) && canCast(s, "escapeForLife")) return { type: "cast", skill: "escapeForLife" };
  if ((underThreat(s) || shaken.length >= 1) && canCast(s, "ranToMeet")) return { type: "cast", skill: "ranToMeet" };
  if (underThreat(s) && canCast(s, "littleChamber")) return { type: "cast", skill: "littleChamber" };
  if (underThreat(s) && canCast(s, "keepSheep")) return { type: "cast", skill: "keepSheep" };
  if ((shaken.length >= 1 || underThreat(s)) && canCast(s, "wouldNotBow")) return { type: "cast", skill: "wouldNotBow" };
  if ((shaken.length >= 1 || s.energy.faith < R.maxFaith) && canCast(s, "wentInBoldly")) return { type: "cast", skill: "wentInBoldly" };
  if (s.energy.faith < R.maxFaith && canCast(s, "blessedAbove")) return { type: "cast", skill: "blessedAbove" };
  if (s.energy.faith < R.maxFaith && canCast(s, "fewDays")) return { type: "cast", skill: "fewDays" };
  if (s.energy.faith < R.maxFaith && canCast(s, "suchATime")) return { type: "cast", skill: "suchATime" };
  if (shaken.length >= 1 && canCast(s, "swordDown")) return { type: "cast", skill: "swordDown" };
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
  if (canCast(s, "fourfold")) return { type: "cast", skill: "fourfold" };
  if (s.energy.faith <= R.maxFaith - R.basketFaith && canCast(s, "giveBasket")) return { type: "cast", skill: "giveBasket" };
  if (s.energy.faith < R.maxFaith && canCast(s, "prayersAlms")) return { type: "cast", skill: "prayersAlms" };
  if (s.energy.faith < R.maxFaith && s.energy.attack === 0 && canCast(s, "belovedBrother")) return { type: "cast", skill: "belovedBrother" };
  if (s.energy.faith < R.maxFaith && s.hand.length < R.maxHand && canCast(s, "bearLetter")) return { type: "cast", skill: "bearLetter" };
  if (s.energy.faith <= R.maxFaith - R.fieldFaith && canCast(s, "soldField")) return { type: "cast", skill: "soldField" };
  if ((shaken.length >= 1 || s.energy.attack < 2) && canCast(s, "encourage")) return { type: "cast", skill: "encourage" };
  if ((shaken.length >= 1 || s.energy.faith < R.maxFaith) && canCast(s, "midnightHymns")) return { type: "cast", skill: "midnightHymns" };
  if ((underThreat(s) || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.spikenardHeal).length >= 2) && canCast(s, "spikenard")) return { type: "cast", skill: "spikenard" };
  if (s.energy.faith <= R.maxFaith - R.feetFaith && canCast(s, "atHisFeet")) return { type: "cast", skill: "atHisFeet" };
  if (s.energy.faith < R.maxFaith && canCast(s, "manyBelieved")) return { type: "cast", skill: "manyBelieved" };
  if (canCast(s, "sycamore")) return { type: "cast", skill: "sycamore" };
  if (s.energy.faith < R.maxFaith && canCast(s, "prayer")) return { type: "cast", skill: "prayer" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.johnHeal).length >= 2 && canCast(s, "nameIsJohn")) return { type: "cast", skill: "nameIsJohn" };
  if (canCast(s, "incense")) return { type: "cast", skill: "incense" };
  // Mary: the Magnificat once the leader is still strong or someone is low; Handmaid when Shaken or Faith has room.
  const lowest = Math.min(...s.lineup.filter((id) => isAlive(s, id)).map((id) => s.party[id].hp / MAX_HP[id]));
  if ((s.enemies[s.stage === "eden" ? "serpent" : "goliath"].hp >= 160 || lowest <= 0.4) && canCast(s, "magnificat")) return { type: "cast", skill: "magnificat" };
  if ((shaken.length >= 1 || s.energy.faith < R.maxFaith) && canCast(s, "handmaid")) return { type: "cast", skill: "handmaid" };
  if (s.energy.faith <= R.maxFaith - R.fastingFaith && isAlive(s, "esther") && s.party.esther.hp > 40 && canCast(s, "fasting")) return { type: "cast", skill: "fasting" };
  if (canCast(s, "wisdom")) return { type: "cast", skill: "wisdom" };
  if (isAlive(s, "elijah") && MAX_HP.elijah - s.party.elijah.hp >= R.ravensHeal && canCast(s, "ravens")) return { type: "cast", skill: "ravens" };
  // Saul's Rash Offering only when the Faith would complete a Faith skill this turn.
  const faithSkill = s.lineup.some((id) => isAlive(s, id) && !s.party[id].acted && CHARACTER_SKILLS[id].some((k) => SKILLS[k].kind === "faith" && skillBlockReason({ ...s, energy: { ...s.energy, faith: s.energy.faith + R.rashFaith } }, k) === null));
  if (faithSkill && canCast(s, "rashOffering")) return { type: "cast", skill: "rashOffering" };
  if (faithSkill && canCast(s, "departed")) return { type: "cast", skill: "departed" };
  // Judas sells out a friend only when the Faith completes a Faith skill and nobody is in danger.
  if (faithSkill && s.lineup.every((id) => !isAlive(s, id) || s.party[id].hp > 60) && canCast(s, "thirtySilver")) return { type: "cast", skill: "thirtySilver" };
  if (s.hand.length <= R.maxHand - R.gleanDraw && canCast(s, "glean")) return { type: "cast", skill: "glean" };
  if (s.hand.length <= R.maxHand - R.catchDraw && canCast(s, "greatCatch")) return { type: "cast", skill: "greatCatch" };
  if (s.hand.length <= R.maxHand - R.ladDraw && canCast(s, "aLadHere")) return { type: "cast", skill: "aLadHere" };
  if (s.hand.length <= R.maxHand - R.orderDraw && canCast(s, "inOrder")) return { type: "cast", skill: "inOrder" };
  if (s.hand.length <= R.maxHand - R.ezraDraw && canCast(s, "preparedHeart")) return { type: "cast", skill: "preparedHeart" };
  if (s.hand.length <= R.maxHand - R.signDraw && canCast(s, "hopedSign")) return { type: "cast", skill: "hopedSign" };
  if (s.hand.length < R.maxHand - 1 && canCast(s, "hardQuestions")) return { type: "cast", skill: "hardQuestions" };
  if (s.hand.length < R.maxHand && s.energy.faith < R.maxFaith && canCast(s, "almondRod")) return { type: "cast", skill: "almondRod" };
  if (s.hand.length < R.maxHand && s.energy.faith < R.maxFaith && canCast(s, "byNight")) return { type: "cast", skill: "byNight" };
  // Miriam sings when someone is Shaken or Faith has room for the full gift.
  if ((shaken.length >= 1 || s.energy.faith <= R.maxFaith - R.songFaith) && canCast(s, "song")) return { type: "cast", skill: "song" };

  // 5a. Abel's Firstlings of the Flock on whoever has lost the most, once the full heal fits.
  const sore = s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.firstlingsHeal).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (sore && canCast(s, "firstlings", sore)) return { type: "cast", skill: "firstlings", target: sore };
  const worn = s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.blessingHeal).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (worn && canCast(s, "blessing", worn)) return { type: "cast", skill: "blessing", target: worn };
  if (worn && canCast(s, "counsel", worn)) return { type: "cast", skill: "counsel", target: worn };
  if (worn && canCast(s, "carpenter", worn)) return { type: "cast", skill: "carpenter", target: worn };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.loavesHeal).length >= 2 && canCast(s, "loaves")) return { type: "cast", skill: "loaves" };
  const needy = s.lineup.filter((id) => isAlive(s, id) && (s.party[id].shaken || MAX_HP[id] - s.party[id].hp >= R.risenPeaceHeal)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (needy && canCast(s, "peaceBeUnto", needy)) return { type: "cast", skill: "peaceBeUnto", target: needy };
  if (worn && canCast(s, "mendNets", worn)) return { type: "cast", skill: "mendNets", target: worn };
  if (worn && canCast(s, "goInPeace", worn)) return { type: "cast", skill: "goInPeace", target: worn };
  if (worn && canCast(s, "almsdeeds", worn)) return { type: "cast", skill: "almsdeeds", target: worn };
  if (worn && canCast(s, "succourer", worn)) return { type: "cast", skill: "succourer", target: worn };
  const faint = s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.blessedHeal).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (faint && canCast(s, "blessedAmong", faint)) return { type: "cast", skill: "blessedAmong", target: faint };
  const spent = s.lineup.filter((id) => isAlive(s, id) && s.party[id].hp <= MAX_HP[id] * 0.4).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (spent && canCast(s, "tooHard", spent)) return { type: "cast", skill: "tooHard", target: spent };
  const pitied = s.lineup.filter((id) => id !== "pharaohDaughter" && isAlive(s, id) && (s.party[id].shaken || MAX_HP[id] - s.party[id].hp >= R.compassionHeal)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (pitied && canCast(s, "hadCompassion", pitied)) return { type: "cast", skill: "hadCompassion", target: pitied };
  const nursed = s.lineup.filter((id) => id !== "jochebed" && isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.nurseHeal).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (nursed && canCast(s, "nurseHim", nursed)) return { type: "cast", skill: "nurseHim", target: nursed };
  const served = s.lineup.filter((id) => id !== "maid" && isAlive(s, id) && (s.party[id].shaken || MAX_HP[id] - s.party[id].hp >= R.maidHeal)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (served && canCast(s, "littleMaid", served)) return { type: "cast", skill: "littleMaid", target: served };
  const honoured = s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.queenMotherHeal).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (honoured && canCast(s, "kingsMother", honoured)) return { type: "cast", skill: "kingsMother", target: honoured };
  const hungry = s.lineup.filter((id) => id !== "zarephath" && isAlive(s, id) && (s.party[id].shaken || MAX_HP[id] - s.party[id].hp >= R.cakeHeal)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (hungry && canCast(s, "littleCake", hungry)) return { type: "cast", skill: "littleCake", target: hungry };
  if ((s.energy.faith < R.maxFaith || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.mealHeal).length >= 2) && canCast(s, "mealNotSpent")) return { type: "cast", skill: "mealNotSpent" };
  const wounded = s.lineup.filter((id) => id !== "goodSamaritan" && isAlive(s, id) && (s.party[id].shaken || MAX_HP[id] - s.party[id].hp >= R.oilHeal)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (wounded && canCast(s, "oilAndWine", wounded)) return { type: "cast", skill: "oilAndWine", target: wounded };
  const lodger = s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.innHeal * R.innTurns).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (!s.inn && lodger && canCast(s, "twoPence", lodger)) return { type: "cast", skill: "twoPence", target: lodger };
  const carried = s.lineup.filter((id) => id !== "fourFriends" && isAlive(s, id) && (s.party[id].shaken || MAX_HP[id] - s.party[id].hp >= R.roofHeal)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (carried && canCast(s, "throughTheRoof", carried)) return { type: "cast", skill: "throughTheRoof", target: carried };
  const far = s.lineup.filter((id) => id !== "centurion" && isAlive(s, id) && (s.party[id].shaken || MAX_HP[id] - s.party[id].hp >= R.wordHeal)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
  if (far && canCast(s, "speakTheWord", far)) return { type: "cast", skill: "speakTheWord", target: far };
  if (needy && canCast(s, "brotherSaul", needy)) return { type: "cast", skill: "brotherSaul", target: needy };
  if (isAlive(s, "hezekiah") && MAX_HP.hezekiah - s.party.hezekiah.hp >= R.fifteenHeal && canCast(s, "fifteenYears")) return { type: "cast", skill: "fifteenYears" };
  if (worn && canCast(s, "fineLinen", worn)) return { type: "cast", skill: "fineLinen", target: worn };
  if (worn && canCast(s, "drinkMyLord", worn)) return { type: "cast", skill: "drinkMyLord", target: worn };
  if (needy && canCast(s, "spices", needy)) return { type: "cast", skill: "spices", target: needy };
  if (needy && canCast(s, "hereIsWater", needy)) return { type: "cast", skill: "hereIsWater", target: needy };
  if (needy && canCast(s, "physician", needy)) return { type: "cast", skill: "physician", target: needy };
  const nearlyGone = s.lineup.filter((id) => isAlive(s, id) && s.party[id].hp <= MAX_HP[id] * 0.35).sort((a, b) => s.party[a].hp - s.party[b].hp)[0];
  if (nearlyGone && canCast(s, "bornAgain", nearlyGone)) return { type: "cast", skill: "bornAgain", target: nearlyGone };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.provisionHeal).length >= 2 && canCast(s, "provision")) return { type: "cast", skill: "provision" };
  if ((shaken.length >= 1 || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.healWatersHeal).length >= 2) && canCast(s, "healWaters")) return { type: "cast", skill: "healWaters" };
  if ((shaken.length >= 1 || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.baptismHeal).length >= 2) && canCast(s, "baptism")) return { type: "cast", skill: "baptism" };
  if ((underThreat(s) || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.loveHeal).length >= 2) && canCast(s, "loveOneAnother")) return { type: "cast", skill: "loveOneAnother" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.feastHeal).length >= 2 && canCast(s, "feast")) return { type: "cast", skill: "feast" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.abideHeal).length >= 2 && canCast(s, "abideHouse")) return { type: "cast", skill: "abideHouse" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.wateredHeal).length >= 2 && canCast(s, "watered")) return { type: "cast", skill: "watered" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.livingHeal).length >= 2 && canCast(s, "livingWater")) return { type: "cast", skill: "livingWater" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.leapHeal).length >= 2 && canCast(s, "leaped")) return { type: "cast", skill: "leaped" };
  if ((underThreat(s) || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.camelsHeal).length >= 2) && canCast(s, "waterCamels")) return { type: "cast", skill: "waterCamels" };
  if (s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.breadHeal).length >= 2 && canCast(s, "breadAndWine")) return { type: "cast", skill: "breadAndWine" };
  if ((s.energy.faith < R.maxFaith || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.laughHeal).length >= 2) && canCast(s, "laughter")) return { type: "cast", skill: "laughter" };
  if ((shaken.length >= 1 || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.refreshHeal).length >= 2) && canCast(s, "refreshed")) return { type: "cast", skill: "refreshed" };
  if ((shaken.length >= 1 || s.lineup.filter((id) => isAlive(s, id) && MAX_HP[id] - s.party[id].hp >= R.heavensHeal).length >= 2) && canCast(s, "heavensOpened")) return { type: "cast", skill: "heavensOpened" };

  // 5b. Eve's Helper: an ally who has already acted strikes again if there is energy for it (David first).
  const again = (["david", "jonathan", "adam", "cain", "samuel"] as CharacterId[]).find(
    (id) => canCast(s, "helper", id) && CHARACTER_SKILLS[id].some((k) => SKILLS[k].damage && (k === "slingStone" ? s.energy.faith >= SKILLS.slingStone.cost : s.energy.attack > 0)),
  );
  if (again) return { type: "cast", skill: "helper", target: again };
  const again2 = (["david", "jonathan", "peter", "samson", "joshua", "adam", "cain", "samuel"] as CharacterId[]).find(
    (id) => canCast(s, "comeAndSee", id) && CHARACTER_SKILLS[id].some((k) => SKILLS[k].damage && (SKILLS[k].kind === "faith" ? s.energy.faith >= SKILLS[k].cost : s.energy.attack >= SKILLS[k].cost)),
  );
  if (again2) return { type: "cast", skill: "comeAndSee", target: again2 };
  const again3 = (["david", "samuel", "peter", "samson", "joshua", "jonathan", "paul"] as CharacterId[]).find(
    (id) => canCast(s, "speakLord", id) && CHARACTER_SKILLS[id].some((k) => SKILLS[k].damage && (SKILLS[k].kind === "faith" ? s.energy.faith >= SKILLS[k].cost : s.energy.attack >= SKILLS[k].cost)),
  );
  if (again3) return { type: "cast", skill: "speakLord", target: again3 };
  const again4 = s.lineup.find(
    (id) => canCast(s, "underAuthority", id) && CHARACTER_SKILLS[id].some((k) => SKILLS[k].damage && (SKILLS[k].kind === "faith" ? s.energy.faith - SKILLS.underAuthority.cost >= SKILLS[k].cost : s.energy.attack >= SKILLS[k].cost)),
  );
  if (again4) return { type: "cast", skill: "underAuthority", target: again4 };
  // Jacob's Ladder once two allies have acted and there is still Attack to spend.
  const acted = s.lineup.filter((id) => id !== "jacob" && isAlive(s, id) && s.party[id].acted).length;
  if (acted >= 2 && s.energy.attack >= 2 && canCast(s, "ladder")) return { type: "cast", skill: "ladder" };

  // 6. Attack with whatever 🗡️ is left.
  // The archer's Volley ignores the shield bearer: go straight for the boss.
  const boss = s.stage === "eden" ? "serpent" : "goliath";
  if (enemyAlive(s, boss) && canCast(s, "volley", boss)) return { type: "cast", skill: "volley", target: boss };
  if (enemyAlive(s, boss) && canCast(s, "courage", boss)) return { type: "cast", skill: "courage", target: boss };
  if (enemyAlive(s, boss) && canCast(s, "cavalryCharge", boss)) return { type: "cast", skill: "cavalryCharge", target: boss };
  if (enemyAlive(s, boss) && canCast(s, "aimedShot", boss)) return { type: "cast", skill: "aimedShot", target: boss };
  if (enemyAlive(s, boss) && canCast(s, "pilum", boss)) return { type: "cast", skill: "pilum", target: boss };
  if (enemyAlive(s, boss) && canCast(s, "sealedLetters", boss)) return { type: "cast", skill: "sealedLetters", target: boss };
  if (s.goliath.charging && attackableEnemies(s).includes(boss) && canCast(s, "purgeIdols", boss)) return { type: "cast", skill: "purgeIdols", target: boss };
  for (const skill of [...(s.lineup.some((id) => id === "moses" || id === "mosesSinai" || id === "aaron") ? [] : ["strangeCensers" as const]), ...(isAlive(s, "achan") && s.party.achan.hp > R.achorCost + 30 ? ["troubleOfAchor" as const] : []), ...(s.lineup.some((id) => id === "deborah" || id === "barak") ? [] : ["ironChariots" as const]), ...(isAlive(s, "absalom") ? [] : ["threeDarts" as const]), ...(isAlive(s, "herodAgrippa") && s.party.herodAgrippa.hp > R.voiceCost + 30 ? ["voiceOfGod" as const] : []), ...(isAlive(s, "uriah") && s.party.uriah.hp > R.hottestBetrayed + 30 ? ["hottestBattle" as const] : []), ...(isAlive(s, "jephthah") && s.party.jephthah.hp > R.vowCost + 30 ? ["rashVow" as const] : []), ...(isAlive(s, "herodGreat") && s.party.herodGreat.hp > R.wrothCost + 30 ? ["exceedingWroth" as const] : []), ...(s.lineup.includes("hezekiah") ? [] : ["fencedCities" as const]), "arrowVolley", "gladius", ...(s.lineup.includes("johnBaptist") ? [] : ["heldGrudge" as const]), "insurrection", "rentClothes", "cunningHunter", "fiftyMen", "captainOfHost", "sevenTimesHotter", ...(s.lineup.includes("samson") ? [] : ["whereinStrength" as const]), ...(s.lineup.some((id) => id === "esther" || id === "mordecai") ? [] : ["hamansDecree" as const]), "callOnBaal", "pursued", "atThyWord", ...(s.party.mockingThief.hp > R.railCost + 10 ? ["railedOn" as const] : []), "saveThyself", "faithWorks", "castGarment", "purgeIdols", "thouArtTheMan", "fireInBones", "thisMountain", "saintsCome", "tentPeg", "leftHanded", "drivethFuriously", "notByMight", "downTabor", "zeal", "swordOfSpirit", "centurionCommand", "drawSword", "axe", "stoneCut", "wrestle", "sling", "spearThrust", "venom", "sword", "till", "offering", "faithOffering", "harvest", "bash", "rebuke", "timbrel", "jawbone", "javelin", "nineveh", "sendMe", "swordAndTrowel", "thunder", "boanerges", "gracePower", "samaria", "stirUpGift", "tentRope", "mightyScriptures", "profitable", "nowProfitable", "pebble", "moneyBag", "twoHundredPence", "noGuile", "oneOfTwelve", "contendFaith", "withEleven"] as SkillId[]) {
    const target = attackTarget(s, skill);
    if (target && enemyAlive(s, target) && canCast(s, skill, target)) return { type: "cast", skill, target };
  }

  return { type: "end" };
}
