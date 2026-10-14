// Which sound effects a change in a battle calls for, worked out by comparing the battle before and after. Reading the
// state instead of the battle log keeps this short: the engine has hundreds of different log lines but only a few
// kinds of change (someone is hurt or healed, a shield rises or breaks, a card is drawn or stuck on, someone falls).
import type { SfxName } from "../sfx";
import type { BattleState, CharacterId, EnemyId } from "../v2/types";

const MAX_EFFECTS = 4;

export function sfxEvents(prev: BattleState | null, next: BattleState): SfxName[] {
  // A new battle (or another line-up) starts from scratch: nothing to compare.
  if (!prev || next.turn < prev.turn || next.stage !== prev.stage || next.lineup.join() !== prev.lineup.join()) return [];

  const out: SfxName[] = [];
  const add = (n: SfxName) => out.includes(n) || out.push(n);

  const enemies = Object.keys(next.enemies) as EnemyId[];
  if (enemies.some((id) => next.enemies[id].hp < prev.enemies[id].hp)) add("hit");

  const party = next.lineup as CharacterId[];
  const hurt = party.some((id) => next.party[id].hp < prev.party[id].hp);
  const blocked = party.some((id) => next.party[id].shield < prev.party[id].shield);
  if (hurt) add("hurt");
  else if (blocked) add("block");
  if (party.some((id) => next.party[id].hp > prev.party[id].hp && prev.party[id].hp > 0)) add("heal");
  if (party.some((id) => next.party[id].shield > prev.party[id].shield)) add("shield");

  if (party.some((id) => prev.party[id].hp > 0 && next.party[id].hp <= 0)) add("down");
  if (enemies.some((id) => prev.enemies[id].hp > 0 && next.enemies[id].hp <= 0)) add("enemyDown");

  if (next.attached > prev.attached) add("attach");
  else if (next.hand.length > prev.hand.length) add("draw");

  if (prev.result === "ongoing" && next.result === "victory") add("victory");
  if (prev.result === "ongoing" && next.result === "defeat") add("defeat");

  // The end of a battle always gets its sound, even when the turn was busy.
  const ending = out.filter((n) => n === "victory" || n === "defeat");
  return [...out.filter((n) => n !== "victory" && n !== "defeat").slice(0, MAX_EFFECTS - ending.length), ...ending];
}
