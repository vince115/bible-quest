import type { CardDef } from "../types";

export const CARDS: CardDef[] = [
  // Faith
  { id: "delivered", cost: 1, effect: { faith: 3 } },
  { id: "battle", cost: 2, effect: { faith: 4, removeDavidFear: true } },
  // Courage / Fear
  { id: "courageous", cost: 1, effect: { courage: 3 } },
  { id: "whomfear", cost: 2, effect: { removeFearAll: "all", courage: 1 } },
  // Healing
  { id: "renewed", cost: 1, effect: { healLowest: 8 } },
  { id: "brokenhearted", cost: 2, effect: { healAll: 5 } },
  { id: "healer", cost: 1, effect: { healLowest: 6, healLowestFear: 1 } },
  // Resurrection
  { id: "resurrection", cost: 2, singleUse: true, effect: { revive: 0.3 } },
  // Defensive
  { id: "wings", cost: 1, effect: { shieldAll: 4 } },
  { id: "rock", cost: 2, effect: { shieldAll: 7 } },
  // Offensive
  { id: "hosts", cost: 1, effect: { damage: 8 } },
  { id: "trains", cost: 1, effect: { davidStrike: 5 } },
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);
