// Card rarity: presentation only. It decides how a card looks (frame, ornaments, foil, light effects), never its
// numbers, and is not tied to draws or drop rates.
import type { CharacterId, EnemyId } from "@/game/v2/types";
import type { Ornament } from "./CardFrame";

export type Rarity = "N" | "R" | "SR" | "SSR" | "UR";

/** Which rarity each card is printed at. R and UR are kept for later cards (common soldiers, special editions). */
export const CARD_RARITY: Record<CharacterId | EnemyId, Rarity> = {
  archer: "N",
  bearer: "N",
  samuel: "SR",
  jonathan: "SR",
  cain: "SR",
  abel: "SR",
  noah: "SSR",
  abraham: "SSR",
  isaac: "SR",
  jacob: "SSR",
  joseph: "UR",
  moses: "UR",
  aaron: "SSR",
  miriam: "SR",
  mosesSinai: "SSR",
  joshua: "SSR",
  rahab: "SR",
  deborah: "SSR",
  gideon: "SSR",
  samson: "SSR",
  ruth: "SR",
  naomi: "R",
  boaz: "SR",
  hannah: "SR",
  saul: "SSR",
  abigail: "SR",
  solomon: "UR",
  elijah: "SSR",
  elisha: "SSR",
  jonah: "SR",
  isaiah: "SSR",
  esther: "UR",
  daniel: "SSR",
  nehemiah: "SR",
  zechariah: "SR",
  mary: "UR",
  josephNaz: "SR",
  johnBaptist: "SSR",
  jesus: "UR",
  jesusUR: "UR",
  peter: "SSR",
  andrew: "SR",
  johnApostle: "SSR",
  matthew: "SR",
  jamesZeb: "SR",
  thomas: "SR",
  maryMagdalene: "SSR",
  martha: "SR",
  zacchaeus: "R",
  maryBethany: "SR",
  lazarus: "SR",
  stephen: "SR",
  philip: "SR",
  paul: "UR",
  barnabas: "SR",
  silas: "SR",
  timothy: "SR",
  lydia: "SR",
  priscilla: "SR",
  david: "SSR",
  adam: "SSR",
  eve: "SSR",
  goliath: "SSR",
  archerP: "N",
  bearerP: "N",
  goliathP: "SSR",
  serpentP: "SSR",
  serpent: "SSR",
};

export interface RarityLook {
  /** Gold ornaments on the frame (null: a plain frame), their size (% of the card width) and how strongly they show. */
  ornament: Ornament | null;
  ornamentSize: number;
  ornamentOpacity: number;
  /** Metal of the ornaments: gold for the top rarities, silver for SR, bronze for R. */
  ornamentMetal: "gold" | "silver" | "bronze";
  /** Element foil strength over the card while it is held close (0: none). */
  foil: number;
  /** Light that follows the pointer. */
  glare: boolean;
  /** Maximum tilt in degrees when held close. */
  tilt: number;
  /** A band of light sweeps across the card as it comes up close. */
  shine: boolean;
  /** A slow gold sheen keeps running along the frame, even on the table. */
  sheen: boolean;
  /** Prismatic (rainbow) frame, with the ornaments in flowing neon rainbow colours. */
  prism: boolean;
  /** Colour of the rarity mark printed by the card number. */
  mark: string;
  /** Gradient filling the rarity letters (with a glossy band across the top). */
  metal: string;
}

export const RARITY: Record<Rarity, RarityLook> = {
  N: { ornament: null, ornamentSize: 0, ornamentOpacity: 0, ornamentMetal: "silver", foil: 0, glare: false, tilt: 6, shine: false, sheen: false, prism: false, mark: "text-stone-500", metal: "linear-gradient(180deg,#ffffff 0%,#e7e5e4 38%,#a8a29e 52%,#d6d3d1 75%,#78716c 100%)" },
  R: { ornament: "lily", ornamentSize: 11, ornamentOpacity: 1, ornamentMetal: "bronze", foil: 0, glare: true, tilt: 10, shine: false, sheen: false, prism: false, mark: "text-sky-700", metal: "linear-gradient(180deg,#f0f9ff 0%,#bae6fd 38%,#38bdf8 52%,#7dd3fc 75%,#0369a1 100%)" },
  SR: { ornament: "lily", ornamentSize: 15, ornamentOpacity: 1, ornamentMetal: "silver", foil: 0.06, glare: true, tilt: 14, shine: true, sheen: false, prism: false, mark: "text-violet-700", metal: "linear-gradient(180deg,#ffffff 0%,#ede9fe 36%,#a78bfa 52%,#ddd6fe 74%,#6d28d9 100%)" },
  SSR: { ornament: "dove", ornamentSize: 18, ornamentOpacity: 1, ornamentMetal: "gold", foil: 0.1, glare: true, tilt: 16, shine: true, sheen: true, prism: false, mark: "text-amber-600", metal: "linear-gradient(180deg,#fffbe6 0%,#fde68a 36%,#f59e0b 52%,#fcd34d 74%,#b45309 100%)" },
  UR: { ornament: "ur", ornamentSize: 13, ornamentOpacity: 1, ornamentMetal: "gold", foil: 0.16, glare: true, tilt: 16, shine: true, sheen: true, prism: true, mark: "text-fuchsia-600", metal: "linear-gradient(120deg,#f9a8d4 0%,#fde68a 22%,#86efac 42%,#7dd3fc 62%,#c4b5fd 82%,#f9a8d4 100%)" },
};

export const lookOf = (id: CharacterId | EnemyId) => RARITY[CARD_RARITY[id]];

