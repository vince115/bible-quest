import { defineConfig } from "vitest/config";

// Generates draft card art with an image API (see scripts/generate-art.art.ts). Kept apart from the normal tests so
// `pnpm test` never calls an API or writes files: run it with `pnpm art`.
export default defineConfig({
  resolve: { alias: { "@": process.cwd() } },
  test: { include: ["scripts/*.art.ts"], testTimeout: 30 * 60_000 },
});
