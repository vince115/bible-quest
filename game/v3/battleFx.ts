// What to show on the cards after a change in a battle (floating numbers and the hit shake), worked out by comparing the
// battle before and after, like the sound effects (see sfxEvents.ts).
import type { BattleState, CharacterId, EnemyId } from "../v2/types";

export interface Delta {
  id: CharacterId | EnemyId;
  /** damage: HP lost; block: the shield took it; heal: HP gained; shield: shield gained. */
  kind: "damage" | "block" | "heal" | "shield";
  amount: number;
}

export function battleDeltas(prev: BattleState | null, next: BattleState): Delta[] {
  // A new battle (or another line-up) starts from scratch: nothing to compare.
  if (!prev || next.turn < prev.turn || next.stage !== prev.stage || next.lineup.join() !== prev.lineup.join()) return [];
  const out: Delta[] = [];

  for (const id of next.lineup) {
    const was = prev.party[id];
    const now = next.party[id];
    const hpLost = Math.max(0, was.hp - now.hp);
    const shieldLost = Math.max(0, was.shield - now.shield);
    if (hpLost > 0) out.push({ id, kind: "damage", amount: hpLost + shieldLost });
    else if (shieldLost > 0) out.push({ id, kind: "block", amount: shieldLost });
    if (now.hp > was.hp && was.hp > 0) out.push({ id, kind: "heal", amount: now.hp - was.hp });
    if (now.shield > was.shield) out.push({ id, kind: "shield", amount: now.shield - was.shield });
  }
  for (const id of Object.keys(next.enemies) as EnemyId[]) {
    const lost = prev.enemies[id].hp - next.enemies[id].hp;
    if (lost > 0) out.push({ id, kind: "damage", amount: lost });
  }
  return out;
}
