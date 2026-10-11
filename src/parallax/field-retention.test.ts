import { afterEach, expect, it, vi } from "vitest";
const purge = vi.hoisted(() => vi.fn());
vi.mock("./field-service", () => ({ purgeExpiredFieldEvidence: purge }));
import { startParallaxFieldRetention, fieldRetentionIntervalMs } from "./field-retention";
afterEach(() => {
  const state = globalThis as typeof globalThis & { parallaxFieldRetentionTimer?: ReturnType<typeof setInterval> };
  clearInterval(state.parallaxFieldRetentionTimer);
  delete state.parallaxFieldRetentionTimer;
  vi.useRealTimers();
  purge.mockReset();
});
it("purges at server startup and hourly without creating duplicate workers", async () => {
  vi.useFakeTimers();
  await startParallaxFieldRetention();
  await startParallaxFieldRetention();
  expect(purge).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(fieldRetentionIntervalMs);
  expect(purge).toHaveBeenCalledTimes(2);
});
it("retries cleanup failures without disclosing database or private content", async () => {
  vi.useFakeTimers();
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  purge.mockRejectedValueOnce(new Error("private database context"));
  await startParallaxFieldRetention();
  expect(warning).toHaveBeenCalledWith("PARALLAX_FIELD_RETENTION_RETRY_REQUIRED");
  await vi.advanceTimersByTimeAsync(fieldRetentionIntervalMs);
  expect(purge).toHaveBeenCalledTimes(2);
  warning.mockRestore();
});
