import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";

const pkg = "com.voyagewright.landfall.lab";
const component = `${pkg}/.LandfallLocationLabService`;
const receiptSchema = z
  .object({
    sessionId: z.string().uuid(),
    phase: z.enum(["OUTSIDE_BASELINE", "INSIDE_TRANSITION", "STOP"]),
    state: z.enum(["DELIVERED", "MOCK_MODE_FAILED", "LOCATION_FAILED", "STOPPED", "STOP_FAILED"]),
    delivered: z.number().int().min(0).max(100),
    mocking: z.boolean(),
    synthetic: z.literal(true),
    canComplete: z.literal(false),
  })
  .strict();

/** Only the exclusively owned ephemeral hosted guest. The separate debug lab APK
 * feeds documented FLP mock input; Play services owns geofence event delivery. */
export async function startOwnedAndroidFusedInput(
  adb: (args: string[], timeout?: number) => Promise<string>,
  root: string,
) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted")
    throw new Error("HOSTED_EPHEMERAL_FUSED_INPUT_REQUIRED");
  if (!["ranchu", "goldfish"].includes((await adb(["shell", "getprop", "ro.hardware"])).trim()))
    throw new Error("FUSED_INPUT_EMULATOR_REQUIRED");
  const sessionId = randomUUID();
  await adb([
    "install",
    "-r",
    path.join(root, "native/android/location-lab/build/outputs/apk/debug/locationLab-debug.apk"),
  ]);
  for (const permission of ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"])
    await adb(["shell", "pm", "grant", pkg, `android.permission.${permission}`]);
  await adb(["shell", "appops", "set", pkg, "android:mock_location", "allow"]);
  const read = async () => {
    const raw = await adb(["shell", "run-as", pkg, "cat", "files/landfall-location-lab.json"]);
    if (raw.length > 1024) throw new Error("FUSED_INPUT_RECEIPT_TOO_LARGE");
    const receipt = receiptSchema.parse(JSON.parse(raw));
    if (receipt.sessionId !== sessionId) throw new Error("FUSED_INPUT_RECEIPT_FOREIGN");
    return receipt;
  };
  const phase = async (requested: "OUTSIDE_BASELINE" | "INSIDE_TRANSITION" | "STOP") => {
    await adb([
      "shell",
      "am",
      "start-foreground-service",
      "-n",
      component,
      "--es",
      "labSession",
      sessionId,
      "--es",
      "labPhase",
      requested,
    ]);
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      let receipt;
      try {
        receipt = await read();
      } catch {
        /* No delivery is inferred from a missing record. */
      }
      if (receipt?.phase === requested) {
        if (requested === "STOP" && receipt.state === "STOPPED" && !receipt.mocking) return receipt;
        if (requested !== "STOP" && receipt.state === "DELIVERED" && receipt.delivered > 0 && receipt.mocking)
          return receipt;
        throw new Error(`FUSED_INPUT_${receipt.state}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("FUSED_INPUT_STATE_UNOBSERVED");
  };
  return {
    phase,
    read,
    async cleanup() {
      await phase("STOP");
      await adb(["shell", "appops", "set", pkg, "android:mock_location", "default"]);
      await adb(["shell", "am", "force-stop", pkg]);
      if (!(await adb(["shell", "pm", "clear", pkg])).includes("Success")) throw new Error("FUSED_INPUT_CLEAR_FAILED");
    },
  };
}
