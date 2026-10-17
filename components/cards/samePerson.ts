// Cards that show the same person at different times (Moses, then Moses at Sinai), or the same person on both sides (Ahab
// as a card to play and as an enemy at Carmel). Goliath's men on the player's side are battle-only and not in the list. The card demo lists the others when one is viewed. This is only for showing the link:
// which cards may go to battle together is decided by PERSON in game/v2/data.ts.
import type { BaseEnemyId, CharacterId } from "@/game/v2/types";

export type Card = CharacterId | BaseEnemyId;

/**
 * One person, every card of them; `via` names the verse that makes the link for cards that are not plainly the same figure.
 * `ownSection`: the person has a section of their own in the card demo (Jesus in the Trinity's, Satan), so their cards are
 * never piled.
 */
export const SAME_PERSON: { cards: Card[]; via?: Partial<Record<Card, string>>; ownSection?: boolean }[] = [
  { cards: ["moses", "mosesSinai"] },
  { cards: ["jesus", "jesusUR", "jesusCross"], ownSection: true },
  { cards: ["johnApostle", "johnPatmos"] },
  {
    // That old serpent, called the Devil, and Satan (Revelation 12:9).
    cards: ["satanDisguised", "satan", "satanMan", "satanVeiled", "satanFoe", "serpent", "serpentTempter", "serpentP"],
    via: { serpent: "v3.demo.viaRev12", serpentTempter: "v3.demo.viaRev12", serpentP: "v3.demo.viaRev12" },
    ownSection: true,
  },
  { cards: ["ahab", "ahabKing"] },
  { cards: ["jezebel", "jezebelQueen"] },
  // The man of the Gadarenes, possessed by Legion and then set free (Mark 5).
  { cards: ["legion", "legionFreed"] },
];

/**
 * Which pile a card is stacked in when the same person's cards share a place in a list: the person's group. Undefined for a
 * card of its own, and for the people who have a section of their own (their cards always lie side by side).
 */
export function stackOf(card: Card): string | undefined {
  const i = SAME_PERSON.findIndex((g) => g.cards.includes(card));
  return i < 0 || SAME_PERSON[i].ownSection ? undefined : String(i);
}

/** The cards of a person who has a section of their own, by one of their cards. */
export const sectionOf = (card: Card): Card[] => SAME_PERSON.find((g) => g.ownSection && g.cards.includes(card))?.cards ?? [];

/**
 * The other cards of the person on `card`, each with the verse behind the link when it is not plain: only between a card
 * that needs it and one that doesn't (the serpent and Satan), never between two serpents.
 */
export function samePersonAs(card: Card): { card: Card; via?: string }[] {
  const group = SAME_PERSON.find((g) => g.cards.includes(card));
  if (!group) return [];
  const mine = group.via?.[card];
  return group.cards.filter((c) => c !== card).map((c) => {
    const theirs = group.via?.[c];
    return { card: c, via: !mine === !theirs ? undefined : (mine ?? theirs) };
  });
}
