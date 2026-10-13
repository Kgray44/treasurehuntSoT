// Explicit owner-authorized, task-owned development only. No automatic retries.
import { appendFileSync, readFileSync, existsSync, writeFileSync } from "node:fs";
const live = process.env.PARALLAX_ROOM_PHOTO_RUNTIME === "OWNER_AUTHORIZED_LIVE_DEVELOPMENT";
if (
  !live ||
  process.env.NODE_ENV !== "development" ||
  !process.env.DATABASE_URL?.includes("/artifacts/sounding-line/generic-")
)
  throw new Error("Owned authorized photo runtime required");
const guard = JSON.parse(readFileSync(process.env.PARALLAX_ROOM_PHOTO_GUARD, "utf8"));
const original = globalThis.fetch;
let calls = 0,
  exposureNano = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === "https://api.openai.com/v1/responses") {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (
      body.model !== guard.model ||
      body.service_tier !== "default" ||
      body.store !== false ||
      body.tools?.length !== 0 ||
      body.max_output_tokens > 8000
    )
      throw new Error("Owner photo call does not match authorized limits");
    const previous = existsSync(guard.dispatchFile)
      ? readFileSync(guard.dispatchFile, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .filter((item) => item.event === "DISPATCH_RESERVED")
      : [];
    calls = previous.length;
    exposureNano = previous.reduce((sum, item) => sum + item.reservedNano, 0);
    if (!Number.isSafeInteger(exposureNano)) throw new Error("Invalid preserved dispatch accounting");
    const exposure = body.model === "gpt-6-luna" ? 6700000 : 134000000;
    if (calls >= guard.maxCalls || exposureNano + exposure > guard.budgetNano)
      throw new Error("Owner photo budget or call ceiling reached");
    calls++;
    exposureNano += exposure;
    appendFileSync(
      guard.dispatchFile,
      JSON.stringify({
        event: "DISPATCH_RESERVED",
        call: calls,
        model: body.model,
        exposureNano,
        reservedNano: exposure,
        utc: new Date().toISOString(),
      }) + "\n",
    );
    try {
      const response = await original(input, init);
      const result = await response.clone().json();
      // Owner-derived observations stay only in ignored private task artifacts, never in source or raw request logs.
      const text = result.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text")?.text;
      if (text) writeFileSync(`${guard.dispatchFile}.call-${calls}.observation.json`, text);
      appendFileSync(
        guard.dispatchFile,
        JSON.stringify({
          event: "RESPONSE",
          call: calls,
          status: response.status,
          usage: result.usage ?? null,
          utc: new Date().toISOString(),
        }) + "\n",
      );
      return response;
    } catch (error) {
      appendFileSync(
        guard.dispatchFile,
        JSON.stringify({ event: "UNKNOWN_OUTCOME", call: calls, utc: new Date().toISOString() }) + "\n",
      );
      throw error;
    }
  }
  return original(input, init);
};
