import { defineConfig } from "vitest/config";

// The auto-battle tests play out a battle for every card, so they grow with the roster:
// give them room beyond the 5 s default when the whole suite runs in parallel.
export default defineConfig({
  // The same "@/..." import paths as tsconfig.json (tests run from the project root).
  resolve: { alias: { "@": process.cwd() } },
  test: { testTimeout: 30_000 },
});
