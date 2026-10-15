import { pilotEnvironmentEnabled, requirePilotOwner } from "@/spatial-pilot/authorization";
import { readEighthwallAsset } from "@/parallax/eighthwall-local-assets";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ asset: string }> }) {
  if (
    process.env.PARALLAX_LOCAL_TRACKER_PROTOTYPE !== "1" ||
    process.env.PARALLAX_LOCAL_TRACKER_ENGINE !== "EIGHTHWALL" ||
    !pilotEnvironmentEnabled()
  )
    return new Response(null, { status: 404 });
  if (!(await requirePilotOwner())) return new Response(null, { status: 404 });
  const { asset } = await context.params;
  const file = await readEighthwallAsset(`resources/${asset}`, new URL(request.url).origin);
  if (!file) return new Response(null, { status: 404 });
  return new Response(file.bytes, {
    headers: { "Content-Type": file.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
