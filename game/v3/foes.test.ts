import { describe, expect, it } from "vitest";
import { ENEMY_HP, STAGE_BOSS } from "../v2/data";
import { attackableEnemies, enemyAlive, guardOf, shooterOf } from "../v2/engine";
import { BOSSES, GUARDS, SHOOTERS, autoFoes, isStageOwn, stageFoes, stageOfBoss } from "./foes";
import { createBoard } from "./engine";

const steady = () => 0.5;

describe("free mode's enemy side", () => {
  it("offers every boss, guard and shooter, and each boss brings its own stage", () => {
    expect(BOSSES).toContain("goliath");
    expect(GUARDS).toContain("bearer");
    expect(SHOOTERS).toContain("archer");
    for (const boss of BOSSES) expect(STAGE_BOSS[stageOfBoss(boss)]).toBe(boss);
    expect(isStageOwn(stageFoes("goliath"))).toBe(true);
    expect(isStageOwn({ boss: "goliath", guard: "pharaohHost", shooter: null })).toBe(false);
  });

  it("a battle can have another guard and shooter than its stage's, or none", () => {
    const b = createBoard(["david", "samuel", "jonathan"], "david", steady, "goliath", "table", { guard: "pharaohHost", shooter: "windows" });
    const s = b.battle;
    expect([guardOf(s), shooterOf(s)]).toEqual(["pharaohHost", "windows"]);
    expect(enemyAlive(s, "pharaohHost") && enemyAlive(s, "windows")).toBe(true);
    expect(enemyAlive(s, "bearer") || enemyAlive(s, "archer")).toBe(false);
    expect(attackableEnemies(s)).not.toContain("goliath"); // the chosen guard protects the boss
    const bare = createBoard(["david", "samuel"], "david", steady, "goliath", "table", { guard: null, shooter: null }).battle;
    expect(attackableEnemies(bare)).toEqual(["goliath"]);
    expect(bare.archerTarget).toBeNull();
  });

  it("sets up a side to suit the team: a boss near 40% of the team's HP, minions for bigger teams", () => {
    const solo = autoFoes(["david"], steady);
    expect([solo.guard, solo.shooter]).toEqual([null, null]);
    const team = autoFoes(["david", "samuel", "jonathan", "moses", "joseph"], steady);
    expect(team.guard).not.toBeNull();
    expect(team.shooter).not.toBeNull();
    expect(ENEMY_HP[team.boss]).toBeGreaterThan(ENEMY_HP[solo.boss] - 1);
  });
});
