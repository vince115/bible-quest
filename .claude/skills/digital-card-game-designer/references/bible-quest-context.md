# Bible Quest — current context (snapshot 2026-10-08; verify against the code)

## Version history
`baseline-v0.1` → `balance-v0.2` → `balance-v0.3` → i18n commit → `balance-v0.4` →
`bee8f5a feat: improve character skill system` (Team Energy 6, skills cost 2, one skill per character per turn,
two skills each).

## Known design issues (from playtest + measurement)
1. **Cards are crowded out by skills.** 6 Energy buys exactly three 2-cost skills; bots play ~1 card/turn.
2. **Little "who gets this card?" decision.** Most cards are team-wide or auto-target (heals target the
   lowest-HP ally automatically).
3. **The draw isn't a moment.** Opening 4, draw 2, hand limit 6; hand averages ~4 after a turn, so draws
   often hit the limit and are skipped silently. ~9 of 12 cards seen by turn 4. No draw animation or piles.
4. **Armor nullifies actions** while it stands (every hit capped at 1 in the committed version), so early
   turns show almost no progress and the battle runs ~7+ turns.
5. **Dominated choices.** Young Warrior can't stack with Sling (one skill per character), so it's rarely
   better than Sling.
6. **UI hierarchy.** Scripture Hand sits below the characters; the result overlay hides the battle log.
7. **No threat.** Goliath almost never defeats anyone in the target battle length.

## Open decisions (waiting on the user)
- Combat Loop v0.5: layout (Goliath → Hand → Characters), draw presentation, card frame, character targeting,
  draw rules (opening/draw per turn).
- Balance proposal (damage scale, Armor model, Goliath HP) — on hold until the loop is settled.
- Rarity data model proposal — on hold.

## Fixed decisions
- Faith is David's personal resource; frozen while he's fallen, kept when revived.
- Team Energy 6, skills cost 2, one skill per character per turn.
- 12-card deck (2 Faith, 2 Courage/Fear, 3 heal, 1 resurrection, 2 defence, 2 offence).
- Sling Stone: once per battle, needs 10 Faith, breaks Armor, Goliath turns Enraged immediately (no stagger).
- Chinese/English via `game/i18n.ts`; the engine logs keys, never sentences.
