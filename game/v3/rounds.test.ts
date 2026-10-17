import { describe, expect, it } from "vitest";
import { ENEMY_HP, MAX_HP, RULES_V2 as R, STAGE_ENEMIES } from "../v2/data";
import { isAlive, resolveGoliath } from "../v2/engine";
import { CARD_RARITY } from "@/components/cards/rarity";
import { campaignStage, stageBgm, stageOfBattle } from "./campaign";
import { createBoard, nextRoundBoard } from "./engine";
import { useProgressStore } from "./progress";
import { useBattleV3Store } from "./store";

const PARTY = ["daniel", "esther", "nehemiah"] as const;

describe("the lions' den in two rounds", () => {
  it("has the plot round first, then three lions", () => {
    expect(STAGE_ENEMIES.plot.sort()).toEqual(["presidents", "princes"]);
    expect(STAGE_ENEMIES.lions.sort()).toEqual(["lion", "lionRest", "lioness"]);
    const stage = campaignStage("lions");
    expect(stage.before).toBe("plot");
    expect(stage.battle).toBe("lions");
    expect(stageOfBattle("plot")).toBe(stage);
    expect(stageBgm("plot")).toBe(stageBgm("lions"));
  });

  it("the second round keeps each ally's HP, a fallen ally stays down, and the deck carries on", () => {
    const first = createBoard([...PARTY], undefined, () => 0.5, "plot", "table");
    first.battle.party.daniel.hp = 90;
    first.battle.party.esther.hp = 0;
    first.battle.party.daniel.shield = 30;
    const second = nextRoundBoard(first, "lions", () => 0.5);
    expect(second.battle.stage).toBe("lions");
    expect(second.battle.party.daniel.hp).toBe(90);
    expect(second.battle.party.daniel.shield).toBe(0);
    expect(isAlive(second.battle, "esther")).toBe(false);
    expect(isAlive(second.battle, "nehemiah")).toBe(true);
    expect(second.battle.deck).toBe(first.battle.deck);
    expect(second.battle.pools).toBe("table");
    expect(second.battle.turn).toBe(1);
    expect(Object.entries(second.battle.enemies).filter(([, e]) => e.hp > 0).map(([id]) => id).sort()).toEqual(["lion", "lionRest", "lioness"]);
  });

  it("the formation carries over to the second round, the fallen in their places", () => {
    const first = createBoard([...PARTY], undefined, () => 0.5, "plot", "table");
    first.battle.party.daniel.hp = 0;
    const second = nextRoundBoard(first, "lions", () => 0.5);
    expect(second.slots).toEqual(first.slots);
    expect(isAlive(second.battle, "daniel")).toBe(false);
  });

  it("winning round 1 only opens round 2; clearing the stage takes both", () => {
    const store = useBattleV3Store.getState();
    store.enter("lions");
    store.start([...PARTY], [], "lions", "table");
    expect(useBattleV3Store.getState().board!.battle.stage).toBe("plot");

    // Round 1: the accusers fall.
    const round1 = useBattleV3Store.getState().board!;
    round1.battle.enemies.princes.hp = 0;
    round1.battle.enemies.presidents.hp = 1;
    useBattleV3Store.getState().basic("daniel", "presidents");
    let now = useBattleV3Store.getState();
    expect(now.board!.battle.result).toBe("victory");
    expect(now.interlude).toBe("lions");
    expect(useProgressStore.getState().cleared.lions).toBeUndefined();
    expect(now.drop).toBeNull();

    // Round 2 starts from the interlude.
    now.nextRound();
    now = useBattleV3Store.getState();
    expect(now.interlude).toBeNull();
    expect(now.board!.battle.stage).toBe("lions");
    expect(now.board!.battle.result).toBe("ongoing");

    // Round 2: the lions fall, and now the stage is cleared.
    const round2 = now.board!;
    round2.battle.enemies.lionRest.hp = 0;
    round2.battle.enemies.lioness.hp = 0;
    round2.battle.enemies.lion.hp = 1;
    now.basic("daniel", "lion");
    now = useBattleV3Store.getState();
    expect(now.board!.battle.result).toBe("victory");
    expect(now.interlude).toBeNull();
    expect(useProgressStore.getState().cleared.lions).toBe(1);
    expect(now.drop).not.toBeNull();
  });

  it("playing again after round 2 starts over from round 1", () => {
    const store = useBattleV3Store.getState();
    store.enter("lions");
    store.start([...PARTY], [], "lions", "table");
    useBattleV3Store.getState().restart();
    expect(useBattleV3Store.getState().board!.battle.stage).toBe("plot");
  });

  it("Eden opens with the cunning serpent, then the serpent that was cursed; the two cards differ in tier", () => {
    expect(STAGE_ENEMIES.tempter).toEqual(["serpentTempter"]);
    expect(STAGE_ENEMIES.eden).toEqual(["serpent"]);
    const stage = campaignStage("eden");
    expect(stage.before).toBe("tempter");
    expect(stageOfBattle("tempter")).toBe(stage);
    expect(CARD_RARITY.serpentTempter).toBe("SR");
    expect(CARD_RARITY.serpent).toBe("SSR");
    expect(CARD_RARITY.serpentP).not.toBe(CARD_RARITY.serpent);
    const store = useBattleV3Store.getState();
    store.enter("eden");
    store.start(["adam", "eve", "cain"], [], "eden", "table");
    expect(useBattleV3Store.getState().board!.battle.stage).toBe("tempter");
    // Eve's seed bruises the serpent's head in both rounds
    const first = useBattleV3Store.getState().board!;
    first.battle.enemies.serpentTempter.hp = 1;
    useBattleV3Store.getState().basic("adam", "serpentTempter");
    expect(useBattleV3Store.getState().interlude).toBe("eden");
    useBattleV3Store.getState().nextRound();
    expect(useBattleV3Store.getState().board!.battle.stage).toBe("eden");
  });

  it("the wilderness: a tempter who looks like a man, then Satan shown for what he is, the strongest of the three", () => {
    expect(STAGE_ENEMIES.disguise).toEqual(["satanMan"]);
    expect(STAGE_ENEMIES.temptation).toEqual(["satanFoe"]);
    const stage = campaignStage("temptation");
    expect(stage.before).toBe("disguise");
    expect(stage.drops).toEqual(["satanDisguised", "satan"]);
    expect(stageOfBattle("disguise")).toBe(stage);
    expect(CARD_RARITY.satanMan).toBe("SSR");
    expect(CARD_RARITY.satanFoe).toBe("UR");
    expect(MAX_HP.satanDisguised).toBeGreaterThanOrEqual(250);
    // Disguised < Satan (wings half seen) < Satan in his true form.
    expect(MAX_HP.satan).toBeGreaterThan(MAX_HP.satanDisguised);
    expect(ENEMY_HP.satanFoe).toBeGreaterThan(MAX_HP.satan);
    const store = useBattleV3Store.getState();
    store.enter("temptation");
    store.start(["peter", "johnApostle", "holySpirit"], [], "temptation", "table");
    expect(useBattleV3Store.getState().board!.battle.stage).toBe("disguise");
    useBattleV3Store.getState().board!.battle.enemies.satanMan.hp = 1;
    useBattleV3Store.getState().basic("peter", "satanMan");
    expect(useBattleV3Store.getState().interlude).toBe("temptation");
    useBattleV3Store.getState().nextRound();
    expect(useBattleV3Store.getState().board!.battle.stage).toBe("temptation");
  });

  it("Satan summons his guard, then his shooter, to the front line; with both standing the host closes ranks and he heals", () => {
    expect(STAGE_ENEMIES.temptation).toEqual(["satanFoe"]);
    const first = createBoard(["peter", "johnApostle", "holySpirit"], undefined, () => 0.5, "temptation", "table");
    const b = first.battle;
    expect(b.enemies.roaringLion.hp).toBe(0);
    expect(b.enemies.fieryDarts.hp).toBe(0);
    expect(b.intents[0].action).toBe("summon");
    const summon = () => {
      b.intents[0] = { action: "summon", targets: [] };
      return resolveGoliath(b, () => 0.5);
    };
    const one = summon();
    expect([one.enemies.roaringLion.hp, one.enemies.fieryDarts.hp]).toEqual([ENEMY_HP.roaringLion, 0]);
    one.intents[0] = { action: "summon", targets: [] };
    const two = resolveGoliath(one, () => 0.5);
    expect([two.enemies.roaringLion.hp, two.enemies.fieryDarts.hp]).toEqual([ENEMY_HP.roaringLion, ENEMY_HP.fieryDarts]);
    two.enemies.satanFoe.hp = 100;
    two.intents[0] = { action: "summon", targets: [] };
    const three = resolveGoliath(two, () => 0.5);
    expect(three.enemies.satanFoe.hp).toBe(100 + R.hostHeal);
  });
});
