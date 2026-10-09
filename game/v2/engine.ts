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
const cycleOf = (s: BattleState) => (s.goliath.enraged ? PHASE2_CYCLE : PHASE1_CYCLE);
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
  if (action === "spear" || action === "crush") {
    return { action, targets: alive.length ? [alive[Math.floor(rng() * alive.length)]] : [] };
  }
  if (action === "defy") return { action, targets: shuffle(alive, rng).slice(0, R.defyTargets) };
  return { action, targets: [] };
}

function checkVictory(s: BattleState) {
  if (s.result === "ongoing" && s.enemies.goliath.hp <= 0) {
    s.enemies.goliath.hp = 0;
    s.result = "victory";
    log(s, "v2.log.victory", "system");
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
  const n = enemyDamage(from, id, base);
  const c = s.party[id];
  const blocked = Math.min(c.shield, n);
  c.shield -= blocked;
  const taken = Math.min(c.hp, n - blocked);
  c.hp -= taken;
  log(s, "v2.log.allyDamage", "detail", { char: id, n: taken, blocked, hp: c.hp, max: MAX_HP[id] });
  if (c.hp === 0) {
    c.shaken = false;
    c.shield = 0;
    log(s, "v2.log.fallen", "system", { char: id });
  }
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
export function skillDamage(s: BattleState, skill: SkillId, target?: EnemyId): number {
  const def = SKILLS[skill];
  if (skill === "slingStone") return def.damage ?? 0;
  const giant = def.owner === "david" && s.energy.faith >= R.giantFaith ? R.giantBonus : 0;
  const base = (def.damage ?? 0) + giant;
  if (!target) return base;
  return toTens(base * elementMultiplier(CHARACTER_ELEMENT[def.owner], ENEMY_ELEMENT[target]));
}

/** Damage an enemy deals to an ally, with elements (e.g. dark Goliath hits light David ×1.5). */
export function enemyDamage(enemy: EnemyId, ally: CharacterId, base: number): number {
  return toTens(base * elementMultiplier(ENEMY_ELEMENT[enemy], CHARACTER_ELEMENT[ally]));
}

// ---------- setup ----------

/** lineup: who fights; everyone else sits the battle out (HP 0). */
export function createBattle(rng: Rng = Math.random, lineup: CharacterId[] = DEFAULT_LINEUP): BattleState {
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
    enemies: { bearer: { hp: ENEMY_HP.bearer }, goliath: { hp: ENEMY_HP.goliath }, archer: { hp: ENEMY_HP.archer } },
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
  s.intents = [makeIntent(s, PHASE1_CYCLE[0], rng), makeIntent(s, PHASE1_CYCLE[1], rng)];
  s.archerTarget = randomAlly(s, rng);
  draw(s, R.openingHand, rng);
  log(s, "v2.log.start", "system");
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
  if (skill === "sling" || skill === "sword" || skill === "rebuke" || skill === "till") return "enemy";
  if (skill === "heal") return "ally";
  if (skill === "arise") return "fallenAlly";
  if (skill === "helper") return "actedAlly";
  return "none";
}

export function skillTargets(s: BattleState, skill: SkillId): Target[] {
  const kind = skillTargetKind(skill);
  if (kind === "enemy") return attackableEnemies(s);
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
  if (e.hp === 0 && enemy !== "goliath") {
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
  if (def.damage) hitEnemy(s, skill, skill === "slingStone" ? "goliath" : (target as EnemyId));
  s.energy.faith -= pay.faith;
  s.energy.attack -= pay.attack;
  s.energy.guard -= pay.guard;
  if (pay.faith && def.kind !== "faith") log(s, "v2.log.faithSpent", "detail", { n: pay.faith });

  switch (skill) {
    case "slingStone":
      s.goliath.stunned = true;
      if (s.result === "ongoing" && !s.goliath.enraged) {
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
      addShield(s, "adam", R.keepShield);
      break;
    case "mother":
      log(s, "v2.log.mother", "player");
      living(s).forEach((id) => {
        const c = s.party[id];
        const healed = Math.min(R.motherHeal, MAX_HP[id] - c.hp);
        c.hp += healed;
        log(s, "v2.log.motherHeal", "detail", { char: id, n: healed, hp: c.hp, max: MAX_HP[id] });
      });
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
  const g = s.goliath;
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
    log(s, "v2.log.stunned", "enemy", { action: intent.action });
  } else {
    log(s, "v2.log.goliathUses", "enemy", { action: intent.action });
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
