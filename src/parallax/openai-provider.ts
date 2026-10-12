import { z } from "zod";
import { assistantInterpretationSchema, assistantOperationSchema, SpatialAssistantError } from "./spatial-assistant";
import { aiUsageSchema, aiModelIds, type AIGlobalPolicy, type AIModelId, type AIUsage } from "./ai-policy";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export { conciseAssistantInstructions as assistantSystemInstructions } from "./assistant-instructions";
import { conciseAssistantInstructions as assistantSystemInstructions } from "./assistant-instructions";
import { roomAssistantInstructions } from "./assistant-instructions";

export function openAIProviderConfiguration(policy: AIGlobalPolicy) {
  const configured = Boolean(process.env.OPENAI_API_KEY?.trim());
  return {
    provider: "OPENAI" as const,
    configured,
    enabled: policy.enabled,
    status: !configured ? ("UNCONFIGURED" as const) : !policy.enabled ? ("DISABLED" as const) : ("READY" as const),
    standardModel: policy.standardModel,
    advancedModel: policy.advancedModel,
    allowedModels: policy.allowedModels,
    standardReasoning: policy.standardReasoning,
    advancedReasoning: policy.advancedReasoning,
    maximumInputTokens: policy.maximumInputTokens,
    maximumOutputTokens: policy.maximumOutputTokens,
    timeoutMs: policy.timeoutMs,
    allowedTools: [] as never[],
    advancedEnabled: policy.advancedEnabled,
    legacyConfigured: Boolean(process.env.PARALLAX_AUTHORING_AI_URL && process.env.PARALLAX_AUTHORING_AI_TOKEN),
  };
}

export class OpenAIProviderError extends SpatialAssistantError {
  constructor(
    code: string,
    message: string,
    public readonly definitelyUnbilled = false,
    status = 503,
  ) {
    super(code, message, status);
  }
}
type Outcome = {
  responseId: string;
  usage: AIUsage | null;
  interpretation: unknown | null;
  failure: { code: string; message: string } | null;
};
const providerEnvelope = z.object({
  id: z.string().min(1).max(200),
  status: z.string(),
  service_tier: z.string().optional(),
  output: z
    .array(
      z.object({
        type: z.string(),
        content: z
          .array(z.object({ type: z.string(), text: z.string().optional(), refusal: z.string().optional() }))
          .optional(),
      }),
    )
    .max(64),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
      input_tokens_details: z
        .object({
          cached_tokens: z.number().int().nonnegative().optional(),
          cache_write_tokens: z.number().int().nonnegative().optional(),
        })
        .optional(),
      output_tokens_details: z.object({ reasoning_tokens: z.number().int().nonnegative().optional() }).optional(),
    })
    .nullable()
    .optional(),
});
export function extractOpenAIResponse(raw: unknown): Outcome {
  const parsed = providerEnvelope.safeParse(raw);
  if (!parsed.success)
    throw new OpenAIProviderError(
      "INVALID_PROVIDER_ENVELOPE",
      "The provider returned an invalid response. Your scene is unchanged.",
    );
  const body = parsed.data;
  const reported = body.usage
    ? aiUsageSchema.safeParse({
        inputTokens: body.usage.input_tokens,
        cachedInputTokens: body.usage.input_tokens_details?.cached_tokens ?? 0,
        cacheWriteTokens: body.usage.input_tokens_details?.cache_write_tokens ?? 0,
        outputTokens: body.usage.output_tokens,
        reasoningTokens: body.usage.output_tokens_details?.reasoning_tokens ?? 0,
      })
    : null;
  const usage = reported?.success ? reported.data : null;
  const base = { responseId: body.id, usage, interpretation: null };
  if (body.service_tier && body.service_tier !== "default")
    return {
      ...base,
      usage: null,
      failure: {
        code: "UNEXPECTED_SERVICE_TIER",
        message: "Provider billing requires reconciliation before more assistance.",
      },
    };
  if (body.status !== "completed")
    return {
      ...base,
      failure: {
        code: "INCOMPLETE_OUTPUT",
        message: "The provider could not finish this proposal. Your scene is unchanged.",
      },
    };
  const content = body.output.flatMap((item) => item.content ?? []);
  if (content.some((item) => item.type === "refusal"))
    return {
      ...base,
      failure: {
        code: "PROVIDER_REFUSAL",
        message: "The provider couldn't help with that request. Try describing a supported scene change.",
      },
    };
  if (body.output.some((item) => item.type !== "message" && item.type !== "reasoning"))
    return {
      ...base,
      failure: {
        code: "FORBIDDEN_PROVIDER_TOOL",
        message: "The provider attempted an unsupported operation. Your scene is unchanged.",
      },
    };
  const texts = content.filter((item) => item.type === "output_text" && typeof item.text === "string");
  if (texts.length !== 1)
    return {
      ...base,
      failure: {
        code: "INVALID_STRUCTURED_OUTPUT",
        message: "The provider returned an invalid proposal. Your scene is unchanged.",
      },
    };
  try {
    const interpretation = assistantInterpretationSchema.parse(JSON.parse(texts[0].text!));
    return { responseId: body.id, usage, interpretation, failure: null };
  } catch {
    return {
      ...base,
      failure: {
        code: "INVALID_STRUCTURED_OUTPUT",
        message: "The provider returned an invalid proposal. Your scene is unchanged.",
      },
    };
  }
}

export function buildOpenAIRequest(input: {
  request: string;
  context: unknown;
  mode: "STANDARD" | "ADVANCED";
  model: AIModelId;
  policy: AIGlobalPolicy;
}) {
  if (!aiModelIds.includes(input.model) || !input.policy.allowedModels.includes(input.model))
    throw new OpenAIProviderError("MODEL_UNAVAILABLE", "The selected assistance model is unavailable.", true);
  const hasRoom =
    typeof input.context === "object" &&
    input.context !== null &&
    "room" in input.context &&
    "placementPolicy" in input.context &&
    input.context.placementPolicy === "FIXED";
  // Send only operations the current scene can use. Keep the canonical response validator complete.
  const options = assistantOperationSchema.options.filter((option) =>
    hasRoom ? option.shape.type.value !== "SEMANTIC_PLACEMENT" : option.shape.type.value !== "ROOM_PLACEMENT",
  );
  const responseSchema = assistantInterpretationSchema.extend({
    operations: z
      .array(z.discriminatedUnion("type", options as [(typeof options)[number], ...(typeof options)[number][]]))
      .max(24),
  });
  const body = {
    model: input.model,
    instructions: hasRoom ? roomAssistantInstructions : assistantSystemInstructions,
    input: [{ role: "user", content: JSON.stringify({ creatorRequest: input.request, sceneContext: input.context }) }],
    reasoning: { effort: input.mode === "ADVANCED" ? input.policy.advancedReasoning : input.policy.standardReasoning },
    text: {
      format: {
        type: "json_schema",
        name: "parallax_spatial_assistant_v1",
        strict: true,
        schema: z.toJSONSchema(responseSchema, { reused: "ref" }),
      },
    },
    max_output_tokens: input.policy.maximumOutputTokens,
    service_tier: "default",
    store: false,
    tools: [],
  };
  // UTF-8 bytes conservatively bound text BPE tokens, including schema and instruction bytes.
  // Retain headroom for framing tokens. No clipping of meaningful Creator requests.
  const conservativeInputTokens = Buffer.byteLength(JSON.stringify(body), "utf8") + 256;
  if (conservativeInputTokens > input.policy.maximumInputTokens)
    throw new OpenAIProviderError(
      "CONTEXT_TOO_LARGE",
      "This request needs less scene context or a higher administrator-configured input allowance.",
      true,
      413,
    );
  return body;
}
async function boundedResponseText(response: Response, maximumBytes: number) {
  if (!response.body)
    throw new OpenAIProviderError("EMPTY_PROVIDER_RESPONSE", "The provider returned an empty response.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new OpenAIProviderError("PROVIDER_RESPONSE_SIZE", "The provider response exceeded its safe size.");
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function classifyOpenAIRateFailure(response: Response) {
  try {
    const raw = JSON.parse(await boundedResponseText(response, 8192));
    const error = z
      .object({ error: z.object({ code: z.string().max(100).nullish(), type: z.string().max(100).nullish() }) })
      .parse(raw).error;
    // Only known code/type identities escape this boundary. Never return the
    // provider message, param, headers or other upstream body data.
    if (
      [
        "credit_balance_exhausted",
        "organization_spend_limit_exceeded",
        "project_spend_limit_exceeded",
        "organization_usage_limit_exceeded",
        "usage_limit_exceeded",
        "insufficient_quota",
      ].includes(error.code ?? "") ||
      error.type === "insufficient_quota"
    )
      return "PROVIDER_QUOTA_EXHAUSTED";
    if (["slow_down", "rate_limit_exceeded"].includes(error.code ?? "") || error.type === "rate_limit_error")
      return "PROVIDER_RATE_LIMITED";
  } catch {
    /* Ambiguous or oversized 429 bodies remain a safe generic finding. */
  }
  return "PROVIDER_QUOTA_OR_RATE";
}

/** Fixed upstream, server credential, no external tools, no redirects and no automatic paid retry. */
export async function invokeOpenAISpatialAssistant(
  body: ReturnType<typeof buildOpenAIRequest>,
  timeoutMs: number,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Outcome> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key)
    throw new OpenAIProviderError(
      "PROVIDER_UNCONFIGURED",
      "Spatial Assistant is not configured. Manual editing remains available.",
      true,
    );
  const timeout = AbortSignal.timeout(timeoutMs),
    combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetcher(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      redirect: "error",
      signal: combined,
    });
    if (!response.ok) {
      const code =
        response.status === 429
          ? await classifyOpenAIRateFailure(response)
          : response.status === 401 || response.status === 403
            ? "PROVIDER_AUTHENTICATION"
            : response.status === 404
              ? "MODEL_UNAVAILABLE"
              : response.status >= 500
                ? "PROVIDER_UNAVAILABLE"
                : "PROVIDER_REQUEST_REJECTED";
      await response.body?.cancel();
      throw new OpenAIProviderError(
        code,
        "Spatial Assistant can't prepare a proposal right now. Your scene is unchanged.",
        [400, 401, 403, 404, 405, 410, 413, 415, 422, 429].includes(response.status),
      );
    }
    const text = await boundedResponseText(response, 128 * 1024);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new OpenAIProviderError(
        "INVALID_PROVIDER_ENVELOPE",
        "The provider returned unreadable data. Your scene is unchanged.",
      );
    }
    return extractOpenAIResponse(raw);
  } catch (cause) {
    if (cause instanceof OpenAIProviderError) throw cause;
    if (signal?.aborted)
      throw new OpenAIProviderError("REQUEST_CANCELLED", "Assistance was cancelled. Your scene is unchanged.");
    if (timeout.aborted)
      throw new OpenAIProviderError("UPSTREAM_TIMEOUT", "Spatial Assistant took too long. Your scene is unchanged.");
    throw new OpenAIProviderError(
      "PROVIDER_UNAVAILABLE",
      "Spatial Assistant can't connect right now. Your scene is unchanged.",
    );
  }
}
