import type { CharacterDef, CharacterId } from "../types";
import { RULES } from "./rules";

export const PARTY_ORDER: CharacterId[] = ["david", "samuel", "jonathan"];

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  david: {
    id: "david",
    name: "David",
    role: "Faith · Armor Breaker",
    maxHp: 30,
    attack: 4,
    skill: {
      name: "Sling",
      cost: 2,
      description: `Deal ${RULES.slingDamage} damage. At ${RULES.maxFaith} Faith becomes Sling Stone.`,
    },
  },
  samuel: {
    id: "samuel",
    name: "Samuel",
    role: "Faith · Fear Removal",
    maxHp: 24,
    attack: 2,
    skill: {
      name: "Anoint",
      cost: 2,
      description: `+${RULES.samuelFaith} Faith. Remove ${RULES.samuelFearRemoval} Fear from every ally.`,
    },
  },
  jonathan: {
    id: "jonathan",
    name: "Jonathan",
    role: "Protection · Courage",
    maxHp: 36,
    attack: 3,
    skill: {
      name: "Covenant Shield",
      cost: 2,
      description: `+${RULES.jonathanCourage} Courage. Every ally gains Shield ${RULES.jonathanShield}.`,
    },
  },
};

export const SLING_STONE = {
  name: "Sling Stone",
  cost: 2,
  description: `Spend ${RULES.maxFaith} Faith. Break Goliath's Armor and deal ${RULES.slingStoneDamage} damage. Once per battle.`,
};
