import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { AdmiraltyError } from "@/admiralty/errors";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit } from "@/admiralty/http";
import {
  aiEconomicsOverview,
  aiEconomicsHistory,
  aiEconomicsOperation,
  defaultEconomicsFilter,
} from "@/parallax/ai-economics";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const optionalId = z.string().trim().min(1).max(191).optional();
const querySchema = z.strictObject({
  section: z.enum(["overview", "history", "operation"]).default("overview"),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  capabilityId: optionalId,
  accountId: optionalId,
  model: optionalId,
  provider: optionalId,
  outcome: optionalId,
  costBasis: optionalId,
  applicationVersion: optionalId,
  cursor: optionalId,
  search: z.string().trim().min(1).max(128).optional(),
  id: optionalId,
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export async function GET(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OBSERVE");
    if (!operator.roles.includes("ADMINISTRATOR"))
      throw new AdmiraltyError(
        "ADMIRALTY_CAPABILITY_DENIED",
        "Administrator authority is required for AI economics.",
        403,
      );
    await requireAdmiraltyOperator("ACCOUNT_OBSERVE");
    enforceAdmiraltyRateLimit(`ai-economics:${operator.accountId}`, 60, 300000);
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (query.section === "operation") {
      if (!query.id) return NextResponse.json({ error: "Choose an operation." }, { status: 400, headers });
      const operation = await aiEconomicsOperation(query.id);
      return NextResponse.json({ operation }, { status: operation ? 200 : 404, headers });
    }
    const defaults = defaultEconomicsFilter();
    const filter = {
      ...query,
      from: query.from ? new Date(query.from) : defaults.from,
      to: query.to ? new Date(query.to) : defaults.to,
    };
    if (filter.to <= filter.from || filter.to.getTime() - filter.from.getTime() > 366 * 86400000)
      return NextResponse.json(
        { error: "Choose an increasing UTC range of up to 366 days." },
        { status: 400, headers },
      );
    return NextResponse.json(
      query.section === "history" ? await aiEconomicsHistory(filter, query) : await aiEconomicsOverview(filter),
      { headers },
    );
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
