import { defineConfig } from "vitest/config";

// Builds the printable paper prototype (see scripts/paper-prototype.paper.ts). Kept apart from the normal tests so
// `pnpm test` never rewrites files: run it with `pnpm paper` (STAGE=goliath by default).
export default defineConfig({
  resolve: { alias: { "@": process.cwd() } },
  test: { include: ["scripts/*.paper.ts"], testTimeout: 60_000 },
});
