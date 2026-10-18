// Free mode's enemy side: any boss, with any guard in the front row and any shooter behind (or none), chosen by hand or
// set up automatically to suit the team.
import { ENEMY_HP, MAX_HP, STAGE_BOSS, STAGE_GUARD, STAGE_ORDER, STAGE_SHOOTER } from "../v2/data";
import type { Rng } from "../v2/engine";
import type { CharacterId, EnemyId, StageId } from "../v2/types";

/** The bosses (one per stage, in campaign order), and every guard and shooter a stage has. */
export const BOSSES: EnemyId[] = STAGE_ORDER.map((st) => STAGE_BOSS[st]);
export const GUARDS: EnemyId[] = STAGE_ORDER.map((st) => STAGE_GUARD[st]).filter((e): e is EnemyId => !!e);
export const SHOOTERS: EnemyId[] = STAGE_ORDER.map((st) => STAGE_SHOOTER[st]).filter((e): e is EnemyId => !!e);

export interface FoeSetup {
  boss: EnemyId;
  guard: EnemyId | null;
  shooter: EnemyId | null;
}

/** The stage a boss belongs to (its actions, its scene and its music come from there). */
export const stageOfBoss = (boss: EnemyId): StageId => STAGE_ORDER.find((st) => STAGE_BOSS[st] === boss) ?? "goliath";

/** A stage's own enemies. */
export const stageFoes = (stage: StageId): FoeSetup => ({ boss: STAGE_BOSS[stage], guard: STAGE_GUARD[stage] ?? null, shooter: STAGE_SHOOTER[stage] ?? null });

/** Is this setup exactly the stage's own (then the battle needs no override)? */
export const isStageOwn = (f: FoeSetup): boolean => {
  const own = stageFoes(stageOfBoss(f.boss));
  return own.guard === f.guard && own.shooter === f.shooter;
};

/**
 * An enemy side to suit the team: a boss whose HP is about 40% of the team's total HP (one of the three nearest, at
 * random), a guard when two or more come, a shooter when three or more come.
 */
export function autoFoes(lineup: CharacterId[], rng: Rng = Math.random): FoeSetup {
  const strength = lineup.reduce((n, id) => n + MAX_HP[id], 0);
  const target = strength * 0.4;
  const near = [...BOSSES].sort((a, b) => Math.abs(ENEMY_HP[a] - target) - Math.abs(ENEMY_HP[b] - target)).slice(0, 3);
  const any = <T,>(list: T[]) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  return {
    boss: any(near),
    guard: lineup.length >= 2 ? any(GUARDS) : null,
    shooter: lineup.length >= 3 ? any(SHOOTERS) : null,
  };
}
