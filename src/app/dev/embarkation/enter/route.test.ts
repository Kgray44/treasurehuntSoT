import { afterEach, describe, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  readFile: read,
}));
import { GET } from "./route";
describe("Embarkation screening isolation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  it("never opens a fixture session in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMBARKATION_PREVIEW", "1");
    const response = await GET(new Request("http://localhost/dev/embarkation/enter?role=captain"));
    expect(response.status).toBe(404);
    expect(read).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("requires both the preview switch and this worktree's exact synthetic database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMBARKATION_PREVIEW", "1");
    vi.stubEnv("DATABASE_URL", "file:/different/shared.sqlite");
    expect((await GET(new Request("http://localhost/dev/embarkation/enter"))).status).toBe(404);
    expect(read).not.toHaveBeenCalled();
  });
});
