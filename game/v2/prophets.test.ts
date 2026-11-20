import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { CHARACTER_ELEMENT, CHARACTER_SKILLS, MAX_HP, PARTY_ORDER, PROPHET_EFFECTS, SKILLS, tableKind } from "./data";
import { castSkill, createBattle, mpCost, skillTargets, skillTargetKind } from "./engine";
import { translate as t } from "../i18n";
import { PACKS, packCards, COLLECTIBLE } from "../v3/gacha";
import { TIMELINE } from "@/components/cards/timeline";
import type { BaseCharacterId, PoolMode } from "./types";

const ADDED: BaseCharacterId[] = ["hosea", "joel", "amos", "obadiah", "micah", "nahum", "habakkuk", "zephaniah", "haggai", "zechariahProphet", "malachi"];
const rng = () => 0.5;

function ready(owner: BaseCharacterId, mode: PoolMode, copy = false) {
  const caster = copy ? `${owner}#2` as const : owner;
  const s = createBattle(rng, [caster, "david", "eve"], "goliath", 0, mode);
  s.energy = { attack: 6, guard: 6, faith: 6 };
  for (const id of s.lineup) {
    s.party[id].hp -= 50;
    s.party[id].mp = 150;
    s.party[id].sp = 150;
    s.party[id].cards = { red: [1], green: [2], blue: [2] };
  }
  s.party.david.cards = { red: [], green: [], blue: [] };
  return { s, caster };
}

describe("book prophets added in November 2026", () => {
  it("registers art, bilingual card copy, unique card numbers, stats and exactly one booster pack per prophet", () => {
    const faces = readFileSync("components/cards/CharacterCardFace.tsx", "utf8");
    for (const id of ADDED) {
      expect(PARTY_ORDER.filter(x => x === id)).toHaveLength(1);
      expect(TIMELINE.filter(x => x === id)).toHaveLength(1);
      expect(COLLECTIBLE).toContain(id);
      expect(PACKS.filter(p => packCards(p).includes(id))).toHaveLength(1);
      expect(CHARACTER_ELEMENT[id]).toBeTruthy();
      expect(MAX_HP[id]).toBeGreaterThanOrEqual(120);
      expect(existsSync(`public/cards/${id}.jpg`)).toBe(true);
      for (const lang of ["zh", "en"] as const) {
        for (const key of [`char.${id}.name`, `v3.bio.${id}`, ...["title", "flavor", "verse", "ref"].map(f => `v3.card.${id}.${f}`)]) {
          expect(t(lang, key), key).not.toBe(key);
        }
        for (const skill of CHARACTER_SKILLS[id]) {
          expect(t(lang, `v2.skill.${skill}.name`)).not.toContain("v2.skill.");
          expect(t(lang, `v2.skill.${skill}.desc`, { n: 30 })).not.toContain("v2.skill.");
          expect(SKILLS[skill].owner).toBe(id);
        }
      }
    }
    const cardNumbers = [...faces.matchAll(/\b\w+: "(\d{3}|E\d{2})"/g)].map(m => m[1]);
    expect(new Set(cardNumbers).size).toBe(cardNumbers.length);
    expect(t("zh", "v3.card.zechariahProphet.title")).not.toBe(t("zh", "v3.card.zechariah.title"));
    expect(CHARACTER_SKILLS.zechariah).toEqual(["incense", "nameIsJohn"]);
  });

  for (const mode of ["team", "personal", "table"] as PoolMode[]) {
    for (const owner of ADDED) {
      for (const skill of CHARACTER_SKILLS[owner]) {
        it(`${mode}: ${skill} pays energy, produces its effect and consumes the casting copy's turn`, () => {
          const { s, caster } = ready(owner, mode, true);
          const kind = skillTargetKind(skill);
          const target = kind === "enemy" ? skillTargets(s, skill, caster)[0] : kind === "ally" ? "david" : undefined;
          s.party.david.shaken = true;
          const beforeHp = target && target in s.enemies ? s.enemies[target as keyof typeof s.enemies].hp : 0;
          const out = castSkill(s, skill, target, rng, caster);
          expect(out).not.toBe(s);
          expect(s.party[caster].acted).toBe(false);
          expect(out.party[caster].acted).toBe(true);
          expect(out.party[owner].acted).toBe(false);
          if (SKILLS[skill].damage) {
            expect(out.enemies[target as keyof typeof out.enemies].hp).toBeLessThan(beforeHp);
          } else {
            const effect = PROPHET_EFFECTS[skill]!;
            if (effect.heal) expect(out.party.david.hp).toBe(s.party.david.hp + effect.heal);
            if (effect.shield) expect(out.party.david.shield).toBeGreaterThan(s.party.david.shield);
            if (effect.cleanse) expect(out.party.david.shaken).toBe(false);
            if (effect.faith && mode === "table") expect(out.party.david.cards!.blue.length).toBe(1);
          }
          if (mode === "team") expect(out.energy[SKILLS[skill].kind]).toBeLessThan(s.energy[SKILLS[skill].kind]);
          if (mode === "personal") expect(SKILLS[skill].kind === "attack" ? out.party[caster].sp : out.party[caster].mp).toBeLessThan(SKILLS[skill].kind === "attack" ? s.party[caster].sp : s.party[caster].mp);
          if (mode === "table") {
            const color = { attack: "red", guard: "green", faith: "blue" }[tableKind(skill)] as "red" | "green" | "blue";
            expect(out.party[caster].cards![color].length).toBeLessThan(s.party[caster].cards![color].length);
          }
          expect(mpCost(skill)).toBeGreaterThan(0);
          expect(castSkill(out, skill, target, rng, caster)).toBe(out);
        });
      }
    }
  }

  it("keeps prophet damage on the existing cost curve (no stronger than any older skill of the same kind and cost)", () => {
    const prophetSkills = new Set(ADDED.flatMap(id => CHARACTER_SKILLS[id]));
    for (const skill of prophetSkills) {
      const def = SKILLS[skill];
      if (!def.damage) continue;
      const peers = Object.values(SKILLS).filter(o => !prophetSkills.has(o.id) && o.kind === def.kind && o.cost === def.cost && o.damage);
      expect(peers.length, skill).toBeGreaterThan(0);
      expect(def.damage, skill).toBeLessThanOrEqual(Math.max(...peers.map(o => o.damage!)));
    }
    // Amos's "justice as waters" sits with Seth's and Thomas's two-cost faith strikes.
    expect(SKILLS.justiceWaters.damage).toBe(SKILLS.callOnLord.damage);
  });

  it("does not cast without resources or heal a fallen ally", () => {
    const { s } = ready("micah", "team");
    s.energy = { attack: 0, guard: 0, faith: 0 };
    expect(castSkill(s, "loveMercy", "david", rng)).toBe(s);
    s.energy.guard = 2;
    s.party.david.hp = 0;
    expect(skillTargets(s, "loveMercy")).not.toContain("david");
    expect(castSkill(s, "loveMercy", "david", rng)).toBe(s);
    const all = ready("malachi", "team").s;
    all.party.david.hp = 0;
    expect(castSkill(all, "healingWings", undefined, rng).party.david.hp).toBe(0);
  });
});
