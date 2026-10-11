import { purgeExpiredFieldEvidence } from "./field-service";

const state = globalThis as typeof globalThis & { parallaxFieldRetentionTimer?: ReturnType<typeof setInterval> };
export const fieldRetentionIntervalMs = 60 * 60 * 1000;
/** Normal Node server lifecycle only. Expired metadata is never served; cleanup also runs without traffic. */
export async function startParallaxFieldRetention() {
  if (state.parallaxFieldRetentionTimer) return;
  const purge = async () => {
    try {
      await purgeExpiredFieldEvidence();
    } catch {
      console.warn("PARALLAX_FIELD_RETENTION_RETRY_REQUIRED");
    }
  };
  state.parallaxFieldRetentionTimer = setInterval(() => {
    void purge();
  }, fieldRetentionIntervalMs);
  state.parallaxFieldRetentionTimer.unref?.();
  await purge();
}
