import type { GoliathAction, GoliathActionId } from "../types";

export const GOLIATH_ACTIONS: Record<GoliathActionId, GoliathAction> = {
  defy: {
    id: "defy",
    fearAll: 1,
  },
  spear: {
    id: "spear",
    damageOne: 10,
  },
  taunt: {
    id: "taunt",
    damageOne: 6,
    fearOne: 2,
    targetsDavid: true,
  },
  roar: {
    id: "roar",
    fearAll: 2,
  },
  swing: {
    id: "swing",
    damageAll: 12,
  },
  crush: {
    id: "crush",
    damageOne: 22,
  },
};

/** Cycle while the Armor is intact (Phases 1–3). */
export const ARMORED_PATTERN: GoliathActionId[] = ["defy", "spear", "taunt"];

/** Cycle after the Armor is broken (Phase 4). */
export const ENRAGED_PATTERN: GoliathActionId[] = ["roar", "swing", "crush"];
