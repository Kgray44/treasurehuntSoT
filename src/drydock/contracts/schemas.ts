import { z } from "zod";
import { journalPresentationSchema } from "@/chronicle/journal-contract";
import type { JsonObject } from "@/chronicle/types";
import { drydockExpressionSchema } from "@/drydock/expressions";
import { drydockExtensionsSchema } from "@/drydock/extensions";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const optionalId = id.optional();
const requiredText = (maximum: number) => z.string().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().max(maximum).optional();
const boundedStringArray = (maximumItems: number, maximumLength = 1000) =>
  z.array(z.string().min(1).max(maximumLength)).max(maximumItems);
const finite = (minimum: number, maximum: number) => z.number().finite().min(minimum).max(maximum);
const integer = (minimum: number, maximum: number) => z.number().int().min(minimum).max(maximum);

const withExtensions = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, extensions: drydockExtensionsSchema.optional() }).strict();

const providerOptionsSchema = z.discriminatedUnion("id", [
  z.object({ id: z.literal("captainManual"), version: z.literal(1), options: z.object({}).strict() }).strict(),
  z.object({ id: z.literal("playerConfirmation"), version: z.literal(1), options: z.object({}).strict() }).strict(),
  z.object({ id: z.literal("textAnswer"), version: z.literal(1), options: z.object({}).strict() }).strict(),
  z.object({ id: z.literal("timer"), version: z.literal(1), options: z.object({}).strict() }).strict(),
  z
    .object({
      id: z.literal("visionLocation"),
      version: z.literal(1),
      options: z.object({ providerInstanceId: id }).strict(),
    })
    .strict(),
  z
    .object({
      id: z.literal("visionObject"),
      version: z.literal(1),
      options: z.object({ providerInstanceId: id }).strict(),
    })
    .strict(),
  z
    .object({
      id: z.literal("externalWebhook"),
      version: z.literal(1),
      options: z.object({ providerInstanceId: id }).strict(),
    })
    .strict(),
]);

export const drydockCompletionSchema = z
  .object({
    // Provider registration is semantic authority. Preserve a syntactically valid
    // unknown identifier so the parser can issue DRYDOCK_PROVIDER_UNREGISTERED.
    mode: id,
    provider: providerOptionsSchema.optional(),
    fallbackMode: z.enum(["captainManual", "playerConfirmation"]).optional(),
    retryPolicy: z.enum(["none", "creatorDeclared", "captainControlled"]).optional(),
    captainOverride: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.provider && value.provider.id !== value.mode)
      context.addIssue({
        code: "custom",
        message: "Provider options must match the completion mode.",
        path: ["provider"],
      });
    if (["visionLocation", "visionObject", "externalWebhook"].includes(value.mode)) {
      if (!value.provider)
        context.addIssue({
          code: "custom",
          message: "This provider mode requires typed provider options.",
          path: ["provider"],
        });
      if (!value.fallbackMode)
        context.addIssue({
          code: "custom",
          message: "This provider mode requires an accessible fallback.",
          path: ["fallbackMode"],
        });
    }
  }) as z.ZodType<JsonObject>;

export const drydockPresentationSchema = journalPresentationSchema
  .extend({
    sceneReference: z
      .object({ owner: z.string().min(1).max(80), sceneId: id, version: z.number().int().min(1).max(100) })
      .strict()
      .optional(),
    reducedMotionMeaning: optionalText(1000),
    nonAudioMeaning: optionalText(1000),
  })
  .strict() as z.ZodType<JsonObject>;

const alignmentSchema = z
  .object({
    x: finite(-10000, 10000),
    y: finite(-10000, 10000),
    scale: finite(0.05, 20),
    rotation: finite(-360, 360),
    opacity: finite(0, 100),
    focalX: finite(0, 100),
    focalY: finite(0, 100),
  })
  .strict();

const choiceSchema = z.object({ id, label: requiredText(240), targetBlockId: id }).strict();

const artifactRecipientPolicies = [
  "ALL_ACTIVE_PLAYERS",
  "SELECTED_PLAYER",
  "DISCOVERING_PLAYER",
  "CAPTAIN_SELECTED",
  "CREW_ROLE",
  "CREW_COLLECTION_ONLY",
  "PERSONAL_AND_CREW_COLLECTION",
] as const;

export const drydockConfigurationSchemas = {
  narrative: withExtensions({
    heading: requiredText(240),
    body: requiredText(20000),
    narratorLabel: optionalText(160),
    backgroundAssetId: optionalId,
    textAlignment: z.enum(["left", "center", "right"]).optional(),
    widthStyle: z.enum(["reading", "wide", "full"]).optional(),
    entranceAnimation: z.enum(["none", "ink", "fade", "pageTurn"]).optional(),
  }),
  captainsNote: withExtensions({
    title: requiredText(240),
    body: requiredText(20000),
    signature: optionalText(240),
    paperStyle: optionalText(80),
    inkStyle: optionalText(80),
    portraitAssetId: optionalId,
    narrationAssetId: optionalId,
  }),
  riddle: withExtensions({
    riddleTitle: requiredText(240),
    riddleText: requiredText(10000),
    acceptedAnswers: boundedStringArray(64, 500).min(1),
    caseSensitive: z.boolean(),
    normalizeWhitespace: z.boolean(),
    hints: boundedStringArray(32, 2000),
    wrongAnswerFeedback: optionalText(4000),
    illustrationAssetId: optionalId,
  }),
  information: withExtensions({
    heading: requiredText(240),
    body: requiredText(20000),
    importance: z.enum(["normal", "important", "warning"]),
    acknowledgmentRequired: z.boolean(),
    buttonLabel: optionalText(120),
    assetId: optionalId,
  }),
  travelDirection: withExtensions({
    heading: requiredText(240),
    directionText: requiredText(10000),
    destinationVisibility: z.enum(["named", "hidden", "regionOnly"]),
    compassHeading: optionalText(120),
    region: optionalText(240),
    estimatedTravelTime: integer(0, 10080).optional(),
    locationId: optionalId,
    mapAssetId: optionalId,
    captainNotes: optionalText(10000),
  }),
  location: withExtensions({
    locationId: id,
    playerTitle: optionalText(240),
    playerDescription: optionalText(10000),
    displayAssetId: optionalId,
    mapAssetId: optionalId,
    arrivalInstructions: optionalText(10000),
    referenceCollectionId: optionalId,
  }),
  arrivalCheck: withExtensions({
    prompt: requiredText(4000),
    pendingText: optionalText(1000),
    captainNotification: optionalText(1000),
    allowCaptainOverride: z.boolean(),
    referenceCollectionId: optionalId,
  }),
  image: withExtensions({
    assetId: id,
    caption: optionalText(4000),
    altText: z.string().max(2000),
    decorative: z.boolean().optional(),
    displayMode: z.enum(["inline", "fullBleed", "fullscreen", "journalFrame", "mapFragment", "memory", "background"]),
    objectFit: z.enum(["cover", "contain", "fill"]),
    focalX: finite(0, 100),
    focalY: finite(0, 100),
    entranceMotion: z.enum(["none", "reveal", "fade", "pan"]).optional(),
  }).superRefine((value, context) => {
    if (!value.decorative && !value.altText.trim())
      context.addIssue({
        code: "custom",
        message: "Image requires alternative text or decorative classification.",
        path: ["altText"],
      });
  }),
  imageTransformation: withExtensions({
    beforeAssetId: id,
    afterAssetId: id,
    transitionPreset: z.enum([
      "crossfade",
      "inkSpread",
      "ancientCarving",
      "moonlight",
      "fog",
      "waterWash",
      "magicalGlow",
      "cameraPushIn",
    ]),
    duration: integer(0, 600000),
    holdBefore: integer(0, 600000),
    holdAfter: integer(0, 600000),
    caption: optionalText(4000),
    alignment: alignmentSchema,
    audioAssetId: optionalId,
    nonMotionMeaning: optionalText(2000),
  }),
  cinematic: withExtensions({
    videoAssetId: id,
    posterAssetId: id,
    // An intentionally blank caption reference remains invalid in full analysis,
    // but reaches the stable accessibility rule instead of a generic schema error.
    captionsAssetId: z.union([z.literal(""), id]),
    autoplay: z.boolean(),
    skippable: z.boolean(),
    minimumWatchDuration: finite(0, 86400),
    nonMotionMeaning: optionalText(2000),
  }),
  audio: withExtensions({
    audioAssetId: id,
    title: optionalText(240),
    // Empty transcript content is a semantic accessibility violation; malformed
    // non-string input remains a contract failure.
    transcript: z.string().max(20000),
    playbackMode: z.enum(["controls", "autoplay", "background"]),
    loop: z.boolean(),
    volume: finite(0, 1),
  }),
  artifactReveal: withExtensions({
    artifactId: id,
    ordinaryObjectLabel: optionalText(240),
    revealArtworkId: optionalId,
    revealVideoId: optionalId,
    loreTitle: requiredText(240),
    loreDescription: requiredText(20000),
    audioAssetId: optionalId,
    addToCollection: z.boolean(),
    recipientPolicy: z.enum(artifactRecipientPolicies),
    selectedRecipientProfileIds: z.array(id).max(20),
    requiredCrewRole: id.nullable(),
    discoveringMembershipId: id.nullable(),
    personalGrantState: z.enum(["COLLECTED", "ENTRUSTED", "ASSEMBLY_COMPONENT"]),
    custodyKind: z.enum(["PERSONAL", "CREW", "SHARED"]).optional(),
    assemblyDefinitionId: id.nullable(),
    componentRole: z.string().max(120).nullable(),
    receiptState: z.enum(["ACTIVE", "REVOKED"]),
    correctionOfGrantId: id.nullable(),
    correctionReason: z.string().max(2000).nullable(),
    revealAnimation: optionalText(80),
  }).superRefine((value, context) => {
    if (value.recipientPolicy === "SELECTED_PLAYER" && value.selectedRecipientProfileIds.length !== 1)
      context.addIssue({
        code: "custom",
        message: "Selected-player policy requires one selected profile.",
        path: ["selectedRecipientProfileIds"],
      });
    if (value.receiptState === "REVOKED" && !value.correctionReason)
      context.addIssue({
        code: "custom",
        message: "Revoked receipt requires a correction reason.",
        path: ["correctionReason"],
      });
  }),
  hiddenMessageReveal: withExtensions({
    baseAssetId: id,
    revealedAssetId: optionalId,
    messageText: z.string().max(10000),
    revealStyle: z.enum(["crossfade", "ink", "moonlight", "fog", "water"]),
    duration: integer(0, 600000),
    audioAssetId: optionalId,
    nonMotionMeaning: optionalText(2000),
  }).superRefine((value, context) => {
    if (!value.revealedAssetId && !value.messageText.trim())
      context.addIssue({ code: "custom", message: "Reveal requires an image or message.", path: ["messageText"] });
  }),
  collectionUpdate: withExtensions({
    artifactId: id,
    quantity: integer(1, 1000000),
    progressLabel: optionalText(240),
    totalExpected: integer(1, 1000000).optional(),
    celebrationStyle: z.enum(["quiet", "standard", "cinematic"]),
  }),
  confirmation: withExtensions({
    prompt: requiredText(4000),
    primaryLabel: requiredText(120),
    secondaryLabel: optionalText(120),
    confirmationStyle: z.enum(["standard", "warning", "ceremonial"]),
    captainOverride: z.boolean(),
  }),
  choice: withExtensions({
    prompt: requiredText(4000),
    choices: z.array(choiceSchema).min(2).max(20),
    reversible: z.boolean(),
  }).superRefine((value, context) => {
    if (new Set(value.choices.map((choice) => choice.id)).size !== value.choices.length)
      context.addIssue({ code: "custom", message: "Choice option IDs must be unique.", path: ["choices"] });
  }),
  textAnswer: withExtensions({
    prompt: requiredText(4000),
    acceptedAnswers: boundedStringArray(64, 500).min(1),
    caseSensitive: z.boolean(),
    normalizeWhitespace: z.boolean(),
    feedback: optionalText(4000),
    hints: boundedStringArray(32, 2000),
  }),
  captainApproval: withExtensions({
    waitingText: requiredText(4000),
    captainInstruction: requiredText(10000),
    presentationTrigger: optionalText(120),
    allowRetry: z.boolean(),
  }),
  wait: withExtensions({
    durationSeconds: finite(0, 86400),
    waitingText: optionalText(4000),
    allowCaptainSkip: z.boolean(),
    reconnectPolicy: z.enum(["resumeRemaining", "restart", "captainDecision"]).optional(),
    virtualTimeContractVersion: z.literal(1).optional(),
  }),
  condition: withExtensions({
    expression: drydockExpressionSchema,
    variable: z.string().min(1).max(120),
    operator: z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains"]),
    value: z.union([
      z.boolean(),
      z.number().finite(),
      z.string().max(4000),
      z.array(z.string().max(4000)).max(128),
      z.null(),
    ]),
    successTargetBlockId: id,
    failureTargetBlockId: id,
  }),
  setVariable: withExtensions({
    variableId: id,
    variableName: z.string().min(1).max(120),
    variable: z.string().min(1).max(120),
    valueType: z.enum(["boolean", "integer", "number", "string", "enum", "stringSet", "identifierReference"]),
    operation: z.enum(["set", "increment", "decrement", "toggle"]),
    value: z.union([
      z.boolean(),
      z.number().finite(),
      z.string().max(4000),
      z.array(z.string().max(4000)).max(128),
      z.null(),
    ]),
    scope: z.enum(["CHRONICLE_DEFINITION", "SESSION"]),
    privacy: z.enum(["PLAYER_SAFE", "CAPTAIN_PRIVATE", "CREATOR_PRIVATE", "SYSTEM_PRIVATE"]),
  }),
  chapterComplete: withExtensions({
    completionMessage: requiredText(4000),
    summary: optionalText(10000),
    nextChapterBehavior: z.enum(["continue", "returnToMap", "captainDecision"]),
    rewardArtifactId: optionalId,
    returnToMap: z.boolean(),
    animation: optionalText(80),
    outcomeId: id.optional(),
    repeatProtection: z.enum(["oncePerSession", "idempotent"]).optional(),
  }),
  taleComplete: withExtensions({
    finaleHeading: requiredText(240),
    finaleContent: requiredText(20000),
    completionMessage: optionalText(4000),
    credits: optionalText(10000),
    replayAvailable: z.boolean(),
    outcomeId: id.optional(),
    repeatProtection: z.enum(["oncePerSession", "idempotent"]).optional(),
  }),
} satisfies Record<string, z.ZodType<JsonObject>>;

export type DrydockBlockType = keyof typeof drydockConfigurationSchemas;
export const drydockBlockTypeIds = Object.keys(drydockConfigurationSchemas) as DrydockBlockType[];
