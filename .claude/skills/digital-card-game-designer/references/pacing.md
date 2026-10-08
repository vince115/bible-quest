# Combat pacing

Bible Quest target: **3 turns excellent, 4 normal, 5 acceptable, 6+ too long.**

## Framework
For each phase, estimate per turn:
- **Effective damage** = sum of every source after modifiers (armor, fear, bonuses).
- **Meaningful decisions** = choices with ≥2 reasonable answers (not just "spend everything").
- **Cards played** and **character actions** taken.
- **Enemy actions** and the threat they pose (can the player actually lose a character?).

Turns to win ≈ setup turns + ⌈remaining HP / effective payoff damage per turn⌉.

## Turn types
| Type | Purpose | Risk |
|---|---|---|
| Setup | Build Faith/Courage, remove Fear, shield | Feels like nothing happens if damage is ~0 |
| Defensive | Answer a telegraphed big hit | Feels passive if it's the only option |
| Payoff | Spend the setup (Sling Stone) | Must feel dramatically larger |
| Finisher | Close out | Should be short; a long finisher is a grind |

## Rules of thumb
- Every turn should move Goliath's HP bar visibly **or** visibly advance the setup (Faith meter, Armor).
- The damage-to-HP ratio should let a successful action take roughly 10–25% of the boss's HP;
  a single action taking under ~3% reads as "nothing happened".
- Don't fix length only by lowering boss HP: first check for phases where actions are nullified
  (e.g. a hard damage cap), dominated options, and crowded-out cards.
- With a 3–5 turn battle the enemy only acts 3–5 times; each action must be a real threat to matter.

## Measuring
Use a scratchpad bot over the real engine (compile `game/engine.ts` with `tsc` to CommonJS):
- At least two policies (competent and casual); report win turn distribution (≤3 / 4 / 5 / 6+),
  armor-break turn, character deaths, cards played per turn, wasted draws.
- Bots under-play synergy and over-play mechanically; treat results as a signal, not a verdict.
