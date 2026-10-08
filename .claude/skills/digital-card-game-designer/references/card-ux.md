# Card UX principles

## Screen hierarchy for Bible Quest
```text
Goliath (HP, intent, status)
   ↓
Scripture Hand (with deck pile, discard pile, Energy)
   ↓
Player characters (HP, Fear, two skills each)
```
Eye path: threat → options → who acts. The hand sits between the enemy and the party because cards are
how the party answers the threat. The battle log is secondary (side column / collapsible).

## Card anatomy (most to least important)
1. **Cost** — corner gem, readable at a glance.
2. **Name** — the Scripture title.
3. **Effect** — one line, with the key number large or iconised.
4. **Reference** — book chapter:verse (identity and flavour).
5. **Category colour/frame** — Faith, Courage, healing, defence, offence, resurrection.
6. Rarity mark (later), art (later).
A card should be recognisable as a *card* (frame, proportions ~2:3, depth), not a rectangular button.

## Interaction states
| State | Feedback |
|---|---|
| Idle | In hand, slight fan/overlap |
| Hover / focus | Lift and enlarge; full text readable |
| Unaffordable / unplayable | Dimmed **with a reason** (Energy, no valid target) |
| Selected | Raised and glowing; valid targets highlight; invalid ones dim |
| Targeting | Line/arrow or highlighted character frames; Esc/cancel always available |
| Played | Card travels to target/battlefield, effect plays, card goes to discard |

## Motion
- **Draw:** card leaves the deck pile and lands in hand one at a time; "new" marker for the turn.
- **Play:** short travel to target (~250–400 ms), then the effect number/animation.
- **Discard/reshuffle:** visible travel to the discard pile; reshuffle as a brief deck animation.
- Motion explains cause and effect; keep it short so turns stay fast. Respect reduced-motion preferences.

## Mobile
- Keep cards at a readable minimum width; use a horizontally scrollable or fanned hand instead of shrinking.
- Tap to select, tap a target to play; no hover-only information.
- Make sure the hand never covers the characters you need to target.
