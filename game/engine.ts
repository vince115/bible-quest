import { CARD_BY_ID, CARDS } from "./data/cards";
import { CHARACTERS, PARTY_ORDER, SLING_STONE } from "./data/characters";
import {
  ARMORED_PATTERN,
  ENRAGED_PATTERN,
  GOLIATH_ACTIONS,
} from "./data/goliath";
import { RULES } from "./data/rules";
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

function log(s: BattleState, text: string, kind: LogEntry["kind"]) {
  s.log.push({ id: ++s.seq, turn: s.turn, text, kind });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}

function fx(s: BattleState, target: Fx["target"], text: string, kind: Fx["kind"]) {
  s.fx.push({ id: ++s.seq, target, text, kind });
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
      log(s, "Discard pile reshuffled into the deck.", "system");
    }
    s.hand.push(s.drawPile.shift()!);
  }
}

function checkVictory(s: BattleState) {
  if (s.result === "ongoing" && s.goliath.hp <= 0) {
    s.goliath.hp = 0;
    s.result = "victory";
    log(s, "Goliath falls! The battle is the LORD's.", "system");
  }
}

function checkDefeat(s: BattleState) {
  if (s.result === "ongoing" && livingAllies(s).length === 0) {
    s.result = "defeat";
    log(s, "All of Israel's champions have fallen.", "system");
  }
}

/** Returns the damage actually dealt after Armor. */
function damageGoliath(s: BattleState, amount: number): number {
  if (amount <= 0) {
    fx(s, "goliath", "0", "miss");
    return 0;
  }
  const dealt = s.goliath.armored ? Math.min(amount, RULES.armoredMaxDamage) : amount;
  s.goliath.hp = Math.max(0, s.goliath.hp - dealt);
  fx(s, "goliath", `-${dealt}`, dealt < amount ? "miss" : "damage");
  return dealt;
}

function damageAlly(s: BattleState, id: CharacterId, amount: number) {
  const c = s.party[id];
  if (!isAlive(c)) return;
  const absorbed = Math.min(c.shield, amount);
  c.shield -= absorbed;
  const taken = amount - absorbed;
  c.hp = Math.max(0, c.hp - taken);
  fx(s, id, absorbed > 0 ? `-${taken} (🛡${absorbed})` : `-${taken}`, "damage");
  if (c.hp === 0) {
    c.fear = 0;
    c.shield = 0;
    log(s, `${CHARACTERS[id].name} has fallen!`, "system");
    if (id === "david" && !s.slingStoneUsed) {
      log(s, "Without David, the Sling Stone is lost.", "system");
    }
  }
}

function addFear(s: BattleState, id: CharacterId, amount: number) {
  const c = s.party[id];
  if (!isAlive(c) || amount <= 0) return;
  const before = c.fear;
  c.fear = Math.min(RULES.maxFear, c.fear + amount);
  if (c.fear > before) fx(s, id, `+${c.fear - before} Fear`, "fear");
  if (c.fear >= RULES.maxFear && before < RULES.maxFear) {
    log(s, `${CHARACTERS[id].name} is Terrified!`, "enemy");
  }
}

function removeFear(s: BattleState, id: CharacterId, amount: number) {
  const c = s.party[id];
  if (!isAlive(c) || c.fear === 0) return;
  const removed = Math.min(c.fear, amount);
  c.fear -= removed;
  fx(s, id, `-${removed} Fear`, "buff");
}

function addFaith(s: BattleState, n: number) {
  s.faith = Math.min(RULES.maxFaith, s.faith + n);
  fx(s, "david", `+${n} Faith`, "buff");
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
    goliath: { hp: RULES.goliathHp, armored: true, staggered: false, patternIndex: 0 },
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
  log(s, "Goliath of Gath steps forward, clad in bronze armor.", "system");
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

export function skillInfo(s: BattleState, id: CharacterId) {
  if (id === "david" && isSlingStoneReady(s)) return SLING_STONE;
  return CHARACTERS[id].skill;
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
  log(s, `Played ${card.name} (${card.reference}).`, "player");

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
      fx(s, c.id, `+${e.shieldAll} Shield`, "shield");
    });
  }
  if (e.healLowest) {
    const target = livingAllies(s).sort((a, b) => a.hp - b.hp)[0];
    if (target) {
      const healed = Math.min(e.healLowest, CHARACTERS[target.id].maxHp - target.hp);
      target.hp += healed;
      fx(s, target.id, `+${healed}`, "heal");
    }
  }
  if (e.damage) {
    const dealt = damageGoliath(s, e.damage);
    log(s, `Goliath takes ${dealt} damage${s.goliath.armored ? " (Armor)" : ""}.`, "player");
    checkVictory(s);
  }
  if (e.energy) s.energy += e.energy;
  if (e.draw) draw(s, e.draw, rng);
  return s;
}

export function activateSkill(state: BattleState, id: CharacterId): BattleState {
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
      s.goliath.staggered = true;
      s.goliath.patternIndex = 0;
      log(s, "SLING STONE! The stone sinks into Goliath's forehead — his Armor shatters!", "player");
      damageGoliath(s, RULES.slingStoneDamage);
      checkVictory(s);
      if (s.result === "ongoing") {
        log(s, "Goliath is Staggered and will lose his next action. Then he becomes Enraged.", "system");
        s.intent = null;
      }
    } else {
      const dealt = damageGoliath(s, RULES.slingDamage);
      log(s, `David slings a stone: ${dealt} damage${s.goliath.armored ? " (Armor)" : ""}.`, "player");
      checkVictory(s);
    }
  } else if (id === "samuel") {
    addFaith(s, RULES.samuelFaith);
    PARTY_ORDER.forEach((pid) => removeFear(s, pid, RULES.samuelFearRemoval));
    log(s, `Samuel anoints: +${RULES.samuelFaith} Faith, Fear eased.`, "player");
  } else {
    addCourage(s, RULES.jonathanCourage);
    livingAllies(s).forEach((ally) => {
      ally.shield += RULES.jonathanShield;
      fx(s, ally.id, `+${RULES.jonathanShield} Shield`, "shield");
    });
    log(s, `Jonathan's Covenant Shield: +${RULES.jonathanCourage} Courage, Shield ${RULES.jonathanShield} to all.`, "player");
  }
  return s;
}

export function spendCourage(state: BattleState, id: CharacterId): BattleState {
  if (!canSpendCourage(state, id)) return state;
  const s = clone(state);
  s.courage -= 1;
  removeFear(s, id, 1);
  log(s, `Spent 1 Courage: ${CHARACTERS[id].name} loses 1 Fear.`, "player");
  return s;
}

// ---------- end turn resolution ----------

export function resolveBasicAttacks(state: BattleState): BattleState {
  if (state.result !== "ongoing") return state;
  const s = clone(state);
  for (const id of PARTY_ORDER) {
    const c = s.party[id];
    if (!isAlive(c)) continue;
    const name = CHARACTERS[id].name;
    if (isTerrified(c)) {
      log(s, `${name} is Terrified and cannot attack.`, "ally");
      fx(s, id, "Terrified", "fear");
      continue;
    }
    const dmg = basicAttackDamage(s, id);
    const dealt = damageGoliath(s, dmg);
    log(s, `${name} attacks: ${dealt} damage${s.goliath.armored && dmg > dealt ? " (Armor)" : ""}.`, "ally");
    checkVictory(s);
    if (s.result !== "ongoing") break;
  }
  return s;
}

export function resolveGoliath(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.result !== "ongoing") return state;
  const s = clone(state);

  if (s.goliath.staggered) {
    s.goliath.staggered = false;
    log(s, "Goliath staggers and cannot act! His rage grows…", "enemy");
    fx(s, "goliath", "Staggered", "miss");
  } else if (s.intent) {
    const action = GOLIATH_ACTIONS[s.intent.actionId];
    log(s, `Goliath uses ${action.name}.`, "enemy");
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
  log(s, `— Turn ${s.turn} —`, "system");
  return s;
}

/** Which of the four encounter phases the battle is in (for the UI tracker). */
export function battlePhase(s: BattleState): 1 | 2 | 3 | 4 {
  if (!s.goliath.armored) return 4;
  if (isSlingStoneReady(s)) return 3;
  return s.faith > 0 ? 2 : 1;
}
