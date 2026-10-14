import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (base?: string) => {
  vi.resetModules();
  if (base === undefined) vi.unstubAllEnvs();
  else vi.stubEnv("NEXT_PUBLIC_ASSET_BASE", base);
  return (await import("./assets")).asset;
};

describe("asset", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("serves everything from /public when no base is set", async () => {
    const asset = await load();
    expect(asset("/cards/adam.jpg")).toBe("/cards/adam.jpg");
    expect(asset("/audio/bgm/eden.mp3")).toBe("/audio/bgm/eden.mp3");
  });

  it("moves card art, stage art and music to the base, but keeps the small UI pieces local", async () => {
    const asset = await load("https://example.r2.dev/");
    expect(asset("/cards/adam.jpg")).toBe("https://example.r2.dev/cards/adam.jpg");
    expect(asset("/cards/scripture/trains.jpg")).toBe("https://example.r2.dev/cards/scripture/trains.jpg");
    expect(asset("/stages/eden.jpg")).toBe("https://example.r2.dev/stages/eden.jpg");
    expect(asset("/audio/bgm/eden.mp3")).toBe("https://example.r2.dev/audio/bgm/eden.mp3");
    expect(asset("/cards/frame-ur.png")).toBe("/cards/frame-ur.png");
    expect(asset("/cards/scripture-gilt-frame.png")).toBe("/cards/scripture-gilt-frame.png");
    expect(asset("/elements/fire.webp")).toBe("/elements/fire.webp");
  });
});
