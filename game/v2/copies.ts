// More than one copy of a card in one line-up (free mode): the second to sixth copies of a card fight as their own
// characters, `david#2` … `david#6`, each with its own HP, energy and turn, and everything else taken from the card.
import type { BaseCharacterId, CharacterId, CopyId } from "./types";

/** The numbers a copy can carry (the card itself is the first). */
export const COPY_NUMBERS = [2, 3, 4, 5, 6] as const;

/** The card a character is printed on (a copy's card is the card itself). */
export const baseCharacter = (id: CharacterId): BaseCharacterId => id.split("#")[0] as BaseCharacterId;

/** Which copy of its card a character is: 1 for the card itself. */
export const copyNumber = (id: CharacterId): number => Number(id.split("#")[1] ?? 1);

/** The `n`th copy of a card in a line-up (the first is the card itself). */
export const copyOf = (card: BaseCharacterId, n: number): CharacterId => (n <= 1 ? card : (`${card}#${n}` as CopyId));

/** A table of cards extended to their copies, which share every entry with their card. */
export function withCopies<K extends string, T>(base: Record<K, T>): Record<K | `${K}#${(typeof COPY_NUMBERS)[number]}`, T> {
  const out: Record<string, T> = { ...base };
  for (const id of Object.keys(base) as K[]) for (const n of COPY_NUMBERS) out[`${id}#${n}`] = base[id];
  return out as Record<K | `${K}#${(typeof COPY_NUMBERS)[number]}`, T>;
}
