import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pilotEnvironmentEnabled } from "@/spatial-pilot/authorization";
import { requireWayfarerAccount } from "@/wayfarer/http";

export const dynamic = "force-dynamic";
const assets = {
  "tinyvio-slam.js": {
    type: "text/javascript",
    sha256: "aede7070219b40ebd13d07be6b79d6be38d57a88b39bc8ac6b919c61cefc2a40",
  },
  "tinyvio-slam.wasm": {
    type: "application/wasm",
    sha256: "78f1942ec1048fc19f93c2b9edd7b1b52d067a9d0a76b7ec1ef34777298729c3",
  },
} as const;
/** Owner authorized a local prototype only. Assets are never checked in or served by a normal release. */
export async function GET(request: Request, context: { params: Promise<{ asset: string }> }) {
  if (process.env.PARALLAX_LOCAL_TRACKER_PROTOTYPE !== "1" || !pilotEnvironmentEnabled())
    return new Response(null, { status: 404 });
  if (!(await requireWayfarerAccount())) return new Response(null, { status: 401 });
  const { asset } = await context.params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (asset === "availability")
    return Response.json(
      { localPrototype: true, productionCleared: false, method: "VISUAL_INERTIAL_SLAM", metricScaleVerified: false },
      { headers },
    );
  if (!Object.hasOwn(assets, asset)) return new Response(null, { status: 404 });
  const spec = assets[asset as keyof typeof assets];
  try {
    const binary = await readFile(resolve("tmp/browser-ar-local-assets", asset));
    if (createHash("sha256").update(binary).digest("hex") !== spec.sha256) return new Response(null, { status: 503 });
    return new Response(binary, { headers: { ...headers, "Content-Type": spec.type } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
