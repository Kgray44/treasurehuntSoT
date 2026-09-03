import { assertAuditRuntimeSafe } from "@/audit/runtime";

/** Audit mode is explicit and opt-in. A normal deployment never loads any
 * audit fixture or persona state. */
export const runtime = "nodejs";

export async function register() {
  await assertAuditRuntimeSafe(process.env, { verifyFixtureHash: true });
}
