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
  MAX_HP,
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
const cycleOf = (s: BattleState) => (s.stage === "eden" ? SERPENT_CYCLE : s.goliath.enraged ? PHASE2_CYCLE : PHASE1_CYCLE);
/** This stage's boss (Goliath, or the Serpent). */
export const bossOf = (s: BattleState): EnemyId => STAGE_BOSS[s.stage];
export const enemyAlive = (s: BattleState, id: EnemyId) => s.enemies[id].hp > 0;
const randomAlly = (s: BattleState, rng: Rng) => {
  const alive = living(s);
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
  const alive = living(s);
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
  if (s.result === "ongoing" && living(s).length === 0) {
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
  if (!isAlive(s, id)) return;
  // Aaron bears the names of the tribes upon his heart (Exodus 28:29): the leader's blows are halved.
  const n = s.breastplate && from === bossOf(s) ? toTens(enemyDamage(from, id, base) / 2) : enemyDamage(from, id, base);
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
  const base = (def.damage ?? 0) + giant + till + seed + blessing + hands;
  if (!target) return base;
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
  return 0;
}

export function supportAmount(s: BattleState, skill: SkillId): number {
  if (skill === "keep" && inStory(s, "adam")) return R.keepShield + R.edenKeepBonus;
  if (skill === "mother" && inStory(s, "eve")) return R.motherHeal + R.edenMotherBonus;
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
  if (skill === "sling" || skill === "sword" || skill === "rebuke" || skill === "till" || skill === "offering" || skill === "faithOffering" || skill === "harvest" || skill === "wrestle") return "enemy";
  if (skill === "bash" || skill === "spearThrust" || skill === "venom") return "enemy";
  if (skill === "volley" || skill === "courage") return "anyEnemy";
  if (skill === "heal" || skill === "shieldUp" || skill === "firstlings" || skill === "blessing" || skill === "hideSpies") return "ally";
  if (skill === "arise") return "fallenAlly";
  if (skill === "helper") return "actedAlly";
  return "none";
}

export function skillTargets(s: BattleState, skill: SkillId): Target[] {
  const kind = skillTargetKind(skill);
  if (kind === "enemy") return attackableEnemies(s);
  if (kind === "anyEnemy") return ENEMY_ORDER.filter((id) => enemyAlive(s, id));
  if (kind === "ally") return living(s);
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
  if (skill === "taunt" || skill === "sea" || skill === "timbrel" || skill === "jericho" || skill === "torches") ENEMY_ORDER.filter((id) => enemyAlive(s, id)).forEach((id) => s.result === "ongoing" && hitEnemy(s, skill, id));
  else if (def.damage) hitEnemy(s, skill, skill === "slingStone" || skill === "starsFought" ? bossOf(s) : (target as EnemyId));
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
  s.handsUp = false;
  s.breastplate = false;
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
  draw(s, R.drawPerTurn, rng);
  return s;
}

/** Convenience for tests and simulations: Goliath acts, then the next turn starts. */
export function endTurn(state: BattleState, rng: Rng = Math.random): BattleState {
  return startNextTurn(resolveGoliath(state, rng), rng);
}
