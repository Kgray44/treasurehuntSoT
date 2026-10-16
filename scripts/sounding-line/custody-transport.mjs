// Bounded transport recovery inside one logical custody invocation. Never retry writes.
import { setTimeout as delay } from "node:timers/promises";

export const CUSTODY_TRANSPORT_POLICY = Object.freeze({
  readAttempts: 2,
  readRetriesPerInvocation: 2,
  requestTimeoutMs: 20000,
  readRetryDelayMs: 250,
});
const transientStatus = new Set([408, 500, 502, 503, 504]);
const fail = (code) => new Error(`PRODUCT_EXPERIENCE_EXCEPTION_${code}`);
const diagnostic = (value) => process.stderr.write(JSON.stringify(value) + "\n");
const reason = (error) => {
  const code = error?.cause?.code ?? error?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,80}$/u.test(code) ? code : "TRANSPORT_OR_BODY_FAILURE";
};

export function createCustodyRequest({
  repository,
  token,
  fetchImpl = globalThis.fetch,
  wait = delay,
  report = diagnostic,
}) {
  if (!token) throw fail("AUTHENTICATED_CUSTODY_REQUIRED");
  let remainingReadRetries = CUSTODY_TRANSPORT_POLICY.readRetriesPerInvocation;
  return async (endpoint, method = "GET", body) => {
    const maximum = method === "GET" ? CUSTODY_TRANSPORT_POLICY.readAttempts : 1;
    const observe = (attempt, detail) =>
      report({
        namespace: "SOUNDING_LINE_CUSTODY_TRANSPORT",
        method,
        endpoint: endpoint.split("?")[0],
        attempt,
        maximumAttempts: maximum,
        ...detail,
      });
    for (let attempt = 1; attempt <= maximum; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CUSTODY_TRANSPORT_POLICY.requestTimeoutMs);
      timeout.unref?.();
      let failure;
      try {
        const response = await fetchImpl(`https://api.github.com/repos/${repository}/${endpoint}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        });
        if (method === "GET" && response.status === 404) return null;
        if (!response.ok) {
          if (method === "GET" && transientStatus.has(response.status)) failure = { status: response.status };
          else {
            observe(attempt, { outcome: "TERMINAL_HTTP_FAILURE", status: response.status, willRetry: false });
            throw fail(
              method === "POST" && [409, 422].includes(response.status)
                ? "SLOT_CONSUMED"
                : `CUSTODY_ACCESS_${response.status}`,
            );
          }
        } else {
          const value = await response.json();
          if (attempt > 1) observe(attempt, { outcome: "READ_RECOVERED", status: response.status, willRetry: false });
          return value;
        }
      } catch (error) {
        if (error?.message?.startsWith("PRODUCT_EXPERIENCE_EXCEPTION_")) throw error;
        failure = { reason: reason(error) };
        if (method !== "GET") {
          observe(attempt, { ...failure, outcome: "WRITE_OUTCOME_UNKNOWN", willRetry: false });
          throw fail("CUSTODY_WRITE_OUTCOME_UNKNOWN");
        }
      } finally {
        clearTimeout(timeout);
        controller.abort(); // Close unconsumed/error bodies as well as timed-out requests.
      }
      const willRetry = attempt < maximum && remainingReadRetries > 0;
      observe(attempt, { ...failure, outcome: "READ_FAILURE", willRetry });
      if (!willRetry) throw fail("CUSTODY_READ_TRANSPORT_EXHAUSTED");
      remainingReadRetries--;
      await wait(CUSTODY_TRANSPORT_POLICY.readRetryDelayMs);
    }
    throw fail("CUSTODY_READ_TRANSPORT_EXHAUSTED");
  };
}
