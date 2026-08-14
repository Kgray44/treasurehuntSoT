import { bridgewatchAccessAllowed } from "@/admiralty/bridgewatch-gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  const allowed = await bridgewatchAccessAllowed();
  return new Response(null, {
    status: allowed ? 204 : 401,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
