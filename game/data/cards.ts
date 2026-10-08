import type { CardDef } from "../types";

export const CARDS: CardDef[] = [
  {
    id: "delivered",
    cost: 1,
    effect: { faith: 3 },
  },
  {
    id: "assurance",
    cost: 1,
    effect: { faith: 2, draw: 1 },
  },
  {
    id: "trust",
    cost: 2,
    effect: { faith: 5 },
  },
  {
    id: "battle",
    cost: 2,
    effect: { faith: 3, removeDavidFear: true },
  },
  {
    id: "courageous",
    cost: 1,
    effect: { courage: 3 },
  },
  {
    id: "forsake",
    cost: 1,
    effect: { courage: 2, faith: 1 },
  },
  {
    id: "noevil",
    cost: 1,
    effect: { removeFearAll: 1 },
  },
  {
    id: "whomfear",
    cost: 2,
    effect: { removeFearAll: "all", courage: 1 },
  },
  {
    id: "wings",
    cost: 1,
    effect: { shieldAll: 4 },
  },
  {
    id: "renewed",
    cost: 1,
    effect: { healLowest: 8 },
  },
  {
    id: "hosts",
    cost: 1,
    effect: { damage: 8 },
  },
  {
    id: "strength",
    cost: 0,
    effect: { energy: 1 },
  },
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);
