// Budgets constrain execution; they cannot issue or replace a release decision.
export const VERIFICATION_TAIL_MS = 120000;
export const VERIFICATION_JOB_MS = 45 * 60000;
const fail = (code) => {
  throw new Error(`SOUNDING_LINE_VERIFICATION_${code}`);
};
export function verificationJobLimit(pr) {
  return (Number(pr) === 776 ? 120 : Number(pr) === 721 ? 90 : 45) * 60000;
}
export function verificationBudget({
  jobStartedAt,
  now = Date.now(),
  limitMs = VERIFICATION_JOB_MS,
  tailMs = VERIFICATION_TAIL_MS,
}) {
  if (
    !Number.isSafeInteger(limitMs) ||
    limitMs < 1 ||
    limitMs > 120 * 60000 ||
    !Number.isSafeInteger(tailMs) ||
    tailMs < 1 ||
    tailMs >= limitMs
  )
    fail("BUDGET_INVALID");
  const started = Date.parse(jobStartedAt);
  const setupMs = now - started;
  if (!Number.isFinite(setupMs) || setupMs < 0) fail("JOB_BINDING_INVALID");
  const executionMs = limitMs - setupMs - tailMs;
  if (executionMs <= 0) fail("JOB_BUDGET_EXHAUSTED");
  return Object.freeze({ limitMs, setupMs, tailMs, executionMs });
}
export function commandDeadline(deadlineAt, now = Date.now()) {
  const remaining = Number(deadlineAt) - now;
  if (!Number.isSafeInteger(Number(deadlineAt)) || !Number.isFinite(remaining) || remaining <= 0)
    fail("COMMAND_BUDGET_EXHAUSTED");
  return Math.min(remaining, 15 * 60000);
}
export function commandTransport(command, args) {
  if (typeof command !== "string" || !Array.isArray(args) || args.some((arg) => typeof arg !== "string"))
    fail("COMMAND_TRANSPORT_INVALID");
  let bytes = 0;
  for (const arg of [command, ...args]) {
    if (/[\u0000\r\n]/u.test(arg)) fail("COMMAND_TRANSPORT_INVALID");
    bytes += /[\s"'#$&()*;<>?\\\x60|~!%^]/u.test(arg)
      ? 8 * Buffer.byteLength(arg, "utf8") + 9
      : Buffer.byteLength(arg, "utf8") + 1;
    if (bytes > 6000) fail("COMMAND_TRANSPORT_EXHAUSTED");
  }
  return { conservativeBytes: bytes, arguments: args.length };
}
