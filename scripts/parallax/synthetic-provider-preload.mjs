import fs from "node:fs";
import path from "node:path";

// Explicit, disposable browser instrumentation. Never loaded by application code.
const database = (process.env.DATABASE_URL ?? "").replaceAll("\\", "/");
const source = process.env.PARALLAX_A1_SOURCE_SHA ?? "";
const root = path.resolve(process.cwd(), "artifacts", "parallax-a1", "browser", source.slice(0, 12));
const databaseRelative = path.relative(path.resolve(process.cwd(), "artifacts", "sounding-line"), database.slice(5));
if (
  process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1" ||
  !/^[a-f0-9]{40}$/.test(source) ||
  process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
  process.env.OPENAI_API_KEY !== "parallax-a1-synthetic-provider-only" ||
  !/^file:(?:[A-Za-z]:\/|\/)/.test(database) ||
  !/^generic-[a-f0-9]{12}[\\/]validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/.test(databaseRelative) ||
  database.split("/").includes("..")
)
  throw new Error("PARALLAX_A1_DISPOSABLE_SYNTHETIC_PROVIDER_REQUIRED");

const requests = new Map([
  ["What is 5 times 5?", "OUT_OF_SCOPE"],
  [
    "Make the selected map 15% smaller and move it 0.1 meters to the left. Preserve its clue text, height and support.",
    "ROOM_RELATIVE_REPLAY",
  ],
  ["Place a readable old pirate note on a wall near the entrance.", "ROOM_ENTRANCE_REPLAY"],
  ["Group all footprints as Ghost route.", "GROUP_CREATE"],
  ["Group selected footprints as Ghost route.", "GROUP_CREATE"],
  ["Move this group half a meter to the right.", "GROUP_MOVE"],
  ["Create a pirate map on a desk with a readable clue and a guided alternative.", "CREATE"],
  ["Make that pirate map wider, keeping its clue and placement unchanged.", "REFINE"],
  ["Explain an unsupported glowing particle effect.", "UNSUPPORTED"],
  ["Synthetic provider failure for recovery review.", "FAILURE"],
  ["Place a note on the table near the window.", "ROOM_TABLE"],
  ["Place a note on either of the two tables near the window.", "ROOM_CLARIFICATION"],
  ["Synthetic delayed note creation for cancellation review.", "CREATE_CANCEL"],
  [
    "Create a folded pirate letter on the desk beside the window, hidden initially and revealed five seconds after scene entry.",
    "ROOM_LETTER",
  ],
]);
const originalFetch = globalThis.fetch;
let sequence = 0;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (new URL(url).hostname !== "api.openai.com") return originalFetch(input, init);
  // No actual OpenAI traffic is allowed from this instrumented process.
  if (
    !["https://api.openai.com/v1/responses", "https://api.openai.com/v1/responses/input_tokens"].includes(url) ||
    init?.method !== "POST"
  )
    throw new Error("PARALLAX_A1_SYNTHETIC_PROVIDER_ENDPOINT_REQUIRED");
  const body = JSON.parse(init.body);
  if (body.text?.format?.name === "watchglass_room_observation_v1") {
    if (process.env.PARALLAX_ROOM_PHOTO_RUNTIME !== "SYNTHETIC_DEVELOPMENT")
      throw new Error("PARALLAX_ROOM_PHOTO_SYNTHETIC_RUNTIME_REQUIRED");
    const context = JSON.parse(body.input[0].content[0].text);
    if (context.purpose !== "CREATOR_ROOM_RECONSTRUCTION") throw new Error("Unknown synthetic room purpose");
    if (url.endsWith("/input_tokens")) return Response.json({ object: "response.input_tokens", input_tokens: 1500 });
    fs.mkdirSync(root, { recursive: true });
    fs.appendFileSync(
      path.join(root, `provider-${process.pid}.jsonl`),
      JSON.stringify({
        kind: "ROOM_PHOTO",
        sequence: ++sequence,
        model: body.model,
        synthetic: true,
        refinement: Boolean(context.existingRoom),
        sharedFeatureId: context.sharedFeatureId,
      }) + "\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    const desk = {
      matchedFeatureId: context.sharedFeatureId,
      classification: "DESK",
      name: "Writing desk",
      position: { x: context.existingRoom ? 0.5 : 1, y: 0.4, z: -1 },
      dimensions: [1.4, 0.8, 0.8],
      yawDegrees: 0,
      basis: "DIRECTLY_OBSERVED",
      confidence: 0.8,
    };
    const observation = {
      status: "OBSERVED",
      explanation: "Approximate synthetic room with a desk beside a window.",
      clarification: null,
      alignment: context.existingRoom ? "EXISTING_ROOM_FRAME" : "INITIAL_ROOM",
      sharedFeatureId: context.sharedFeatureId,
      roomDimensions: [6, 3, 5],
      dimensionBasis: "ESTIMATED",
      uncertainties: ["Hidden geometry is inferred; dimensions are estimates."],
      features: context.existingRoom
        ? [desk]
        : [
            desk,
            {
              ...desk,
              matchedFeatureId: null,
              classification: "WINDOW",
              name: "Desk window",
              position: { x: 1, y: 1.8, z: -2.5 },
              dimensions: [1.2, 1.1, 0.08],
            },
          ],
    };
    return Response.json({
      id: `synthetic-room-${process.pid}-${sequence}`,
      status: "completed",
      service_tier: "default",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(observation) }] }],
      usage: {
        input_tokens: 1500,
        output_tokens: 450,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    });
  }
  if (url.endsWith("/input_tokens")) {
    if (body.text?.format?.name !== "parallax_spatial_assistant_v1")
      throw new Error("PARALLAX_A1_UNKNOWN_SYNTHETIC_REQUEST");
    return Response.json({ object: "response.input_tokens", input_tokens: 3000 });
  }
  const submitted = JSON.parse(body.input[0].content);
  const kind = requests.get(submitted.creatorRequest);
  if (!kind) throw new Error("PARALLAX_A1_UNKNOWN_SYNTHETIC_REQUEST");
  fs.mkdirSync(root, { recursive: true });
  // Only whitelisted synthetic fixture input; never headers or credentials.
  fs.appendFileSync(
    path.join(root, `provider-${process.pid}.jsonl`),
    JSON.stringify({
      sequence: ++sequence,
      kind,
      model: body.model,
      store: body.store,
      tools: body.tools,
      reasoning: body.reasoning,
      sceneContext: submitted.sceneContext,
    }) + "\n",
  );
  await new Promise((resolve, reject) => {
    const signal = init.signal;
    if (signal?.aborted) return reject(new DOMException("Synthetic request aborted", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Synthetic request aborted", "AbortError"));
    };
    const timer = setTimeout(
      () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      },
      kind === "CREATE_CANCEL" ? 5000 : kind.startsWith("ROOM_") ? 1250 : 750,
    );
    signal?.addEventListener("abort", abort, { once: true });
  });
  if (kind === "FAILURE") return Response.json({ error: { code: "rate_limit_exceeded" } }, { status: 429 });
  const base = {
    intentType: kind === "CREATE" ? "CREATE" : ["REFINE", "ROOM_LETTER"].includes(kind) ? "EDIT" : "UNSUPPORTED",
    summary:
      kind === "CREATE"
        ? "A pirate map for your desk"
        : kind === "REFINE"
          ? "A wider pirate map"
          : "A supported alternative to particles",
    clarification: null,
    operations: [],
    assumptions: [],
    warnings: [],
    accessibilityNotes: ["The map remains readable in Guided view."],
    unsupportedCapabilities: kind === "UNSUPPORTED" ? ["Particle effects are unavailable."] : [],
    creatorExplanation: "Review these supported changes in the real canvas before saving.",
  };
  if (kind === "OUT_OF_SCOPE") {
    base.intentType = "OUT_OF_SCOPE";
    base.summary = "This unrelated model answer must be replaced by the server.";
    base.accessibilityNotes = [];
  }
  if (kind === "ROOM_ENTRANCE_REPLAY") {
    const features = submitted.sceneContext.roomFeatureIndex ?? [];
    for (const classification of ["DOOR", "WINDOW", "WALL", "DESK", "CHAIR"])
      if (
        !features.some((feature) => feature.classification === classification && feature.position && feature.dimensions)
      )
        throw new Error("Complete current Bedroom geometry required");
    const evidence = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "Development_Docs/Projects/Project_Parallax/evidence/assistant-room-placement-20261013.json",
        ),
        "utf8",
      ),
    );
    const retained = evidence.rounds
      .flatMap((round) => round.results)
      .filter((result) => result.caseId === "room-bedroom-entrance" && result.passed && result.interpretation)
      .at(-1);
    if (!retained) throw new Error("Retained public synthetic entrance response required");
    Object.assign(base, structuredClone(retained.interpretation));
    // Test-only transport delay makes actual pending rendering observable.
    await new Promise((resolve) => setTimeout(resolve, 1400));
  }
  if (kind === "ROOM_RELATIVE_REPLAY") {
    const evidence = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "Development_Docs/Projects/Project_Parallax/evidence/assistant-room-placement-20261013.json",
        ),
        "utf8",
      ),
    );
    const retained = evidence.rounds
      .flatMap((round) => round.results)
      .filter((result) => result.caseId === "room-adjust-reference-desk" && result.passed && result.interpretation)
      .at(-1);
    if (!retained || !submitted.sceneContext.selectedEntityId)
      throw new Error("Retained relative edit and current selection required");
    Object.assign(base, structuredClone(retained.interpretation));
    for (const operation of base.operations)
      if ("entityId" in operation) operation.entityId = submitted.sceneContext.selectedEntityId;
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  if (kind === "ROOM_CLARIFICATION") {
    const tables =
      submitted.sceneContext.roomFeatureIndex.filter((feature) => feature.classification === "TABLE") ?? [];
    if (tables.length !== 2) throw new Error("Synthetic clarification requires two tables");
    base.intentType = "CLARIFICATION";
    base.summary = "Choose the intended table";
    base.clarification = `Which table should receive the note: ${tables[0].name} or ${tables[1].name}?`;
    base.creatorExplanation = "Both tables are plausible. Choose a named table before any scene change.";
    base.accessibilityNotes = [];
  }
  if (kind === "ROOM_TABLE" || kind === "CREATE_CANCEL") {
    base.intentType = "CREATE";
    base.summary = "A note on the table near the window";
    base.accessibilityNotes = ["The same note is readable in Guided view."];
    const entityId = kind === "ROOM_TABLE" ? "synthetic-window-note" : "synthetic-cancelled-note";
    base.operations = [
      {
        id: "create-window-note",
        type: "CREATE",
        entityId,
        name: "Folded window note",
        kind: "PARCHMENT",
        content: "Follow the northern harbor bearing.",
        alternativeText: "A readable folded note on the window table.",
        widthMeters: 0.22,
        placement: "DESK",
        position: { x: 0.4, y: 0, z: 0 },
        scale: 1,
        dependsOn: [],
        explanation: "Create the requested readable note for review.",
      },
    ];
    if (kind === "ROOM_TABLE") {
      const features = submitted.sceneContext.roomFeatureIndex ?? [];
      const window = features.find((feature) => feature.classification === "WINDOW");
      const table = features.find((feature) => feature.id === "window-table" && feature.classification === "TABLE");
      if (!window || !table) throw new Error("Synthetic table request requires the window table and window");
      base.operations.push({
        id: "place-window-note",
        type: "ROOM_PLACEMENT",
        entityId,
        classification: "TABLE",
        targetFeatureId: table.id,
        nearFeatureId: window.id,
        dependsOn: ["create-window-note"],
        explanation: "Use Window table, the table nearest Room window, and its clear usable top face.",
      });
    }
  }
  if (kind === "ROOM_LETTER") {
    const features = submitted.sceneContext.roomFeatureIndex ?? [];
    const desk = features.find((feature) => feature.classification === "DESK");
    const window = features.find((feature) => feature.classification === "WINDOW");
    if (!desk || !window) throw new Error("Synthetic room letter requires desk and window");
    const entityId = "synthetic-folded-pirate-letter";
    base.intentType = "CREATE";
    base.summary = "A hidden pirate letter beside the window";
    base.accessibilityNotes = ["The same letter remains readable in Guided view."];
    base.operations = [
      {
        id: "room-letter-content",
        type: "CREATE",
        entityId,
        name: "Folded pirate letter",
        kind: "PARCHMENT",
        content: "Follow the northern harbor bearing.",
        alternativeText: "A pirate letter on the writing desk beside the window, revealed after five seconds.",
        widthMeters: 0.3,
        placement: "DESK",
        position: { x: 0.4, y: 0, z: 0 },
        scale: 1,
        dependsOn: [],
        explanation: "Create the requested letter while preserving existing objects.",
      },
      {
        id: "room-letter-placement",
        type: "ROOM_PLACEMENT",
        entityId,
        classification: "DESK",
        targetFeatureId: desk.id,
        nearFeatureId: window.id,
        dependsOn: ["room-letter-content"],
        explanation: "Use the room's actual desk beside its window.",
      },
      {
        id: "room-letter-hidden",
        type: "VISIBILITY",
        entityId,
        visible: false,
        dependsOn: ["room-letter-placement"],
        explanation: "Keep the letter hidden in the initial scene state.",
      },
      {
        id: "room-letter-reveal",
        type: "BEHAVIOR",
        behaviorId: "room-letter-timed-reveal",
        trigger: "SCENE_ENTER",
        sourceEntityId: null,
        targetEntityId: entityId,
        delayMs: 5000,
        action: "SHOW",
        dependsOn: ["room-letter-hidden"],
        explanation: "Reveal that same letter five seconds after entering the scene.",
      },
    ];
  }
  if (kind === "CREATE")
    base.operations = [
      {
        id: "synthetic-create-map",
        type: "CREATE",
        entityId: "synthetic-pirate-map",
        name: "Pirate map",
        kind: "PARCHMENT",
        content: "Follow the northern harbor bearing.",
        alternativeText: "A readable pirate map pointing toward the northern harbor.",
        widthMeters: 0.3,
        placement: "DESK",
        position: { x: 0.4, y: 0, z: 0 },
        scale: 1,
        dependsOn: [],
        explanation: "Add a readable map on the desk.",
      },
      {
        id: "synthetic-guided-map",
        type: "FALLBACK",
        narrative: "Read the pirate map: follow the northern harbor bearing.",
        dependsOn: ["synthetic-create-map"],
        explanation: "Preserve the same clue without a spatial display.",
      },
    ];
  if (kind === "REFINE") {
    if (!submitted.sceneContext.entities.some((entity) => entity.id === "synthetic-pirate-map"))
      throw new Error("PARALLAX_A1_CURRENT_MAP_CONTEXT_REQUIRED");
    base.operations = [
      {
        id: "synthetic-widen-map",
        type: "CONTENT",
        entityId: "synthetic-pirate-map",
        name: null,
        content: null,
        alternativeText: null,
        widthMeters: 0.45,
        interactions: null,
        dependsOn: [],
        explanation: "Widen only the existing pirate map; preserve its clue and placement.",
      },
    ];
  }
  if (kind === "GROUP_CREATE" || kind === "GROUP_MOVE") {
    base.intentType = "EDIT";
    base.summary = kind === "GROUP_CREATE" ? "Group the footprint route" : "Move the route together";
    base.operations =
      kind === "GROUP_CREATE"
        ? [
            {
              id: "synthetic-group-create",
              type: "GROUP_CREATE",
              groupId: "assistant-ghost-route",
              name: "Ghost route",
              members: submitted.creatorRequest.includes("selected")
                ? submitted.sceneContext.selectedMembers
                : submitted.sceneContext.assetIndex.map((entity) => ({ kind: "ASSET", id: entity.id })),
              dependsOn: [],
              explanation: "Keep every footprint and its current pose in a named group.",
            },
          ]
        : [
            {
              id: "synthetic-group-move",
              type: "GROUP_TRANSFORM",
              groupId: submitted.sceneContext.selectedGroupId,
              translation: { x: 0.5, y: 0, z: 0 },
              yawDegrees: 0,
              scale: 1,
              dependsOn: [],
              explanation: "Move the saved group half a meter without changing its internal spacing.",
            },
          ];
  }
  if (submitted.sceneContext.room && submitted.sceneContext.placementPolicy === "FIXED") {
    for (const create of base.operations.filter((operation) => operation.type === "CREATE")) {
      if (
        base.operations.some(
          (operation) => operation.type === "ROOM_PLACEMENT" && operation.entityId === create.entityId,
        )
      )
        continue;
      const features = submitted.sceneContext.roomFeatureIndex ?? [];
      const support = features.find(
        (feature) => feature.classification === (create.placement === "WALL" ? "WALL" : "DESK"),
      );
      if (!support) throw new Error("Synthetic create requires an existing support");
      base.operations.push({
        id: `synthetic-support-${create.id}`,
        type: "ROOM_PLACEMENT",
        entityId: create.entityId,
        classification: support.classification,
        targetFeatureId: support.id,
        nearFeatureId: null,
        explanation: "Use the supplied current room support.",
        dependsOn: [create.id],
      });
    }
  }
  return Response.json({
    id: `synthetic-response-${process.pid}-${sequence}`,
    status: "completed",
    service_tier: "default",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(base) }] }],
    usage: {
      input_tokens: 500,
      output_tokens: 200,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  });
};
