/** Audit mode is explicit and opt-in. A normal deployment never loads any
 * audit fixture or persona state. */
export const runtime = "nodejs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertAuditRuntimeSafe } = await import("@/audit/runtime");
    await assertAuditRuntimeSafe(process.env, { verifyFixtureHash: true });
  }
}
