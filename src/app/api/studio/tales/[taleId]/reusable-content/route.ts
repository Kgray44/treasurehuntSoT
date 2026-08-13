import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import type { DraftState } from "@/components/studio/studio-types";
import {
  archiveReusableAuthoringItem,
  createBlockFragment,
  createBlockPreset,
  createChapterTemplate,
  createReusableAuthoringItem,
  getReusableAuthoringItemVersion,
  listReusableAuthoringItems,
  planReusableAuthoringInsertion,
} from "@/studio/reusable-library-service";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), envelope: z.unknown() }),
  z.object({
    action: z.literal("create-preset"),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(10000).optional(),
    tags: z.array(z.string().max(64)).max(30).optional(),
    blockId: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal("plan-insert"),
    itemId: z.string().min(8).max(128),
    operationId: z.string().min(8).max(128),
    targetChapterId: z.string().min(8).max(128).optional(),
    draft: z.unknown(),
  }),
  z.object({
    action: z.literal("create-fragment"),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(10000).optional(),
    tags: z.array(z.string().max(64)).max(30).optional(),
    blockIds: z.array(z.string().min(1).max(128)).min(2).max(1000),
  }),
  z.object({
    action: z.literal("create-chapter-template"),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(10000).optional(),
    tags: z.array(z.string().max(64)).max(30).optional(),
    chapterId: z.string().min(1).max(128),
  }),
  z.object({ action: z.literal("archive"), itemId: z.string().min(8).max(128) }),
]);

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const itemId = new URL(request.url).searchParams.get("itemId");
    if (itemId)
      return NextResponse.json(await getReusableAuthoringItemVersion(authorization.session.accountId, itemId));
    return NextResponse.json({ items: await listReusableAuthoringItems(authorization.session.accountId) });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const input = requestSchema.parse(await request.json());
    if (input.action === "create")
      return NextResponse.json(await createReusableAuthoringItem(authorization.session.accountId, input.envelope), {
        status: 201,
      });
    if (input.action === "create-preset")
      return NextResponse.json(await createBlockPreset(authorization.session.accountId, taleId, input), {
        status: 201,
      });
    if (input.action === "create-fragment")
      return NextResponse.json(await createBlockFragment(authorization.session.accountId, taleId, input), {
        status: 201,
      });
    if (input.action === "create-chapter-template")
      return NextResponse.json(await createChapterTemplate(authorization.session.accountId, taleId, input), {
        status: 201,
      });
    if (input.action === "plan-insert")
      return NextResponse.json(
        await planReusableAuthoringInsertion({
          ownerAccountId: authorization.session.accountId,
          taleId,
          itemId: input.itemId,
          operationId: input.operationId,
          targetChapterId: input.targetChapterId,
          draft: input.draft as DraftState,
        }),
      );
    return NextResponse.json(await archiveReusableAuthoringItem(authorization.session.accountId, input.itemId));
  } catch (cause) {
    return apiError(cause);
  }
}
