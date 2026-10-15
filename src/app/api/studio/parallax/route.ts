import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioWorkspace, requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { apiError } from "@/chronicle/api";
import { consumeRateLimit } from "@/lib/rate-limit";
import { draftSchema } from "@/parallax/authoring";
import { spatialId, spatialMomentSchema } from "@/parallax/contracts";
import {
  saveSpatialDraft,
  listSpatialItems,
  releaseSpatialVersion,
  attachSpatialVersion,
  restoreSpatialAttachment,
  assertSpatialDraftAccess,
  saveReusableAsset,
  reuseSpatialAsset,
  reuseInstalledSpatialComposition,
  archiveSpatialItem,
  updateEnvironmentLibraryEntry,
} from "@/parallax/library-service";
import {
  validateSpatialAuthoring,
  simulationEnvironments,
  simulateSpatialEnvironments,
  spatialPerformanceEstimate,
} from "@/parallax/studio-validation";
import { requestSpatialAI } from "@/parallax/ai-authoring";
import { assistantRequestSchema, requestSpatialAssistant } from "@/parallax/spatial-assistant-service";
import { assistantApplicationSchema, applySpatialAssistant } from "@/parallax/spatial-assistant-application";
import { creatorAIUsage, readAIPolicy } from "@/parallax/ai-ledger";
import { openAIProviderConfiguration } from "@/parallax/openai-provider";
import { SpatialAssistantError } from "@/parallax/spatial-assistant";
import { DraftConflictError } from "@/chronicle/studio-service";
import { creatorFieldQuality, reviewCalibration } from "@/parallax/field-service";
import { calibrationReviewInputSchema } from "@/parallax/field-contracts";
import { environmentDraftSchema, spatialLibraryTypes } from "@/parallax/library-lifecycle-contracts";
import { environmentReferenceSchema } from "@/parallax/environment-reference";
import { listCompatibleEnvironments } from "@/parallax/environment-library-compatibility";
import { compareScenes } from "@/parallax/scene-comparison";
import { spatialLibraryKind } from "@/parallax/reusable-assets";
import { legacyEnvironmentWorkingSchema } from "@/parallax/legacy-environment-working-contracts";
import {
  compactCatalogQuerySchema,
  readCompactSpatialCatalogPage,
  readExactSpatialCatalogItem,
  UnsupportedSpatialCatalogFilter,
} from "@/parallax/spatial-catalog-read-projection";
import {
  legacyEnvironmentBeginSchema,
  legacyEnvironmentCopySchema,
  legacyEnvironmentReleaseSchema,
  beginLegacyEnvironmentEdit,
  copyLegacyEnvironment,
  saveLegacyEnvironmentWorking,
  releaseLegacyEnvironmentVersion,
  saveLegacyEnvironmentToLibrary,
  archiveLegacyEnvironment,
} from "@/parallax/legacy-environment-service";
import {
  spatialLibraryInventory,
  saveEnvironmentDraft,
  saveDefinitionToLibrary,
  saveSpatialAs,
  mutateLibraryDefinition,
  restoreDefinitionVersion,
  releaseEnvironmentVersion,
  useEnvironmentDefinition as applyEnvironmentDefinition,
  reconcileLegacySpatialMembership,
} from "@/parallax/library-lifecycle-service";

const inputSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("ENVIRONMENT_CATALOG") }),
  z.strictObject({ action: z.literal("SCENE_COMPARE"), draft: draftSchema, targetDefinitionId: spatialId }),
  legacyEnvironmentBeginSchema.extend({ action: z.literal("LEGACY_ENVIRONMENT_BEGIN") }),
  legacyEnvironmentCopySchema.extend({ action: z.literal("LEGACY_ENVIRONMENT_COPY") }),
  legacyEnvironmentReleaseSchema.extend({ action: z.literal("LEGACY_ENVIRONMENT_RELEASE") }),
  z.strictObject({
    action: z.literal("LEGACY_ENVIRONMENT_SAVE"),
    document: legacyEnvironmentWorkingSchema,
    revision: z.number().int().nonnegative(),
  }),
  z.strictObject({
    action: z.literal("LEGACY_ENVIRONMENT_LIBRARY_SAVE"),
    definitionId: legacyEnvironmentBeginSchema.shape.definitionId,
    revision: z.number().int().nonnegative(),
  }),
  z.strictObject({
    action: z.literal("LEGACY_ENVIRONMENT_ARCHIVE"),
    definitionId: legacyEnvironmentBeginSchema.shape.definitionId,
    revision: z.number().int().nonnegative(),
    archived: z.boolean(),
  }),
  z.strictObject({
    action: z.literal("ENVIRONMENT_SAVE"),
    document: environmentDraftSchema,
    revision: z.number().int().nonnegative(),
  }),
  z.strictObject({
    action: z.literal("SAVE_TO_LIBRARY"),
    definitionId: spatialId,
    revision: z.number().int().positive(),
  }),
  z.strictObject({
    action: z.literal("SAVE_AS"),
    definitionId: spatialId,
    revision: z.number().int().positive(),
    newId: spatialId,
    operationId: spatialId,
    name: z.string().trim().min(1).max(120),
    destination: z.enum(["WORKING", "SAVED"]),
    type: z.enum(spatialLibraryTypes),
    versionId: environmentReferenceSchema.shape.versionId.optional(),
    retainedSnapshot: z.union([draftSchema, environmentDraftSchema]).optional(),
  }),
  z.strictObject({
    action: z.literal("LIBRARY_METADATA"),
    definitionId: spatialId,
    revision: z.number().int().positive(),
    change: z.strictObject({
      archive: z.boolean().optional(),
      name: z.string().trim().min(1).max(120).optional(),
      description: z.string().max(1000).optional(),
      tags: z.array(z.string().trim().min(1).max(60)).max(16).optional(),
      collection: z.string().max(120).optional(),
      favorite: z.boolean().optional(),
    }),
  }),
  z.strictObject({
    action: z.literal("VERSION_RESTORE"),
    definitionId: spatialId,
    revision: z.number().int().positive(),
    versionId: environmentReferenceSchema.shape.versionId,
  }),
  z.strictObject({
    action: z.literal("ENVIRONMENT_RELEASE"),
    definitionId: spatialId,
    revision: z.number().int().positive(),
    notes: z.string().max(1000).optional(),
  }),
  z.strictObject({
    action: z.literal("ENVIRONMENT_USE"),
    draft: draftSchema,
    revision: z.number().int().positive(),
    definitionId: spatialId,
    versionId: environmentReferenceSchema.shape.versionId.optional(),
  }),
  z.strictObject({ action: z.literal("RECONCILE_LIBRARY") }),
  z.strictObject({
    action: z.literal("ENVIRONMENT_RENAME"),
    definitionId: spatialId,
    revision: z.number().int().min(1),
    name: z.string().trim().min(1).max(120),
  }),
  z.strictObject({
    action: z.literal("ENVIRONMENT_ARCHIVE"),
    definitionId: spatialId,
    revision: z.number().int().min(1),
  }),
  z.strictObject({
    action: z.literal("ASSET_SAVE"),
    operation: z.strictObject({ newId: spatialId, operationId: spatialId }).optional(),
    draft: draftSchema,
    revision: z.number().int().min(1),
    rootId: spatialId,
    metadata: z.strictObject({
      name: z.string().trim().min(1).max(240),
      description: z.string().trim().max(1000),
      classification: z.string().trim().min(1).max(60),
    }),
    environmentId: z.string().trim().min(1).max(128),
  }),
  z.strictObject({
    action: z.literal("ASSET_INSERT"),
    draft: draftSchema,
    revision: z.number().int().min(1),
    definitionId: spatialId,
    versionId: spatialId,
  }),
  z.strictObject({
    action: z.literal("INSTALLED_COMPOSITION_INSERT"),
    draft: draftSchema,
    revision: z.number().int().min(1),
    definitionId: spatialId,
    versionId: spatialId,
  }),
  z.strictObject({ action: z.literal("ARCHIVE"), definitionId: spatialId, revision: z.number().int().min(1) }),
  z.strictObject({ action: z.literal("FIELD_QUALITY"), definitionId: spatialId, draft: draftSchema.optional() }),
  z.strictObject({ action: z.literal("CALIBRATION_REVIEW"), review: calibrationReviewInputSchema, draft: draftSchema }),
  z.strictObject({ action: z.literal("SAVE"), draft: draftSchema, revision: z.number().int().min(0) }),
  z.strictObject({
    action: z.literal("RELEASE"),
    definitionId: spatialId,
    revision: z.number().int().min(1),
    notes: z.string().max(1000).optional(),
  }),
  z.strictObject({ action: z.literal("VALIDATE"), draft: draftSchema }),
  z.discriminatedUnion("kind", [
    assistantRequestSchema.extend({ action: z.literal("AI"), kind: z.literal("ASSISTANT") }),
    z.strictObject({
      action: z.literal("AI"),
      draft: draftSchema,
      kind: z.enum(["INTENT", "CRITIQUE"]),
      request: z.string().trim().min(1).max(2000),
    }),
  ]),
  assistantApplicationSchema.extend({ action: z.literal("ASSISTANT_APPLY") }),
  z.strictObject({
    action: z.literal("ATTACH"),
    definitionId: spatialId,
    versionId: spatialId,
    chronicleId: spatialId,
    blockId: spatialId,
    autosaveVersion: z.number().int().min(1),
    narrative: z.string().trim().max(4000).optional(),
  }),
  z.strictObject({
    action: z.literal("RESTORE_ATTACHMENT"),
    chronicleId: spatialId,
    blockId: spatialId,
    autosaveVersion: z.number().int().min(1),
    moment: spatialMomentSchema.nullable(),
  }),
]);
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
async function assistantError(cause: unknown, accountId: string) {
  const status =
    cause instanceof SpatialAssistantError
      ? cause.status
      : cause instanceof DraftConflictError
        ? 409
        : cause instanceof z.ZodError || cause instanceof SyntaxError
          ? 400
          : 500;
  const code =
    cause instanceof SpatialAssistantError
      ? cause.code
      : cause instanceof DraftConflictError
        ? "DRAFT_CONFLICT"
        : status === 400
          ? "INVALID_REQUEST"
          : "STUDIO_REQUEST_FAILED";
  const message =
    cause instanceof SpatialAssistantError
      ? cause.message
      : status === 409
        ? "The saved scene changed. Review its current revision before applying changes."
        : status === 400
          ? "The spatial request is invalid."
          : "The Studio request could not finish. Your local work is unchanged.";
  return NextResponse.json(
    { status: "FAILED", code, message, usage: await creatorAIUsage(accountId).catch(() => undefined) },
    { status, headers },
  );
}
export async function GET(request: Request) {
  const session = await requireStudioWorkspace();
  if (!session) return NextResponse.json({ error: "Creator access required." }, { status: 401, headers });
  const searchParams = new URL(request.url).searchParams;
  const view = searchParams.get("view");
  try {
    if (view) {
      if (searchParams.has("accountId"))
        return NextResponse.json({ error: "Library query is invalid." }, { status: 400, headers });
      const rate = consumeRateLimit(`parallax.catalog.read:${session.accountId}`, { limit: 120, windowMs: 60000 });
      if (!rate.allowed)
        return NextResponse.json({ error: "Please wait before browsing again." }, { status: 429, headers });
      if (view === "library-catalog") {
        const query = compactCatalogQuerySchema.parse({
          kind: searchParams.get("kind"),
          search: searchParams.get("search") ?? undefined,
          collection: searchParams.get("collection") ?? undefined,
          origin: searchParams.get("origin") ?? undefined,
          state: searchParams.get("state") ?? undefined,
          environmentId: searchParams.get("environmentId") ?? undefined,
          sort: searchParams.get("sort") ?? undefined,
          limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
          cursor: searchParams.get("cursor") ?? undefined,
        });
        if (query.origin === "RECENTLY_USED" || query.origin === "IN_USE") throw new UnsupportedSpatialCatalogFilter();
        return NextResponse.json(await readCompactSpatialCatalogPage(session.accountId, query), { headers });
      }
      if (view === "library-item") {
        const entryId = z.string().min(1).max(200).parse(searchParams.get("entryId"));
        const item = await readExactSpatialCatalogItem(session.accountId, entryId);
        return item
          ? NextResponse.json(item, { headers })
          : NextResponse.json({ error: "Library item unavailable." }, { status: 404, headers });
      }
      return NextResponse.json({ error: "Library view unavailable." }, { status: 400, headers });
    }
    const chronicleId = searchParams.get("chronicle");
    let chronicle = null;
    if (chronicleId) {
      if (!(await requireOwnedStudioTale(chronicleId)))
        return NextResponse.json({ error: "Chronicle unavailable." }, { status: 404, headers });
      const source = await getStudioTale(chronicleId);
      chronicle = {
        id: chronicleId,
        title: source.tale.title,
        autosaveVersion: source.draft.autosaveVersion,
        blocks: source.draft.chapters.flatMap((c) =>
          c.blocks.map((b) => ({ id: b.id, title: b.title, spatialMoment: b.presentation.spatialMoment ?? null })),
        ),
      };
    }
    const [usage, policy] = await Promise.all([creatorAIUsage(session.accountId), readAIPolicy()]);
    const provider = openAIProviderConfiguration(policy.policy);
    return NextResponse.json(
      {
        csrfToken: session.csrfToken,
        layoutScope: session.accountId,
        ...(await spatialLibraryInventory(session.accountId)),
        chronicle,
        aiAvailable: provider.configured && usage.enabled,
        aiConfigured: provider.configured,
        aiUsage: { ...usage, enabled: usage.enabled && provider.configured },
      },
      { headers },
    );
  } catch (cause) {
    if (cause instanceof UnsupportedSpatialCatalogFilter)
      return NextResponse.json(
        { code: "SPATIAL_CATALOG_USAGE_FILTER_UNAVAILABLE", error: cause.message },
        { status: 422, headers },
      );
    if (cause instanceof z.ZodError)
      return NextResponse.json({ error: "Library query is invalid." }, { status: 400, headers });
    if (cause instanceof Error && cause.message === "Spatial catalog cursor is stale; restart browsing.")
      return NextResponse.json(
        { code: "SPATIAL_CATALOG_CURSOR_STALE", error: cause.message },
        { status: 409, headers },
      );
    if (cause instanceof Error && cause.message === "Spatial catalog cursor is invalid.")
      return NextResponse.json({ error: cause.message }, { status: 400, headers });
    if (view) return NextResponse.json({ error: "Spatial Library could not load." }, { status: 500, headers });
    return apiError(cause);
  }
}
export async function POST(request: Request) {
  const session = await requireStudioWorkspace(request);
  if (!session)
    return NextResponse.json({ error: "Creator access and CSRF verification required." }, { status: 401, headers });
  const rate = consumeRateLimit(`parallax.studio:${session.accountId}`, { limit: 60, windowMs: 60000 });
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429, headers });
  let assistantAction = false;
  let privateManagerAction = false;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 256 * 1024)
      return NextResponse.json({ error: "Spatial request exceeds 256 KiB." }, { status: 413, headers });
    const raw = JSON.parse(body);
    privateManagerAction =
      raw?.action === "SCENE_COMPARE" ||
      (typeof raw?.action === "string" && raw.action.startsWith("LEGACY_ENVIRONMENT_"));
    assistantAction = raw?.action === "ASSISTANT_APPLY" || (raw?.action === "AI" && raw?.kind === "ASSISTANT");
    const input = inputSchema.parse(raw);
    if ("draft" in input && input.draft) await assertSpatialDraftAccess(input.draft);
    switch (input.action) {
      case "ENVIRONMENT_CATALOG": {
        const inventory = await spatialLibraryInventory(session.accountId);
        return NextResponse.json(
          { catalog: await listCompatibleEnvironments(session.accountId, undefined, inventory.environments) },
          { headers },
        );
      }
      case "SCENE_COMPARE": {
        const target = (await listSpatialItems(session.accountId)).find(
          (item) =>
            item.id === input.targetDefinitionId && !item.archived && spatialLibraryKind(item.draft) === "SCENES",
        );
        if (!target) throw new Error("This Scene is unavailable to this Creator.");
        return NextResponse.json(compareScenes(input.draft, target.draft), { headers });
      }
      case "LEGACY_ENVIRONMENT_BEGIN": {
        const { action: _action, ...operation } = input;
        void _action;
        return NextResponse.json(await beginLegacyEnvironmentEdit(session.accountId, operation), { headers });
      }
      case "LEGACY_ENVIRONMENT_COPY": {
        const { action: _action, ...operation } = input;
        void _action;
        return NextResponse.json(await copyLegacyEnvironment(session.accountId, operation), { headers });
      }
      case "LEGACY_ENVIRONMENT_SAVE":
        return NextResponse.json(
          await saveLegacyEnvironmentWorking(session.accountId, input.document, input.revision),
          { headers },
        );
      case "LEGACY_ENVIRONMENT_RELEASE": {
        const { action: _action, ...operation } = input;
        void _action;
        return NextResponse.json(await releaseLegacyEnvironmentVersion(session.accountId, operation), { headers });
      }
      case "LEGACY_ENVIRONMENT_LIBRARY_SAVE":
        return NextResponse.json(
          await saveLegacyEnvironmentToLibrary(session.accountId, input.definitionId, input.revision),
          { headers },
        );
      case "LEGACY_ENVIRONMENT_ARCHIVE":
        return NextResponse.json(
          await archiveLegacyEnvironment(session.accountId, input.definitionId, input.revision, input.archived),
          { headers },
        );
      case "ENVIRONMENT_SAVE":
        return NextResponse.json(
          { revision: await saveEnvironmentDraft(session.accountId, input.document, input.revision) },
          { headers },
        );
      case "SAVE_TO_LIBRARY":
        return NextResponse.json(await saveDefinitionToLibrary(session.accountId, input.definitionId, input.revision), {
          headers,
        });
      case "SAVE_AS":
        return NextResponse.json(await saveSpatialAs(session.accountId, input), { headers });
      case "LIBRARY_METADATA":
        return NextResponse.json(
          await mutateLibraryDefinition(session.accountId, input.definitionId, input.revision, input.change),
          { headers },
        );
      case "VERSION_RESTORE":
        return NextResponse.json(
          await restoreDefinitionVersion(session.accountId, input.definitionId, input.revision, input.versionId),
          { headers },
        );
      case "ENVIRONMENT_RELEASE":
        return NextResponse.json(
          await releaseEnvironmentVersion(session.accountId, input.definitionId, input.revision, input.notes),
          { headers },
        );
      case "ENVIRONMENT_USE":
        return NextResponse.json(await applyEnvironmentDefinition(session.accountId, input), { headers });
      case "RECONCILE_LIBRARY":
        return NextResponse.json(await reconcileLegacySpatialMembership(session.accountId), { headers });
      case "ENVIRONMENT_RENAME":
        return NextResponse.json(
          await updateEnvironmentLibraryEntry(session.accountId, input.definitionId, input.revision, {
            name: input.name,
          }),
          { headers },
        );
      case "ENVIRONMENT_ARCHIVE":
        return NextResponse.json(
          await updateEnvironmentLibraryEntry(session.accountId, input.definitionId, input.revision, { archive: true }),
          { headers },
        );
      case "ASSET_SAVE": {
        const room = input.draft.content.studio?.environment;
        const environment =
          room?.id === input.environmentId
            ? { ...room, horizontal: true, vertical: true, tracking: true, clutter: 0, light: "NORMAL" }
            : simulationEnvironments.find((e) => e.id === input.environmentId);
        if (!environment) throw new Error("Choose a current room before saving the selection.");
        return NextResponse.json(
          await saveReusableAsset(
            session.accountId,
            input.draft,
            input.revision,
            input.rootId,
            input.metadata,
            environment,
            input.operation,
          ),
          { headers },
        );
      }
      case "ASSET_INSERT":
        return NextResponse.json(
          await reuseSpatialAsset(session.accountId, input.draft, input.revision, input.definitionId, input.versionId),
          { headers },
        );
      case "INSTALLED_COMPOSITION_INSERT":
        return NextResponse.json(
          await reuseInstalledSpatialComposition(
            session.accountId,
            input.draft,
            input.revision,
            input.definitionId,
            input.versionId,
          ),
          { headers },
        );
      case "ARCHIVE":
        await archiveSpatialItem(session.accountId, input.definitionId, input.revision);
        return NextResponse.json({ archived: true }, { headers });
      case "FIELD_QUALITY":
        return NextResponse.json(await creatorFieldQuality(session.accountId, input.definitionId, input.draft), {
          headers,
        });
      case "CALIBRATION_REVIEW":
        return NextResponse.json(await reviewCalibration(session.accountId, input.review, input.draft), { headers });
      case "SAVE":
        return NextResponse.json(
          { revision: await saveSpatialDraft(session.accountId, input.draft, input.revision) },
          { headers },
        );
      case "RELEASE":
        return NextResponse.json(
          await releaseSpatialVersion(session.accountId, input.definitionId, input.revision, input.notes),
          {
            headers,
          },
        );
      case "VALIDATE":
        return NextResponse.json(
          {
            findings: validateSpatialAuthoring(input.draft.content),
            simulations: simulateSpatialEnvironments(input.draft.content),
            performance: spatialPerformanceEstimate(input.draft.content),
            authority: "DRYDOCK_STATIC_CONTRACT",
            physicalQualification: "NOT_ESTABLISHED",
          },
          { headers },
        );
      case "AI":
        if (input.kind === "ASSISTANT") {
          const { action: _action, kind: _kind, ...assistant } = input;
          void _action;
          void _kind;
          return NextResponse.json(
            await requestSpatialAssistant(session.accountId, assistant, { signal: request.signal }),
            { headers },
          );
        }
        return NextResponse.json(await requestSpatialAI(input.kind, input.request, input.draft), { headers });
      case "ASSISTANT_APPLY": {
        const { action: _action, ...application } = input;
        void _action;
        return NextResponse.json(await applySpatialAssistant(session.accountId, application), { headers });
      }
      case "ATTACH":
        return NextResponse.json(await attachSpatialVersion({ ...input, ownerAccountId: session.accountId }), {
          headers,
        });
      case "RESTORE_ATTACHMENT":
        return NextResponse.json(await restoreSpatialAttachment({ ...input, ownerAccountId: session.accountId }), {
          headers,
        });
    }
  } catch (cause) {
    if (assistantAction) return assistantError(cause, session.accountId);
    const response = apiError(cause);
    if (privateManagerAction) Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }
}
