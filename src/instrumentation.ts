/** Audit mode is explicit and opt-in. A normal deployment never loads any
 * audit fixture or persona state. */
export const runtime = "nodejs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertAuditRuntimeSafe } = await import("@/audit/runtime");
    await assertAuditRuntimeSafe(process.env, { verifyFixtureHash: true });
    const { auditModeEnabled } = await import("@/audit/host");
    if (process.env.NEXT_PHASE !== "phase-production-build" && !auditModeEnabled(process.env)) {
      const { startParallaxFieldRetention } = await import("@/parallax/field-retention");
      await startParallaxFieldRetention();
    }
  }
}
