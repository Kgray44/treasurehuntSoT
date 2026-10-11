import fs from "node:fs";
import path from "node:path";

// Explicit, disposable browser instrumentation. Never loaded by application code.
const database = (process.env.DATABASE_URL ?? "").replaceAll("\\", "/");
const root = path.resolve(process.cwd(), "artifacts", "parallax-a1", "browser");
const databaseRelative = path.relative(path.resolve(process.cwd(), "artifacts", "sounding-line"), database.slice(5));
if (
  process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1" ||
  process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
  process.env.OPENAI_API_KEY !== "parallax-a1-synthetic-provider-only" ||
  !/^file:(?:[A-Za-z]:\/|\/)/.test(database) ||
  !/^generic-[a-f0-9]{12}[\\/]validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/.test(databaseRelative) ||
  database.split("/").includes("..")
)
  throw new Error("PARALLAX_A1_DISPOSABLE_SYNTHETIC_PROVIDER_REQUIRED");

const requests = new Map([
  ["Create a pirate map on a desk with a readable clue and a guided alternative.", "CREATE"],
  ["Make that pirate map wider, keeping its clue and placement unchanged.", "REFINE"],
  ["Explain an unsupported glowing particle effect.", "UNSUPPORTED"],
  ["Synthetic provider failure for recovery review.", "FAILURE"],
]);
const originalFetch = globalThis.fetch;
let sequence = 0;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (new URL(url).hostname !== "api.openai.com") return originalFetch(input, init);
  // No actual OpenAI traffic is allowed from this instrumented process.
  if (url !== "https://api.openai.com/v1/responses" || init?.method !== "POST")
    throw new Error("PARALLAX_A1_SYNTHETIC_PROVIDER_ENDPOINT_REQUIRED");
  const body = JSON.parse(init.body);
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
  await new Promise((resolve) => setTimeout(resolve, 750));
  if (kind === "FAILURE") return Response.json({ error: { code: "rate_limit_exceeded" } }, { status: 429 });
  const base = {
    intentType: kind === "CREATE" ? "CREATE" : kind === "REFINE" ? "EDIT" : "UNSUPPORTED",
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
