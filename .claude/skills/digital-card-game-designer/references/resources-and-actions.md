# Resource and action economy

## Models seen in mature games
| Model | Example | What it creates |
|---|---|---|
| Growing mana | Hearthstone (1→10), Snap (1→6) | Curve planning; early/late cards |
| Banked surplus | Runeterra spell mana (carry up to 3) | "Pass now, big turn later" |
| Fixed energy per turn | Slay the Spire (3) | Pure allocation puzzle each turn |
| Permanent resources | Magic lands, Pokémon Energy attached to a Pokémon | Long-term commitment; *which unit* to invest in |
| Per-unit actions | Tactics games, Pokémon's one attack | Each character acts; choice is *how* |
| Per-type limits | One Supporter / one land per turn | Texture without new currencies |

## Why players have resources but can't do everything
Because the choice *is* the game. A healthy turn has **more good options than resources**, and the
options compete on different axes (damage now vs defence vs setup vs card flow).

## Diagnostics
- **Exact-fit trap:** if the resource buys exactly one standard set of actions every turn (e.g. 6 Energy =
  three 2-cost skills), the turn is solved. Other actions (cards) get crowded out.
- **Shared pool across different action types:** cards and skills competing for one pool is fine only if
  both are frequently worth it. Measure cards played per turn; ~0–1 means cards are being crowded out.
- **Dominated options:** if one skill is always better than its sibling, the choice is fake.
- **Carry-over:** banking creates planning only if a bigger turn is actually valuable.

## Questions before changing Bible Quest's economy
1. Over a typical turn, how many distinct actions are worth taking vs affordable?
2. Do Scripture Cards and character skills compete on value, or does one always win?
3. Does each character's per-turn choice have two live options?
4. Is the "big turn" (Sling Stone) something the economy lets the player build toward?
Do not assume a specific model is right for Bible Quest; compare 2–3 options against the Review Protocol.
