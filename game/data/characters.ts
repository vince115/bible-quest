import type { CharacterDef, CharacterId, SkillId } from "../types";

export const PARTY_ORDER: CharacterId[] = ["david", "samuel", "jonathan"];

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  david: {
    id: "david",
    maxHp: 30,
    attack: 4,
    skills: ["sling", "youngWarrior"],
  },
  samuel: {
    id: "samuel",
    maxHp: 24,
    attack: 2,
    skills: ["anoint", "prayer"],
  },
  jonathan: {
    id: "jonathan",
    maxHp: 36,
    attack: 3,
    skills: ["covenantShield", "brothersCovenant"],
  },
};

/** Every character skill (including Sling Stone) costs the same Team Energy. */
export const SKILL_COST: Record<SkillId, number> = {
  sling: 2,
  youngWarrior: 2,
  anoint: 2,
  prayer: 2,
  covenantShield: 2,
  brothersCovenant: 2,
};
