import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/private-content/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    maxWorkers: 4,
    // Network-hosted worktrees can time out while spawning several child
    // processes. Validation may opt into one fork without weakening tests.
    ...(process.env.SEALED_HOLD_SINGLE_FORK === "1" ? { pool: "forks" as const, poolOptions: { forks: { singleFork: true } }, maxWorkers: 1 } : {}),
    coverage: { reporter: ["text", "html"], include: ["src/domain/**", "src/server/**"] },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
