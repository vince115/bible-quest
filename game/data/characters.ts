import type { CharacterDef, CharacterId } from "../types";

export const PARTY_ORDER: CharacterId[] = ["david", "samuel", "jonathan"];

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  david: {
    id: "david",
    maxHp: 30,
    attack: 4,
    skillCost: 2,
  },
  samuel: {
    id: "samuel",
    maxHp: 24,
    attack: 2,
    skillCost: 2,
  },
  jonathan: {
    id: "jonathan",
    maxHp: 36,
    attack: 3,
    skillCost: 2,
  },
};

export const SLING_STONE_COST = 2;
