import type { GoliathAction, GoliathActionId } from "../types";

export const GOLIATH_ACTIONS: Record<GoliathActionId, GoliathAction> = {
  defy: {
    id: "defy",
    name: "Defy the Armies of Israel",
    description: "Every ally gains 1 Fear.",
    fearAll: 1,
  },
  spear: {
    id: "spear",
    name: "Spear Thrust",
    description: "10 damage to one ally.",
    damageOne: 10,
  },
  taunt: {
    id: "taunt",
    name: "Taunt the Shepherd",
    description: "David gains 2 Fear and takes 6 damage.",
    damageOne: 6,
    fearOne: 2,
    targetsDavid: true,
  },
  roar: {
    id: "roar",
    name: "Roar of Rage",
    description: "Every ally gains 2 Fear.",
    fearAll: 2,
  },
  swing: {
    id: "swing",
    name: "Furious Swing",
    description: "12 damage to every ally.",
    damageAll: 12,
  },
  crush: {
    id: "crush",
    name: "Crushing Blow",
    description: "22 damage to one ally.",
    damageOne: 22,
  },
};

/** Cycle while the Armor is intact (Phases 1–3). */
export const ARMORED_PATTERN: GoliathActionId[] = ["defy", "spear", "taunt"];

/** Cycle after the Armor is broken (Phase 4). */
export const ENRAGED_PATTERN: GoliathActionId[] = ["roar", "swing", "crush"];
