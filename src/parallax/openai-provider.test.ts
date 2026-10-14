// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpatialDraft } from "./authoring";
import { prepareAssistantContext } from "./spatial-assistant";
import { enableAdaptiveAuthoring } from "./adaptive-authoring";
import { insertSpatialPreset } from "./editor-assets";
import { defaultAIGlobalPolicy } from "./ai-policy";
import {
  OPENAI_RESPONSES_URL,
  buildOpenAIRequest,
  prepareOpenAIRequest,
  extractOpenAIResponse,
  invokeOpenAISpatialAssistant,
  openAIProviderConfiguration,
  countOpenAIInputTokens,
} from "./openai-provider";
const interpretation = {
  intentType: "CLARIFICATION",
  summary: "Choose the object",
  clarification: "Which object should move?",
  operations: [],
  assumptions: [],
  unsupportedCapabilities: [],
  warnings: [],
  accessibilityNotes: [],
  creatorExplanation: "I need a specific object before preparing a change.",
};
const response = (rest: Record<string, unknown> = {}) => ({
  id: "synthetic-response",
  status: "completed",
  service_tier: "default",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(interpretation) }] }],
  usage: {
    input_tokens: 100,
    output_tokens: 80,
    input_tokens_details: { cached_tokens: 20 },
    output_tokens_details: { reasoning_tokens: 30 },
  },
  ...rest,
});
const request = () =>
  buildOpenAIRequest({
    request: "Move the selected map toward the left",
    context: prepareAssistantContext(createSpatialDraft("synthetic-a1"), "synthetic-a1:entity-0"),
    mode: "STANDARD",
    model: "gpt-6-luna",
    policy: { ...defaultAIGlobalPolicy, enabled: true, maximumInputTokens: 32000 },
  });
afterEach(() => vi.unstubAllEnvs());
describe("OpenAI Responses strict, bounded and credential-safe provider", () => {
  it("replaces an out-of-scope answer and every proposed edit with the server-owned Studio redirect", () => {
    const raw = {
      ...interpretation,
      intentType: "OUT_OF_SCOPE",
      summary: "Unrelated advice must not reach the chat",
      clarification: "Unrelated follow-up",
      operations: [
        {
          type: "VISIBILITY",
          id: "hide",
          explanation: "Unrelated edit",
          dependsOn: [],
          entityId: "synthetic-entity",
          visible: false,
        },
      ],
      warnings: ["Unrelated warning"],
    };
    const result = extractOpenAIResponse(
      response({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(raw) }] }] }),
    );
    expect(result.failure).toBeNull();
    expect(result.usage).toMatchObject({ inputTokens: 100, outputTokens: 80 });
    expect(result.interpretation).toMatchObject({
      intentType: "UNSUPPORTED",
      clarification: null,
      operations: [],
      warnings: [],
      summary: expect.stringContaining("build and edit your spatial scene"),
    });
    expect(JSON.stringify(result.interpretation)).not.toContain("Unrelated");
  });
  it("includes explicit task scope and affirmative proposal wording without changing existing authoring intents", () => {
    const body = request();
    expect(body.instructions).toContain("Unrelated arithmetic");
    expect(body.instructions).toContain("fictional clue, riddle or narrative");
    expect(body.instructions).toContain("'I'll', not 'I'd'");
    const schema = JSON.stringify(body.text.format.schema);
    expect(schema).toContain("OUT_OF_SCOPE");
    expect(schema).toContain("CREATE");
    expect(extractOpenAIResponse(response()).interpretation).toEqual(interpretation);
  });
  it("applies scope normalization through the actual provider transport", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        response({
          output: [
            {
              type: "message",
              content: [
                { type: "output_text", text: JSON.stringify({ ...interpretation, intentType: "OUT_OF_SCOPE" }) },
              ],
            },
          ],
        }),
      ),
    );
    const result = await invokeOpenAISpatialAssistant(request(), 10000, undefined, fetcher);
    expect(result.failure).toBeNull();
    expect(result.interpretation).toMatchObject({ intentType: "UNSUPPORTED", operations: [], clarification: null });
  });
  it("counts exact multimodal input through the same safe transport before generation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ object: "response.input_tokens", input_tokens: 1234 }),
    );
    const body = {
      ...request(),
      input: [
        {
          role: "user",
          content: [{ type: "input_image", image_url: "data:image/webp;base64,c3ludGhldGlj", detail: "high" }],
        },
      ],
    };
    expect(await countOpenAIInputTokens(body, 20000, undefined, fetcher)).toBe(1234);
    expect(fetcher.mock.calls[0][0]).toBe(`${OPENAI_RESPONSES_URL}/input_tokens`);
    const sent = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
    expect(sent.input).toEqual(body.input);
    expect(sent.text).toEqual(body.text);
    expect(sent).not.toHaveProperty("store");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("fails closed when image counting is unavailable without exposing upstream details", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ secret: "PRIVATE_COUNT_DETAIL" }));
    await expect(countOpenAIInputTokens(request(), 20000, undefined, fetcher)).rejects.toMatchObject({
      code: "INPUT_COUNT_UNAVAILABLE",
      definitelyUnbilled: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    "credit_balance_exhausted",
    "project_spend_limit_exceeded",
    "organization_spend_limit_exceeded",
    "organization_usage_limit_exceeded",
  ])("distinguishes upstream %s from local quotas without revealing error messages", async (code) => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code, type: "insufficient_quota", message: "PRIVATE_BILLING_DETAIL" } },
        { status: 429 },
      ),
    );
    await expect(invokeOpenAISpatialAssistant(request(), 20000, undefined, fetcher)).rejects.toMatchObject({
      code: "PROVIDER_QUOTA_EXHAUSTED",
      definitelyUnbilled: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("distinguishes rate limits and conservatively accounts an upstream HTTP timeout", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const rate = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { code: "slow_down", type: "rate_limit_error" } }, { status: 429 }),
    );
    await expect(invokeOpenAISpatialAssistant(request(), 20000, undefined, rate)).rejects.toMatchObject({
      code: "PROVIDER_RATE_LIMITED",
      definitelyUnbilled: true,
    });
    const timeout = vi.fn<typeof fetch>(async () => new Response("PRIVATE_TIMEOUT_DETAIL", { status: 408 }));
    await expect(invokeOpenAISpatialAssistant(request(), 20000, undefined, timeout)).rejects.toMatchObject({
      definitelyUnbilled: false,
    });
  });
  it("uses only the shared process credential and treats whitespace as absent", async () => {
    vi.stubEnv("OPENAI_API_KEY", "   ");
    vi.stubEnv("PARALLAX_OPENAI_API_KEY", "synthetic-obsolete-key");
    const fetcher = vi.fn();
    expect(openAIProviderConfiguration(defaultAIGlobalPolicy).configured).toBe(false);
    await expect(invokeOpenAISpatialAssistant(request(), 20000, undefined, fetcher)).rejects.toMatchObject({
      code: "PROVIDER_UNCONFIGURED",
      definitelyUnbilled: true,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reads the inherited credential at dispatch without caching it or putting it in request data", async () => {
    const body = request();
    vi.stubEnv("OPENAI_API_KEY", "synthetic-shared-one");
    expect(openAIProviderConfiguration(defaultAIGlobalPolicy).configured).toBe(true);
    vi.stubEnv("OPENAI_API_KEY", "synthetic-shared-two");
    const fetcher = vi.fn(async () => new Response(JSON.stringify(response())));
    await invokeOpenAISpatialAssistant(body, 20000, undefined, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      OPENAI_RESPONSES_URL,
      expect.objectContaining({
        headers: { "Content-Type": "application/json", Authorization: "Bearer synthetic-shared-two" },
      }),
    );
    expect(JSON.stringify(body)).not.toContain("synthetic-shared");
    expect(JSON.stringify(openAIProviderConfiguration(defaultAIGlobalPolicy))).not.toContain("synthetic-shared");
  });
  it("constructs the documented Responses format with no tools, storage or model escalation", () => {
    const body = request();
    expect(body.model).toBe("gpt-6-luna");
    expect(body.reasoning.effort).toBe("low");
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(body.text.format.schema.additionalProperties).toBe(false);
    expect(body.text.format.schema).toHaveProperty("$defs");
    expect(body.tools).toEqual([]);
    expect(body.store).toBe(false);
    expect(body.service_tier).toBe("default");
    expect(JSON.stringify(body)).not.toContain("Follow the compass rose");
  });
  it("counts expanded group-capable context before dispatch under the unchanged default allowance", async () => {
    let draft = enableAdaptiveAuthoring(createSpatialDraft("synthetic-context"));
    for (let i = 1; i < 8; i++) draft = insertSpatialPreset(draft, "Desk Map", `synthetic-${i}`);
    const context = prepareAssistantContext(draft, draft.content.entities[0].id);
    expect(context.entities).toHaveLength(4);
    expect(context.totalEntities).toBe(8);
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ object: "response.input_tokens", input_tokens: 4000 }),
    );
    const input = {
      request: "Place the selected map on a desk near the entrance.",
      context,
      mode: "STANDARD" as const,
      model: "gpt-6-luna" as const,
      policy: defaultAIGlobalPolicy,
    };
    const body = await prepareOpenAIRequest(input, undefined, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`${OPENAI_RESPONSES_URL}/input_tokens`);
    const oversized = vi.fn<typeof fetch>(async () =>
      Response.json({ object: "response.input_tokens", input_tokens: defaultAIGlobalPolicy.maximumInputTokens }),
    );
    await expect(prepareOpenAIRequest(input, undefined, oversized)).rejects.toMatchObject({
      code: "CONTEXT_TOO_LARGE",
      definitelyUnbilled: true,
    });
    expect(JSON.stringify(body)).not.toContain("Follow the compass rose");
  });
  it("rejects oversized context and arbitrary model identifiers before dispatch", () => {
    expect(() =>
      buildOpenAIRequest({
        request: "x".repeat(20000),
        context: {},
        mode: "STANDARD",
        model: "gpt-6-luna",
        policy: defaultAIGlobalPolicy,
      }),
    ).toThrow(/less scene context/);
    expect(() =>
      buildOpenAIRequest({
        request: "Move it",
        context: {},
        mode: "STANDARD",
        model: "other" as "gpt-6-luna",
        policy: defaultAIGlobalPolicy,
      }),
    ).toThrow(/unavailable/);
  });
  it("extracts structured proposal and usage, including reasoning as output subset", () => {
    const result = extractOpenAIResponse(response());
    expect(result.interpretation).toEqual(interpretation);
    expect(result.failure).toBeNull();
    expect(result.usage).toMatchObject({
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 80,
      reasoningTokens: 30,
    });
  });
  it.each(["incomplete", "cancelled", "failed"])("rejects %s output while preserving defensible usage", (status) => {
    const result = extractOpenAIResponse(response({ status }));
    expect(result.interpretation).toBeNull();
    expect(result.failure?.code).toBe("INCOMPLETE_OUTPUT");
    expect(result.usage?.outputTokens).toBe(80);
  });
  it("handles refusal without rendering untrusted provider messages", () => {
    const result = extractOpenAIResponse(
      response({ output: [{ type: "message", content: [{ type: "refusal", refusal: "PRIVATE_UNTRUSTED_REASON" }] }] }),
    );
    expect(result.failure?.code).toBe("PROVIDER_REFUSAL");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_UNTRUSTED_REASON");
  });
  it("rejects malformed JSON and unexpected executable output but retains usage", () => {
    const malformed = extractOpenAIResponse(
      response({ output: [{ type: "message", content: [{ type: "output_text", text: "{broken" }] }] }),
    );
    expect(malformed.failure?.code).toBe("INVALID_STRUCTURED_OUTPUT");
    expect(malformed.usage?.outputTokens).toBe(80);
    const tool = extractOpenAIResponse(
      response({ output: [{ type: "function_call", name: "execute_js", arguments: "untrusted" }] }),
    );
    expect(tool.failure?.code).toBe("FORBIDDEN_PROVIDER_TOOL");
  });
  it("keeps missing/inconsistent usage and unexpected pricing tiers unsettled", () => {
    expect(extractOpenAIResponse(response({ usage: null })).usage).toBeNull();
    expect(
      extractOpenAIResponse(
        response({ usage: { input_tokens: 10, output_tokens: 1, input_tokens_details: { cached_tokens: 11 } } }),
      ).usage,
    ).toBeNull();
    const result = extractOpenAIResponse(response({ service_tier: "priority" }));
    expect(result.usage).toBeNull();
    expect(result.failure?.code).toBe("UNEXPECTED_SERVICE_TIER");
  });
  it("reports missing credentials without calling the upstream", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetcher = vi.fn();
    await expect(invokeOpenAISpatialAssistant(request(), 20000, undefined, fetcher)).rejects.toMatchObject({
      code: "PROVIDER_UNCONFIGURED",
      definitelyUnbilled: true,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(openAIProviderConfiguration(defaultAIGlobalPolicy).configured).toBe(false);
  });
  it("uses only the fixed HTTPS endpoint, server key and no redirects", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-server-key");
    const fetcher = vi.fn(async () => new Response(JSON.stringify(response()), { status: 200 }));
    await invokeOpenAISpatialAssistant(request(), 20000, undefined, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      OPENAI_RESPONSES_URL,
      expect.objectContaining({
        redirect: "error",
        headers: { "Content-Type": "application/json", Authorization: "Bearer synthetic-server-key" },
      }),
    );
    expect(JSON.stringify(openAIProviderConfiguration(defaultAIGlobalPolicy))).not.toContain("synthetic-server-key");
  });
  it.each([
    [401, "PROVIDER_AUTHENTICATION", true],
    [404, "MODEL_UNAVAILABLE", true],
    [429, "PROVIDER_QUOTA_OR_RATE", true],
    [503, "PROVIDER_UNAVAILABLE", false],
  ])("classifies HTTP %s without raw error leakage or automatic retries", async (status, code, definitelyUnbilled) => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const fetcher = vi.fn(async () => new Response("PRIVATE_UPSTREAM_ERROR", { status: status as number }));
    await expect(invokeOpenAISpatialAssistant(request(), 20000, undefined, fetcher)).rejects.toMatchObject({
      code,
      definitelyUnbilled,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bounds response bytes and preserves conservative failure classification", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const fetcher = vi.fn(async () => new Response("x".repeat(128 * 1024 + 1)));
    await expect(invokeOpenAISpatialAssistant(request(), 20000, undefined, fetcher)).rejects.toMatchObject({
      code: "PROVIDER_RESPONSE_SIZE",
      definitelyUnbilled: false,
    });
  });
  it("cancels safely without assuming accepted work cost nothing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
    const controller = new AbortController();
    const fetcher = vi.fn(async () => {
      controller.abort();
      throw new Error("aborted");
    });
    await expect(invokeOpenAISpatialAssistant(request(), 20000, controller.signal, fetcher)).rejects.toMatchObject({
      code: "REQUEST_CANCELLED",
      definitelyUnbilled: false,
    });
  });
});
