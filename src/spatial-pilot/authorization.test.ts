// @sounding-line-registration owner=spatial-pilot suite=unit.spatial-pilot contracts=spatial-pilot.experience
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ account: vi.fn() }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.account }));
import { pilotEnvironmentEnabled, requirePilotOwner } from "./authorization";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("fails closed outside an explicitly owned synthetic database and exact account", async () => {
  vi.stubEnv("DATABASE_URL", "file:C:/shared/real.db");
  vi.stubEnv("SPATIAL_PILOT_ENABLED", "1");
  vi.stubEnv("SPATIAL_PILOT_OWNER_ID", "spatial-pilot-navigator");
  expect(pilotEnvironmentEnabled()).toBe(false);
  expect(await requirePilotOwner()).toBeNull();
  expect(mocks.account).not.toHaveBeenCalled();
  vi.stubEnv("DATABASE_URL", "file:C:/workspace/artifacts/spatial-pilot/owned.db");
  mocks.account.mockResolvedValue({ accountId: "another-account" });
  expect(await requirePilotOwner()).toBeNull();
  mocks.account.mockResolvedValue({ accountId: "spatial-pilot-navigator" });
  expect(await requirePilotOwner()).toEqual({ accountId: "spatial-pilot-navigator" });
});
it("qualifies only through the existing nonce-bound generic fixture runtime", () => {
  vi.stubEnv("SPATIAL_PILOT_ENABLED", "0");
  vi.stubEnv("SOUNDING_LINE_SUITE_PROFILE", "generic");
  vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "1");
  vi.stubEnv("SOUNDING_LINE_TASK_OWNED_HTTP", "1");
  vi.stubEnv(
    "DATABASE_URL",
    `file:C:/workspace/artifacts/sounding-line/generic-${"a".repeat(12)}/validation-isolated-19700101-000000000-${"a".repeat(32)}.db`,
  );
  vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", "a".repeat(64));
  expect(pilotEnvironmentEnabled()).toBe(true);
  vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", "");
  expect(pilotEnvironmentEnabled()).toBe(false);
});
