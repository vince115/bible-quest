// Bible Quest v2 rules (energy-card version): pure functions over BattleState. Every call returns a new state.
// Cards turn into energy; characters spend energy on skills (one skill per character per turn).
import {
  CARDS_V2,
  CHARACTER_ELEMENT,
  DECK_V2,
  DEFAULT_LINEUP,
  ELEMENT_BEATS,
  ENEMY_ELEMENT,
  ENEMY_HP,
  ENEMY_ORDER,
  APOSTLES,
  MAX_HP,
  NEVER_FALLS,
  PARTY_ORDER,
  PHASE1_CYCLE,
  PHASE2_CYCLE,
  SERPENT_CYCLE,
  STAGE_BOSS,
  STAGE_ENEMIES,
  STORY,
  RULES_V2 as R,
  SKILLS,
} from "./data";
import type {
  BattleState,
  CardInstance,
  CharacterId,
  Element,
  EnemyId,
  EnergyPool,
  GoliathActionId,
  Intent,
  LogEntry,
  SkillId,
  StageId,
  TargetKind,
} from "./types";

export type Rng = () => number;

/** A skill target: an ally (Heal, Arise) or an enemy (attacks). */
export type Target = CharacterId | EnemyId;

// ---------- helpers ----------

const clone = (s: BattleState): BattleState => structuredClone(s);

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function log(s: BattleState, key: string, kind: LogEntry["kind"], params?: LogEntry["params"]) {
  s.log.push({ id: ++s.seq, turn: s.turn, key, params, kind });
}

export const isAlive = (s: BattleState, id: CharacterId) => s.party[id].hp > 0;
/** Jesus is with the team: any of his cards is standing. */
export const jesusHere = (s: BattleState) => isAlive(s, "jesus") || isAlive(s, "jesusUR") || isAlive(s, "jesusCross");
const living = (s: BattleState) => s.lineup.filter((id) => isAlive(s, id));
/** Allies the enemy can aim at: everyone standing except cards that never fall. */
export const targetable = (s: BattleState) => living(s).filter((id) => !NEVER_FALLS.has(id) && !(id === "zacchaeus" && s.inTree));
const cycleOf = (s: BattleState) => (s.stage === "eden" ? SERPENT_CYCLE : s.goliath.enraged ? PHASE2_CYCLE : PHASE1_CYCLE);
/** This stage's boss (Goliath, or the Serpent). */
export const bossOf = (s: BattleState): EnemyId => STAGE_BOSS[s.stage];
export const enemyAlive = (s: BattleState, id: EnemyId) => s.enemies[id].hp > 0;
const randomAlly = (s: BattleState, rng: Rng) => {
  const alive = targetable(s);
  return alive.length ? alive[Math.floor(rng() * alive.length)] : null;
};

/** Enemies a normal attack can hit: Goliath is protected while his shield bearer stands. */
export function attackableEnemies(s: BattleState): EnemyId[] {
  return ENEMY_ORDER.filter((id) => enemyAlive(s, id) && !(id === "goliath" && enemyAlive(s, "bearer")));
}

/** A standing, un-Shaken character who hasn't used a skill yet this turn. */
export function canAct(s: BattleState, id: CharacterId): boolean {
  const c = s.party[id];
  return isAlive(s, id) && !c.shaken && !c.acted;
}

function draw(s: BattleState, n: number, rng: Rng) {
  for (let i = 0; i < n; i++) {
    if (s.hand.length >= R.maxHand) {
      log(s, "v2.log.handFull", "system");
      return;
    }
    if (s.deck.length === 0) {
      if (s.discard.length === 0) return;
      s.deck = shuffle(s.discard, rng);
      s.discard = [];
      log(s, "v2.log.reshuffle", "system");
    }
    s.hand.push(s.deck.shift()!);
  }
}

function makeIntent(s: BattleState, action: GoliathActionId, rng: Rng): Intent {
  const alive = targetable(s);
  if (action === "spear" || action === "crush" || action === "fang" || action === "coil" || action === "tempt") {
    return { action, targets: alive.length ? [alive[Math.floor(rng() * alive.length)]] : [] };
  }
  if (action === "defy") return { action, targets: shuffle(alive, rng).slice(0, R.defyTargets) };
  return { action, targets: [] };
}

function checkVictory(s: BattleState) {
  const boss = bossOf(s);
  if (s.result === "ongoing" && s.enemies[boss].hp <= 0) {
    s.enemies[boss].hp = 0;
    s.result = "victory";
    log(s, s.stage === "eden" ? "v2.log.victoryEden" : "v2.log.victory", "system");
  }
}

function checkDefeat(s: BattleState) {
  // While Jesus lies in the tomb (or someone waits on Martha's word) the battle is not lost: they will rise.
  const waiting = s.tomb !== null || s.lazarus === "tomb" || s.dorcas === "asleep" || (s.riseAgain !== "unused" && s.riseAgain !== "ready" && s.riseAgain !== "used");
  if (s.result === "ongoing" && targetable(s).length === 0 && !waiting) {
    s.result = "defeat";
    log(s, "v2.log.defeat", "system");
  }
}

function addShield(s: BattleState, id: CharacterId, n: number) {
  if (!isAlive(s, id)) return;
  s.party[id].shield += n;
  log(s, "v2.log.shield", "detail", { char: id, n, total: s.party[id].shield });
}

function damageAlly(s: BattleState, id: CharacterId, base: number, from: EnemyId) {
  if (!isAlive(s, id) || NEVER_FALLS.has(id)) return;
  // Zacchaeus up the sycamore tree is out of reach this turn (Luke 19:4).
  if (id === "zacchaeus" && s.inTree) return;
  // Whither thou goest, I will go (Ruth 1:16): Ruth takes the blows meant for the ally she covers.
  if (s.covered === id && id !== "ruth" && isAlive(s, "ruth")) {
    log(s, "v2.log.ruthCovers", "detail", { char: id });
    return damageAlly(s, "ruth", base, from);
  }
  // It was turned to the contrary (Esther 9:1): the leader's blow falls back on the leader.
  if (s.contrary && from === bossOf(s)) {
    const e = s.enemies[from];
    const n = enemyDamage(from, id, base);
    e.hp = Math.max(0, e.hp - n);
    log(s, "v2.log.contraryHit", "player", { char: id, enemy: from, n, hp: e.hp });
    afterEnemyHit(s, from);
    return;
  }
  // My God hath shut the lions' mouths, that they have not hurt me (Daniel 6:22).
  if (s.lionsDen && from === bossOf(s) && isAlive(s, "daniel")) {
    log(s, "v2.log.lionsShut", "player", { char: id });
    return;
  }
  // Lo, I see four men loose, walking in the midst of the fire, and they have no hurt (Daniel 3:25).
  if (s.fiery) {
    log(s, "v2.log.fieryUnhurt", "player", { char: id });
    return;
  }
  // Who have for my life laid down their own necks (Romans 16:4).
  // They compel one Simon a Cyrenian... to bear his cross (Mark 15:21).
  // The spearmen hold the line: the blow meant for the ally behind them falls on the spearman.
  if (s.spearCovers === id && id !== "romanSpearman" && isAlive(s, "romanSpearman")) {
    log(s, "v2.log.spearCovers", "detail", { char: id });
    return damageAlly(s, "romanSpearman", base, from);
  }
  if (s.simonCovers === id && id !== "simonCyrene" && isAlive(s, "simonCyrene")) {
    log(s, "v2.log.simonCovers", "detail", { char: id });
    return damageAlly(s, "simonCyrene", base, from);
  }
  if (s.aquilaCovers === id && id !== "aquila" && isAlive(s, "aquila")) {
    log(s, "v2.log.aquilaCovers", "detail", { char: id });
    return damageAlly(s, "aquila", base, from);
  }
  // Cast me forth into the sea; so shall the sea be calm unto you (Jonah 1:12).
  if (s.castIntoSea && id !== "jonah" && isAlive(s, "jonah")) return damageAlly(s, "jonah", base, from);
  // Aaron bears the names of the tribes upon his heart (Exodus 28:29): the leader's blows are halved.
  const raw = s.breastplate && from === bossOf(s) ? toTens(enemyDamage(from, id, base) / 2) : enemyDamage(from, id, base);
  // Abigail turned David from shedding blood (1 Samuel 25:33): every hit is softened.
  const n = s.intercede ? Math.max(0, raw - R.intercedeBlock) : raw;
  const c = s.party[id];
  const blocked = Math.min(c.shield, n);
  c.shield -= blocked;
  let taken = Math.min(c.hp, n - blocked);
  // The ram caught in the thicket takes the place of the first ally who would fall (Genesis 22:13);
  // under Rahab's scarlet cord nobody in the house falls this turn (Joshua 2:18).
  const spared = (s.ramReady || s.cordReady) && taken === c.hp && c.hp > R.ramHp;
  if (spared) {
    if (!s.cordReady) s.ramReady = false;
    taken = c.hp - R.ramHp;
  }
  c.hp -= taken;
  log(s, "v2.log.allyDamage", "detail", { char: id, n: taken, blocked, hp: c.hp, max: MAX_HP[id] });
  if (spared) log(s, s.cordReady ? "v2.log.cordSaves" : "v2.log.ramSaves", "player", { char: id, hp: c.hp });
  if (c.hp === 0) {
    c.shaken = false;
    c.shield = 0;
    log(s, "v2.log.fallen", "system", { char: id });
    if (id === "jamesZeb" && !s.cupDrunk) {
      s.cupDrunk = true;
      log(s, "v2.log.cupDrunk", "player", { n: R.cupBonus });
    }
    // Enoch walked with God: and he was not; for God took him (Genesis 5:24).
    if (id === "enoch" && !s.enochTaken) {
      s.enochTaken = true;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.takenFaith);
      log(s, "v2.log.enochTaken", "player", { n: R.takenFaith });
      living(s).forEach((ally) => {
        const a = s.party[ally];
        const healed = Math.min(R.takenHeal, MAX_HP[ally] - a.hp);
        a.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: ally, n: healed, hp: a.hp, max: MAX_HP[ally] });
      });
    }
    // Thy brother shall rise again (John 11:23): the first ally to fall after Martha's word comes back next turn.
    if (s.riseAgain === "ready" && id !== "jesusUR" && !(id === "jonah" && s.fish === "inside")) {
      s.riseAgain = id;
      log(s, "v2.log.riseAgainWaits", "player", { char: id });
    }
    // Tabitha, arise (Acts 9:40): with Peter beside her, she will be back next turn.
    if (id === "dorcas" && s.dorcas === "ready" && isAlive(s, "peter")) {
      s.dorcas = "asleep";
      log(s, "v2.log.dorcasAsleep", "player");
    }
    // Lazarus, come forth (John 11:43): with Jesus beside him, he will be back next turn.
    if (id === "lazarus" && s.lazarus === "ready" && jesusHere(s)) {
      s.lazarus = "tomb";
      log(s, "v2.log.lazarusTomb", "player");
    }
    // He is not here: for he is risen, as he said (Matthew 28:6).
    if (id === "jesusUR" && !s.risenUsed) {
      s.risenUsed = true;
      // Laid in Joseph of Arimathea's own new tomb (Matthew 27:60): with him beside Jesus, he rises a turn sooner.
      s.tomb = s.turn + R.riseAfter - (isAlive(s, "josephArimathea") ? 1 : 0);
      log(s, "v2.log.tomb", "player");
    }
    // The LORD prepared a great fish to swallow up Jonah (Jonah 1:17): he will be back next turn.
    if (id === "jonah" && s.fish === "ready") {
      s.fish = "inside";
      log(s, "v2.log.fishSwallows", "player");
    }
    // Abel, being dead, yet speaketh (Hebrews 11:4): every ally is shielded and gains Faith.
    if (id === "abel") {
      log(s, "v2.log.speaketh", "player");
      living(s).forEach((ally) => addShield(s, ally, R.speakethShield));
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.speakethFaith);
    }
  }
  // The mark of Cain: whoever strikes him suffers vengeance (Genesis 4:15).
  if (id === "cain" && s.marked && enemyAlive(s, from)) strikeBack(s, from);
}

function strikeBack(s: BattleState, enemy: EnemyId) {
  const e = s.enemies[enemy];
  e.hp = Math.max(0, e.hp - R.markRetaliate);
  log(s, "v2.log.markHit", "player", { enemy, n: R.markRetaliate, hp: e.hp });
  afterEnemyHit(s, enemy);
}

/** Damage is shown in steps of 10, like Pokémon TCG. */
const toTens = (n: number) => Math.floor(n / 10) * 10;

/** Element damage multiplier (always 1 while elements are switched off). */
export function elementMultiplier(attacker: Element, defender: Element, enabled: boolean = R.elements.enabled): number {
  if (!enabled) return 1;
  if (ELEMENT_BEATS[attacker].includes(defender)) return R.elements.strong;
  if (ELEMENT_BEATS[defender].includes(attacker)) return R.elements.weak;
  return 1;
}

/**
 * Damage of an attack skill, with David's "Against the Giant" (Faith ≥ 3) and, when switched on, elements.
 * Sling Stone is a fixed number: no bonuses, no element.
 */
/** Is this character fighting in their own Bible story (story bonus on)? */
export const inStory = (s: BattleState, id: CharacterId) => STORY[id] === s.stage && s.lineup.includes(id);

export function skillDamage(s: BattleState, skill: SkillId, target?: EnemyId): number {
  const def = SKILLS[skill];
  // Sling Stone is fixed: 140 against Goliath, an ordinary 80 anywhere else.
  if (skill === "slingStone") return s.stage === "goliath" ? (def.damage ?? 0) : R.slingStoneElsewhere;
  const giant = def.owner === "david" && inStory(s, "david") && s.energy.faith >= R.giantFaith ? R.giantBonus : 0;
  const till = skill === "till" && inStory(s, "adam") ? R.edenTillBonus : 0;
  // Eve in Eden: her seed shall bruise the serpent's head — every attack on the Serpent +20.
  const seed = target === "serpent" && inStory(s, "eve") && isAlive(s, "eve") ? R.edenSeedBonus : 0;
  // Isaac sowed and reaped a hundredfold, for the LORD blessed him (Genesis 26:12): more with his father beside him.
  const blessing = skill === "harvest" && isAlive(s, "abraham") ? R.harvestBlessing : 0;
  // While Moses held up his hand, Israel prevailed (Exodus 17:11).
  const hands = s.handsUp ? R.handsBonus : 0;
  // Lord, if it be thou, bid me come (Matthew 14:28): Peter is bolder with Jesus beside him.
  const withJesus = def.owner === "peter" && jesusHere(s) ? R.peterWithJesus : 0;
  // The sons of thunder (Mark 3:17); and after James has drunk the cup, everyone fights on harder (Mark 10:39).
  const brothers = skill === "boanerges" && isAlive(s, "johnApostle") ? R.boanergesWithJohn : 0;
  const cup = s.cupDrunk ? R.cupBonus : 0;
  // When I am weak, then am I strong (2 Corinthians 12:10).
  const weak = def.owner === "paul" && s.party.paul.hp <= MAX_HP.paul / 2 ? R.strongWhenWeak : 0;
  // Be thou an example of the believers (1 Timothy 4:12); stir up the gift... by the putting on of my hands (2 Timothy 1:6).
  const example = s.example ? R.exampleBonus : 0;
  const stir = skill === "stirUpGift" && isAlive(s, "paul") ? R.stirWithPaul : 0;
  // They expounded unto him the way of God more perfectly (Acts 18:26).
  const taught = s.taught === def.owner ? R.expoundBonus : 0;
  // An eloquent man, and mighty in the scriptures — taught the way more perfectly by Priscilla and Aquila (Acts 18:24, 26).
  // Take Mark, and bring him with thee: for he is profitable to me for the ministry (2 Timothy 4:11).
  const restored = skill === "profitable" && (isAlive(s, "barnabas") || isAlive(s, "paul")) ? R.profitableWith : 0;
  const mighty = skill === "mightyScriptures" && (isAlive(s, "priscilla") || isAlive(s, "aquila")) ? R.scripturesWithTeachers : 0;
  const base = (def.damage ?? 0) + giant + till + seed + blessing + hands + withJesus + brothers + cup + weak + example + stir + taught + mighty + restored + (skill === "nowProfitable" && (isAlive(s, "philemon") || isAlive(s, "paul")) ? SKILLS.nowProfitable.damage! : 0)
    // Philip findeth Nathanael (John 1:45).
    + (skill === "noGuile" && isAlive(s, "philipApostle") ? 20 : 0)
    + (skill === "downTabor" && isAlive(s, "deborah") ? 20 : 0)
    // As yet I am as strong this day as I was in the day that Moses sent me (Joshua 14:11).
    + (skill === "thisMountain" && s.party.caleb.hp === MAX_HP.caleb ? R.stillStrong : 0)
    // His word was in mine heart as a burning fire shut up in my bones (Jeremiah 20:9).
    // And Nathan said to David, Thou art the man (2 Samuel 12:7): the word cuts deepest at the one in power.
    // He, casting away his garment, rose, and came to Jesus (Mark 10:50).
    // I will shew thee my faith by my works (James 2:18).
    + (skill === "faithWorks" ? Math.min(R.worksMax, R.worksPerFaith * s.energy.faith) : 0)
    // Nevertheless at thy word I will let down the net (Luke 5:5).
    + (skill === "atThyWord" && (jesusHere(s) || isAlive(s, "peter")) ? 20 : 0)
    // All the horses and chariots of Pharaoh pursued after them (Exodus 14:9).
    + (skill === "pursued" && isAlive(s, "pharaoh") ? 20 : 0)
    // Absalom prepared him chariots and horses, and fifty men to run before him (2 Samuel 15:1).
    + (skill === "fiftyMen" && target === bossOf(s) ? 20 : 0)
    // I am a man under authority, having soldiers under me (Matthew 8:9).
    + (skill === "gladius" && (isAlive(s, "centurion") || isAlive(s, "cornelius") || isAlive(s, "romanCenturion")) ? R.underCenturion : 0)
    // Isaac loved Esau, because he did eat of his venison (Genesis 25:28).
    + (skill === "cunningHunter" && isAlive(s, "isaac") ? R.hunterWithIsaac : 0)
    // From morning even until noon, O Baal, hear us (1 Kings 18:26): they cry louder each turn.
    + (skill === "callOnBaal" ? Math.min(R.baalMax, R.baalPerTurn * (s.turn - 1)) : 0)
    + (skill === "castGarment" && jesusHere(s) ? R.garmentWithJesus : 0)
    + (skill === "thouArtTheMan" && target === bossOf(s) ? R.manBonus : 0)
    + (skill === "fireInBones" && s.party.jeremiah.hp <= MAX_HP.jeremiah / 2 ? R.bonesBonus : 0)
    // Jael took a nail of the tent... and smote the nail into his temples (Judges 4:21).
    + (skill === "tentPeg" && target && s.enemies[target].hp <= ENEMY_HP[target] / 2 ? R.pegFinish : 0)
    + (skill === "leftHanded" && target && s.enemies[target].hp >= ENEMY_HP[target] ? R.ehudSurprise : 0)
    // He ordained twelve, that they should be with him (Mark 3:14).
    // Simon called Zelotes (Luke 6:15): his zeal burns hotter as the leader weakens.
    + (skill === "zeal" && s.enemies[bossOf(s)].hp <= ENEMY_HP[bossOf(s)] / 2 ? 20 : 0)
    + (skill === "oneOfTwelve" ? 10 * living(s).filter((id) => id !== "jamesAlph" && APOSTLES.has(id)).length : 0)
    // He was numbered with the eleven apostles (Acts 1:26).
    + (skill === "withEleven" ? 10 * living(s).filter((id) => id !== "matthias" && APOSTLES.has(id)).length : 0);
  if (!target) return base;
  // Now also the axe is laid unto the root of the trees (Matthew 3:10): wood enemies take double.
  if (skill === "axe" && ENEMY_ELEMENT[target] === "wood") return toTens(base * 2 * elementMultiplier(CHARACTER_ELEMENT[def.owner], ENEMY_ELEMENT[target]));
  return toTens(base * elementMultiplier(CHARACTER_ELEMENT[def.owner], ENEMY_ELEMENT[target]));
}

/** Heal or Shield amount of a support skill, with story bonuses. */
/** Heal or Shield a support skill gives before story bonuses; 0 for skills without an amount (Helper, Beguile). */
export function baseSupportAmount(skill: SkillId): number {
  if (skill === "heal") return R.healAmount;
  if (skill === "arise") return R.ariseHp;
  if (skill === "covshield") return R.covShield;
  if (skill === "keep") return R.keepShield;
  if (skill === "mother") return R.motherHeal;
  if (skill === "shieldUp") return R.shieldUpAmount;
  if (skill === "mark") return R.markRetaliate;
  if (skill === "firstlings") return R.firstlingsHeal;
  if (skill === "ark") return R.arkShield;
  if (skill === "rainbow") return R.rainbowHeal;
  if (skill === "stars") return R.starsFaith;
  if (skill === "provide") return R.provideDraw;
  if (skill === "granary") return R.granaryHeal;
  if (skill === "handsUp") return R.handsBonus;
  if (skill === "blessing") return R.blessingHeal;
  if (skill === "song") return R.songFaith;
  if (skill === "tenWords") return R.tenWordsShield;
  if (skill === "hideSpies") return R.hideShield;
  if (skill === "upToday") return R.upTodayAttack;
  if (skill === "fleece") return R.fleeceFaith;
  if (skill === "glean") return R.gleanDraw;
  if (skill === "counsel") return R.counselHeal;
  if (skill === "restorer") return R.restorerHp;
  if (skill === "wings") return R.wingsShield;
  if (skill === "prayer") return R.prayerFaith;
  if (skill === "rashOffering") return R.rashFaith;
  if (skill === "provision") return R.provisionHeal;
  if (skill === "intercede") return R.intercedeBlock;
  if (skill === "wisdom") return R.wisdomFaith;
  if (skill === "ravens") return R.ravensHeal;
  if (skill === "healWaters") return R.healWatersHeal;
  if (skill === "chariots") return R.chariotsShield;
  if (skill === "fasting") return R.fastingFaith;
  if (skill === "buildWall") return R.wallShield;
  if (skill === "incense") return R.incenseFaith;
  if (skill === "nameIsJohn") return R.johnHeal;
  if (skill === "handmaid") return R.handmaidFaith;
  if (skill === "carpenter") return R.carpenterShield;
  if (skill === "baptism") return R.baptismHeal;
  if (skill === "peaceBeUnto") return R.risenPeaceHeal;
  if (skill === "withYouAlway") return R.alwayShield;
  if (skill === "greatCatch") return R.catchDraw;
  if (skill === "aLadHere") return R.ladDraw;
  if (skill === "loveOneAnother") return R.loveHeal;
  if (skill === "taxBooth") return R.taxBoothAttack;
  if (skill === "feast") return R.feastHeal;
  if (skill === "mendNets") return R.mendHeal;
  if (skill === "reachFinger") return R.fingerFaith;
  if (skill === "spices") return R.spicesHeal;
  if (skill === "seenTheLord") return R.seenHp;
  if (skill === "serving") return R.servingGuard;
  if (skill === "riseAgain") return R.riseAgainHp;
  if (skill === "sycamore") return R.sycamoreFaith;
  if (skill === "atHisFeet") return R.feetFaith;
  if (skill === "spikenard") return R.spikenardHeal;
  if (skill === "looseHim") return R.looseShield;
  if (skill === "manyBelieved") return R.believedFaith;
  if (skill === "heavensOpened") return R.heavensHeal;
  if (skill === "hereIsWater") return R.waterHeal;
  if (skill === "armourOfGod") return R.armourShield;
  if (skill === "encourage") return R.encourageAttack;
  if (skill === "soldField") return R.fieldFaith;
  if (skill === "midnightHymns") return R.hymnsFaith;
  if (skill === "example") return R.exampleBonus;
  if (skill === "purpleCloth") return R.purpleShield;
  if (skill === "abideHouse") return R.abideHeal;
  if (skill === "tentmaking") return R.tentShield;
  if (skill === "expound") return R.expoundBonus;
  if (skill === "goInPeace") return R.peaceHeal;
  if (skill === "garments") return R.garmentHeal;
  if (skill === "almsdeeds") return R.almsHeal;
  if (skill === "prayersAlms") return R.memorialFaith;
  if (skill === "watered") return R.wateredHeal;
  if (skill === "succourer") return R.succourHeal;
  if (skill === "physician") return R.physicianHeal;
  if (skill === "inOrder") return R.orderDraw;
  if (skill === "departed") return R.departFaith;
  if (skill === "earnestCare") return R.earnestShield;
  if (skill === "refreshed") return R.refreshHeal;
  if (skill === "receiveHim") return R.receiveHp;
  if (skill === "belovedBrother") return R.brotherFaith;
  if (skill === "byNight") return R.nightDraw;
  if (skill === "aQuestion") return 1;
  if (skill === "lotFell") return 50;
  if (skill === "livingWater") return R.livingHeal;
  if (skill === "leaped") return R.leapHeal;
  if (skill === "blessedAmong") return R.blessedHeal;
  if (skill === "wouldNotBow") return R.bowShield;
  if (skill === "suchATime") return 1;
  if (skill === "laughter") return R.laughHeal;
  if (skill === "drinkMyLord") return R.drinkHeal;
  if (skill === "waterCamels") return R.camelsHeal;
  if (skill === "keepSheep") return R.sheepShield;
  if (skill === "fewDays") return 1;
  if (skill === "ifThouGo") return R.thouGoAttack;
  if (skill === "blessedAbove") return 1;
  if (skill === "fineLinen") return R.linenHeal;
  if (skill === "brotherSaul") return R.brotherHeal;
  if (skill === "scalesFell") return R.scalesShield;
  if (skill === "butIfNot") return 1;
  if (skill === "lordGave") return R.jobShield;
  if (skill === "walkedWithGod") return R.walkShield;
  if (skill === "breadAndWine") return R.breadHeal;
  if (skill === "tenthOfAll") return R.titheFaith;
  if (skill === "goUpAtOnce") return R.goUpAttack;
  if (skill === "almondRod") return 1;
  if (skill === "watchman") return R.watchmanShield;
  if (skill === "preparedHeart") return R.ezraDraw;
  if (skill === "houseForever") return R.houseShield;
  if (skill === "fifteenYears") return R.fifteenHeal;
  if (skill === "heardTheBook") return 1;
  if (skill === "hisStar") return 1;
  if (skill === "goodTidings") return 1;
  if (skill === "sonOfDavid") return 1;
  if (skill === "speakTheWord") return R.wordHeal;
  if (skill === "onlyBelieve") return 1;
  if (skill === "bearHisCross") return R.crossShield;
  if (skill === "rememberMe") return 1;
  if (skill === "forgiveThem") return 1;
  if (skill === "twoMites") return 1;
  if (skill === "toiledAllNight") return 1;
  if (skill === "throughTheRoof") return R.roofHeal;
  if (skill === "oilAndWine") return R.oilHeal;
  if (skill === "hardenedHeart") return R.hardShield;
  if (skill === "makeBricks") return R.bricksAttack;
  if (skill === "chosenChariots") return 1;
  if (skill === "royalCommand") return 1;
  if (skill === "cutThemselves") return R.cutAttack;
  if (skill === "kingsRing") return R.ringAttack;
  if (skill === "pieceOfSilver") return 1;
  if (skill === "praiseKingOfHeaven") return R.heavenHeal;
  if (skill === "covetVineyard") return R.vineyardAttack;
  if (skill === "mealNotSpent") return R.mealHeal;
  if (skill === "littleChamber") return R.chamberShield;
  if (skill === "wouldGod") return 1;
  if (skill === "rememberOath") return 1;
  if (skill === "stoleHearts") return R.heartsFaith;
  if (skill === "kingsTable") return R.tableHeal;
  if (skill === "hardQuestions") return 1;
  if (skill === "lookedUpon") return R.afflictionHeal;
  if (skill === "ranToMeet") return R.embraceShield;
  if (skill === "godHeard") return 2;
  if (skill === "escapeForLife") return R.escapeShield;
  if (skill === "arkOfBulrushes") return R.bulrushShield;
  if (skill === "hadCompassion") return R.compassionHeal;
  if (skill === "shareBurden") return 1;
  if (skill === "wateredFlock") return R.flockHeal;
  if (skill === "strangerLand") return 1;
  if (skill === "unfeignedFaith") return 1;
  if (skill === "soldPossession") return R.soldAttack;
  if (skill === "noFault") return R.noFaultShield;
  if (skill === "oneManDie") return R.expedientFaith;
  if (skill === "hopedSign") return R.signDraw;
  if (skill === "convenientDay") return R.convenientAttack;
  if (skill === "shieldWall") return R.scutumShield;
  if (skill === "braceSpears") return R.braceShield;
  if (skill === "rideOut") return 1;
  if (skill === "commandCohort") return 1;
  if (skill === "whomTrust") return 2;
  if (skill === "goldenVessels") return R.vesselsAttack;
  if (skill === "donkeySaw") return R.donkeyShield;
  if (skill === "takeTooMuch") return 2;
  if (skill === "hiddenSpoil") return R.spoilFaith;
  if (skill === "fledToTent") return R.siseraMantleShield;
  if (skill === "privilyCalled") return R.privilyDraw;
  if (skill === "rightMind") return R.legionShield;
  if (skill === "tellHowGreat") return R.tellDraw;
  if (skill === "cameToHimself") return R.prodigalFaith;
  if (skill === "bestRobe") return R.prodigalRobeHeal;
  if (skill === "readingIsaiah") return R.eunuchFaith;
  if (skill === "wentRejoicing") return R.rejoicingHeal;
  if (skill === "inTheSpirit") return R.patmosFaith;
  if (skill === "newHeaven") return R.newHeavenHeal;
  if (skill === "blewTrumpet") return R.trumpetAttack;
  if (skill === "judgeThisDay") return R.judgeFaith;
  if (skill === "playTheMen") return R.joabShield;
  if (skill === "wouldNotGoHome") return R.uriahShield;
  if (skill === "sorceries") return R.sorceryAttack;
  if (skill === "pleasedJews") return R.agrippaAttack;
  if (skill === "cyrusDecree") return R.cyrusFaith;
  if (skill === "returnVessels") return R.cyrusShield;
  if (skill === "laidFoundation") return R.foundationShield;
  if (skill === "refusedToCome") return R.vashtiShield;
  if (skill === "royalFeast") return R.vashtiFeastHeal;
  if (skill === "letDownWindow") return R.michalShield;
  if (skill === "imageInBed") return R.michalDecoyShield;
  if (skill === "ranAfterNaaman") return R.gehaziAttack;
  if (skill === "twoTalents") return 1;
  if (skill === "zealForLord") return R.jehuAttack;
  if (skill === "lordHelpMe") return R.helpMeFaith;
  if (skill === "crumbs") return R.crumbsHeal;
  if (skill === "keptAllThese") return R.rulerShield;
  if (skill === "greatPossessions") return R.possessionsAttack;
  if (skill === "heartsBurn") return R.burnFaith;
  if (skill === "breakingBread") return R.emmausHeal;
  if (skill === "lanternsTorches") return 1;
  if (skill === "earHealed") return R.earHeal;
  if (skill === "whatMustIDo") return R.jailerFaith;
  if (skill === "washedStripes") return R.stripesHeal;
  if (skill === "forGladness") return R.gladFaith;
  if (skill === "blessNotCurse") return R.blessHeal;
  if (skill === "writingOnWall") return 1;
  if (skill === "trulySonOfGod") return 2;
  if (skill === "gorgeousRobe") return R.robeShield;
  if (skill === "washedHands") return R.washShield;
  if (skill === "keptBackPart") return R.keptFaith;
  if (skill === "fromAChild") return R.childShield;
  if (skill === "greaterThanAll") return R.greaterFaith;
  if (skill === "drewHimOut") return R.drewFaith;
  if (skill === "nurseHim") return R.nurseHeal;
  if (skill === "lookedBack") return R.lookBackAttack;
  if (skill === "wellOpened") return R.wellHeal;
  if (skill === "nowPraise") return R.praiseFaith;
  if (skill === "spicesAndGold") return R.spiceHeal;
  if (skill === "kingsMother") return R.queenMotherHeal;
  if (skill === "littleMaid") return R.maidHeal;
  if (skill === "itIsWell") return R.wellHp;
  if (skill === "littleCake") return R.cakeHeal;
  if (skill === "humbledHimself") return R.humbledHeal;
  if (skill === "twoPence") return R.innHeal;
  if (skill === "theirFaith") return R.theirFaith;
  if (skill === "swiftToHear") return R.hearShield;
  if (skill === "paradise") return R.paradiseHeal;
  if (skill === "comingFromCountry") return R.countryHeal;
  if (skill === "talithaCumi") return R.talithaHp;
  if (skill === "gloryHighest") return R.gloryHeal;
  if (skill === "threeGifts") return R.giftHeal;
  if (skill === "readTheLaw") return R.lawFaith;
  if (skill === "dryBones") return R.dryBonesHp;
  if (skill === "nuncDimittis") return R.nuncHeal;
  if (skill === "nightAndDay") return R.annaShield;
  if (skill === "gaveThanks") return 1;
  if (skill === "giveBasket") return R.basketFaith;
  if (skill === "thirtySilver") return R.silverFaith;
  if (skill === "bearLetter") return R.letterFaith;
  if (skill === "fourfold") return R.fourfoldAttack + R.fourfoldFaith;
  if (skill === "loaves") return R.loavesHeal;
  return 0;
}

export function supportAmount(s: BattleState, skill: SkillId): number {
  if (skill === "keep" && inStory(s, "adam")) return R.keepShield + R.edenKeepBonus;
  if (skill === "mother" && inStory(s, "eve")) return R.motherHeal + R.edenMotherBonus;
  // For this child I prayed (1 Samuel 1:27): with Samuel beside her, Hannah's prayer gives more.
  if (skill === "prayer" && isAlive(s, "samuel")) return R.prayerSamuelFaith;
  // Let a double portion of thy spirit be upon me (2 Kings 2:9): with Elijah beside him, Elisha heals double.
  if (skill === "healWaters" && isAlive(s, "elijah")) return R.healWatersHeal * 2;
  // The disciple whom Jesus loved (John 21:20): with Jesus beside him, John's love is doubled.
  if (skill === "loveOneAnother" && jesusHere(s)) return R.loveHeal * 2;
  if (skill === "lordHelpMe" && jesusHere(s)) return R.helpMeJesusFaith;
  if (skill === "crumbs" && jesusHere(s)) return R.crumbsHeal * 2;
  // At midnight Paul and Silas prayed, and sang praises unto God (Acts 16:25).
  if (skill === "midnightHymns" && isAlive(s, "paul")) return R.hymnsPaulFaith;
  if (skill === "earnestCare" && isAlive(s, "paul")) return R.earnestPaulShield;
  if (skill === "receiveHim" && isAlive(s, "paul")) return R.receivePaulHp;
  if (skill === "byNight" && jesusHere(s)) return R.nightDraw * 2;
  if (skill === "aQuestion" && jesusHere(s)) return 2;
  if (skill === "livingWater" && jesusHere(s)) return R.livingHeal * 2;
  if (skill === "gaveThanks" && isAlive(s, "simeon")) return 2;
  if (skill === "suchATime" && isAlive(s, "esther")) return 2;
  if (skill === "keepSheep" && (isAlive(s, "jacob") || isAlive(s, "joseph"))) return R.sheepShield * 2;
  if (skill === "fewDays" && isAlive(s, "jacob")) return 2;
  if (skill === "ifThouGo" && isAlive(s, "deborah")) return R.thouGoAttack * 2;
  if (skill === "blessedAbove" && (isAlive(s, "deborah") || isAlive(s, "barak"))) return 2;
  if (skill === "butIfNot" && isAlive(s, "daniel")) return 2;
  if (skill === "tenthOfAll" && isAlive(s, "abraham")) return R.titheFaith + 1;
  if (skill === "goUpAtOnce" && isAlive(s, "joshua")) return R.goUpAttack * 2;
  if (skill === "readTheLaw" && isAlive(s, "nehemiah")) return R.lawFaith + 1;
  if (skill === "covetVineyard" && isAlive(s, "jezebel")) return R.vineyardAttack + 1;
  if (skill === "mealNotSpent" && isAlive(s, "elijah")) return R.mealHeal * 2;
  if (skill === "littleChamber" && isAlive(s, "elisha")) return R.chamberShield * 2;
  if (skill === "wouldGod" && (isAlive(s, "naaman") || isAlive(s, "elisha"))) return 2;
  if (skill === "rememberOath" && (isAlive(s, "david") || isAlive(s, "nathan"))) return 2;
  if (skill === "kingsTable" && (isAlive(s, "david") || isAlive(s, "jonathan"))) return R.tableHeal * 2;
  if (skill === "hardQuestions" && isAlive(s, "solomon")) return 2;
  if (skill === "nowPraise" && isAlive(s, "jacob")) return R.praiseFaith + 1;
  if (skill === "godHeard" && isAlive(s, "abraham")) return 3;
  if (skill === "unfeignedFaith" && isAlive(s, "timothy")) return 2;
  if (skill === "writingOnWall" && isAlive(s, "daniel")) return 3;
  if (skill === "strangerLand" && (isAlive(s, "moses") || isAlive(s, "mosesSinai") || isAlive(s, "jethro"))) return 2;
  if (skill === "greaterThanAll" && (isAlive(s, "moses") || isAlive(s, "mosesSinai"))) return R.greaterFaith + 1;
  if (skill === "drewHimOut" && (isAlive(s, "moses") || isAlive(s, "mosesSinai") || isAlive(s, "jochebed"))) return R.drewFaith + 1;
  if (skill === "fifteenYears" && isAlive(s, "isaiah")) return R.fifteenHeal * 2;
  if (skill === "sonOfDavid" && jesusHere(s)) return 2;
  if (skill === "speakTheWord" && jesusHere(s)) return R.wordHealJesus;
  if (skill === "onlyBelieve" && jesusHere(s)) return 2;
  if (skill === "rememberMe" && jesusHere(s)) return 2;
  if (skill === "throughTheRoof" && jesusHere(s)) return R.roofHeal * 2;
  if (skill === "theirFaith" && jesusHere(s)) return R.theirFaith + 1;
  if (skill === "hisStar" && (isAlive(s, "mary") || jesusHere(s))) return 2;
  // So built we the wall; and all the wall was joined together (Nehemiah 4:6): each course stands higher.
  if (skill === "buildWall") return Math.min(R.wallCap, R.wallShield + R.wallStep * s.wallCourses);
  return baseSupportAmount(skill);
}

/** Damage an enemy deals to an ally, with elements (e.g. metal Goliath hits wood Eve ×1.5). */
/** God Meant It for Good: half the HP the line-up has lost, in tens, up to the cap. */
export function goodDamage(s: BattleState): number {
  const lost = s.lineup.reduce((n, id) => n + MAX_HP[id] - s.party[id].hp, 0);
  return Math.min(R.goodCap, toTens(lost / 2));
}

export function enemyDamage(enemy: EnemyId, ally: CharacterId, base: number): number {
  return toTens(base * elementMultiplier(ENEMY_ELEMENT[enemy], CHARACTER_ELEMENT[ally]));
}

// ---------- setup ----------

/** lineup: who fights; everyone else sits the battle out (HP 0). */
export function createBattle(rng: Rng = Math.random, lineup: CharacterId[] = DEFAULT_LINEUP, stage: StageId = "goliath"): BattleState {
  const deck = shuffle(
    DECK_V2.map((card, i): CardInstance => ({ uid: i + 1, card })),
    rng,
  );
  const s: BattleState = {
    turn: 1,
    energy: { faith: 0, attack: 0, guard: 0 },
    party: Object.fromEntries(
      PARTY_ORDER.map((id) => [id, { hp: lineup.includes(id) ? MAX_HP[id] : 0, shield: 0, shaken: false, acted: false }]),
    ) as BattleState["party"],
    lineup: PARTY_ORDER.filter((id) => lineup.includes(id)),
    helperUsed: false,
    beguileUsed: false,
    markUsed: false,
    marked: false,
    rainbowUsed: false,
    provideUsed: false,
    ramUsed: false,
    ramReady: false,
    ladderUsed: false,
    goodUsed: false,
    seaUsed: false,
    handsUp: false,
    breastplate: false,
    shoneUsed: false,
    jerichoUsed: false,
    cordUsed: false,
    cordReady: false,
    starsFoughtUsed: false,
    torchesUsed: false,
    covered: null,
    restorerUsed: false,
    redeemerUsed: false,
    hannahSongUsed: false,
    saulRash: false,
    markLeft: false,
    receiveUsed: false,
    bornAgainUsed: false,
    simeonWaiting: false,
    basketGiven: false,
    lotUsed: false,
    tooHardUsed: false,
    intercede: false,
    templeFireUsed: false,
    carmelUsed: false,
    chariotsUsed: false,
    castIntoSea: false,
    fish: "ready",
    greatLightUsed: false,
    contraryUsed: false,
    contrary: false,
    lionsDenUsed: false,
    lionsDen: false,
    fourthManUsed: false,
    fiery: false,
    captivityUsed: false,
    enochTaken: false,
    dryBonesUsed: false,
    letterUsed: false,
    giftsGiven: false,
    talithaUsed: false,
    spiritUsed: false,
    praisedHeaven: false,
    ahabHumbled: false,
    itIsWellUsed: false,
    jordanUsed: false,
    wellUsed: false,
    releasedUsed: false,
    inn: null,
    wallCourses: 0,
    johnUsed: false,
    magnificatUsed: false,
    dreamUsed: false,
    loavesUsed: false,
    walkUsed: false,
    withYouUsed: false,
    comeAndSeeUsed: false,
    cupDrunk: false,
    thomasBelieves: false,
    seenUsed: false,
    riseAgain: "unused",
    inTree: false,
    fourfoldUsed: false,
    spikenardUsed: false,
    lazarus: "ready",
    heavensUsed: false,
    fieldSold: false,
    prisonOpened: false,
    example: false,
    taught: null,
    speakUsed: false,
    aquilaCovers: null,
    simonCovers: null,
    spearCovers: null,
    dorcas: "ready",
    tomb: null,
    risenUsed: false,
    enemies: Object.fromEntries(ENEMY_ORDER.map((id) => [id, { hp: STAGE_ENEMIES[stage].includes(id) ? ENEMY_HP[id] : 0 }])) as BattleState["enemies"],
    stage,
    coiled: null,
    goliath: { enraged: false, charging: false, stunned: false, cycle: 0 },
    archerTarget: null,
    intents: [
      { action: "defy", targets: [] },
      { action: "defy", targets: [] },
    ],
    deck,
    hand: [],
    discard: [],
    ariseUsed: false,
    log: [],
    seq: 0,
    result: "ongoing",
  };
  const cycle = cycleOf(s);
  s.intents = [makeIntent(s, cycle[0], rng), makeIntent(s, cycle[1], rng)];
  s.archerTarget = enemyAlive(s, "archer") ? randomAlly(s, rng) : null;
  draw(s, R.openingHand, rng);
  log(s, stage === "eden" ? "v2.log.startEden" : "v2.log.start", "system");
  log(s, "v2.log.turn", "system", { n: 1 });
  return s;
}

// ---------- energy ----------

/** How a skill would be paid from the pool: matching energy first, then Faith. null if unaffordable. */
export function payment(s: BattleState, skill: SkillId): EnergyPool | null {
  const { kind, cost } = SKILLS[skill];
  if (kind === "faith") return s.energy.faith >= cost ? { faith: cost, attack: 0, guard: 0 } : null;
  const own = Math.min(s.energy[kind], cost);
  const faith = cost - own;
  if (faith > s.energy.faith) return null;
  return { faith, attack: kind === "attack" ? own : 0, guard: kind === "guard" ? own : 0 };
}

/** Turn a card into energy. Any number of cards may be played per turn. */
export function playCard(state: BattleState, uid: number): BattleState {
  if (state.result !== "ongoing") return state;
  const i = state.hand.findIndex((c) => c.uid === uid);
  if (i < 0) return state;
  const s = clone(state);
  const [inst] = s.hand.splice(i, 1);
  s.discard.push(inst);
  const kind = CARDS_V2[inst.card].energy;
  const cap = kind === "faith" ? R.maxFaith : kind === "guard" ? R.maxGuard : Infinity;
  if (s.energy[kind] >= cap) log(s, "v2.log.energyFull", "detail", { energy: kind });
  s.energy[kind] = Math.min(cap, s.energy[kind] + 1);
  log(s, "v2.log.play", "player", { card: inst.card, energy: kind });
  return s;
}

// ---------- skills ----------

/** Who Ezekiel's Dry Bones would raise: every fallen ally, except Jonah while the fish still has him. */
function dryBonesFallen(s: BattleState): CharacterId[] {
  return s.lineup.filter((id) => !isAlive(s, id) && !NEVER_FALLS.has(id) && !(id === "jonah" && s.fish === "inside"));
}

export function skillTargetKind(skill: SkillId): TargetKind {
  if (skill === "drivethFuriously" || skill === "hottestBattle" || skill === "threeDarts" || skill === "rashVow" || skill === "leftHanded" || skill === "exceedingWroth" || skill === "sling" || skill === "sword" || skill === "rebuke" || skill === "till" || skill === "offering" || skill === "faithOffering" || skill === "harvest" || skill === "wrestle" || skill === "javelin" || skill === "sendMe" || skill === "stoneCut" || skill === "swordAndTrowel" || skill === "axe" || skill === "drawSword" || skill === "thunder" || skill === "boanerges" || skill === "gracePower" || skill === "swordOfSpirit" || skill === "stirUpGift" || skill === "tentRope" || skill === "centurionCommand" || skill === "mightyScriptures" || skill === "profitable" || skill === "nowProfitable" || skill === "pebble" || skill === "moneyBag" || skill === "twoHundredPence" || skill === "noGuile" || skill === "oneOfTwelve" || skill === "contendFaith" || skill === "zeal" || skill === "withEleven" || skill === "downTabor" || skill === "tentPeg" || skill === "saintsCome" || skill === "thisMountain" || skill === "fireInBones" || skill === "thouArtTheMan" || skill === "purgeIdols" || skill === "castGarment" || skill === "faithWorks" || skill === "saveThyself" || skill === "railedOn" || skill === "atThyWord" || skill === "pursued" || skill === "callOnBaal" || skill === "whereinStrength" || skill === "captainOfHost" || skill === "fiftyMen" || skill === "cunningHunter" || skill === "rentClothes" || skill === "insurrection" || skill === "heldGrudge" || skill === "gladius") return "enemy";
  if (skill === "bash" || skill === "spearThrust" || skill === "venom") return "enemy";
  if (skill === "volley" || skill === "courage" || skill === "sealedLetters" || skill === "pilum" || skill === "aimedShot" || skill === "cavalryCharge") return "anyEnemy";
  if (skill === "heal" || skill === "shieldUp" || skill === "firstlings" || skill === "blessing" || skill === "hideSpies" || skill === "counsel" || skill === "wings" || skill === "carpenter" || skill === "peaceBeUnto" || skill === "mendNets" || skill === "spices" || skill === "looseHim" || skill === "hereIsWater" || skill === "purpleCloth" || skill === "goInPeace" || skill === "almsdeeds" || skill === "succourer" || skill === "physician" || skill === "bornAgain" || skill === "blessedAmong" || skill === "tooHard" || skill === "drinkMyLord" || skill === "fineLinen" || skill === "brotherSaul" || skill === "twoPence" || skill === "kingsMother") return "ally";
  if (skill === "whither" || skill === "expound" || skill === "layDownNeck" || skill === "speakTheWord" || skill === "bearHisCross" || skill === "braceSpears" || skill === "throughTheRoof" || skill === "oilAndWine" || skill === "letDownWindow" || skill === "crumbs" || skill === "littleCake" || skill === "littleMaid" || skill === "arkOfBulrushes" || skill === "nurseHim" || skill === "hadCompassion") return "otherAlly";
  if (skill === "arise" || skill === "restorer" || skill === "seenTheLord" || skill === "receiveHim" || skill === "lotFell" || skill === "talithaCumi" || skill === "itIsWell") return "fallenAlly";
  if (skill === "helper" || skill === "comeAndSee" || skill === "speakLord" || skill === "underAuthority") return "actedAlly";
  return "none";
}

export function skillTargets(s: BattleState, skill: SkillId): Target[] {
  const kind = skillTargetKind(skill);
  if (kind === "enemy") return attackableEnemies(s);
  if (kind === "anyEnemy") return ENEMY_ORDER.filter((id) => enemyAlive(s, id));
  if (kind === "ally") return living(s);
  if (kind === "otherAlly") return living(s).filter((id) => id !== SKILLS[skill].owner);
  if (kind === "fallenAlly") return s.lineup.filter((id) => !isAlive(s, id));
  if (kind === "actedAlly") {
    const owner = SKILLS[skill].owner;
    return s.lineup.filter((id) => id !== owner && isAlive(s, id) && s.party[id].acted && !s.party[id].shaken);
  }
  return [];
}

/** Why this skill can't be used right now (an i18n key), or null. */
export function skillBlockReason(s: BattleState, skill: SkillId, target?: Target): string | null {
  const def = SKILLS[skill];
  if (s.result !== "ongoing") return "v2.reason.over";
  if (!isAlive(s, def.owner)) return "v2.reason.fallen";
  if (s.party[def.owner].shaken) return "v2.reason.shaken";
  if (s.party[def.owner].acted) return "v2.reason.acted";
  if (skill === "arise" && s.ariseUsed) return "v2.reason.ariseUsed";
  if (skill === "helper" && s.helperUsed) return "v2.reason.ariseUsed";
  if (skill === "beguile" && s.beguileUsed) return "v2.reason.ariseUsed";
  if (skill === "mark" && s.markUsed) return "v2.reason.ariseUsed";
  if (skill === "rainbow" && s.rainbowUsed) return "v2.reason.ariseUsed";
  if (skill === "provide" && s.provideUsed) return "v2.reason.ariseUsed";
  if (skill === "ram" && s.ramUsed) return "v2.reason.ariseUsed";
  if (skill === "ladder" && s.ladderUsed) return "v2.reason.ariseUsed";
  if (skill === "meantForGood" && s.goodUsed) return "v2.reason.ariseUsed";
  if (skill === "sea" && s.seaUsed) return "v2.reason.ariseUsed";
  if (skill === "faceShone" && s.shoneUsed) return "v2.reason.ariseUsed";
  if (skill === "jericho" && s.jerichoUsed) return "v2.reason.ariseUsed";
  if (skill === "scarletCord" && s.cordUsed) return "v2.reason.ariseUsed";
  if (skill === "starsFought" && s.starsFoughtUsed) return "v2.reason.ariseUsed";
  if (skill === "torches" && s.torchesUsed) return "v2.reason.ariseUsed";
  if (skill === "restorer" && s.restorerUsed) return "v2.reason.ariseUsed";
  if (skill === "redeemer" && s.redeemerUsed) return "v2.reason.ariseUsed";
  if (skill === "hannahSong" && s.hannahSongUsed) return "v2.reason.ariseUsed";
  if (skill === "templeFire" && s.templeFireUsed) return "v2.reason.ariseUsed";
  if (skill === "carmel" && s.carmelUsed) return "v2.reason.ariseUsed";
  if (skill === "chariots" && s.chariotsUsed) return "v2.reason.ariseUsed";
  if (skill === "greatLight" && s.greatLightUsed) return "v2.reason.ariseUsed";
  if (skill === "contrary" && s.contraryUsed) return "v2.reason.ariseUsed";
  if (skill === "lionsDen" && s.lionsDenUsed) return "v2.reason.ariseUsed";
  if (skill === "fourthMan" && s.fourthManUsed) return "v2.reason.ariseUsed";
  if (skill === "turnedCaptivity" && s.captivityUsed) return "v2.reason.ariseUsed";
  if (skill === "dryBones" && s.dryBonesUsed) return "v2.reason.ariseUsed";
  if (skill === "spreadLetter" && s.letterUsed) return "v2.reason.ariseUsed";
  if (skill === "threeGifts" && s.giftsGiven) return "v2.reason.ariseUsed";
  if (skill === "talithaCumi" && s.talithaUsed) return "v2.reason.ariseUsed";
  if (skill === "commitSpirit" && s.spiritUsed) return "v2.reason.ariseUsed";
  if (skill === "praiseKingOfHeaven" && s.praisedHeaven) return "v2.reason.ariseUsed";
  if (skill === "humbledHimself" && s.ahabHumbled) return "v2.reason.ariseUsed";
  if (skill === "itIsWell" && s.itIsWellUsed) return "v2.reason.ariseUsed";
  if (skill === "sevenTimesJordan" && s.jordanUsed) return "v2.reason.ariseUsed";
  if (skill === "wellOpened" && s.wellUsed) return "v2.reason.ariseUsed";
  if (skill === "releasedUnto" && s.releasedUsed) return "v2.reason.ariseUsed";
  if (skill === "paradise" && !jesusHere(s)) return "v2.reason.needJesus";
  if (skill === "dryBones" && dryBonesFallen(s).length === 0) return "v2.reason.noTarget";
  if (skill === "nameIsJohn" && s.johnUsed) return "v2.reason.ariseUsed";
  if (skill === "magnificat" && s.magnificatUsed) return "v2.reason.ariseUsed";
  if (skill === "dreamWarning" && s.dreamUsed) return "v2.reason.ariseUsed";
  if (skill === "loaves" && s.loavesUsed) return "v2.reason.ariseUsed";
  if (skill === "walkOnWater" && s.walkUsed) return "v2.reason.ariseUsed";
  if (skill === "withYouAlway" && s.withYouUsed) return "v2.reason.ariseUsed";
  if (skill === "comeAndSee" && s.comeAndSeeUsed) return "v2.reason.ariseUsed";
  // Except I shall see in his hands the print of the nails, I will not believe (John 20:25).
  if (skill === "myLord" && !s.thomasBelieves) return "v2.reason.unbelief";
  if (skill === "seenTheLord" && s.seenUsed) return "v2.reason.ariseUsed";
  if (skill === "riseAgain" && s.riseAgain !== "unused") return "v2.reason.ariseUsed";
  if (skill === "fourfold" && s.fourfoldUsed) return "v2.reason.ariseUsed";
  if (skill === "spikenard" && s.spikenardUsed) return "v2.reason.ariseUsed";
  if (skill === "heavensOpened" && s.heavensUsed) return "v2.reason.ariseUsed";
  if (skill === "soldField" && s.fieldSold) return "v2.reason.ariseUsed";
  if (skill === "prisonOpened" && s.prisonOpened) return "v2.reason.ariseUsed";
  if (skill === "speakLord" && s.speakUsed) return "v2.reason.ariseUsed";
  if (skill === "receiveHim" && s.receiveUsed) return "v2.reason.ariseUsed";
  if (skill === "bornAgain" && s.bornAgainUsed) return "v2.reason.ariseUsed";
  if (skill === "giveBasket" && s.basketGiven) return "v2.reason.ariseUsed";
  if (skill === "lotFell" && s.lotUsed) return "v2.reason.ariseUsed";
  if (skill === "tooHard" && s.tooHardUsed) return "v2.reason.ariseUsed";
  // Thou shalt be dumb, until the day that these things shall be performed (Luke 1:20).
  if (skill === "nameIsJohn" && s.turn < R.johnTurn) return "v2.reason.silent";
  // The ladder is for allies who have already acted: someone must have.
  if (skill === "ladder" && !s.lineup.some((id) => id !== "jacob" && isAlive(s, id) && s.party[id].acted)) return "v2.reason.noTarget";
  if (!payment(s, skill)) return def.kind === "faith" ? "v2.reason.needFaith" : "v2.reason.energy";
  if (skillTargetKind(skill) !== "none") {
    const valid = skillTargets(s, skill);
    if (valid.length === 0) return "v2.reason.noTarget";
    if (target !== undefined && !valid.includes(target)) return "v2.reason.badTarget";
  }
  return null;
}

function hitEnemy(s: BattleState, skill: SkillId, enemy: EnemyId) {
  const dmg = skillDamage(s, skill, enemy);
  const e = s.enemies[enemy];
  e.hp = Math.max(0, e.hp - dmg);
  log(s, skill === "slingStone" ? "v2.log.slingStone" : "v2.log.attack", "player", {
    char: SKILLS[skill].owner,
    skill,
    enemy,
    n: dmg,
    hp: e.hp,
  });
  afterEnemyHit(s, enemy);
}

/** After any damage to an enemy: the Serpent may shed its skin, a minion may fall, the boss may fall. */
function afterEnemyHit(s: BattleState, enemy: EnemyId) {
  const e = s.enemies[enemy];
  // The Serpent sheds its skin at half HP: its fang hits harder from then on.
  if (s.stage === "eden" && enemy === "serpent" && e.hp > 0 && !s.goliath.enraged && e.hp <= ENEMY_HP.serpent / 2) {
    s.goliath.enraged = true;
    log(s, "v2.log.shed", "enemy");
  }
  if (e.hp === 0 && enemy !== bossOf(s)) {
    log(s, "v2.log.enemyFalls", "system", { enemy });
    if (enemy === "archer") s.archerTarget = null;
  }
  checkVictory(s);
}

/** Use a skill: the owner acts for this turn and the energy is spent (matching kind first, then Faith). */
export function castSkill(state: BattleState, skill: SkillId, target?: Target, rng: Rng = Math.random): BattleState {
  if (skillBlockReason(state, skill, target) !== null) return state;
  if (skillTargetKind(skill) !== "none" && target === undefined) return state;
  const pay = payment(state, skill)!;

  const s = clone(state);
  const def = SKILLS[skill];
  s.party[def.owner].acted = true;
  // Against the Giant reads the Faith held before paying. Sling Stone flies over the shield into Goliath.
  // Taunt hits every enemy; other attacks hit their target (Sling Stone always the boss).
  if (skill === "taunt" || skill === "sea" || skill === "timbrel" || skill === "jericho" || skill === "torches" || skill === "jawbone" || skill === "templeFire" || skill === "nineveh" || skill === "samaria" || skill === "prisonOpened" || skill === "spreadLetter" || skill === "commitSpirit" || skill === "hamansDecree" || skill === "sevenTimesHotter" || skill === "arrowVolley" || skill === "fencedCities" || skill === "strangeCensers" || skill === "troubleOfAchor" || skill === "ironChariots" || skill === "voiceOfGod" || skill === "notByMight") ENEMY_ORDER.filter((id) => enemyAlive(s, id)).forEach((id) => s.result === "ongoing" && hitEnemy(s, skill, id));
  else if (def.damage) hitEnemy(s, skill, skill === "slingStone" || skill === "starsFought" || skill === "pillars" || skill === "hannahSong" || skill === "carmel" || skill === "greatLight" || skill === "myLord" ? bossOf(s) : (target as EnemyId));
  s.energy.faith -= pay.faith;
  s.energy.attack -= pay.attack;
  s.energy.guard -= pay.guard;
  if (pay.faith && def.kind !== "faith") log(s, "v2.log.faithSpent", "detail", { n: pay.faith });

  switch (skill) {
    case "slingStone":
      // Only Goliath is Stunned: the stone was made for him (1 Sam 17:49).
      if (s.stage === "goliath") s.goliath.stunned = true;
      // Goliath rises Enraged after the first Sling Stone (the Serpent sheds its skin by HP instead).
      if (s.stage === "goliath" && s.result === "ongoing" && !s.goliath.enraged) {
        s.goliath.enraged = true;
        s.goliath.cycle = -1; // phase 2 begins after the (skipped) current action
        s.intents[1] = makeIntent(s, PHASE2_CYCLE[0], rng);
        log(s, "v2.log.enraged", "enemy");
      }
      break;
    case "heal": {
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.healAmount, MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.heal", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "firstlings": {
      // Abel brought of the firstlings of his flock (Genesis 4:4).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.firstlingsHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.firstlings", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "arise": {
      const c = s.party[target as CharacterId];
      c.hp = R.ariseHp;
      c.shaken = false;
      c.shield = 0;
      c.acted = false;
      s.ariseUsed = true;
      log(s, "v2.log.revive", "player", { char: target, hp: c.hp });
      break;
    }
    case "covshield":
      log(s, "v2.log.covshield", "player");
      living(s).forEach((id) => addShield(s, id, R.covShield));
      break;
    case "keep":
      log(s, "v2.log.keep", "player");
      addShield(s, "adam", supportAmount(s, "keep"));
      break;
    case "mother":
      log(s, "v2.log.mother", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(supportAmount(s, "mother"), MAX_HP[id] - c.hp);
        // Comfort: lifts Shaken (Goliath's Defy, the Serpent's Temptation).
        c.shaken = false;
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "ark":
      // Make thee an ark of gopher wood (Genesis 6:14).
      log(s, "v2.log.ark", "player");
      living(s).forEach((id) => addShield(s, id, R.arkShield));
      break;
    case "rainbow":
      // I do set my bow in the cloud (Genesis 9:13).
      s.rainbowUsed = true;
      log(s, "v2.log.rainbow", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.rainbowHeal, MAX_HP[id] - c.hp);
        c.shaken = false;
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "stars": {
      // Look now toward heaven, and tell the stars (Genesis 15:5).
      const gained = Math.min(R.starsFaith, R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      log(s, "v2.log.stars", "player", { n: gained });
      break;
    }
    case "provide":
      // Jehovah-jireh: the LORD will provide (Genesis 22:14).
      s.provideUsed = true;
      log(s, "v2.log.provide", "player", { n: R.provideDraw });
      draw(s, R.provideDraw, rng);
      break;
    case "wrestle": {
      // I will not let thee go, except thou bless me (Genesis 32:26).
      const c = s.party.jacob;
      c.hp = Math.max(R.wrestleCost, c.hp - R.wrestleCost);
      const gained = Math.min(R.wrestleFaith, R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      log(s, "v2.log.wrestle", "player", { n: gained, hp: c.hp, max: MAX_HP.jacob });
      break;
    }
    case "sea":
      // The waters returned, and covered the chariots (Exodus 14:28).
      s.seaUsed = true;
      break;
    case "blessing": {
      // The LORD bless thee, and keep thee (Numbers 6:24).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.blessingHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.blessing", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      addShield(s, ally, R.blessingShield);
      break;
    }
    case "ravens": {
      // The ravens brought him bread and flesh in the morning (1 Kings 17:6).
      const c = s.party.elijah;
      const healed = Math.min(R.ravensHeal, MAX_HP.elijah - c.hp);
      c.hp += healed;
      log(s, "v2.log.ravens", "player", { n: healed, hp: c.hp, max: MAX_HP.elijah });
      draw(s, R.ravensDraw, rng);
      break;
    }
    case "fasting": {
      // Fast ye for me, neither eat nor drink three days (Esther 4:16).
      const c = s.party.esther;
      c.hp = Math.max(R.fastingCost, c.hp - R.fastingCost);
      const gained = Math.min(R.fastingFaith, R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      log(s, "v2.log.fasting", "player", { n: gained, hp: c.hp, max: MAX_HP.esther });
      break;
    }
    case "philipComeSee":
      // Philip saith unto him, Come and see (John 1:46) — and Nathanael comes ready.
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      if (isAlive(s, "nathanael")) s.energy.attack += 1;
      log(s, "v2.log.philipComeSee", "player");
      break;
    case "lotFell": {
      // They gave forth their lots; and the lot fell upon Matthias (Acts 1:26): the empty place is filled.
      const c = s.party[target as CharacterId];
      c.hp = 50;
      c.shaken = false;
      c.shield = 0;
      c.acted = false;
      s.lotUsed = true;
      log(s, "v2.log.lotFell", "player", { char: target as CharacterId });
      break;
    }
    case "swordDown":
      // From the sword of the zealots to the peace of Christ.
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.swordDown", "player");
      addShield(s, "simonZealot", 20);
      break;
    case "aQuestion": {
      // Lord, how is it that thou wilt manifest thyself unto us, and not unto the world? (John 14:22).
      const n = supportAmount(s, "aQuestion");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.aQuestion", "player", { n });
      draw(s, n, rng);
      break;
    }
    case "quietFaith":
      // Named among the twelve, and faithful without being noticed.
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.quietFaith", "player");
      addShield(s, "jamesAlph", 30);
      break;
    case "figTree":
      // When thou wast under the fig tree, I saw thee (John 1:48).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.figTree", "player");
      draw(s, 1, rng);
      break;
    case "thirtySilver": {
      // They covenanted with him for thirty pieces of silver (Matthew 26:15): Faith now, paid for by a friend.
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.silverFaith);
      const victim = living(s).filter((id) => id !== "judas" && !NEVER_FALLS.has(id)).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
      log(s, "v2.log.thirtySilver", "player", { n: R.silverFaith });
      if (victim) {
        const c = s.party[victim];
        const lost = Math.min(R.silverCost, c.hp - 10);
        if (lost > 0) c.hp -= lost;
        log(s, "v2.log.betrayed", "detail", { char: victim, n: Math.max(0, lost), hp: c.hp, max: MAX_HP[victim] });
      }
      break;
    }
    case "moneyBag":
      // He had the bag (John 12:6).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      break;
    case "giveBasket":
      // There is a lad here, which hath five barley loaves, and two small fishes (John 6:9).
      s.basketGiven = true;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.basketFaith);
      log(s, "v2.log.giveBasket", "player", { n: R.basketFaith });
      if (jesusHere(s))
        living(s).forEach((id) => {
          const c = s.party[id];
          const healed = Math.min(R.basketHeal, MAX_HP[id] - c.hp);
          c.hp += healed;
          log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
        });
      break;
    case "nightAndDay":
      // She served God with fastings and prayers night and day (Luke 2:37).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.nightAndDay", "player");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, R.annaShield));
      break;
    case "gaveThanks": {
      // She coming in that instant gave thanks likewise unto the Lord, and spake of him (Luke 2:38).
      const n = supportAmount(s, "gaveThanks");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.gaveThanks", "player", { n });
      break;
    }
    case "waiting":
      // Waiting for the consolation of Israel (Luke 2:25): Faith now, and every other turn from here on.
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      s.simeonWaiting = true;
      log(s, "v2.log.waiting", "player");
      break;
    case "nuncDimittis": {
      // Lord, now lettest thou thy servant depart in peace... for mine eyes have seen thy salvation (Luke 2:29-30).
      s.simeonWaiting = false;
      log(s, "v2.log.nuncDimittis", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.nuncHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
        if (!NEVER_FALLS.has(id) && id !== "simeon") addShield(s, id, R.nuncShield);
      });
      const me = s.party.simeon;
      me.hp = 0;
      me.shield = 0;
      me.shaken = false;
      log(s, "v2.log.fallen", "system", { char: "simeon" });
      checkDefeat(s);
      break;
    }
    case "livingWater": {
      // Whosoever drinketh of the water that I shall give him shall never thirst (John 4:14).
      const n = supportAmount(s, "livingWater");
      log(s, "v2.log.livingWater", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(n, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    }
    case "leaped": {
      // The babe leaped in her womb; and Elisabeth was filled with the Holy Ghost (Luke 1:41).
      const kin = isAlive(s, "mary") || isAlive(s, "johnBaptist");
      if (kin) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, kin ? "v2.log.leapedKin" : "v2.log.leaped", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.leapHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    }
    case "blessedAmong": {
      // Blessed art thou among women, and blessed is the fruit of thy womb (Luke 1:42) — twice over for Mary.
      const ally = target as CharacterId;
      const k = ally === "mary" ? 2 : 1;
      const c = s.party[ally];
      const healed = Math.min(R.blessedHeal * k, MAX_HP[ally] - c.hp);
      c.hp += healed;
      addShield(s, ally, R.blessedShield * k);
      log(s, "v2.log.blessedAmong", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "wouldNotBow":
      // But Mordecai bowed not, nor did him reverence (Esther 3:2).
      addShield(s, "mordecai", R.bowShield);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.wouldNotBow", "player", { n: R.bowShield });
      break;
    case "suchATime": {
      // Who knoweth whether thou art come to the kingdom for such a time as this? (Esther 4:14).
      const n = supportAmount(s, "suchATime");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.suchATime", "player", { n });
      break;
    }
    case "laughter": {
      // God hath made me to laugh, so that all that hear will laugh with me (Genesis 21:6).
      const n = isAlive(s, "abraham") || isAlive(s, "isaac") ? 2 : 1;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.laughter", "player", { n });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.laughHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    }
    case "tooHard": {
      // Is any thing too hard for the LORD? (Genesis 18:14).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = MAX_HP[ally] - c.hp;
      c.hp = MAX_HP[ally];
      c.shaken = false;
      s.tooHardUsed = true;
      log(s, "v2.log.tooHard", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "drinkMyLord": {
      // Drink, my lord: and she hasted, and let down her pitcher upon her hand, and gave him drink (Genesis 24:18).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.drinkHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.drinkMyLord", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "waterCamels": {
      // I will draw water for thy camels also, until they have done drinking (Genesis 24:19).
      const isaac = isAlive(s, "isaac");
      if (isaac) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, isaac ? "v2.log.waterCamelsIsaac" : "v2.log.waterCamels", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.camelsHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        if (!NEVER_FALLS.has(id)) addShield(s, id, R.camelsShield);
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    }
    case "keepSheep": {
      // Rachel came with her father's sheep: for she kept them (Genesis 29:9).
      const n = supportAmount(s, "keepSheep");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, n));
      log(s, "v2.log.keepSheep", "player", { n });
      break;
    }
    case "fewDays": {
      // They seemed unto him but a few days, for the love he had to her (Genesis 29:20).
      const n = supportAmount(s, "fewDays");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.fewDays", "player", { n });
      break;
    }
    case "ifThouGo": {
      // If thou wilt go with me, then I will go (Judges 4:8).
      const n = supportAmount(s, "ifThouGo");
      s.energy.attack += n;
      log(s, "v2.log.ifThouGo", "player", { n });
      break;
    }
    case "blessedAbove": {
      // Blessed above women shall Jael the wife of Heber the Kenite be (Judges 5:24).
      const n = supportAmount(s, "blessedAbove");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.blessedAbove", "player", { n });
      break;
    }
    case "wentInBoldly":
      // Joseph of Arimathaea... went in boldly unto Pilate, and craved the body of Jesus (Mark 15:43).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.wentInBoldly", "player");
      break;
    case "fineLinen": {
      // He bought fine linen, and took him down, and wrapped him in the linen (Mark 15:46).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.linenHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      if (!NEVER_FALLS.has(ally)) addShield(s, ally, R.linenShield);
      log(s, "v2.log.fineLinen", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "brotherSaul": {
      // Brother Saul, the Lord... hath sent me, that thou mightest receive thy sight (Acts 9:17) — twice over for Paul.
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.brotherHeal * (ally === "paul" ? 2 : 1), MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.brotherSaul", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "scalesFell": {
      // There fell from his eyes as it had been scales: and he received sight forthwith (Acts 9:18).
      const paul = isAlive(s, "paul");
      if (paul) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      living(s).forEach((id) => {
        s.party[id].shaken = false;
        if (!NEVER_FALLS.has(id)) addShield(s, id, R.scalesShield);
      });
      log(s, paul ? "v2.log.scalesFellPaul" : "v2.log.scalesFell", "player", { n: R.scalesShield });
      break;
    }
    case "butIfNot": {
      // But if not, be it known unto thee, O king, that we will not serve thy gods (Daniel 3:18).
      const n = supportAmount(s, "butIfNot");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.butIfNot", "player", { n });
      break;
    }
    case "fourthMan":
      // The form of the fourth is like the Son of God (Daniel 3:25).
      s.fourthManUsed = true;
      s.fiery = true;
      log(s, "v2.log.fourthMan", "player");
      break;
    case "lordGave": {
      // The LORD gave, and the LORD hath taken away; blessed be the name of the LORD (Job 1:21).
      const low = s.party.job.hp <= MAX_HP.job / 2;
      addShield(s, "job", R.jobShield);
      if (low) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, low ? "v2.log.lordGaveLow" : "v2.log.lordGave", "player", { n: R.jobShield });
      break;
    }
    case "turnedCaptivity": {
      // The LORD turned the captivity of Job... and gave Job twice as much as he had before (Job 42:10).
      const c = s.party.job;
      const lost = MAX_HP.job - c.hp;
      c.hp = MAX_HP.job;
      c.shaken = false;
      addShield(s, "job", Math.min(lost, R.captivityShieldMax));
      s.captivityUsed = true;
      log(s, "v2.log.turnedCaptivity", "player", { n: lost, shield: Math.min(lost, R.captivityShieldMax) });
      break;
    }
    case "walkedWithGod":
      // Enoch walked with God (Genesis 5:22); before his translation he had this testimony, that he pleased God (Hebrews 11:5).
      addShield(s, "enoch", R.walkShield);
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.walkedWithGod", "player", { n: R.walkShield });
      break;
    case "breadAndWine": {
      // Melchizedek king of Salem brought forth bread and wine: and he was the priest of the most high God (Genesis 14:18).
      const abram = isAlive(s, "abraham");
      if (abram) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, abram ? "v2.log.breadAndWineAbram" : "v2.log.breadAndWine", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.breadHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    }
    case "tenthOfAll": {
      // And he gave him tithes of all (Genesis 14:20).
      const n = supportAmount(s, "tenthOfAll");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.tenthOfAll", "player", { n });
      break;
    }
    case "goUpAtOnce": {
      // Let us go up at once, and possess it; for we are well able to overcome it (Numbers 13:30).
      const n = supportAmount(s, "goUpAtOnce");
      s.energy.attack += n;
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.goUpAtOnce", "player", { n });
      break;
    }
    case "almondRod":
      // I see a rod of an almond tree... for I will hasten my word to perform it (Jeremiah 1:11-12).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.almondRod", "player");
      draw(s, 1, rng);
      break;
    case "watchman":
      // Son of man, I have made thee a watchman unto the house of Israel (Ezekiel 3:17).
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, R.watchmanShield));
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.watchman", "player", { n: R.watchmanShield });
      break;
    case "dryBones":
      // Behold, I will cause breath to enter into you, and ye shall live (Ezekiel 37:5).
      s.dryBonesUsed = true;
      log(s, "v2.log.dryBones", "player");
      dryBonesFallen(s).forEach((id) => {
        if (id === "jesusUR") s.tomb = null;
        const c = s.party[id];
        c.hp = R.dryBonesHp;
        c.shaken = false;
        c.shield = 0;
        c.acted = false;
        log(s, "v2.log.revive", "player", { char: id, hp: c.hp });
      });
      break;
    case "preparedHeart":
      // Ezra had prepared his heart to seek the law of the LORD, and to do it, and to teach (Ezra 7:10).
      log(s, "v2.log.preparedHeart", "player", { n: R.ezraDraw });
      draw(s, R.ezraDraw, rng);
      break;
    case "readTheLaw": {
      // They read in the book in the law of God distinctly, and gave the sense (Nehemiah 8:8).
      const n = supportAmount(s, "readTheLaw");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.readTheLaw", "player", { n });
      break;
    }
    case "houseForever":
      // Thine house and thy kingdom shall be established for ever before thee (2 Samuel 7:16).
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, id === "david" || id === "solomon" ? R.houseKingShield : R.houseShield));
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.houseForever", "player", { n: R.houseShield });
      break;
    case "spreadLetter":
      // Hezekiah... spread it before the LORD; and that night the angel of the LORD went out (2 Kings 19:14, 35).
      s.letterUsed = true;
      log(s, "v2.log.spreadLetter", "player");
      break;
    case "fifteenYears": {
      // I have heard thy prayer, I have seen thy tears... I will add unto thy days fifteen years (2 Kings 20:5-6).
      const c = s.party.hezekiah;
      const healed = Math.min(supportAmount(s, "fifteenYears"), MAX_HP.hezekiah - c.hp);
      c.hp += healed;
      log(s, "v2.log.fifteenYears", "player", { n: healed, hp: c.hp, max: MAX_HP.hezekiah });
      break;
    }
    case "heardTheBook":
      // When the king had heard the words of the book of the law, he rent his clothes (2 Kings 22:11).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.heardTheBook", "player");
      break;
    case "purgeIdols":
      // The king... put down the idolatrous priests, and burned the grove (2 Kings 23:5-6): the leader's gathered blow is broken.
      if (target === bossOf(s) && s.goliath.charging) {
        s.goliath.charging = false;
        log(s, "v2.log.purgeIdols", "player");
      }
      break;
    case "hisStar": {
      // We have seen his star in the east, and are come to worship him (Matthew 2:2).
      const n = supportAmount(s, "hisStar");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.hisStar", "player", { n });
      break;
    }
    case "threeGifts":
      // They presented unto him gifts; gold, and frankincense, and myrrh (Matthew 2:11).
      s.giftsGiven = true;
      s.energy.attack += R.giftAttack;
      log(s, "v2.log.threeGifts", "player", { n: R.giftAttack });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.giftHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        if (!NEVER_FALLS.has(id)) addShield(s, id, R.giftShield);
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "goodTidings":
      // Fear not: for, behold, I bring you good tidings of great joy, which shall be to all people (Luke 2:10).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.goodTidings", "player");
      break;
    case "gloryHighest":
      // Glory to God in the highest, and on earth peace, good will toward men (Luke 2:14).
      log(s, "v2.log.gloryHighest", "player", { n: R.gloryShield });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.gloryHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        if (!NEVER_FALLS.has(id)) addShield(s, id, R.gloryShield);
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "sonOfDavid": {
      // Jesus, thou son of David, have mercy on me (Mark 10:47).
      const n = supportAmount(s, "sonOfDavid");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.sonOfDavid", "player", { n });
      break;
    }
    case "speakTheWord": {
      // Speak the word only, and my servant shall be healed (Matthew 8:8).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(supportAmount(s, "speakTheWord"), MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.speakTheWord", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "underAuthority": {
      // I say to this man, Go, and he goeth; and to another, Come, and he cometh (Matthew 8:9).
      const ally = target as CharacterId;
      s.party[ally].acted = false;
      log(s, "v2.log.underAuthority", "player", { char: ally });
      break;
    }
    case "onlyBelieve": {
      // Be not afraid, only believe (Mark 5:36).
      const n = supportAmount(s, "onlyBelieve");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.onlyBelieve", "player", { n });
      break;
    }
    case "talithaCumi": {
      // Talitha cumi; which is, Damsel, I say unto thee, arise (Mark 5:41).
      const ally = target as CharacterId;
      if (ally === "jesusUR") s.tomb = null;
      const c = s.party[ally];
      c.hp = jesusHere(s) ? MAX_HP[ally] : Math.min(R.talithaHp, MAX_HP[ally]);
      c.shaken = false;
      c.shield = 0;
      c.acted = false;
      s.talithaUsed = true;
      log(s, "v2.log.talithaCumi", "player", { char: ally, hp: c.hp });
      break;
    }
    case "bearHisCross":
      // On him they laid the cross, that he might bear it after Jesus (Luke 23:26).
      s.simonCovers = target as CharacterId;
      addShield(s, "simonCyrene", R.crossShield);
      log(s, "v2.log.bearHisCross", "player", { char: target as CharacterId, n: R.crossShield });
      break;
    case "comingFromCountry": {
      // Simon a Cyrenian, who passed by, coming out of the country (Mark 15:21).
      const c = s.party.simonCyrene;
      const healed = Math.min(R.countryHeal, MAX_HP.simonCyrene - c.hp);
      c.hp += healed;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.comingFromCountry", "player", { n: healed, hp: c.hp, max: MAX_HP.simonCyrene });
      break;
    }
    case "rememberMe": {
      // Lord, remember me when thou comest into thy kingdom (Luke 23:42).
      const n = supportAmount(s, "rememberMe");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.rememberMe", "player", { n });
      break;
    }
    case "paradise": {
      // Verily I say unto thee, To day shalt thou be with me in paradise (Luke 23:43).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.paradiseFaith);
      log(s, "v2.log.paradise", "player", { n: R.paradiseFaith });
      living(s).filter((id) => id !== "thief").forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.paradiseHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      const me = s.party.thief;
      me.hp = 0;
      me.shield = 0;
      me.shaken = false;
      log(s, "v2.log.fallen", "system", { char: "thief" });
      checkDefeat(s);
      break;
    }
    case "swiftToHear": {
      // Let every man be swift to hear, slow to speak, slow to wrath (James 1:19).
      const council = isAlive(s, "peter") || isAlive(s, "paul");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, R.hearShield));
      if (council) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, council ? "v2.log.swiftToHearCouncil" : "v2.log.swiftToHear", "player", { n: R.hearShield });
      break;
    }
    case "railedOn": {
      // One of the malefactors which were hanged railed on him (Luke 23:39): the bitterness costs him too.
      const me = s.party.mockingThief;
      const lost = Math.min(R.railCost, me.hp - 10);
      if (lost > 0) me.hp -= lost;
      log(s, "v2.log.railedOn", "player", { n: Math.max(0, lost), hp: me.hp, max: MAX_HP.mockingThief });
      break;
    }
    case "forgiveThem":
      // Father, forgive them; for they know not what they do (Luke 23:34).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.forgiveThem", "player");
      break;
    case "commitSpirit": {
      // Father, into thy hands I commend my spirit: and having said thus, he gave up the ghost (Luke 23:46).
      s.spiritUsed = true;
      log(s, "v2.log.commitSpirit", "player");
      living(s).filter((id) => id !== "jesusCross").forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.spiritHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      const me = s.party.jesusCross;
      me.hp = 0;
      me.shield = 0;
      me.shaken = false;
      log(s, "v2.log.fallen", "system", { char: "jesusCross" });
      checkDefeat(s);
      break;
    }
    case "twoMites": {
      // She threw in two mites... she of her want did cast in all that she had (Mark 12:42, 44): every energy left becomes Faith.
      const n = 1 + s.energy.attack + s.energy.guard;
      s.energy.attack = 0;
      s.energy.guard = 0;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.twoMites", "player", { n });
      break;
    }
    case "allHerLiving": {
      // She cast in all that she had, even all her living (Mark 12:44): half her HP heals every other ally.
      const me = s.party.widow;
      const gift = toTens(me.hp / 2);
      me.hp -= gift;
      log(s, "v2.log.allHerLiving", "player", { n: gift });
      living(s).filter((id) => id !== "widow").forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(gift, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    }
    case "toiledAllNight":
      // Master, we have toiled all the night, and have taken nothing (Luke 5:5).
      s.energy.attack += 1;
      log(s, "v2.log.toiledAllNight", "player");
      break;
    case "throughTheRoof": {
      // They uncovered the roof... they let down the bed wherein the sick of the palsy lay (Mark 2:4).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(supportAmount(s, "throughTheRoof"), MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.throughTheRoof", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "theirFaith": {
      // When Jesus saw their faith (Mark 2:5).
      const n = supportAmount(s, "theirFaith");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.theirFaith", "player", { n });
      break;
    }
    case "oilAndWine": {
      // He went to him, and bound up his wounds, pouring in oil and wine (Luke 10:34).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.oilHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.oilAndWine", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "twoPence":
      // On the morrow... he took out two pence, and gave them to the host (Luke 10:35).
      s.inn = { ally: target as CharacterId, turns: R.innTurns };
      log(s, "v2.log.twoPence", "player", { char: target as CharacterId, n: R.innHeal });
      break;
    case "hardenedHeart":
      // And he hardened Pharaoh's heart, that he hearkened not unto them (Exodus 7:13).
      addShield(s, "pharaoh", R.hardShield);
      log(s, "v2.log.hardenedHeart", "player", { n: R.hardShield });
      break;
    case "makeBricks":
      // Ye shall no more give the people straw to make brick... yet the tale of the bricks ye shall lay upon them (Exodus 5:7-8).
      s.energy.attack += R.bricksAttack;
      log(s, "v2.log.makeBricks", "player", { n: R.bricksAttack });
      living(s).filter((id) => id !== "pharaoh" && !NEVER_FALLS.has(id)).forEach((id) => {
        const c = s.party[id];
        const lost = Math.max(0, Math.min(R.bricksCost, c.hp - 10));
        c.hp -= lost;
        log(s, "v2.log.bricksToil", "detail", { char: id, n: lost, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "chosenChariots":
      // He took six hundred chosen chariots, and all the chariots of Egypt (Exodus 14:7).
      s.energy.attack += 1;
      addShield(s, "charioteer", R.chariotShield);
      log(s, "v2.log.chosenChariots", "player", { n: R.chariotShield });
      break;
    case "royalCommand":
      // Dost thou now govern the kingdom of Israel? arise... I will give thee the vineyard (1 Kings 21:7).
      s.energy.attack += 1;
      addShield(s, "jezebel", R.queenShield);
      log(s, "v2.log.royalCommand", "player", { n: R.queenShield });
      break;
    case "cutThemselves": {
      // They cried aloud, and cut themselves after their manner with knives (1 Kings 18:28).
      const me = s.party.baalProphet;
      const lost = Math.max(0, Math.min(R.cutCost, me.hp - 10));
      me.hp -= lost;
      s.energy.attack += R.cutAttack;
      log(s, "v2.log.cutThemselves", "player", { n: R.cutAttack, lost, hp: me.hp, max: MAX_HP.baalProphet });
      break;
    }
    case "kingsRing":
      // The king took his ring from his hand, and gave it unto Haman (Esther 3:10).
      s.energy.attack += R.ringAttack;
      log(s, "v2.log.kingsRing", "player", { n: R.ringAttack });
      break;
    case "hamansDecree":
      // So they hanged Haman on the gallows that he had prepared for Mordecai (Esther 7:10).
      if (isAlive(s, "esther") || isAlive(s, "mordecai")) {
        const me = s.party.haman;
        const lost = Math.max(0, Math.min(R.gallowsCost, me.hp - 10));
        me.hp -= lost;
        log(s, "v2.log.gallows", "player", { n: lost, hp: me.hp, max: MAX_HP.haman });
      }
      break;
    case "pieceOfSilver":
      // We will give thee every one of us eleven hundred pieces of silver (Judges 16:5).
      s.energy.attack += 1;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.pieceOfSilver", "player");
      break;
    case "whereinStrength":
      // She called for a man, and she caused him to shave off the seven locks of his head (Judges 16:19).
      if (isAlive(s, "samson")) {
        s.party.samson.shaken = true;
        log(s, "v2.log.samsonShaved", "player");
      }
      break;
    case "sevenTimesHotter":
      // He commanded that they should heat the furnace one seven times more than it was wont to be heated (Daniel 3:19).
      log(s, "v2.log.sevenTimesHotter", "player");
      break;
    case "praiseKingOfHeaven":
      // Now I Nebuchadnezzar praise and extol and honour the King of heaven (Daniel 4:37).
      s.praisedHeaven = true;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.heavenFaith);
      log(s, "v2.log.praiseKingOfHeaven", "player", { n: R.heavenFaith });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.heavenHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "covetVineyard": {
      // Give me thy vineyard, that I may have it for a garden of herbs (1 Kings 21:2).
      const n = supportAmount(s, "covetVineyard");
      s.energy.attack += n;
      log(s, "v2.log.covetVineyard", "player", { n });
      break;
    }
    case "humbledHimself": {
      // Seest thou how Ahab humbleth himself before me? (1 Kings 21:29).
      s.ahabHumbled = true;
      const c = s.party.ahab;
      const healed = Math.min(R.humbledHeal, MAX_HP.ahab - c.hp);
      c.hp += healed;
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.humbledHimself", "player", { n: healed, hp: c.hp, max: MAX_HP.ahab });
      break;
    }
    case "mealNotSpent": {
      // The barrel of meal shall not waste, neither shall the cruse of oil fail (1 Kings 17:14).
      const n = supportAmount(s, "mealNotSpent");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.mealNotSpent", "player", { n });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(n, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    }
    case "littleCake": {
      // Make me thereof a little cake first, and bring it unto me (1 Kings 17:13).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.cakeHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.littleCake", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "littleChamber": {
      // Let us make a little chamber, I pray thee, on the wall (2 Kings 4:10).
      const n = supportAmount(s, "littleChamber");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, n));
      log(s, "v2.log.littleChamber", "player", { n });
      break;
    }
    case "itIsWell": {
      // And she answered, It is well (2 Kings 4:26) — full HP with Elisha beside her.
      const ally = target as CharacterId;
      if (ally === "jesusUR") s.tomb = null;
      const c = s.party[ally];
      c.hp = isAlive(s, "elisha") ? MAX_HP[ally] : Math.min(R.wellHp, MAX_HP[ally]);
      c.shaken = false;
      c.shield = 0;
      c.acted = false;
      s.itIsWellUsed = true;
      log(s, "v2.log.itIsWell", "player", { char: ally, hp: c.hp });
      break;
    }
    case "sevenTimesJordan": {
      // He dipped himself seven times in Jordan... and his flesh came again like the flesh of a little child (2 Kings 5:14).
      s.jordanUsed = true;
      const c = s.party.naaman;
      const healed = MAX_HP.naaman - c.hp;
      c.hp = MAX_HP.naaman;
      living(s).forEach((id) => (s.party[id].shaken = false));
      const elisha = isAlive(s, "elisha");
      if (elisha) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.jordanFaith);
      log(s, elisha ? "v2.log.sevenTimesJordanElisha" : "v2.log.sevenTimesJordan", "player", { n: healed, f: R.jordanFaith });
      break;
    }
    case "wouldGod": {
      // Would God my lord were with the prophet that is in Samaria! for he would recover him of his leprosy (2 Kings 5:3).
      const n = supportAmount(s, "wouldGod");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.wouldGod", "player", { n });
      break;
    }
    case "littleMaid": {
      // A little maid... waited on Naaman's wife (2 Kings 5:2): a quiet, faithful service.
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.maidHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.littleMaid", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "rememberOath": {
      // My lord, thou swarest by the LORD thy God unto thine handmaid, saying, Assuredly Solomon thy son shall reign (1 Kings 1:17).
      const n = supportAmount(s, "rememberOath");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.rememberOath", "player", { n });
      break;
    }
    case "kingsMother": {
      // The king rose up to meet her... and caused a seat to be set for the king's mother (1 Kings 2:19) — twice over for Solomon.
      const ally = target as CharacterId;
      const k = ally === "solomon" ? 2 : 1;
      const c = s.party[ally];
      const healed = Math.min(R.queenMotherHeal * k, MAX_HP[ally] - c.hp);
      c.hp += healed;
      if (!NEVER_FALLS.has(ally)) addShield(s, ally, R.queenMotherShield * k);
      log(s, "v2.log.kingsMother", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "stoleHearts":
      // So Absalom stole the hearts of the men of Israel (2 Samuel 15:6) — at his father's cost.
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.heartsFaith);
      if (isAlive(s, "david")) s.party.david.shaken = true;
      log(s, isAlive(s, "david") ? "v2.log.stoleHeartsDavid" : "v2.log.stoleHearts", "player", { n: R.heartsFaith });
      break;
    case "kingsTable": {
      // As for Mephibosheth, said the king, he shall eat at my table, as one of the king's sons (2 Samuel 9:11).
      const c = s.party.mephibosheth;
      const healed = Math.min(supportAmount(s, "kingsTable"), MAX_HP.mephibosheth - c.hp);
      c.hp += healed;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.kingsTable", "player", { n: healed, hp: c.hp, max: MAX_HP.mephibosheth });
      break;
    }
    case "deadDog":
      // What is thy servant, that thou shouldest look upon such a dead dog as I am? (2 Samuel 9:8).
      living(s).forEach((id) => (s.party[id].shaken = false));
      s.energy.guard += 1;
      log(s, "v2.log.deadDog", "player");
      break;
    case "hardQuestions": {
      // She came to prove him with hard questions... and Solomon told her all her questions (1 Kings 10:1, 3).
      const n = supportAmount(s, "hardQuestions");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.hardQuestions", "player", { n });
      draw(s, n, rng);
      break;
    }
    case "spicesAndGold":
      // She gave the king an hundred and twenty talents of gold, and of spices very great store (1 Kings 10:10).
      s.energy.attack += R.goldAttack;
      log(s, "v2.log.spicesAndGold", "player", { n: R.goldAttack });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.spiceHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "lookedUpon": {
      // Surely the LORD hath looked upon my affliction (Genesis 29:32).
      const c = s.party.leah;
      const low = c.hp <= MAX_HP.leah / 2;
      const healed = Math.min(R.afflictionHeal, MAX_HP.leah - c.hp);
      c.hp += healed;
      if (low) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, low ? "v2.log.lookedUponLow" : "v2.log.lookedUpon", "player", { n: healed, hp: c.hp, max: MAX_HP.leah });
      break;
    }
    case "nowPraise": {
      // Now will I praise the LORD: therefore she called his name Judah (Genesis 29:35).
      const n = supportAmount(s, "nowPraise");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.nowPraise", "player", { n });
      break;
    }
    case "ranToMeet":
      // And Esau ran to meet him, and embraced him, and fell on his neck, and kissed him: and they wept (Genesis 33:4).
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => {
        s.party[id].shaken = false;
        addShield(s, id, id === "jacob" ? R.embraceJacobShield : R.embraceShield);
      });
      log(s, isAlive(s, "jacob") ? "v2.log.ranToMeetJacob" : "v2.log.ranToMeet", "player", { n: R.embraceShield });
      break;
    case "godHeard": {
      // God hath heard the voice of the lad where he is (Genesis 21:17).
      const n = supportAmount(s, "godHeard");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      const c = s.party.hagar;
      const healed = Math.min(R.heardHeal, MAX_HP.hagar - c.hp);
      c.hp += healed;
      log(s, "v2.log.godHeard", "player", { n, heal: healed });
      break;
    }
    case "wellOpened":
      // God opened her eyes, and she saw a well of water (Genesis 21:19).
      s.wellUsed = true;
      log(s, "v2.log.wellOpened", "player", { n: R.wellHeal });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.wellHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        c.shaken = false;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "escapeForLife": {
      // Escape for thy life; look not behind thee (Genesis 19:17) — and God remembered Abraham, and sent Lot out (19:29).
      const abraham = isAlive(s, "abraham");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, R.escapeShield));
      if (abraham) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, abraham ? "v2.log.escapeForLifeAbraham" : "v2.log.escapeForLife", "player", { n: R.escapeShield });
      break;
    }
    case "lookedBack":
      // But his wife looked back from behind him, and she became a pillar of salt (Genesis 19:26).
      s.energy.attack += R.lookBackAttack;
      s.party.lot.shaken = true;
      log(s, "v2.log.lookedBack", "player", { n: R.lookBackAttack });
      break;
    case "arkOfBulrushes": {
      // She took for him an ark of bulrushes, and daubed it with slime and with pitch (Exodus 2:3).
      const ally = target as CharacterId;
      const n = ally === "moses" || ally === "mosesSinai" ? R.bulrushMosesShield : R.bulrushShield;
      addShield(s, ally, n);
      log(s, "v2.log.arkOfBulrushes", "player", { char: ally, n });
      break;
    }
    case "nurseHim": {
      // Take this child away, and nurse it for me, and I will give thee thy wages (Exodus 2:9).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.nurseHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      const f = isAlive(s, "moses") || isAlive(s, "mosesSinai") || isAlive(s, "miriam") ? 2 : 1;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + f);
      log(s, "v2.log.nurseHim", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally], f });
      break;
    }
    case "hadCompassion": {
      // She saw the child: and, behold, the babe wept. And she had compassion on him (Exodus 2:6).
      const ally = target as CharacterId;
      const k = ally === "moses" || ally === "mosesSinai" ? 2 : 1;
      const c = s.party[ally];
      const healed = Math.min(R.compassionHeal * k, MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.hadCompassion", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "drewHimOut": {
      // She called his name Moses: and she said, Because I drew him out of the water (Exodus 2:10).
      const n = supportAmount(s, "drewHimOut");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.drewHimOut", "player", { n });
      break;
    }
    case "shareBurden": {
      // Provide out of all the people able men... and they shall bear the burden with thee (Exodus 18:21-22).
      const moses = isAlive(s, "moses") || isAlive(s, "mosesSinai");
      s.energy.attack += 1;
      s.energy.guard += 1;
      if (moses) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, moses ? "v2.log.shareBurdenMoses" : "v2.log.shareBurden", "player");
      break;
    }
    case "greaterThanAll": {
      // Now I know that the LORD is greater than all gods (Exodus 18:11).
      const n = supportAmount(s, "greaterThanAll");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.greaterThanAll", "player", { n });
      break;
    }
    case "wateredFlock": {
      // Moses stood up and helped them, and watered their flock (Exodus 2:17).
      const moses = isAlive(s, "moses") || isAlive(s, "mosesSinai");
      log(s, moses ? "v2.log.wateredFlockMoses" : "v2.log.wateredFlock", "player", { n: R.flockHeal });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.flockHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        if (moses && !NEVER_FALLS.has(id)) addShield(s, id, R.flockShield);
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    }
    case "strangerLand": {
      // She bare him a son, and he called his name Gershom: for he said, I have been a stranger in a strange land (Exodus 2:22).
      const n = supportAmount(s, "strangerLand");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.strangerLand", "player", { n });
      break;
    }
    case "unfeignedFaith": {
      // The unfeigned faith that is in thee, which dwelt first in thy grandmother Lois, and thy mother Eunice (2 Timothy 1:5).
      const n = supportAmount(s, "unfeignedFaith");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.unfeignedFaith", "player", { n });
      break;
    }
    case "fromAChild":
      // From a child thou hast known the holy scriptures (2 Timothy 3:15).
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, id === "timothy" ? R.childTimothyShield : R.childShield));
      log(s, "v2.log.fromAChild", "player", { n: R.childShield });
      draw(s, 1, rng);
      break;
    case "soldPossession":
      // Ananias, with Sapphira his wife, sold a possession (Acts 5:1).
      s.energy.attack += R.soldAttack;
      log(s, "v2.log.soldPossession", "player", { n: R.soldAttack });
      break;
    case "keptBackPart": {
      // And kept back part of the price... Why hath Satan filled thine heart to lie to the Holy Ghost? (Acts 5:2-3).
      const me = s.party.sapphira;
      if (isAlive(s, "peter")) {
        const lost = Math.max(0, Math.min(R.keptCost, me.hp - 10));
        me.hp -= lost;
        me.shaken = true;
        log(s, "v2.log.keptBackFound", "player", { n: lost, hp: me.hp, max: MAX_HP.sapphira });
      } else {
        s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.keptFaith);
        log(s, "v2.log.keptBackPart", "player", { n: R.keptFaith });
      }
      break;
    }
    case "noFault":
      // I find no fault in this man (Luke 23:4).
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, R.noFaultShield));
      log(s, "v2.log.noFault", "player", { n: R.noFaultShield });
      break;
    case "washedHands":
      // He took water, and washed his hands before the multitude, saying, I am innocent (Matthew 27:24).
      living(s).filter((id) => id !== "pilate").forEach((id) => (s.party[id].shield = 0));
      s.party.pilate.shaken = false;
      addShield(s, "pilate", R.washShield);
      s.energy.attack += 1;
      log(s, "v2.log.washedHands", "player", { n: R.washShield });
      break;
    case "oneManDie": {
      // It is expedient for us, that one man should die for the people (John 11:50) — another pays for it.
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.expedientFaith);
      const victim = living(s).filter((id) => id !== "caiaphas" && !NEVER_FALLS.has(id)).sort((a, b) => s.party[b].hp - s.party[a].hp)[0];
      if (victim) {
        const c = s.party[victim];
        const lost = Math.max(0, Math.min(R.expedientCost, c.hp - 10));
        c.hp -= lost;
        log(s, "v2.log.oneManDie", "player", { n: R.expedientFaith, char: victim, lost });
      } else log(s, "v2.log.oneManDieAlone", "player", { n: R.expedientFaith });
      break;
    }
    case "hopedSign":
      // He hoped to have seen some miracle done by him (Luke 23:8).
      log(s, "v2.log.hopedSign", "player", { n: R.signDraw });
      draw(s, R.signDraw, rng);
      break;
    case "gorgeousRobe": {
      // Herod... arrayed him in a gorgeous robe... and Pilate and Herod were made friends together (Luke 23:11-12).
      const pilate = isAlive(s, "pilate");
      addShield(s, "herod", R.robeShield);
      s.energy.attack += 1;
      if (pilate) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, pilate ? "v2.log.gorgeousRobePilate" : "v2.log.gorgeousRobe", "player", { n: R.robeShield });
      break;
    }
    case "releasedUnto": {
      // And so Pilate... released Barabbas unto them, and delivered Jesus (Mark 15:15) — another took his place.
      s.releasedUsed = true;
      const c = s.party.barabbas;
      const healed = MAX_HP.barabbas - c.hp;
      c.hp = MAX_HP.barabbas;
      c.shaken = false;
      const jesus = jesusHere(s);
      if (jesus) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.releasedFaith);
      log(s, jesus ? "v2.log.releasedUntoJesus" : "v2.log.releasedUnto", "player", { n: healed, f: R.releasedFaith });
      break;
    }
    case "convenientDay": {
      // And when a convenient day was come, that Herod on his birthday made a supper (Mark 6:21).
      const herod = isAlive(s, "herod");
      s.energy.attack += R.convenientAttack;
      if (herod) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, herod ? "v2.log.convenientDayHerod" : "v2.log.convenientDay", "player", { n: R.convenientAttack });
      break;
    }
    case "heldGrudge":
      // Therefore Herodias had a quarrel against him, and would have killed him (Mark 6:19).
      if (isAlive(s, "johnBaptist")) {
        s.party.johnBaptist.shaken = true;
        log(s, "v2.log.grudgeJohn", "player");
      }
      break;
    case "shieldWall":
      // Shields locked together: he covers himself, and a little of those beside him.
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, id === "romanSoldier" ? R.scutumShield : R.wallAllyShield));
      log(s, "v2.log.shieldWall", "player", { n: R.scutumShield });
      break;
    case "braceSpears":
      // Two hundred spearmen... to bring Paul safe (Acts 23:23-24): the line holds in front of the one it guards.
      s.spearCovers = target as CharacterId;
      addShield(s, "romanSpearman", R.braceShield);
      log(s, "v2.log.braceSpears", "player", { char: target as CharacterId, n: R.braceShield });
      break;
    case "rideOut":
      // On the morrow they left the horsemen to go with him (Acts 23:32): swift riders bring word and strength.
      s.energy.attack += 1;
      log(s, "v2.log.rideOut", "player");
      draw(s, 1, rng);
      break;
    case "commandCohort": {
      // I say to this man, Go, and he goeth (Matthew 8:9): +1 Attack, +1 more for each Roman soldier under him (up to 3).
      const troops = (["romanSoldier", "romanSpearman", "romanArcher", "romanCavalry"] as CharacterId[]).filter((id) => isAlive(s, id)).length;
      const n = Math.min(3, 1 + troops);
      s.energy.attack += n;
      log(s, "v2.log.commandCohort", "player", { n });
      break;
    }
    case "trulySonOfGod": {
      // When the centurion... saw that he so cried out, and gave up the ghost, he said, Truly this man was the Son of God (Mark 15:39).
      const n = jesusHere(s) || isAlive(s, "jesusCross") ? 3 : 2;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.trulySonOfGod", "player", { n });
      break;
    }
    case "whomTrust": {
      // Now on whom dost thou trust, that thou rebellest against me? (2 Kings 18:20) — Hezekiah answers by praying.
      s.energy.attack += 2;
      const hezekiah = isAlive(s, "hezekiah");
      if (hezekiah) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, hezekiah ? "v2.log.whomTrustHezekiah" : "v2.log.whomTrust", "player");
      break;
    }
    case "fencedCities":
      // Sennacherib king of Assyria came up against all the fenced cities of Judah (2 Kings 18:13).
      if (isAlive(s, "hezekiah")) {
        // That night the angel of the LORD went out, and smote in the camp of the Assyrians (2 Kings 19:35).
        const me = s.party.sennacherib;
        const lost = Math.max(0, Math.min(R.campSmitten, me.hp - 10));
        me.hp -= lost;
        log(s, "v2.log.campSmitten", "player", { n: lost, hp: me.hp, max: MAX_HP.sennacherib });
      }
      break;
    case "goldenVessels":
      // They brought the golden vessels taken out of the temple... and drank wine in them (Daniel 5:3-4) — then his knees smote one against another (5:6).
      s.energy.attack += R.vesselsAttack;
      s.party.belshazzar.shaken = true;
      log(s, "v2.log.goldenVessels", "player", { n: R.vesselsAttack });
      break;
    case "writingOnWall": {
      // MENE, MENE, TEKEL, UPHARSIN (Daniel 5:25) — and they clothed Daniel with scarlet (5:29).
      const n = supportAmount(s, "writingOnWall");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      if (isAlive(s, "daniel")) addShield(s, "daniel", R.scarletShield);
      log(s, isAlive(s, "daniel") ? "v2.log.writingDaniel" : "v2.log.writingOnWall", "player", { n });
      break;
    }
    case "donkeySaw":
      // The ass saw the angel of the LORD standing in the way... and turned aside (Numbers 22:23).
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => {
        addShield(s, id, R.donkeyShield);
        s.party[id].shaken = false;
      });
      log(s, "v2.log.donkeySaw", "player", { n: R.donkeyShield });
      break;
    case "blessNotCurse":
      // How shall I curse, whom God hath not cursed? (Numbers 23:8).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.blessNotCurse", "player", { n: R.blessHeal });
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.blessHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "takeTooMuch":
      // Ye take too much upon you, seeing all the congregation are holy (Numbers 16:3).
      s.energy.attack += 2;
      (["moses", "mosesSinai", "aaron"] as CharacterId[]).filter((id) => isAlive(s, id)).forEach((id) => (s.party[id].shaken = true));
      log(s, "v2.log.takeTooMuch", "player");
      break;
    case "strangeCensers": {
      // The earth opened her mouth, and swallowed them up (Numbers 16:32) — when they stood against Moses and Aaron.
      if (isAlive(s, "moses") || isAlive(s, "mosesSinai") || isAlive(s, "aaron")) {
        const me = s.party.korah;
        const lost = Math.max(0, Math.min(R.censerCost, me.hp - 10));
        me.hp -= lost;
        log(s, "v2.log.earthOpened", "player", { n: lost, hp: me.hp, max: MAX_HP.korah });
      }
      break;
    }
    case "hiddenSpoil": {
      // I saw among the spoils a goodly Babylonish garment... and hid them in the earth (Joshua 7:21).
      const me = s.party.achan;
      if (isAlive(s, "joshua")) {
        const lost = Math.max(0, Math.min(R.spoilCost, me.hp - 10));
        me.hp -= lost;
        me.shaken = true;
        log(s, "v2.log.spoilFound", "player", { n: lost, hp: me.hp, max: MAX_HP.achan });
      } else {
        s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.spoilFaith);
        log(s, "v2.log.hiddenSpoil", "player", { n: R.spoilFaith });
      }
      break;
    }
    case "troubleOfAchor": {
      // Why hast thou troubled us? the LORD shall trouble thee this day (Joshua 7:25).
      const me = s.party.achan;
      const lost = Math.max(0, Math.min(R.achorCost, me.hp - 10));
      me.hp -= lost;
      log(s, "v2.log.troubleOfAchor", "player", { n: lost, hp: me.hp, max: MAX_HP.achan });
      break;
    }
    case "ironChariots":
      // Sisera gathered together all his chariots, even nine hundred chariots of iron (Judges 4:13).
      log(s, "v2.log.ironChariots", "player");
      if (isAlive(s, "deborah") || isAlive(s, "barak")) {
        // And the LORD discomfited Sisera, and all his chariots... before Barak (Judges 4:15).
        s.party.sisera.shaken = true;
        log(s, "v2.log.ironRouted", "player");
      }
      break;
    case "fledToTent": {
      // Sisera fled away on his feet to the tent of Jael... she gave him drink, and covered him (Judges 4:17-19).
      const me = s.party.sisera;
      if (isAlive(s, "jael")) {
        // Then Jael took a nail of the tent, and took an hammer in her hand (Judges 4:21).
        const lost = Math.max(0, Math.min(R.siseraPegCost, me.hp - 10));
        me.hp -= lost;
        me.shaken = true;
        s.energy.attack += 1;
        log(s, "v2.log.siseraPeg", "player", { n: lost, hp: me.hp, max: MAX_HP.sisera });
      } else {
        const healed = Math.min(R.siseraMilkHeal, MAX_HP.sisera - me.hp);
        me.hp += healed;
        addShield(s, "sisera", R.siseraMantleShield);
        log(s, "v2.log.fledToTent", "player", { n: healed, shield: R.siseraMantleShield });
      }
      break;
    }
    case "privilyCalled":
      if (isAlive(s, "magi") || isAlive(s, "josephNaz")) {
        // Being warned of God in a dream... they departed into their own country another way (Matthew 2:12-13).
        s.party.herodGreat.shaken = true;
        log(s, "v2.log.privilyFoiled", "player");
      } else {
        // Herod, when he had privily called the wise men, enquired of them diligently (Matthew 2:7).
        log(s, "v2.log.privilyCalled", "player", { n: R.privilyDraw });
        draw(s, R.privilyDraw, rng);
      }
      break;
    case "exceedingWroth": {
      // Herod... was exceeding wroth (Matthew 2:16).
      const me = s.party.herodGreat;
      const lost = Math.max(0, Math.min(R.wrothCost, me.hp - 10));
      me.hp -= lost;
      log(s, "v2.log.exceedingWroth", "player", { n: lost, hp: me.hp, max: MAX_HP.herodGreat });
      break;
    }
    case "rightMind":
      // They see him that was possessed with the devil... sitting, and clothed, and in his right mind (Mark 5:15).
      living(s).forEach((id) => (s.party[id].shaken = false));
      addShield(s, "legionFreed", R.legionShield);
      log(s, "v2.log.rightMind", "player", { n: R.legionShield });
      if (jesusHere(s)) {
        s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.legionFaith);
        log(s, "v2.log.rightMindJesus", "player", { n: R.legionFaith });
      }
      break;
    case "tellHowGreat":
      // Go home to thy friends, and tell them how great things the Lord hath done for thee (Mark 5:19).
      log(s, "v2.log.tellHowGreat", "player", { n: R.tellDraw, heal: R.tellHeal });
      draw(s, R.tellDraw, rng);
      living(s).forEach((id) => {
        const c = s.party[id];
        c.hp += Math.min(R.tellHeal, MAX_HP[id] - c.hp);
      });
      break;
    case "cameToHimself": {
      // And when he came to himself... I will arise and go to my father (Luke 15:17-18).
      const low = s.party.prodigal.hp <= MAX_HP.prodigal / 2;
      const n = low ? R.prodigalLowFaith : R.prodigalFaith;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, low ? "v2.log.cameToHimselfLow" : "v2.log.cameToHimself", "player", { n });
      break;
    }
    case "bestRobe": {
      // Bring forth the best robe, and put it on him... for this my son was dead, and is alive again (Luke 15:22-24).
      const me = s.party.prodigal;
      const healed = Math.min(R.prodigalRobeHeal, MAX_HP.prodigal - me.hp);
      me.hp += healed;
      addShield(s, "prodigal", R.prodigalRobeShield);
      log(s, "v2.log.bestRobe", "player", { n: healed, shield: R.prodigalRobeShield });
      break;
    }
    case "readingIsaiah": {
      // Understandest thou what thou readest? How can I, except some man should guide me? (Acts 8:30-31).
      const guided = isAlive(s, "philip");
      const n = guided ? R.eunuchPhilipFaith : R.eunuchFaith;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, guided ? "v2.log.readingIsaiahPhilip" : "v2.log.readingIsaiah", "player", { n });
      break;
    }
    case "wentRejoicing":
      // And he went on his way rejoicing (Acts 8:39).
      living(s).forEach((id) => {
        const c = s.party[id];
        c.hp += Math.min(R.rejoicingHeal, MAX_HP[id] - c.hp);
      });
      s.energy.attack += 1;
      log(s, "v2.log.wentRejoicing", "player", { n: R.rejoicingHeal });
      break;
    case "inTheSpirit":
      // I was in the Spirit on the Lord's day, and heard behind me a great voice, as of a trumpet (Revelation 1:10).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.patmosFaith);
      log(s, "v2.log.inTheSpirit", "player", { n: R.patmosFaith });
      draw(s, 1, rng);
      break;
    case "newHeaven":
      // And God shall wipe away all tears from their eyes; and there shall be no more death (Revelation 21:4).
      living(s).forEach((id) => {
        const c = s.party[id];
        c.hp += Math.min(R.newHeavenHeal, MAX_HP[id] - c.hp);
        c.shaken = false;
      });
      s.energy.attack += 1;
      log(s, "v2.log.newHeaven", "player", { n: R.newHeavenHeal });
      break;
    case "leftHanded":
      // Ehud put forth his left hand, and took the dagger from his right thigh (Judges 3:21).
      log(s, "v2.log.leftHanded", "player");
      break;
    case "blewTrumpet":
      // He blew a trumpet in the mountain of Ephraim... Follow after me: for the LORD hath delivered your enemies (Judges 3:27-28).
      s.energy.attack += R.trumpetAttack;
      addShield(s, "ehud", R.trumpetShield);
      log(s, "v2.log.blewTrumpet", "player", { n: R.trumpetAttack, shield: R.trumpetShield });
      break;
    case "judgeThisDay":
      // The LORD the Judge be judge this day between the children of Israel and the children of Ammon (Judges 11:27).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.judgeFaith);
      addShield(s, "jephthah", R.judgeShield);
      log(s, "v2.log.judgeThisDay", "player", { n: R.judgeFaith, shield: R.judgeShield });
      break;
    case "rashVow": {
      // I have opened my mouth unto the LORD, and I cannot go back (Judges 11:35).
      const me = s.party.jephthah;
      const lost = Math.max(0, Math.min(R.vowCost, me.hp - 10));
      me.hp -= lost;
      me.shaken = true;
      log(s, "v2.log.rashVow", "player", { n: lost, hp: me.hp, max: MAX_HP.jephthah });
      break;
    }
    case "playTheMen":
      // Be of good courage, and let us play the men for our people, and for the cities of our God (2 Samuel 10:12).
      living(s).forEach((id) => addShield(s, id, R.joabShield));
      s.energy.attack += 1;
      log(s, "v2.log.playTheMen", "player", { n: R.joabShield });
      break;
    case "threeDarts":
      // He took three darts in his hand, and thrust them through the heart of Absalom (2 Samuel 18:14).
      log(s, "v2.log.threeDarts", "player");
      if (isAlive(s, "absalom")) {
        const ab = s.party.absalom;
        const lost = Math.max(0, Math.min(R.dartsCost, ab.hp - 10));
        ab.hp -= lost;
        log(s, "v2.log.threeDartsAbsalom", "player", { n: lost, hp: ab.hp, max: MAX_HP.absalom });
      }
      break;
    case "wouldNotGoHome":
      // The ark, and Israel, and Judah, abide in tents... shall I then go into mine house? (2 Samuel 11:11).
      addShield(s, "uriah", R.uriahShield);
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.uriahFaith);
      log(s, "v2.log.wouldNotGoHome", "player", { n: R.uriahShield, faith: R.uriahFaith });
      break;
    case "hottestBattle": {
      // Set ye Uriah in the forefront of the hottest battle, and retire ye from him (2 Samuel 11:15).
      const me = s.party.uriah;
      const betrayed = isAlive(s, "david");
      const lost = Math.max(0, Math.min(betrayed ? R.hottestBetrayed : R.hottestCost, me.hp - 10));
      me.hp -= lost;
      log(s, betrayed ? "v2.log.hottestBetrayed" : "v2.log.hottestBattle", "player", { n: lost, hp: me.hp, max: MAX_HP.uriah });
      break;
    }
    case "sorceries":
      if (isAlive(s, "philip")) {
        // Then Simon himself believed also: and when he was baptized, he continued with Philip (Acts 8:13).
        s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.sorceryFaith);
        log(s, "v2.log.sorceriesBelieved", "player", { n: R.sorceryFaith });
      } else {
        // He had bewitched them with sorceries (Acts 8:11).
        s.energy.attack += R.sorceryAttack;
        log(s, "v2.log.sorceries", "player", { n: R.sorceryAttack });
      }
      break;
    case "offeredMoney": {
      // He offered them money, saying, Give me also this power (Acts 8:18-19).
      const n = s.energy.attack;
      s.energy.attack = 0;
      if (isAlive(s, "peter")) {
        // Thy money perish with thee, because thou hast thought that the gift of God may be purchased with money (Acts 8:20).
        s.party.simonMagus.shaken = true;
        log(s, "v2.log.moneyPerish", "player", { n });
      } else {
        s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
        log(s, "v2.log.offeredMoney", "player", { n });
      }
      break;
    }
    case "pleasedJews":
      if (isAlive(s, "peter")) {
        // Peter therefore was kept in prison: but prayer was made without ceasing... and his chains fell off (Acts 12:5-7).
        s.party.herodAgrippa.shaken = true;
        log(s, "v2.log.peterFreed", "player");
      } else {
        // Because he saw it pleased the Jews, he proceeded further (Acts 12:3).
        s.energy.attack += R.agrippaAttack;
        log(s, "v2.log.pleasedJews", "player", { n: R.agrippaAttack });
      }
      break;
    case "voiceOfGod": {
      // It is the voice of a god, and not of a man. And immediately the angel of the Lord smote him (Acts 12:22-23).
      const me = s.party.herodAgrippa;
      const lost = Math.max(0, Math.min(R.voiceCost, me.hp - 10));
      me.hp -= lost;
      log(s, "v2.log.voiceOfGod", "player", { n: lost, hp: me.hp, max: MAX_HP.herodAgrippa });
      break;
    }
    case "cyrusDecree":
      // The LORD stirred up the spirit of Cyrus... Who is there among you of all his people? let him go up to Jerusalem (Ezra 1:1-3).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.cyrusFaith);
      log(s, "v2.log.cyrusDecree", "player", { n: R.cyrusFaith });
      if (isAlive(s, "ezra") || isAlive(s, "nehemiah") || isAlive(s, "daniel")) {
        s.energy.attack += 1;
        log(s, "v2.log.cyrusGoUp", "player");
      }
      break;
    case "returnVessels":
      // Cyrus king of Persia brought forth the vessels of the house of the LORD (Ezra 1:7).
      living(s).forEach((id) => addShield(s, id, R.cyrusShield));
      log(s, "v2.log.returnVessels", "player", { n: R.cyrusShield });
      break;
    case "laidFoundation":
      // When the builders laid the foundation of the temple... all the people shouted with a great shout (Ezra 3:10-11).
      addShield(s, "zerubbabel", R.foundationShield);
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.foundationFaith);
      log(s, "v2.log.laidFoundation", "player", { n: R.foundationShield, faith: R.foundationFaith });
      break;
    case "notByMight":
      // Not by might, nor by power, but by my spirit, saith the LORD of hosts... O great mountain? before Zerubbabel thou shalt become a plain (Zechariah 4:6-7).
      log(s, "v2.log.notByMight", "player");
      break;
    case "refusedToCome":
      // But the queen Vashti refused to come at the king's commandment (Esther 1:12).
      addShield(s, "vashti", R.vashtiShield);
      log(s, "v2.log.refusedToCome", "player", { n: R.vashtiShield });
      break;
    case "royalFeast":
      // Also Vashti the queen made a feast for the women in the royal house (Esther 1:9).
      living(s).forEach((id) => {
        const c = s.party[id];
        c.hp += Math.min(R.vashtiFeastHeal, MAX_HP[id] - c.hp);
      });
      log(s, "v2.log.royalFeast", "player", { n: R.vashtiFeastHeal });
      if (isAlive(s, "esther")) {
        // Let the king give her royal estate unto another that is better than she (Esther 1:19).
        s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
        log(s, "v2.log.royalEstate", "player");
      }
      break;
    case "letDownWindow": {
      // So Michal let David down through a window: and he went, and fled, and escaped (1 Samuel 19:12).
      const ally = target as CharacterId;
      const n = ally === "david" ? R.michalDavidShield : R.michalShield;
      addShield(s, ally, n);
      s.party[ally].shaken = false;
      log(s, "v2.log.letDownWindow", "player", { char: ally, n });
      break;
    }
    case "imageInBed":
      // Michal took an image, and laid it in the bed... and covered it with a cloth (1 Samuel 19:13).
      addShield(s, "michal", R.michalDecoyShield);
      log(s, "v2.log.imageInBed", "player", { n: R.michalDecoyShield });
      draw(s, 1, rng);
      break;
    case "ranAfterNaaman":
      if (isAlive(s, "elisha")) {
        // Went not mine heart with thee, when the man turned again from his chariot to meet thee? (2 Kings 5:26).
        const me = s.party.gehazi;
        const lost = Math.max(0, Math.min(R.gehaziCost, me.hp - 10));
        me.hp -= lost;
        me.shaken = true;
        log(s, "v2.log.gehaziFound", "player", { n: lost, hp: me.hp, max: MAX_HP.gehazi });
      } else {
        // As the LORD liveth, I will run after him, and take somewhat of him (2 Kings 5:20).
        s.energy.attack += R.gehaziAttack;
        log(s, "v2.log.ranAfterNaaman", "player", { n: R.gehaziAttack });
      }
      break;
    case "twoTalents":
      // He bound two talents of silver in two bags, with two changes of garments (2 Kings 5:23).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.twoTalents", "player");
      draw(s, 1, rng);
      break;
    case "drivethFuriously":
      // The driving is like the driving of Jehu the son of Nimshi; for he driveth furiously (2 Kings 9:20).
      log(s, "v2.log.drivethFuriously", "player");
      break;
    case "zealForLord":
      // Come with me, and see my zeal for the LORD (2 Kings 10:16).
      s.energy.attack += R.jehuAttack;
      log(s, "v2.log.zealForLord", "player", { n: R.jehuAttack });
      living(s).filter((id) => id === "ahab" || id === "jezebel" || id === "baalProphet").forEach((id) => {
        s.party[id].shaken = true;
        log(s, "v2.log.zealShakes", "detail", { char: id });
      });
      break;
    case "lordHelpMe": {
      // Then came she and worshipped him, saying, Lord, help me (Matthew 15:25).
      const n = supportAmount(s, "lordHelpMe");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + n);
      log(s, "v2.log.lordHelpMe", "player", { n });
      break;
    }
    case "crumbs": {
      // Yet the dogs eat of the crumbs... O woman, great is thy faith (Matthew 15:27-28).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(supportAmount(s, "crumbs"), MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.crumbs", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "keptAllThese":
      // All these things have I kept from my youth up: what lack I yet? (Matthew 19:20).
      addShield(s, "richRuler", R.rulerShield);
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.keptAllThese", "player", { n: R.rulerShield });
      break;
    case "greatPossessions":
      // He went away sorrowful: for he had great possessions (Matthew 19:22).
      s.energy.attack += R.possessionsAttack;
      s.party.richRuler.shaken = true;
      log(s, "v2.log.greatPossessions", "player", { n: R.possessionsAttack });
      break;
    case "heartsBurn":
      // Did not our heart burn within us, while he talked with us by the way? (Luke 24:32).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.burnFaith);
      log(s, "v2.log.heartsBurn", "player", { n: R.burnFaith });
      if (jesusHere(s)) {
        s.energy.attack += 1;
        log(s, "v2.log.heartsBurnJesus", "player");
      }
      break;
    case "breakingBread":
      // He took bread, and blessed it, and brake... and their eyes were opened, and they knew him (Luke 24:30-31).
      living(s).forEach((id) => {
        const c = s.party[id];
        c.hp += Math.min(R.emmausHeal, MAX_HP[id] - c.hp);
        c.shaken = false;
      });
      log(s, "v2.log.breakingBread", "player", { n: R.emmausHeal });
      break;
    case "lanternsTorches":
      // Judas then, having received a band of men and officers... cometh thither with lanterns and torches and weapons (John 18:3).
      s.energy.attack += 1;
      log(s, "v2.log.lanternsTorches", "player");
      draw(s, 1, rng);
      break;
    case "earHealed": {
      // And he touched his ear, and healed him (Luke 22:51).
      const me = s.party.malchus;
      const withJesus = jesusHere(s);
      const healed = withJesus ? MAX_HP.malchus - me.hp : Math.min(R.earHeal, MAX_HP.malchus - me.hp);
      me.hp += healed;
      if (withJesus) addShield(s, "malchus", R.earJesusShield);
      log(s, withJesus ? "v2.log.earHealedJesus" : "v2.log.earHealed", "player", { n: healed, shield: R.earJesusShield });
      break;
    }
    case "whatMustIDo":
      // Sirs, what must I do to be saved? Believe on the Lord Jesus Christ, and thou shalt be saved, and thy house (Acts 16:30-31).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.jailerFaith);
      log(s, "v2.log.whatMustIDo", "player", { n: R.jailerFaith });
      if (isAlive(s, "paul") || isAlive(s, "silas")) {
        log(s, "v2.log.whatMustIDoPaul", "player");
        draw(s, 1, rng);
      }
      break;
    case "washedStripes":
      // He took them the same hour of the night, and washed their stripes (Acts 16:33).
      living(s).forEach((id) => {
        const c = s.party[id];
        c.hp += Math.min(R.stripesHeal, MAX_HP[id] - c.hp);
      });
      log(s, "v2.log.washedStripes", "player", { n: R.stripesHeal });
      break;
    case "forGladness":
      // When she knew Peter's voice, she opened not the gate for gladness (Acts 12:14).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.gladFaith);
      log(s, "v2.log.forGladness", "player", { n: R.gladFaith });
      if (isAlive(s, "peter")) {
        s.energy.attack += 1;
        log(s, "v2.log.forGladnessPeter", "player");
      }
      break;
    case "ranInTold":
      // But ran in, and told how Peter stood before the gate... and when they had opened the door, and saw him, they were astonished (Acts 12:14-16).
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.ranInTold", "player");
      draw(s, 1, rng);
      break;
    case "comeSee":
      // Come, see a man, which told me all things that ever I did (John 4:29).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      s.energy.attack += 1;
      log(s, "v2.log.comeSee", "player");
      break;
    case "byNight": {
      // The same came to Jesus by night (John 3:2).
      const n = supportAmount(s, "byNight");
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.nightFaith);
      log(s, "v2.log.byNight", "player", { n });
      draw(s, n, rng);
      break;
    }
    case "bornAgain": {
      // Except a man be born again, he cannot see the kingdom of God (John 3:3).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = MAX_HP[ally] - c.hp;
      c.hp = MAX_HP[ally];
      c.shaken = false;
      s.bornAgainUsed = true;
      log(s, "v2.log.bornAgain", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "belovedBrother":
      // Not now as a servant, but above a servant, a brother beloved (Philemon 1:16).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.brotherFaith);
      s.party.onesimus.shaken = false;
      log(s, "v2.log.belovedBrother", "player");
      break;
    case "refreshed":
      // The bowels of the saints are refreshed by thee, brother (Philemon 1:7).
      log(s, "v2.log.refreshed", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.refreshHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        c.shaken = false;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "receiveHim": {
      // Receive him, as myself (Philemon 1:17).
      const c = s.party[target as CharacterId];
      c.hp = supportAmount(s, "receiveHim");
      c.shaken = false;
      c.shield = 0;
      c.acted = false;
      s.receiveUsed = true;
      log(s, "v2.log.revive", "player", { char: target, hp: c.hp });
      break;
    }
    case "setInOrder":
      // That thou shouldest set in order the things that are wanting (Titus 1:5): one Faith becomes a Guard and an Attack.
      s.energy.guard = Math.min(R.maxGuard, s.energy.guard + 1);
      s.energy.attack += 1;
      log(s, "v2.log.setInOrder", "player");
      break;
    case "earnestCare": {
      // God, which put the same earnest care into the heart of Titus for you (2 Corinthians 8:16).
      const n = supportAmount(s, "earnestCare");
      log(s, "v2.log.earnestCare", "player", { n });
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, n));
      break;
    }
    case "departed": {
      // John departing from them returned to Jerusalem (Acts 13:13).
      const gained = Math.min(R.departFaith, R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      s.markLeft = true;
      log(s, "v2.log.departed", "player", { n: gained });
      break;
    }
    case "physician": {
      // Luke, the beloved physician (Colossians 4:14) — twice the care for Paul.
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.physicianHeal * (ally === "paul" ? 2 : 1), MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.physician", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "inOrder":
      // To write unto thee in order (Luke 1:3).
      log(s, "v2.log.inOrder", "player", { n: R.orderDraw });
      draw(s, R.orderDraw, rng);
      break;
    case "succourer": {
      // She hath been a succourer of many, and of myself also (Romans 16:2).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.succourHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      s.energy.guard = Math.min(R.maxGuard, s.energy.guard + 1);
      log(s, "v2.log.succourer", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "bearLetter": {
      // I commend unto you Phoebe our sister (Romans 16:1) — carrying Paul's letter to Rome.
      const k = isAlive(s, "paul") ? 2 : 1;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.letterFaith * k);
      log(s, "v2.log.bearLetter", "player", { n: R.letterDraw * k });
      draw(s, R.letterDraw * k, rng);
      break;
    }
    case "watered":
      // I have planted, Apollos watered; but God gave the increase (1 Corinthians 3:6).
      log(s, "v2.log.watered", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.wateredHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "prayersAlms":
      // Thy prayers and thine alms are come up for a memorial before God... call for Simon (Acts 10:4-5).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.memorialFaith);
      if (isAlive(s, "peter")) s.energy.attack += 1;
      log(s, "v2.log.prayersAlms", "player");
      break;
    case "garments":
      // The coats and garments which Dorcas made, while she was with them (Acts 9:39).
      log(s, "v2.log.garments", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        c.hp += Math.min(R.garmentHeal, MAX_HP[id] - c.hp);
        if (!NEVER_FALLS.has(id)) addShield(s, id, R.garmentShield);
      });
      break;
    case "almsdeeds": {
      // This woman was full of good works and almsdeeds (Acts 9:36).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.almsHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.almsdeeds", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "layDownNeck":
      s.aquilaCovers = target as CharacterId;
      log(s, "v2.log.layDownNeck", "player", { char: target as CharacterId });
      if (isAlive(s, "priscilla")) addShield(s, "aquila", R.aquilaShield);
      break;
    case "goInPeace": {
      // Go in peace: and the God of Israel grant thee thy petition (1 Samuel 1:17) — twice over for Hannah.
      const ally = target as CharacterId;
      const k = ally === "hannah" ? 2 : 1;
      const c = s.party[ally];
      const healed = Math.min(R.peaceHeal * k, MAX_HP[ally] - c.hp);
      c.hp += healed;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.peaceFaith * k);
      log(s, "v2.log.goInPeace", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "speakLord": {
      // Speak, LORD; for thy servant heareth (1 Samuel 3:9).
      const ally = target as CharacterId;
      s.party[ally].acted = false;
      s.speakUsed = true;
      if (ally === "samuel") s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      log(s, "v2.log.speakLord", "player", { char: ally });
      break;
    }
    case "tentmaking":
      // By their occupation they were tentmakers (Acts 18:3).
      log(s, "v2.log.tentmaking", "player");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, R.tentShield));
      break;
    case "expound":
      s.taught = target as CharacterId;
      log(s, "v2.log.expound", "player", { char: target as CharacterId, n: R.expoundBonus });
      break;
    case "purpleCloth":
      // Lydia, a seller of purple, of the city of Thyatira (Acts 16:14).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.purpleFaith);
      log(s, "v2.log.purpleCloth", "player", { char: target as CharacterId });
      addShield(s, target as CharacterId, R.purpleShield);
      break;
    case "abideHouse":
      // Come into my house, and abide there (Acts 16:15) — where Paul and Silas came again (Acts 16:40).
      log(s, "v2.log.abideHouse", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.abideHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      if (isAlive(s, "paul") || isAlive(s, "silas")) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      break;
    case "example":
      s.example = true;
      log(s, "v2.log.example", "player", { n: R.exampleBonus });
      break;
    case "midnightHymns":
      living(s).forEach((id) => (s.party[id].shaken = false));
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + supportAmount(s, "midnightHymns"));
      log(s, "v2.log.midnightHymns", "player");
      break;
    case "prisonOpened":
      // Suddenly there was a great earthquake... and every one's bands were loosed (Acts 16:26).
      s.prisonOpened = true;
      s.coiled = null;
      log(s, "v2.log.prisonOpened", "player");
      break;
    case "encourage":
      // Barnabas, the son of consolation (Acts 4:36) — who brought Saul to the apostles (Acts 9:27).
      living(s).forEach((id) => (s.party[id].shaken = false));
      s.energy.attack += R.encourageAttack;
      log(s, "v2.log.encourage", "player");
      if (isAlive(s, "paul")) addShield(s, "paul", R.encouragePaulShield);
      break;
    case "soldField":
      // Having land, sold it, and brought the money, and laid it at the apostles' feet (Acts 4:37).
      s.fieldSold = true;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.fieldFaith);
      log(s, "v2.log.soldField", "player", { n: R.fieldFaith });
      break;
    case "armourOfGod":
      // Put on the whole armour of God, that ye may be able to stand (Ephesians 6:11).
      log(s, "v2.log.armourOfGod", "player");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => {
        s.party[id].shaken = false;
        addShield(s, id, R.armourShield);
      });
      break;
    case "swordOfSpirit":
      // The sword of the Spirit, which is the word of God (Ephesians 6:17).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.swordFaith);
      break;
    case "hereIsWater": {
      // See, here is water; what doth hinder me to be baptized? (Acts 8:36).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.waterHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.hereIsWater", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "samaria":
      // And there was great joy in that city (Acts 8:8).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.samariaFaith);
      log(s, "v2.log.samaria", "player");
      break;
    case "heavensOpened":
      // Behold, I see the heavens opened, and the Son of man standing on the right hand of God (Acts 7:56).
      s.heavensUsed = true;
      log(s, "v2.log.heavensOpened", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.heavensHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        c.shaken = false;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "looseHim": {
      // Loose him, and let him go (John 11:44).
      const ally = target as CharacterId;
      s.party[ally].shaken = false;
      log(s, "v2.log.looseHim", "player", { char: ally });
      addShield(s, ally, R.looseShield);
      break;
    }
    case "manyBelieved":
      // By reason of him many of the Jews went away, and believed on Jesus (John 12:11).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.believedFaith);
      log(s, "v2.log.manyBelieved", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        c.hp += Math.min(R.believedHeal, MAX_HP[id] - c.hp);
      });
      break;
    case "atHisFeet":
      // Mary sat at Jesus' feet, and heard his word... and Martha served (Luke 10:39-40).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.feetFaith);
      if (isAlive(s, "martha")) s.energy.guard = Math.min(R.maxGuard, s.energy.guard + 1);
      log(s, "v2.log.atHisFeet", "player");
      break;
    case "spikenard":
      // The house was filled with the odour of the ointment (John 12:3).
      s.spikenardUsed = true;
      log(s, "v2.log.spikenard", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.spikenardHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
        if (!NEVER_FALLS.has(id)) addShield(s, id, R.spikenardShield);
      });
      break;
    case "sycamore":
      // He ran before, and climbed up into a sycomore tree to see him (Luke 19:4).
      s.inTree = true;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.sycamoreFaith);
      log(s, "v2.log.sycamore", "player");
      break;
    case "fourfold":
      // The half of my goods I give to the poor; and if I have taken any thing, I restore him fourfold (Luke 19:8).
      s.fourfoldUsed = true;
      s.energy.attack += R.fourfoldAttack;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.fourfoldFaith);
      log(s, "v2.log.fourfold", "player");
      break;
    case "serving":
      // Martha was cumbered about much serving (Luke 10:40).
      s.energy.guard = Math.min(R.maxGuard, s.energy.guard + R.servingGuard);
      log(s, "v2.log.serving", "player", { n: R.servingGuard });
      break;
    case "riseAgain":
      s.riseAgain = "ready";
      log(s, "v2.log.riseAgain", "player");
      break;
    case "spices": {
      // They had bought sweet spices, that they might come and anoint him (Mark 16:1).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.spicesHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.spices", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "seenTheLord": {
      // Mary Magdalene came and told the disciples that she had seen the Lord (John 20:18).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const risen = ally === "jesusUR" && s.tomb !== null;
      if (risen) s.tomb = null;
      c.hp = risen ? MAX_HP.jesusUR : R.seenHp;
      c.shaken = false;
      c.shield = 0;
      c.acted = false;
      s.seenUsed = true;
      log(s, risen ? "v2.log.risen" : "v2.log.revive", "player", { char: ally, hp: c.hp });
      break;
    }
    case "reachFinger":
      // Reach hither thy finger, and behold my hands; and be not faithless, but believing (John 20:27).
      s.thomasBelieves = true;
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.fingerFaith);
      log(s, "v2.log.reachFinger", "player");
      break;
    case "mendNets": {
      // James the son of Zebedee, and John his brother, who also were in the ship mending their nets (Mark 1:19).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.mendHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.mendNets", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "taxBooth":
      // He arose, and followed him (Matthew 9:9).
      s.energy.attack += R.taxBoothAttack;
      log(s, "v2.log.taxBooth", "player", { n: R.taxBoothAttack });
      break;
    case "feast":
      // As Jesus sat at meat in the house, many publicans and sinners came and sat down with him (Matthew 9:10).
      log(s, "v2.log.feast", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.feastHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      draw(s, R.feastDraw, rng);
      break;
    case "loveOneAnother": {
      // Beloved, let us love one another: for love is of God (1 John 4:7).
      const k = supportAmount(s, "loveOneAnother") / R.loveHeal;
      log(s, "v2.log.loveOneAnother", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.loveHeal * k, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
        if (!NEVER_FALLS.has(id)) addShield(s, id, R.loveShield * k);
      });
      break;
    }
    case "comeAndSee":
      // He saith unto them, Come and see (John 1:39).
      s.party[target as CharacterId].acted = false;
      s.comeAndSeeUsed = true;
      log(s, "v2.log.comeAndSee", "player", { char: target as CharacterId });
      break;
    case "aLadHere":
      // There is a lad here, which hath five barley loaves, and two small fishes (John 6:9).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.ladFaith);
      log(s, "v2.log.aLadHere", "player", { n: R.ladDraw });
      draw(s, R.ladDraw, rng);
      break;
    case "greatCatch":
      // They inclosed a great multitude of fishes: and their net brake (Luke 5:6).
      s.energy.attack += R.catchAttack;
      log(s, "v2.log.greatCatch", "player", { n: R.catchDraw });
      draw(s, R.catchDraw, rng);
      break;
    case "peaceBeUnto": {
      // Jesus himself stood in the midst of them, and saith unto them, Peace be unto you (Luke 24:36).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.risenPeaceHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.peaceBeUnto", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "withYouAlway":
      // Lo, I am with you alway, even unto the end of the world (Matthew 28:20).
      s.withYouUsed = true;
      log(s, "v2.log.withYouAlway", "player");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, R.alwayShield));
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.alwayFaith);
      break;
    case "walkOnWater":
      // He came unto them, walking on the sea; and when they were come into the ship, the wind ceased (Matthew 14:25, 32).
      s.goliath.stunned = true;
      s.walkUsed = true;
      log(s, "v2.log.walkOnWater", "player");
      break;
    case "loaves":
      // They did all eat, and were filled: and they took up of the fragments twelve baskets full (Matthew 14:20).
      s.loavesUsed = true;
      log(s, "v2.log.loaves", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.loavesHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      draw(s, R.loavesDraw, rng);
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.loavesFaith);
      break;
    case "baptism": {
      // I indeed baptize you with water unto repentance (Matthew 3:11).
      log(s, "v2.log.baptism", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.baptismHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        c.shaken = false;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      // His father Zechariah beside him: +1 Faith.
      if (isAlive(s, "zechariah")) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
      break;
    }
    case "carpenter": {
      // Is not this the carpenter's son? (Matthew 13:55) — Joseph cares for Mary twice over.
      const ally = target as CharacterId;
      const k = ally === "mary" ? 2 : 1;
      const c = s.party[ally];
      const healed = Math.min(R.carpenterHeal * k, MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.carpenter", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      addShield(s, ally, R.carpenterShield * k);
      break;
    }
    case "dreamWarning":
      // The angel of the Lord appeareth to Joseph in a dream, saying, Arise, and flee (Matthew 2:13).
      s.goliath.stunned = true;
      s.dreamUsed = true;
      log(s, "v2.log.dreamWarning", "player");
      break;
    case "handmaid":
      // Behold the handmaid of the Lord; be it unto me according to thy word (Luke 1:38).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.handmaidFaith);
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.handmaid", "player");
      break;
    case "magnificat": {
      // He hath put down the mighty from their seats, and exalted them of low degree (Luke 1:52).
      s.magnificatUsed = true;
      const boss = bossOf(s);
      const e = s.enemies[boss];
      const n = toTens(e.hp * R.magnificatShare);
      e.hp = Math.max(0, e.hp - n);
      log(s, "v2.log.magnificat", "player", { enemy: boss, n, hp: e.hp });
      afterEnemyHit(s, boss);
      const lowly = living(s).sort((a, b) => s.party[a].hp / MAX_HP[a] - s.party[b].hp / MAX_HP[b])[0];
      if (lowly) {
        const c = s.party[lowly];
        const healed = MAX_HP[lowly] - c.hp;
        c.hp = MAX_HP[lowly];
        log(s, "v2.log.motherHeal", "detail", { char: lowly, n: healed, hp: c.hp, max: MAX_HP[lowly] });
      }
      break;
    }
    case "incense": {
      // His lot was to burn incense when he went into the temple of the Lord (Luke 1:9).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.incenseFaith);
      log(s, "v2.log.incense", "player");
      living(s).forEach((id) => addShield(s, id, R.incenseShield));
      break;
    }
    case "nameIsJohn":
      // He wrote, saying, His name is John. And his mouth was opened (Luke 1:63-64).
      s.johnUsed = true;
      log(s, "v2.log.nameIsJohn", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.johnHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.johnFaith);
      break;
    case "buildWall": {
      const n = supportAmount(s, "buildWall");
      s.wallCourses += 1;
      log(s, "v2.log.buildWall", "player", { n });
      living(s).forEach((id) => addShield(s, id, n));
      break;
    }
    case "swordAndTrowel":
      // Every one with one of his hands wrought in the work, and with the other hand held a weapon (Nehemiah 4:17).
      addShield(s, "nehemiah", R.trowelShield);
      break;
    case "lionsDen":
      s.lionsDenUsed = true;
      s.lionsDen = true;
      log(s, "v2.log.lionsDen", "player");
      break;
    case "contrary":
      s.contraryUsed = true;
      s.contrary = true;
      log(s, "v2.log.contrary", "player");
      break;
    case "greatLight":
      // The people that walked in darkness have seen a great light (Isaiah 9:2).
      s.greatLightUsed = true;
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.greatLight", "player");
      break;
    case "castIntoSea":
      s.castIntoSea = true;
      log(s, "v2.log.castIntoSea", "player");
      break;
    case "healWaters":
      // I have healed these waters (2 Kings 2:21).
      log(s, "v2.log.healWaters", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(supportAmount(s, "healWaters"), MAX_HP[id] - c.hp);
        c.hp += healed;
        c.shaken = false;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "chariots":
      // The mountain was full of horses and chariots of fire round about Elisha (2 Kings 6:17).
      s.chariotsUsed = true;
      log(s, "v2.log.chariots", "player");
      living(s).forEach((id) => addShield(s, id, R.chariotsShield));
      break;
    case "carmel":
      // Then the fire of the LORD fell, and consumed the burnt sacrifice (1 Kings 18:38).
      s.carmelUsed = true;
      break;
    case "wisdom":
      // Give therefore thy servant an understanding heart (1 Kings 3:9).
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.wisdomFaith);
      s.energy.attack += R.wisdomAttack;
      log(s, "v2.log.wisdom", "player");
      break;
    case "templeFire":
      // The fire came down from heaven, and the glory of the LORD filled the house (2 Chronicles 7:1).
      s.templeFireUsed = true;
      log(s, "v2.log.templeFire", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.templeFireHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "provision":
      // Abigail took two hundred loaves, and two bottles of wine (1 Samuel 25:18).
      log(s, "v2.log.provision", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.provisionHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "intercede":
      s.intercede = true;
      log(s, "v2.log.intercede", "player", { n: R.intercedeBlock });
      break;
    case "rashOffering": {
      // I forced myself therefore, and offered a burnt offering (1 Samuel 13:12): Faith now, Shaken next turn.
      const gained = Math.min(R.rashFaith, R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      s.saulRash = true;
      log(s, "v2.log.rashOffering", "player", { n: gained });
      break;
    }
    case "prayer": {
      // Hannah spake in her heart; only her lips moved (1 Samuel 1:13).
      const gained = Math.min(supportAmount(s, "prayer"), R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      log(s, "v2.log.prayer", "player", { n: gained });
      break;
    }
    case "hannahSong":
      // The bows of the mighty men are broken, and they that stumbled are girded with strength (1 Samuel 2:4).
      s.hannahSongUsed = true;
      log(s, "v2.log.hannahSong", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.hannahSongHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "wings":
      // Under whose wings thou art come to trust (Ruth 2:12).
      log(s, "v2.log.wings", "player", { char: target as CharacterId });
      addShield(s, target as CharacterId, R.wingsShield);
      break;
    case "redeemer":
      // Ye are witnesses this day, that I have bought all that was Elimelech's (Ruth 4:9).
      s.redeemerUsed = true;
      log(s, "v2.log.redeemer", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const half = toTens(MAX_HP[id] / 2); // HP stays in steps of 10
        if (c.hp >= half) return;
        const healed = half - c.hp;
        c.hp = half;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
      break;
    case "counsel": {
      // My daughter, shall I not seek rest for thee? (Ruth 3:1) — Ruth heals double.
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.counselHeal * (ally === "ruth" ? 2 : 1), MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.counsel", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "restorer": {
      // He shall be unto thee a restorer of thy life (Ruth 4:15).
      const c = s.party[target as CharacterId];
      c.hp = R.restorerHp;
      c.shaken = false;
      c.shield = 0;
      c.acted = false;
      s.restorerUsed = true;
      log(s, "v2.log.revive", "player", { char: target, hp: c.hp });
      break;
    }
    case "glean":
      // Let me now go to the field, and glean ears of corn (Ruth 2:2).
      log(s, "v2.log.glean", "player", { n: R.gleanDraw });
      draw(s, R.gleanDraw, rng);
      break;
    case "whither":
      s.covered = target as CharacterId;
      log(s, "v2.log.whither", "player", { char: target as CharacterId });
      break;
    case "pillars": {
      // Let me die with the Philistines. And he bowed himself with all his might (Judges 16:30).
      const c = s.party.samson;
      c.hp = 0;
      c.shield = 0;
      c.shaken = false;
      log(s, "v2.log.pillars", "player");
      log(s, "v2.log.fallen", "system", { char: "samson" });
      checkDefeat(s);
      break;
    }
    case "fleece": {
      // Let it now be dry only upon the fleece (Judges 6:39): a sign, and Faith to go on.
      const gained = Math.min(R.fleeceFaith, R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      log(s, "v2.log.fleece", "player", { n: gained });
      draw(s, R.fleeceDraw, rng);
      break;
    }
    case "torches":
      // They blew the trumpets and brake the pitchers: the LORD set every man's sword against his fellow (Judges 7:22).
      s.torchesUsed = true;
      if (s.result === "ongoing") {
        s.goliath.stunned = true;
        log(s, "v2.log.torches", "player");
      }
      break;
    case "upToday":
      // Up; for this is the day in which the LORD hath delivered Sisera into thine hand (Judges 4:14).
      s.energy.attack += R.upTodayAttack;
      log(s, "v2.log.upToday", "player", { n: R.upTodayAttack });
      break;
    case "starsFought":
      // The stars in their courses fought against Sisera (Judges 5:20).
      s.starsFoughtUsed = true;
      break;
    case "hideSpies": {
      // She hid them with the stalks of flax (Joshua 2:6).
      const ally = target as CharacterId;
      s.party[ally].shaken = false;
      log(s, "v2.log.hideSpies", "player", { char: ally });
      addShield(s, ally, R.hideShield);
      break;
    }
    case "scarletCord":
      s.cordUsed = true;
      s.cordReady = true;
      log(s, "v2.log.scarletCord", "player");
      break;
    case "jericho":
      // The people shouted, and the wall fell down flat (Joshua 6:20): the shield bearer falls with it.
      s.jerichoUsed = true;
      if (enemyAlive(s, "bearer")) {
        s.enemies.bearer.hp = 0;
        log(s, "v2.log.wallsFall", "player");
        log(s, "v2.log.enemyFalls", "system", { enemy: "bearer" });
      }
      break;
    case "tenWords": {
      // God spake all these words (Exodus 20:1).
      log(s, "v2.log.tenWords", "player");
      living(s).forEach((id) => addShield(s, id, R.tenWordsShield));
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.tenWordsFaith);
      break;
    }
    case "faceShone":
      // The skin of his face shone; and they were afraid to come nigh him (Exodus 34:30).
      s.goliath.stunned = true;
      s.shoneUsed = true;
      log(s, "v2.log.faceShone", "player");
      break;
    case "song": {
      // Miriam took a timbrel, and all the women went out after her (Exodus 15:20).
      const gained = Math.min(R.songFaith, R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      living(s).forEach((id) => (s.party[id].shaken = false));
      log(s, "v2.log.song", "player", { n: gained });
      break;
    }
    case "breastplate":
      s.breastplate = true;
      log(s, "v2.log.breastplate", "player");
      break;
    case "handsUp":
      s.handsUp = true;
      log(s, "v2.log.handsUp", "player", { n: R.handsBonus });
      break;
    case "granary":
      // Joseph gathered corn as the sand of the sea (Genesis 41:49).
      log(s, "v2.log.granary", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.granaryHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
        addShield(s, id, R.granaryShield);
      });
      break;
    case "meantForGood": {
      // Ye thought evil against me; but God meant it unto good (Genesis 50:20).
      s.goodUsed = true;
      const boss = bossOf(s);
      const n = goodDamage(s);
      const e = s.enemies[boss];
      e.hp = Math.max(0, e.hp - n);
      log(s, "v2.log.meantForGood", "player", { enemy: boss, n, hp: e.hp });
      afterEnemyHit(s, boss);
      break;
    }
    case "ladder":
      // Angels ascending and descending on it (Genesis 28:12): everyone who has acted may act again.
      s.ladderUsed = true;
      log(s, "v2.log.ladder", "player");
      s.lineup.filter((id) => id !== "jacob" && isAlive(s, id)).forEach((id) => (s.party[id].acted = false));
      break;
    case "ram":
      s.ramUsed = true;
      s.ramReady = true;
      log(s, "v2.log.ram", "player");
      break;
    case "shieldUp":
      log(s, "v2.log.shieldUp", "player", { char: target });
      addShield(s, target as CharacterId, R.shieldUpAmount);
      break;
    case "beguile":
      s.goliath.stunned = true;
      s.beguileUsed = true;
      log(s, "v2.log.beguile", "player");
      break;
    case "offering": {
      // Cain brought of the fruit of the ground an offering (Genesis 4:3).
      const gained = Math.min(R.offeringFaith, R.maxFaith - s.energy.faith);
      s.energy.faith += gained;
      log(s, "v2.log.offering", "player", { n: gained });
      break;
    }
    case "mark":
      s.markUsed = true;
      s.marked = true;
      log(s, "v2.log.mark", "player", { n: R.markRetaliate });
      break;
    case "helper": {
      s.party[target as CharacterId].acted = false;
      s.helperUsed = true;
      log(s, "v2.log.helper", "player", { char: target });
      break;
    }
  }
  return s;
}

// ---------- end of turn ----------

/** Ends the player's actions: Shaken wears off, the archer shoots, then Goliath carries out his current intent. */
export function resolveGoliath(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.result !== "ongoing") return state;
  const s = clone(state);
  PARTY_ORDER.forEach((id) => (s.party[id].shaken = false));
  s.coiled = null;
  const g = s.goliath;
  const boss = bossOf(s);
  const intent = s.intents[0];
  const target = () => {
    const t = intent.targets[0];
    if (t && isAlive(s, t)) return t;
    const alive = living(s);
    return alive.length ? alive[Math.floor(rng() * alive.length)] : undefined;
  };

  if (enemyAlive(s, "archer") && s.archerTarget) {
    const t = isAlive(s, s.archerTarget) ? s.archerTarget : randomAlly(s, rng);
    if (t) {
      log(s, "v2.log.archer", "enemy", { char: t });
      damageAlly(s, t, R.archerDamage, "archer");
    }
  }

  if (g.stunned) {
    g.stunned = false;
    g.charging = false;
    log(s, s.stage === "eden" ? "v2.log.serpentStunned" : "v2.log.stunned", "enemy", { action: intent.action });
  } else {
    log(s, s.stage === "eden" ? "v2.log.serpentUses" : "v2.log.goliathUses", "enemy", { action: intent.action });
    switch (intent.action) {
      case "defy":
        // A Shield steadies an ally: they can't be Shaken.
        intent.targets.filter((id) => isAlive(s, id)).forEach((id) => {
          if (s.party[id].shield > 0) log(s, "v2.log.shieldHolds", "detail", { char: id });
          else {
            s.party[id].shaken = true;
            log(s, "v2.log.shaken", "detail", { char: id });
          }
        });
        break;
      case "spear": {
        const t = target();
        if (t) damageAlly(s, t, R.spear, "goliath");
        break;
      }
      case "raise":
        g.charging = true;
        break;
      case "crush": {
        if (!g.charging) log(s, "v2.log.noCharge", "detail");
        else {
          const t = target();
          if (t) damageAlly(s, t, R.crush, "goliath");
        }
        g.charging = false;
        break;
      }
      case "swing":
        living(s).forEach((id) => damageAlly(s, id, R.swing, "goliath"));
        break;
      case "tempt": {
        // The fruit of the tree: the target can't act next turn and the party loses Faith (a Shield holds firm).
        const t = target();
        if (!t) break;
        if (s.party[t].shield > 0) log(s, "v2.log.shieldHolds", "detail", { char: t });
        else {
          s.party[t].shaken = true;
          const lost = Math.min(R.temptFaith, s.energy.faith);
          s.energy.faith -= lost;
          log(s, "v2.log.tempted", "detail", { char: t, n: lost });
        }
        break;
      }
      case "fang": {
        const t = target();
        if (t) damageAlly(s, t, g.enraged ? R.fangShed : R.fang, boss);
        break;
      }
      case "coil": {
        // Coils around everyone; the target (the front line) is held in place.
        const t = target();
        living(s).forEach((id) => damageAlly(s, id, R.coil, boss));
        if (t && isAlive(s, t)) {
          s.coiled = t;
          log(s, "v2.log.coiled", "detail", { char: t });
        }
        break;
      }
    }
  }
  checkDefeat(s);
  return s;
}

/** Starts the next player turn: Attack energy and Shields expire (Faith and Guard stay), intents advance, draw cards. */
export function startNextTurn(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.result !== "ongoing") return state;
  const s = clone(state);
  s.turn += 1;
  s.energy.attack = 0;
  s.marked = false;
  s.ramReady = false;
  s.cordReady = false;
  s.covered = null;
  s.inTree = false;
  // To obey is better than sacrifice (1 Samuel 15:22).
  if (s.markLeft) {
    s.markLeft = false;
    if (isAlive(s, "johnMark")) s.party.johnMark.shaken = true;
  }
  if (s.saulRash) {
    s.saulRash = false;
    if (isAlive(s, "saul")) {
      s.party.saul.shaken = true;
      log(s, "v2.log.saulShaken", "detail");
    }
  }
  s.handsUp = false;
  s.example = false;
  s.taught = null;
  s.aquilaCovers = null;
  s.simonCovers = null;
  s.spearCovers = null;
  s.breastplate = false;
  s.intercede = false;
  s.castIntoSea = false;
  s.contrary = false;
  s.lionsDen = false;
  s.fiery = false;
  if (s.riseAgain !== "unused" && s.riseAgain !== "ready" && s.riseAgain !== "used") {
    const back = s.riseAgain;
    s.riseAgain = "used";
    s.party[back].hp = R.riseAgainHp;
    log(s, "v2.log.revive", "player", { char: back, hp: R.riseAgainHp });
  }
  if (s.dorcas === "asleep") {
    s.dorcas = "raised";
    s.party.dorcas.hp = MAX_HP.dorcas;
    log(s, "v2.log.dorcasRaised", "player", { hp: MAX_HP.dorcas });
  }
  // Take care of him: and whatsoever thou spendest more, when I come again, I will repay thee (Luke 10:35).
  if (s.inn) {
    const { ally } = s.inn;
    if (isAlive(s, ally)) {
      const c = s.party[ally];
      const healed = Math.min(R.innHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      log(s, "v2.log.innCare", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
    }
    s.inn = s.inn.turns > 1 && isAlive(s, ally) ? { ally, turns: s.inn.turns - 1 } : null;
  }
  if (s.lazarus === "tomb") {
    s.lazarus = "raised";
    s.party.lazarus.hp = MAX_HP.lazarus;
    log(s, "v2.log.lazarusRaised", "player", { hp: MAX_HP.lazarus });
  }
  if (s.tomb !== null && s.turn >= s.tomb) {
    s.tomb = null;
    s.party.jesusUR.hp = MAX_HP.jesusUR;
    log(s, "v2.log.risen", "player", { hp: MAX_HP.jesusUR });
  }
  // The fish vomited out Jonah upon the dry land (Jonah 2:10).
  if (s.fish === "inside") {
    s.fish = "used";
    s.party.jonah.hp = R.fishHp;
    log(s, "v2.log.fishReturns", "player", { hp: R.fishHp });
  }
  for (const id of PARTY_ORDER) {
    s.party[id].shield = 0;
    s.party[id].acted = false;
  }

  const cycle = cycleOf(s);
  s.goliath.cycle = (s.goliath.cycle + 1) % cycle.length;
  const next = cycle[(s.goliath.cycle + 1) % cycle.length];
  // Re-aim the revealed intent if its target has fallen since.
  const current = s.intents[1];
  s.intents[0] = current.targets.some((id) => !isAlive(s, id)) ? makeIntent(s, current.action, rng) : current;
  s.intents[1] = makeIntent(s, next, rng);
  s.archerTarget = enemyAlive(s, "archer") ? randomAlly(s, rng) : null;

  log(s, "v2.log.turn", "system", { n: s.turn });
  if (s.simeonWaiting && isAlive(s, "simeon") && s.turn % 2 === 0) s.energy.faith = Math.min(R.maxFaith, s.energy.faith + 1);
  // Only Luke is with me (2 Timothy 4:11).
  if (isAlive(s, "luke") && isAlive(s, "paul")) addShield(s, "luke", R.lukeShield);
  draw(s, R.drawPerTurn, rng);
  return s;
}

/** Convenience for tests and simulations: Goliath acts, then the next turn starts. */
export function endTurn(state: BattleState, rng: Rng = Math.random): BattleState {
  return startNextTurn(resolveGoliath(state, rng), rng);
}
