import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { include: ["src/**/*.test.{ts,tsx}"], environment: "jsdom", setupFiles: ["./vitest.setup.ts"], coverage: { reporter: ["text", "html"], include: ["src/domain/**", "src/server/**"] } }, resolve: { alias: { "@": path.resolve(__dirname, "src") } } });
