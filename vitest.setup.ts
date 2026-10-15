import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Windows cross-drive dependency junctions can expose Next's CJS namespace as
// the default export. Preserve the actual Image component, rather than stubbing it.
vi.mock("next/image", async () => {
  const actual = await vi.importActual<typeof import("next/image")>("next/image");
  const candidate = actual.default as typeof actual.default & { default?: typeof actual.default };
  return { ...actual, default: candidate.default ?? candidate };
});

if (typeof window !== "undefined")
  Object.defineProperty(window, "scrollTo", { configurable: true, value: () => undefined });
