import { CARD_BY_ID, CARDS } from "./data/cards";
import { CHARACTERS, PARTY_ORDER, SLING_STONE_COST } from "./data/characters";
import {
  ARMORED_PATTERN,
  ENRAGED_PATTERN,
  GOLIATH_ACTIONS,
} from "./data/goliath";
import { RULES } from "./data/rules";
import type { Params } from "./i18n";
import type {
  BattleState,
  CharacterId,
  CharacterState,
  Fx,
  Intent,
  LogEntry,
} from "./types";

export type Rng = () => number;

// ---------- helpers ----------

const clone = (s: BattleState): BattleState => {
  const c = structuredClone(s);
  c.fx = [];
  return c;
};

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function log(s: BattleState, key: string, kind: LogEntry["kind"], params?: Params) {
  s.log.push({ id: ++s.seq, turn: s.turn, key, params, kind });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}

function fx(s: BattleState, target: Fx["target"], kind: Fx["kind"], key: string, params?: Params) {
  s.fx.push({ id: ++s.seq, target, kind, key, params });
}

const isAlive = (c: CharacterState) => c.hp > 0;
export const isTerrified = (c: CharacterState) => c.fear >= RULES.maxFear;

function livingAllies(s: BattleState): CharacterState[] {
  return PARTY_ORDER.map((id) => s.party[id]).filter(isAlive);
}

export const isEmboldened = (s: BattleState) => s.courage >= RULES.emboldenedAt;

export const currentPattern = (s: BattleState) =>
  s.goliath.armored ? ARMORED_PATTERN : ENRAGED_PATTERN;

function draw(s: BattleState, n: number, rng: Rng) {
  for (let i = 0; i < n; i++) {
    if (s.hand.length >= RULES.maxHand) return;
    if (s.drawPile.length === 0) {
      if (s.discard.length === 0) return;
      s.drawPile = shuffle(s.discard, rng);
      s.discard = [];
      log(s, "log.reshuffle", "system");
    }
    s.hand.push(s.drawPile.shift()!);
  }
}

function checkVictory(s: BattleState) {
  if (s.result === "ongoing" && s.goliath.hp <= 0) {
    s.goliath.hp = 0;
    s.result = "victory";
    log(s, "log.victory", "system");
  }
}

function checkDefeat(s: BattleState) {
  if (s.result === "ongoing" && livingAllies(s).length === 0) {
    s.result = "defeat";
    log(s, "log.defeat", "system");
  }
}

/** Returns the damage actually dealt after Armor. */
function damageGoliath(s: BattleState, amount: number): number {
  if (amount <= 0) {
    fx(s, "goliath", "miss", "fx.dmg", { n: 0 });
    return 0;
  }
  const dealt = s.goliath.armored ? Math.min(amount, RULES.armoredMaxDamage) : amount;
  s.goliath.hp = Math.max(0, s.goliath.hp - dealt);
  fx(s, "goliath", dealt < amount ? "miss" : "damage", "fx.dmg", { n: dealt });
  return dealt;
}

function damageAlly(s: BattleState, id: CharacterId, amount: number) {
  const c = s.party[id];
  if (!isAlive(c)) return;
  const absorbed = Math.min(c.shield, amount);
  c.shield -= absorbed;
  const taken = amount - absorbed;
  c.hp = Math.max(0, c.hp - taken);
  fx(s, id, "damage", absorbed > 0 ? "fx.dmgShield" : "fx.dmg", { n: taken, s: absorbed });
  if (c.hp === 0) {
    c.fear = 0;
    c.shield = 0;
    log(s, "log.fallen", "system", { char: id });
    if (id === "david" && !s.slingStoneUsed) {
      log(s, "log.slingLost", "system");
    }
  }
}

function addFear(s: BattleState, id: CharacterId, amount: number) {
  const c = s.party[id];
  if (!isAlive(c) || amount <= 0) return;
  const before = c.fear;
  c.fear = Math.min(RULES.maxFear, c.fear + amount);
  if (c.fear > before) fx(s, id, "fear", "fx.fearUp", { n: c.fear - before });
  if (c.fear >= RULES.maxFear && before < RULES.maxFear) {
    log(s, "log.terrified", "enemy", { char: id });
  }
}

function removeFear(s: BattleState, id: CharacterId, amount: number) {
  const c = s.party[id];
  if (!isAlive(c) || c.fear === 0) return;
  const removed = Math.min(c.fear, amount);
  c.fear -= removed;
  fx(s, id, "buff", "fx.fearDown", { n: removed });
}

function addFaith(s: BattleState, n: number) {
  s.faith = Math.min(RULES.maxFaith, s.faith + n);
  fx(s, "david", "buff", "fx.faith", { n });
}

function addCourage(s: BattleState, n: number) {
  s.courage = Math.min(RULES.maxCourage, s.courage + n);
}

function pickIntent(s: BattleState, rng: Rng): Intent {
  const pattern = currentPattern(s);
  const actionId = pattern[s.goliath.patternIndex % pattern.length];
  const action = GOLIATH_ACTIONS[actionId];
  if (action.damageOne === undefined) return { actionId };
  return { actionId, targetId: pickTarget(s, action.targetsDavid ?? false, rng) };
}

function pickTarget(s: BattleState, preferDavid: boolean, rng: Rng): CharacterId | undefined {
  if (preferDavid && isAlive(s.party.david)) return "david";
  const alive = livingAllies(s);
  if (alive.length === 0) return undefined;
  return alive[Math.floor(rng() * alive.length)].id;
}

// ---------- setup ----------

export function createBattle(rng: Rng = Math.random): BattleState {
  const party = Object.fromEntries(
    PARTY_ORDER.map((id) => [
      id,
      { id, hp: CHARACTERS[id].maxHp, fear: 0, shield: 0, skillUsed: false },
    ]),
  ) as Record<CharacterId, CharacterState>;

  const s: BattleState = {
    turn: 1,
    energy: RULES.baseEnergy,
    courage: RULES.startCourage,
    faith: 0,
    slingStoneUsed: false,
    goliath: { hp: RULES.goliathHp, armored: true, patternIndex: 0 },
    intent: null,
    party,
    drawPile: shuffle(CARDS.map((c) => c.id), rng),
    hand: [],
    discard: [],
    log: [],
    fx: [],
    seq: 0,
    result: "ongoing",
  };
  draw(s, RULES.openingHand, rng);
  s.intent = pickIntent(s, rng);
  log(s, "log.start", "system");
  return s;
}

// ---------- queries ----------

export function canPlayCard(s: BattleState, handIndex: number): boolean {
  const card = CARD_BY_ID[s.hand[handIndex]];
  return s.result === "ongoing" && !!card && card.cost <= s.energy;
}

export function isSlingStoneReady(s: BattleState): boolean {
  return !s.slingStoneUsed && s.goliath.armored && isAlive(s.party.david) && s.faith >= RULES.maxFaith;
}

/** `key` selects the skill's text in i18n (`skill.<key>.name` / `.desc`). */
export function skillInfo(s: BattleState, id: CharacterId): { key: string; cost: number } {
  if (id === "david" && isSlingStoneReady(s)) return { key: "slingStone", cost: SLING_STONE_COST };
  return { key: id, cost: CHARACTERS[id].skillCost };
}

export function canUseSkill(s: BattleState, id: CharacterId): boolean {
  const c = s.party[id];
  return (
    s.result === "ongoing" &&
    isAlive(c) &&
    !isTerrified(c) &&
    !c.skillUsed &&
    skillInfo(s, id).cost <= s.energy
  );
}

export function canSpendCourage(s: BattleState, id: CharacterId): boolean {
  const c = s.party[id];
  return s.result === "ongoing" && isAlive(c) && c.fear > 0 && s.courage >= 1;
}

export function basicAttackDamage(s: BattleState, id: CharacterId): number {
  const c = s.party[id];
  if (!isAlive(c) || isTerrified(c)) return 0;
  const bonus = isEmboldened(s) ? RULES.emboldenedBonus : 0;
  return Math.max(0, CHARACTERS[id].attack - c.fear + bonus);
}

// ---------- player actions ----------

export function playCard(state: BattleState, handIndex: number, rng: Rng = Math.random): BattleState {
  if (!canPlayCard(state, handIndex)) return state;
  const s = clone(state);
  const [cardId] = s.hand.splice(handIndex, 1);
  const card = CARD_BY_ID[cardId];
  const e = card.effect;
  s.energy -= card.cost;
  s.discard.push(cardId);
  log(s, "log.playCard", "player", { card: cardId });

  if (e.faith) addFaith(s, e.faith);
  if (e.courage) addCourage(s, e.courage);
  if (e.removeDavidFear) removeFear(s, "david", RULES.maxFear);
  if (e.removeFearAll !== undefined) {
    const n = e.removeFearAll === "all" ? RULES.maxFear : e.removeFearAll;
    PARTY_ORDER.forEach((id) => removeFear(s, id, n));
  }
  if (e.shieldAll) {
    livingAllies(s).forEach((c) => {
      c.shield += e.shieldAll!;
      fx(s, c.id, "shield", "fx.shield", { n: e.shieldAll });
    });
  }
  if (e.healLowest) {
    const target = livingAllies(s).sort((a, b) => a.hp - b.hp)[0];
    if (target) {
      const healed = Math.min(e.healLowest, CHARACTERS[target.id].maxHp - target.hp);
      target.hp += healed;
      fx(s, target.id, "heal", "fx.heal", { n: healed });
    }
  }
  if (e.damage) {
    const dealt = damageGoliath(s, e.damage);
    log(s, s.goliath.armored ? "log.cardDamageArmor" : "log.cardDamage", "player", { n: dealt });
    checkVictory(s);
  }
  if (e.energy) s.energy += e.energy;
  if (e.draw) draw(s, e.draw, rng);
  return s;
}

export function activateSkill(state: BattleState, id: CharacterId, rng: Rng = Math.random): BattleState {
  if (!canUseSkill(state, id)) return state;
  const s = clone(state);
  const c = s.party[id];
  const info = skillInfo(s, id);
  s.energy -= info.cost;
  c.skillUsed = true;

  if (id === "david") {
    if (isSlingStoneReady(s)) {
      s.faith = 0;
      s.slingStoneUsed = true;
      s.goliath.armored = false;
      s.goliath.patternIndex = 0;
      log(s, "log.slingStone", "player");
      damageGoliath(s, RULES.slingStoneDamage);
      checkVictory(s);
      if (s.result === "ongoing") {
        // No stagger: Goliath turns Enraged at once and reveals his first Phase 4 action.
        s.intent = pickIntent(s, rng);
        log(s, "log.enraged", "enemy");
      }
    } else {
      const dealt = damageGoliath(s, RULES.slingDamage);
      log(s, s.goliath.armored ? "log.slingArmor" : "log.sling", "player", { n: dealt });
      checkVictory(s);
    }
  } else if (id === "samuel") {
    addFaith(s, RULES.samuelFaith);
    PARTY_ORDER.forEach((pid) => removeFear(s, pid, RULES.samuelFearRemoval));
    log(s, "log.anoint", "player", { n: RULES.samuelFaith });
  } else {
    addCourage(s, RULES.jonathanCourage);
    livingAllies(s).forEach((ally) => {
      ally.shield += RULES.jonathanShield;
      fx(s, ally.id, "shield", "fx.shield", { n: RULES.jonathanShield });
    });
    log(s, "log.covenant", "player", { courage: RULES.jonathanCourage, shield: RULES.jonathanShield });
  }
  return s;
}

export function spendCourage(state: BattleState, id: CharacterId): BattleState {
  if (!canSpendCourage(state, id)) return state;
  const s = clone(state);
  s.courage -= 1;
  removeFear(s, id, 1);
  log(s, "log.spendCourage", "player", { char: id });
  return s;
}

// ---------- end turn resolution ----------

export function resolveBasicAttacks(state: BattleState): BattleState {
  if (state.result !== "ongoing") return state;
  const s = clone(state);
  for (const id of PARTY_ORDER) {
    const c = s.party[id];
    if (!isAlive(c)) continue;
    if (isTerrified(c)) {
      log(s, "log.terrifiedSkip", "ally", { char: id });
      fx(s, id, "fear", "fx.terrified");
      continue;
    }
    const dmg = basicAttackDamage(s, id);
    const dealt = damageGoliath(s, dmg);
    log(s, s.goliath.armored && dmg > dealt ? "log.attackArmor" : "log.attack", "ally", { char: id, n: dealt });
    checkVictory(s);
    if (s.result !== "ongoing") break;
  }
  return s;
}

export function resolveGoliath(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.result !== "ongoing") return state;
  const s = clone(state);

  if (s.intent) {
    const action = GOLIATH_ACTIONS[s.intent.actionId];
    log(s, "log.goliathUses", "enemy", { action: action.id });
    if (action.fearAll) PARTY_ORDER.forEach((id) => addFear(s, id, action.fearAll!));
    if (action.damageAll) PARTY_ORDER.forEach((id) => damageAlly(s, id, action.damageAll!));
    if (action.damageOne !== undefined) {
      let target = s.intent.targetId;
      if (!target || !isAlive(s.party[target])) {
        target = pickTarget(s, action.targetsDavid ?? false, rng);
      }
      if (target) {
        if (action.fearOne) addFear(s, target, action.fearOne);
        damageAlly(s, target, action.damageOne);
      }
    }
    s.goliath.patternIndex = (s.goliath.patternIndex + 1) % currentPattern(s).length;
    checkDefeat(s);
  }

  if (s.result === "ongoing") s.intent = pickIntent(s, rng);
  return s;
}

export function startNextTurn(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.result !== "ongoing") return state;
  const s = clone(state);
  s.turn += 1;
  s.energy = RULES.baseEnergy + Math.min(s.energy, RULES.maxEnergyCarry);
  for (const c of Object.values(s.party)) {
    c.shield = 0;
    c.skillUsed = false;
  }
  draw(s, RULES.drawPerTurn, rng);
  log(s, "log.turn", "system", { n: s.turn });
  return s;
}

/** Which of the four encounter phases the battle is in (for the UI tracker). */
export function battlePhase(s: BattleState): 1 | 2 | 3 | 4 {
  if (!s.goliath.armored) return 4;
  if (isSlingStoneReady(s)) return 3;
  return s.faith > 0 ? 2 : 1;
}
