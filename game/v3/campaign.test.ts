import { describe, expect, it } from "vitest";
import { TIMELINE_ERAS } from "@/components/cards/timeline";
import { STAGE_BOSS } from "../v2/data";
import { CAMPAIGN, CAMPAIGN_IDS, dropFor, isPlayable, isUnlocked, nextStage } from "./campaign";
import { useProgressStore } from "./progress";

const eraOf = (id: string) => TIMELINE_ERAS.find((e) => (e.cards as string[]).includes(id))?.era;

describe("the campaign", () => {
  it("starts in Eden and lists each stage once", () => {
    expect(CAMPAIGN_IDS[0]).toBe("eden");
    expect(new Set(CAMPAIGN_IDS).size).toBe(CAMPAIGN.length);
  });

  it("lends only cards from the stage's own period, enough to pick from, and drops from the same cards", () => {
    for (const stage of CAMPAIGN) {
      const wrongEra = stage.pool.filter((id) => eraOf(id) !== stage.era);
      expect(wrongEra, `${stage.id}: not from ${stage.era}`).toEqual([]);
      expect(new Set(stage.pool).size, `${stage.id}: pool repeats a card`).toBe(stage.pool.length);
      expect(stage.pool.length, `${stage.id}: too few to pick ${stage.pick}`).toBeGreaterThanOrEqual(stage.pick);
      expect((stage.drops ?? stage.pool).filter((id) => !stage.pool.includes(id)), `${stage.id}: drops outside the pool`).toEqual([]);
      if (stage.battle) expect(STAGE_BOSS[stage.battle]).toBeDefined();
    }
  });

  it("unlocks a stage once the built stages before it are cleared, skipping stages still being built", () => {
    expect(isUnlocked("eden", {})).toBe(true);
    expect(isUnlocked("goliath", {})).toBe(false);
    expect(isUnlocked("goliath", { eden: 1 })).toBe(true); // the ark, the Red Sea and Jericho are not built yet
    expect(isPlayable("ark", { eden: 1 })).toBe(false); // unlocked, but not built
    expect(nextStage("eden")).toBe("goliath");
    expect(nextStage("gerasa")).toBeNull();
  });

  it("drops one of the stage's cards", () => {
    expect(dropFor("eden", () => 0)).toBe("adam");
    expect(dropFor("eden", () => 0.999)).toBe("noah");
    expect(dropFor("eden", () => 1)).toBe("noah");
  });
});

describe("campaign progress", () => {
  it("counts clears and collects drops, duplicates included", () => {
    const st = useProgressStore.getState();
    expect(st.clear("eden", () => 0)).toBe("adam");
    expect(st.clear("eden", () => 0)).toBe("adam");
    expect(st.clear("eden", () => 0.5)).toBe("abel");
    const after = useProgressStore.getState();
    expect(after.cleared.eden).toBe(3);
    expect([after.collection.adam, after.collection.abel, after.collection.eve]).toEqual([2, 1, undefined]);
    expect(after.history.map((d) => d.card)).toEqual(["adam", "adam", "abel"]);
    expect(isPlayable("goliath", after.cleared)).toBe(true);
  });
});
