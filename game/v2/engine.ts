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
  // Who have for my life laid down their own necks (Romans 16:4).
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
    if (id === "lazarus" && s.lazarus === "ready" && (isAlive(s, "jesus") || isAlive(s, "jesusUR"))) {
      s.lazarus = "tomb";
      log(s, "v2.log.lazarusTomb", "player");
    }
    // He is not here: for he is risen, as he said (Matthew 28:6).
    if (id === "jesusUR" && !s.risenUsed) {
      s.risenUsed = true;
      s.tomb = s.turn + R.riseAfter;
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
  const withJesus = def.owner === "peter" && (isAlive(s, "jesus") || isAlive(s, "jesusUR")) ? R.peterWithJesus : 0;
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
  if (skill === "leper") return R.leperHeal;
  if (skill === "gethsemane") return R.gethsemaneShield;
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
  if (skill === "loveOneAnother" && (isAlive(s, "jesus") || isAlive(s, "jesusUR"))) return R.loveHeal * 2;
  // At midnight Paul and Silas prayed, and sang praises unto God (Acts 16:25).
  if (skill === "midnightHymns" && isAlive(s, "paul")) return R.hymnsPaulFaith;
  if (skill === "earnestCare" && isAlive(s, "paul")) return R.earnestPaulShield;
  if (skill === "receiveHim" && isAlive(s, "paul")) return R.receivePaulHp;
  if (skill === "byNight" && (isAlive(s, "jesus") || isAlive(s, "jesusUR"))) return R.nightDraw * 2;
  if (skill === "aQuestion" && (isAlive(s, "jesus") || isAlive(s, "jesusUR"))) return 2;
  if (skill === "livingWater" && (isAlive(s, "jesus") || isAlive(s, "jesusUR"))) return R.livingHeal * 2;
  if (skill === "gaveThanks" && isAlive(s, "simeon")) return 2;
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
    wallCourses: 0,
    johnUsed: false,
    magnificatUsed: false,
    dreamUsed: false,
    loavesUsed: false,
    walkUsed: false,
    gethsemaneUsed: false,
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

export function skillTargetKind(skill: SkillId): TargetKind {
  if (skill === "sling" || skill === "sword" || skill === "rebuke" || skill === "till" || skill === "offering" || skill === "faithOffering" || skill === "harvest" || skill === "wrestle" || skill === "javelin" || skill === "sendMe" || skill === "stoneCut" || skill === "swordAndTrowel" || skill === "axe" || skill === "drawSword" || skill === "thunder" || skill === "boanerges" || skill === "gracePower" || skill === "swordOfSpirit" || skill === "stirUpGift" || skill === "tentRope" || skill === "centurionCommand" || skill === "mightyScriptures" || skill === "profitable" || skill === "nowProfitable" || skill === "pebble" || skill === "moneyBag" || skill === "twoHundredPence" || skill === "noGuile" || skill === "oneOfTwelve" || skill === "contendFaith" || skill === "zeal" || skill === "withEleven") return "enemy";
  if (skill === "bash" || skill === "spearThrust" || skill === "venom") return "enemy";
  if (skill === "volley" || skill === "courage") return "anyEnemy";
  if (skill === "heal" || skill === "shieldUp" || skill === "firstlings" || skill === "blessing" || skill === "hideSpies" || skill === "counsel" || skill === "wings" || skill === "carpenter" || skill === "leper" || skill === "mendNets" || skill === "spices" || skill === "looseHim" || skill === "hereIsWater" || skill === "purpleCloth" || skill === "goInPeace" || skill === "almsdeeds" || skill === "succourer" || skill === "physician" || skill === "bornAgain") return "ally";
  if (skill === "whither" || skill === "expound" || skill === "layDownNeck") return "otherAlly";
  if (skill === "arise" || skill === "restorer" || skill === "seenTheLord" || skill === "receiveHim" || skill === "lotFell") return "fallenAlly";
  if (skill === "helper" || skill === "comeAndSee" || skill === "speakLord") return "actedAlly";
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
  if (skill === "nameIsJohn" && s.johnUsed) return "v2.reason.ariseUsed";
  if (skill === "magnificat" && s.magnificatUsed) return "v2.reason.ariseUsed";
  if (skill === "dreamWarning" && s.dreamUsed) return "v2.reason.ariseUsed";
  if (skill === "loaves" && s.loavesUsed) return "v2.reason.ariseUsed";
  if (skill === "walkOnWater" && s.walkUsed) return "v2.reason.ariseUsed";
  if (skill === "gethsemane" && s.gethsemaneUsed) return "v2.reason.ariseUsed";
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
  if (skill === "taunt" || skill === "sea" || skill === "timbrel" || skill === "jericho" || skill === "torches" || skill === "jawbone" || skill === "templeFire" || skill === "nineveh" || skill === "samaria" || skill === "prisonOpened") ENEMY_ORDER.filter((id) => enemyAlive(s, id)).forEach((id) => s.result === "ongoing" && hitEnemy(s, skill, id));
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
      if (isAlive(s, "jesus") || isAlive(s, "jesusUR"))
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
    case "leper": {
      // I will; be thou clean (Matthew 8:3).
      const ally = target as CharacterId;
      const c = s.party[ally];
      const healed = Math.min(R.leperHeal, MAX_HP[ally] - c.hp);
      c.hp += healed;
      c.shaken = false;
      log(s, "v2.log.leper", "player", { char: ally, n: healed, hp: c.hp, max: MAX_HP[ally] });
      break;
    }
    case "gethsemane":
      // Watch and pray, that ye enter not into temptation... nevertheless not as I will, but as thou wilt (Matthew 26:39, 41).
      s.gethsemaneUsed = true;
      log(s, "v2.log.gethsemane", "player");
      living(s).filter((id) => !NEVER_FALLS.has(id)).forEach((id) => addShield(s, id, R.gethsemaneShield));
      s.energy.faith = Math.min(R.maxFaith, s.energy.faith + R.gethsemaneFaith);
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
  s.breastplate = false;
  s.intercede = false;
  s.castIntoSea = false;
  s.contrary = false;
  s.lionsDen = false;
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
