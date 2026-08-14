import { handleBridgewatchGateway } from "@/admiralty/bridgewatch-gateway";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path?: string[] }> };

export async function GET(request: Request, context: Context) {
  return handleBridgewatchGateway(request, (await context.params).path ?? []);
}

export async function HEAD(request: Request, context: Context) {
  return handleBridgewatchGateway(request, (await context.params).path ?? []);
}
