import { describe, expect, it } from "vitest";
import { SAME_PERSON, samePersonAs, stackOf } from "./samePerson";
import { TIMELINE } from "./timeline";

describe("same person on several cards", () => {
  it("names only cards that exist, each in one group", () => {
    const all = SAME_PERSON.flatMap((g) => g.cards);
    expect(all.filter((id) => !(TIMELINE as string[]).includes(id)), "not a card").toEqual([]);
    expect(all.filter((id, i) => all.indexOf(id) !== i), "in two groups").toEqual([]);
  });

  it("stacks the same person's cards together, the serpent apart from Satan", () => {
    expect(stackOf("moses")).toBe(stackOf("mosesSinai"));
    expect(stackOf("satan")).toBe(stackOf("satanFoe"));
    expect(stackOf("serpent")).toBe(stackOf("serpentP"));
    expect(stackOf("serpent")).not.toBe(stackOf("satan"));
    expect(stackOf("david")).toBeUndefined();
  });

  it("links each card to the others, with the verse when the link is by Scripture", () => {
    expect(samePersonAs("moses")).toEqual([{ card: "mosesSinai", via: undefined }]);
    expect(samePersonAs("david")).toEqual([]);
    expect(samePersonAs("serpent").find((o) => o.card === "satan")?.via).toBe("v3.demo.viaRev12");
    expect(samePersonAs("satan").find((o) => o.card === "serpent")?.via).toBe("v3.demo.viaRev12");
    expect(samePersonAs("satan").find((o) => o.card === "satanFoe")?.via).toBeUndefined();
    expect(samePersonAs("serpent").find((o) => o.card === "serpentP")?.via).toBeUndefined();
  });
});
