import { pilotEnvironmentEnabled, requirePilotOwner } from "@/spatial-pilot/authorization";
import { readEighthwallAsset } from "@/parallax/eighthwall-local-assets";
import { canonicalPublicAppOrigin } from "@/homeport/public-app-origin";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ asset: string }> }) {
  if (
    process.env.PARALLAX_LOCAL_TRACKER_PROTOTYPE !== "1" ||
    process.env.PARALLAX_LOCAL_TRACKER_ENGINE !== "EIGHTHWALL" ||
    !pilotEnvironmentEnabled()
  )
    return new Response(null, { status: 404 });
  if (!(await requirePilotOwner())) return new Response(null, { status: 404 });
  const { asset } = await context.params;
  let origin: string;
  try {
    origin = canonicalPublicAppOrigin().origin;
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  const file = await readEighthwallAsset(`resources/${asset}`, origin);
  if (!file) return new Response(null, { status: 404 });
  return new Response(file.bytes, {
    headers: { "Content-Type": file.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
