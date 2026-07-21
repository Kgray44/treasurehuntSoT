import { z } from "zod";
import type { InspectorField, JsonObject, VerificationProviderType } from "@/chronicle/types";

const completionOptions = [
  { value: "playerConfirmation", label: "Continue button" },
  { value: "captainManual", label: "Captain approval" },
  { value: "automatic", label: "Continue automatically after presentation" },
  { value: "textAnswer", label: "Accepted text answer" },
] as const;

const text = (key: string, label: string, required = false, help?: string): InspectorField => ({
  key,
  label,
  kind: "text",
  required,
  help,
});
const area = (key: string, label: string, required = false, help?: string): InspectorField => ({
  key,
  label,
  kind: "textarea",
  required,
  help,
});
const asset = (key: string, label: string, mediaTypes: string[], required = false): InspectorField => ({
  key,
  label,
  kind: "asset",
  mediaTypes,
  required,
});
const completion = (): InspectorField => ({
  key: "completionMode",
  label: "Completion",
  kind: "select",
  options: [...completionOptions],
});

export type BlockDefinition = {
  type: string;
  displayName: string;
  category: "Narrative" | "Directions and waypoints" | "Media" | "Reveals" | "Interactions" | "Logic";
  icon: string;
  description: string;
  defaultTitle: string;
  defaultConfiguration: JsonObject;
  fields: InspectorField[];
  assetFields: Record<string, string[]>;
  schemaVersion: 1;
  validationSchema: z.ZodType<JsonObject>;
};

function schemaFor(fields: InspectorField[]) {
  return z.record(z.string(), z.unknown()).superRefine((value, context) => {
    for (const field of fields) {
      if (!field.required) continue;
      const item = value[field.key];
      if (item === undefined || item === null || (typeof item === "string" && !item.trim())) {
        context.addIssue({ code: "custom", message: `${field.label} is required.`, path: [field.key] });
      }
    }
  });
}

function define(input: Omit<BlockDefinition, "schemaVersion" | "validationSchema" | "assetFields">): BlockDefinition {
  return {
    ...input,
    schemaVersion: 1,
    validationSchema: schemaFor(input.fields),
    assetFields: Object.fromEntries(
      input.fields.filter((field) => field.kind === "asset").map((field) => [field.key, field.mediaTypes ?? []]),
    ),
  };
}

export const blockRegistry = {
  narrative: define({
    type: "narrative",
    displayName: "Narrative",
    category: "Narrative",
    icon: "¶",
    description: "Cinematic narration and connective text for a Passage.",
    defaultTitle: "Narrative",
    defaultConfiguration: {
      heading: "A new passage",
      body: "Write the next part of the voyage.",
      textAlignment: "left",
      widthStyle: "reading",
      entranceAnimation: "ink",
      completionMode: "playerConfirmation",
    },
    fields: [
      text("heading", "Heading", true),
      area("body", "Body", true),
      text("narratorLabel", "Narrator"),
      asset("backgroundAssetId", "Background image", ["IMAGE"]),
      completion(),
    ],
  }),
  captainsNote: define({
    type: "captainsNote",
    displayName: "Captain's Note",
    category: "Narrative",
    icon: "✒",
    description: "A handwritten letter or journal entry.",
    defaultTitle: "Captain's Note",
    defaultConfiguration: {
      title: "Captain's note",
      body: "",
      signature: "The Captain",
      paperStyle: "weathered",
      inkStyle: "midnight",
      completionMode: "playerConfirmation",
    },
    fields: [
      text("title", "Title", true),
      area("body", "Body", true),
      text("signature", "Signature"),
      asset("portraitAssetId", "Portrait or seal", ["IMAGE"]),
      asset("narrationAssetId", "Narration", ["AUDIO"]),
      completion(),
    ],
  }),
  riddle: define({
    type: "riddle",
    displayName: "Riddle",
    category: "Interactions",
    icon: "?",
    description: "A clue with accepted answers and optional hints.",
    defaultTitle: "Riddle",
    defaultConfiguration: {
      riddleTitle: "A riddle",
      riddleText: "",
      acceptedAnswers: [],
      caseSensitive: false,
      normalizeWhitespace: true,
      hints: [],
      wrongAnswerFeedback: "That answer does not turn the lock.",
      completionMode: "textAnswer",
    },
    fields: [
      text("riddleTitle", "Riddle title", true),
      area("riddleText", "Riddle", true),
      asset("illustrationAssetId", "Illustration", ["IMAGE"]),
      { key: "acceptedAnswers", label: "Accepted answers (JSON array)", kind: "json", required: true },
      { key: "hints", label: "Hints (JSON array)", kind: "json" },
      area("wrongAnswerFeedback", "Wrong-answer feedback"),
      completion(),
    ],
  }),
  information: define({
    type: "information",
    displayName: "Information",
    category: "Narrative",
    icon: "i",
    description: "Rules, context, safety notes, or instructions.",
    defaultTitle: "Information",
    defaultConfiguration: {
      heading: "Before you continue",
      body: "",
      importance: "normal",
      acknowledgmentRequired: true,
      buttonLabel: "Understood",
      completionMode: "playerConfirmation",
    },
    fields: [
      text("heading", "Heading", true),
      area("body", "Body", true),
      {
        key: "importance",
        label: "Importance",
        kind: "select",
        options: [
          { value: "normal", label: "Normal" },
          { value: "important", label: "Important" },
          { value: "warning", label: "Warning" },
        ],
      },
      asset("assetId", "Illustration", ["IMAGE"]),
      text("buttonLabel", "Button label"),
      completion(),
    ],
  }),
  travelDirection: define({
    type: "travelDirection",
    displayName: "Travel Direction",
    category: "Directions and waypoints",
    icon: "➶",
    description: "A bearing, destination, map, and travel instruction.",
    defaultTitle: "Travel Direction",
    defaultConfiguration: {
      heading: "Set a course",
      directionText: "",
      destinationVisibility: "named",
      completionMode: "playerConfirmation",
    },
    fields: [
      text("heading", "Heading", true),
      area("directionText", "Directions", true),
      text("compassHeading", "Compass heading"),
      text("region", "Region"),
      { key: "estimatedTravelTime", label: "Estimated minutes", kind: "number" },
      { key: "locationId", label: "Waypoint", kind: "location" },
      asset("mapAssetId", "Map", ["IMAGE"]),
      area("captainNotes", "Captain-only notes"),
      completion(),
    ],
  }),
  location: define({
    type: "location",
    displayName: "Waypoint",
    category: "Directions and waypoints",
    icon: "⌖",
    description: "Introduce a reusable Waypoint.",
    defaultTitle: "Waypoint",
    defaultConfiguration: {
      playerTitle: "Destination",
      playerDescription: "",
      arrivalInstructions: "",
      completionMode: "playerConfirmation",
      futureVision: {},
    },
    fields: [
      { key: "locationId", label: "Waypoint", kind: "location", required: true },
      text("playerTitle", "Player title"),
      area("playerDescription", "Player description"),
      asset("displayAssetId", "Display image", ["IMAGE"]),
      asset("mapAssetId", "Map image", ["IMAGE"]),
      area("arrivalInstructions", "Arrival instructions"),
      { key: "referenceCollectionId", label: "Reference collection ID for a future integration", kind: "text" },
      completion(),
    ],
  }),
  arrivalCheck: define({
    type: "arrivalCheck",
    displayName: "Arrival Check",
    category: "Directions and waypoints",
    icon: "⚓",
    description: "Pause for a verified arrival.",
    defaultTitle: "Arrival Check",
    defaultConfiguration: {
      prompt: "Confirm when you have arrived.",
      pendingText: "Awaiting a truthful bearing…",
      captainNotification: "The crew is awaiting arrival approval.",
      verificationProvider: "captainManual",
      allowCaptainOverride: true,
      completionMode: "captainManual",
      futureProviderOptions: {},
    },
    fields: [
      area("prompt", "Player prompt", true),
      text("pendingText", "Pending text"),
      text("captainNotification", "Captain notification"),
      {
        key: "verificationProvider",
        label: "Verification provider",
        kind: "select",
        options: [
          { value: "captainManual", label: "Captain manual" },
          { value: "playerConfirmation", label: "Player confirmation" },
          { value: "textAnswer", label: "Text phrase or code" },
          { value: "visionLocation", label: "Vision Waypoint (future)" },
        ],
      },
      { key: "referenceCollectionId", label: "Reference collection ID for a future integration", kind: "text" },
      completion(),
    ],
  }),
  image: define({
    type: "image",
    displayName: "Image",
    category: "Media",
    icon: "▧",
    description: "Player-facing artwork with display options.",
    defaultTitle: "Image",
    defaultConfiguration: {
      caption: "",
      altText: "",
      displayMode: "journalFrame",
      objectFit: "cover",
      focalX: 50,
      focalY: 50,
      entranceMotion: "reveal",
      completionMode: "playerConfirmation",
    },
    fields: [
      asset("assetId", "Image", ["IMAGE"], true),
      text("caption", "Caption"),
      text("altText", "Alternative text", true),
      {
        key: "displayMode",
        label: "Display mode",
        kind: "select",
        options: ["inline", "fullBleed", "fullscreen", "journalFrame", "mapFragment", "memory", "background"].map(
          (value) => ({ value, label: value }),
        ),
      },
      { key: "focalX", label: "Focal X (%)", kind: "number" },
      { key: "focalY", label: "Focal Y (%)", kind: "number" },
      completion(),
    ],
  }),
  imageTransformation: define({
    type: "imageTransformation",
    displayName: "Image Transformation",
    category: "Reveals",
    icon: "◐",
    description: "Align and transform a before image into an after image.",
    defaultTitle: "Image Transformation",
    defaultConfiguration: {
      transitionPreset: "inkSpread",
      duration: 3200,
      holdBefore: 600,
      holdAfter: 900,
      caption: "",
      alignment: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 50, focalX: 50, focalY: 50 },
      completionMode: "playerConfirmation",
    },
    fields: [
      asset("beforeAssetId", "Before image", ["IMAGE"], true),
      asset("afterAssetId", "After image", ["IMAGE"], true),
      {
        key: "transitionPreset",
        label: "Transition",
        kind: "select",
        options: [
          "crossfade",
          "inkSpread",
          "ancientCarving",
          "moonlight",
          "fog",
          "waterWash",
          "magicalGlow",
          "cameraPushIn",
        ].map((value) => ({ value, label: value })),
      },
      { key: "duration", label: "Duration (ms)", kind: "number" },
      asset("audioAssetId", "Audio cue", ["AUDIO"]),
      text("caption", "Revealed message"),
      { key: "alignment", label: "Alignment (JSON)", kind: "json" },
      completion(),
    ],
  }),
  cinematic: define({
    type: "cinematic",
    displayName: "Cinematic",
    category: "Media",
    icon: "▶",
    description: "Video playback with poster and fallback behavior.",
    defaultTitle: "Cinematic",
    defaultConfiguration: {
      autoplay: true,
      skippable: true,
      minimumWatchDuration: 0,
      completionMode: "playerConfirmation",
    },
    fields: [
      asset("videoAssetId", "Video", ["VIDEO"], true),
      asset("posterAssetId", "Poster", ["IMAGE"]),
      asset("captionsAssetId", "Captions", ["DOCUMENT"]),
      { key: "autoplay", label: "Autoplay when permitted", kind: "boolean" },
      { key: "skippable", label: "Skippable", kind: "boolean" },
      { key: "minimumWatchDuration", label: "Minimum watch seconds", kind: "number" },
      completion(),
    ],
  }),
  audio: define({
    type: "audio",
    displayName: "Audio",
    category: "Media",
    icon: "♫",
    description: "Narration, music, or atmosphere with transcript.",
    defaultTitle: "Audio",
    defaultConfiguration: {
      title: "Audio",
      transcript: "",
      playbackMode: "controls",
      loop: false,
      volume: 0.8,
      completionMode: "playerConfirmation",
    },
    fields: [
      asset("audioAssetId", "Audio", ["AUDIO"], true),
      text("title", "Title"),
      area("transcript", "Transcript"),
      {
        key: "playbackMode",
        label: "Playback mode",
        kind: "select",
        options: [
          { value: "controls", label: "Player controls" },
          { value: "autoplay", label: "Autoplay" },
          { value: "background", label: "Background" },
        ],
      },
      { key: "loop", label: "Loop", kind: "boolean" },
      { key: "volume", label: "Default volume", kind: "number" },
      completion(),
    ],
  }),
  artifactReveal: define({
    type: "artifactReveal",
    displayName: "Artifact Reveal",
    category: "Reveals",
    icon: "✦",
    description: "Reveal context and add a reusable Artifact once.",
    defaultTitle: "Artifact Reveal",
    defaultConfiguration: {
      ordinaryObjectLabel: "",
      loreTitle: "Recovered treasure",
      loreDescription: "",
      addToCollection: true,
      revealAnimation: "lantern",
      completionMode: "playerConfirmation",
    },
    fields: [
      { key: "artifactId", label: "Artifact", kind: "artifact", required: true },
      text("ordinaryObjectLabel", "Ordinary object label"),
      asset("revealArtworkId", "Reveal artwork", ["IMAGE"]),
      asset("revealVideoId", "Reveal video", ["VIDEO"]),
      text("loreTitle", "Lore title", true),
      area("loreDescription", "Lore description", true),
      asset("audioAssetId", "Audio cue", ["AUDIO"]),
      { key: "addToCollection", label: "Add to collection", kind: "boolean" },
      completion(),
    ],
  }),
  hiddenMessageReveal: define({
    type: "hiddenMessageReveal",
    displayName: "Hidden Message Reveal",
    category: "Reveals",
    icon: "◈",
    description: "Reveal a hidden layer or message over an image.",
    defaultTitle: "Hidden Message",
    defaultConfiguration: {
      messageText: "",
      revealStyle: "moonlight",
      duration: 2800,
      completionMode: "playerConfirmation",
    },
    fields: [
      asset("baseAssetId", "Base image", ["IMAGE"], true),
      asset("revealedAssetId", "Revealed image", ["IMAGE"]),
      area("messageText", "Message"),
      {
        key: "revealStyle",
        label: "Reveal style",
        kind: "select",
        options: ["crossfade", "ink", "moonlight", "fog", "water"].map((value) => ({ value, label: value })),
      },
      { key: "duration", label: "Duration (ms)", kind: "number" },
      asset("audioAssetId", "Audio", ["AUDIO"]),
      completion(),
    ],
  }),
  collectionUpdate: define({
    type: "collectionUpdate",
    displayName: "Collection Update",
    category: "Reveals",
    icon: "+",
    description: "Add an Artifact or update a collection count.",
    defaultTitle: "Collection Update",
    defaultConfiguration: {
      quantity: 1,
      progressLabel: "Recovered",
      celebrationStyle: "quiet",
      completionMode: "playerConfirmation",
    },
    fields: [
      { key: "artifactId", label: "Artifact", kind: "artifact", required: true },
      { key: "quantity", label: "Quantity", kind: "number" },
      text("progressLabel", "Progress label"),
      { key: "totalExpected", label: "Expected total", kind: "number" },
      text("celebrationStyle", "Celebration style"),
      completion(),
    ],
  }),
  confirmation: define({
    type: "confirmation",
    displayName: "Confirmation",
    category: "Interactions",
    icon: "✓",
    description: "An explicit player confirmation step.",
    defaultTitle: "Confirmation",
    defaultConfiguration: {
      prompt: "Ready to continue?",
      primaryLabel: "Continue",
      secondaryLabel: "",
      confirmationStyle: "standard",
      captainOverride: true,
      completionMode: "playerConfirmation",
    },
    fields: [
      area("prompt", "Prompt", true),
      text("primaryLabel", "Primary button", true),
      text("secondaryLabel", "Secondary action"),
      text("confirmationStyle", "Style"),
      completion(),
    ],
  }),
  choice: define({
    type: "choice",
    displayName: "Choice",
    category: "Interactions",
    icon: "⑂",
    description: "Two or more explicit branches in the Chronicle flow.",
    defaultTitle: "Choice",
    defaultConfiguration: {
      prompt: "Choose a course.",
      choices: [
        { id: "choice-a", label: "First course", targetBlockId: "" },
        { id: "choice-b", label: "Second course", targetBlockId: "" },
      ],
      reversible: false,
      completionMode: "playerConfirmation",
    },
    fields: [
      area("prompt", "Prompt", true),
      { key: "choices", label: "Choices (JSON)", kind: "json", required: true },
      { key: "reversible", label: "Choice can be reversed", kind: "boolean" },
      completion(),
    ],
  }),
  textAnswer: define({
    type: "textAnswer",
    displayName: "Text Answer",
    category: "Interactions",
    icon: "Aa",
    description: "A server-validated phrase or answer.",
    defaultTitle: "Text Answer",
    defaultConfiguration: {
      prompt: "Enter the answer.",
      acceptedAnswers: [],
      caseSensitive: false,
      normalizeWhitespace: true,
      feedback: "Try another bearing.",
      hints: [],
      completionMode: "textAnswer",
    },
    fields: [
      area("prompt", "Prompt", true),
      { key: "acceptedAnswers", label: "Accepted answers (JSON array)", kind: "json", required: true },
      { key: "caseSensitive", label: "Case-sensitive", kind: "boolean" },
      { key: "normalizeWhitespace", label: "Normalize whitespace", kind: "boolean" },
      area("feedback", "Rejected feedback"),
      { key: "hints", label: "Hints (JSON array)", kind: "json" },
    ],
  }),
  captainApproval: define({
    type: "captainApproval",
    displayName: "Captain Approval",
    category: "Interactions",
    icon: "⚑",
    description: "Pause for a Captain verification.",
    defaultTitle: "Captain Approval",
    defaultConfiguration: {
      waitingText: "The Captain is checking the chart.",
      captainInstruction: "Approve when the crew has completed the task.",
      allowRetry: true,
      completionMode: "captainManual",
    },
    fields: [
      area("waitingText", "Player waiting text", true),
      area("captainInstruction", "Captain instruction", true),
      text("presentationTrigger", "Presentation trigger"),
      { key: "allowRetry", label: "Allow reject and retry", kind: "boolean" },
    ],
  }),
  wait: define({
    type: "wait",
    displayName: "Wait",
    category: "Logic",
    icon: "◷",
    description: "Continue after a set duration or Captain skip.",
    defaultTitle: "Wait",
    defaultConfiguration: {
      durationSeconds: 5,
      waitingText: "The tide is turning…",
      allowCaptainSkip: true,
      completionMode: "timer",
    },
    fields: [
      { key: "durationSeconds", label: "Duration (seconds)", kind: "number", required: true },
      area("waitingText", "Waiting presentation"),
      { key: "allowCaptainSkip", label: "Allow Captain skip", kind: "boolean" },
    ],
  }),
  condition: define({
    type: "condition",
    displayName: "Condition",
    category: "Logic",
    icon: "◇",
    description: "Route using saved Voyage state comparisons.",
    defaultTitle: "Condition",
    defaultConfiguration: {
      variable: "",
      operator: "equals",
      value: true,
      successTargetBlockId: "",
      failureTargetBlockId: "",
      completionMode: "automatic",
    },
    fields: [
      text("variable", "Voyage variable", true),
      {
        key: "operator",
        label: "Comparison",
        kind: "select",
        options: ["equals", "notEquals", "greaterThan", "lessThan", "contains"].map((value) => ({
          value,
          label: value,
        })),
      },
      { key: "value", label: "Comparison value (JSON)", kind: "json" },
      text("successTargetBlockId", "Success Passage ID", true),
      text("failureTargetBlockId", "Failure Passage ID", true),
    ],
  }),
  setVariable: define({
    type: "setVariable",
    displayName: "Set Variable",
    category: "Logic",
    icon: "=",
    description: "Set, increment, decrement, or toggle a typed variable.",
    defaultTitle: "Set Variable",
    defaultConfiguration: {
      variable: "flag",
      valueType: "boolean",
      operation: "set",
      value: true,
      completionMode: "automatic",
    },
    fields: [
      text("variable", "Variable name", true),
      {
        key: "valueType",
        label: "Type",
        kind: "select",
        options: ["boolean", "number", "string"].map((value) => ({ value, label: value })),
      },
      {
        key: "operation",
        label: "Operation",
        kind: "select",
        options: ["set", "increment", "decrement", "toggle"].map((value) => ({ value, label: value })),
      },
      { key: "value", label: "Value (JSON)", kind: "json" },
    ],
  }),
  chapterComplete: define({
    type: "chapterComplete",
    displayName: "Chapter Complete",
    category: "Narrative",
    icon: "§",
    description: "Close a Chapter and continue to the next Chapter.",
    defaultTitle: "Chapter Complete",
    defaultConfiguration: {
      completionMessage: "Chapter complete",
      summary: "",
      nextChapterBehavior: "continue",
      returnToMap: false,
      animation: "seal",
      completionMode: "playerConfirmation",
    },
    fields: [
      text("completionMessage", "Completion message", true),
      area("summary", "Summary"),
      { key: "rewardArtifactId", label: "Reward Artifact", kind: "artifact" },
      { key: "returnToMap", label: "Return to map", kind: "boolean" },
      text("animation", "Animation"),
      completion(),
    ],
  }),
  taleComplete: define({
    type: "taleComplete",
    displayName: "Voyage Complete",
    category: "Narrative",
    icon: "★",
    description: "End the Voyage and preserve its Voyage Record.",
    defaultTitle: "Voyage Complete",
    defaultConfiguration: {
      finaleHeading: "Voyage complete",
      finaleContent: "The final mark is written.",
      completionMessage: "Your voyage is complete.",
      credits: "",
      replayAvailable: true,
      completionMode: "playerConfirmation",
    },
    fields: [
      text("finaleHeading", "Finale heading", true),
      area("finaleContent", "Finale content", true),
      area("completionMessage", "Completion message"),
      area("credits", "Credits or dedication"),
      { key: "replayAvailable", label: "Replay available", kind: "boolean" },
    ],
  }),
} satisfies Record<string, BlockDefinition>;

export type BlockType = keyof typeof blockRegistry;
export const blockTypeIds = Object.keys(blockRegistry) as BlockType[];

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return blockRegistry[type as BlockType];
}

export function serializeBlockRegistry() {
  return blockTypeIds.map((type) => {
    const { validationSchema: _schema, ...definition } = blockRegistry[type];
    void _schema;
    return definition;
  });
}

export function providerForBlock(type: string, configuration: JsonObject): VerificationProviderType | null {
  if (type === "captainApproval") return "captainManual";
  if (type === "textAnswer" || type === "riddle") return "textAnswer";
  if (type === "wait") return "timer";
  const configured = String(configuration.verificationProvider ?? configuration.completionMode ?? "playerConfirmation");
  if (configured === "automatic") return null;
  if (
    [
      "captainManual",
      "playerConfirmation",
      "textAnswer",
      "timer",
      "visionLocation",
      "visionObject",
      "externalWebhook",
    ].includes(configured)
  )
    return configured as VerificationProviderType;
  return "playerConfirmation";
}
