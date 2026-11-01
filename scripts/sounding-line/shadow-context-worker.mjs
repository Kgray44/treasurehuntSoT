// Private, explicitly partial worker for a shadow parent. No provider grant or
// release decision is produced; the ordinary full-capture CLI remains unchanged.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { readBoundedRawCaptureFile } from "./experience-raw-output.mjs";
import { captureProductExperience } from "./experience-browser.mjs";
const need = (value) => {
  if (!value) throw Error("SOUNDING_LINE_SHADOW_CONTEXT_WORKER_UNAVAILABLE");
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function runShadowContextWorker({ root = process.cwd(), rawDirectory, inputPath, inputSha256 }) {
  need(typeof inputSha256 === "string" && /^[a-f0-9]{64}$/u.test(inputSha256));
  const bytes = await readBoundedRawCaptureFile({ root, rawDirectory, file: inputPath, maximumBytes: 32768 });
  need(hash(bytes) === inputSha256);
  const input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  need(
    Object.keys(input).sort().join() ===
      [
        "version",
        "planPath",
        "planSha256",
        "contextId",
        "outputDirectory",
        "authenticationCachePath",
        "authenticationCacheSha256",
        "resultPath",
      ]
        .sort()
        .join() && input.version === 1,
  );
  for (const key of ["planSha256", "contextId", "authenticationCacheSha256"])
    need(typeof input[key] === "string" && /^[a-f0-9]{64}$/u.test(input[key]));
  const planBytes = await readBoundedRawCaptureFile({
    root,
    rawDirectory,
    file: input.planPath,
    maximumBytes: 2 * 1024 * 1024,
  });
  const cache = await readBoundedRawCaptureFile({
    root,
    rawDirectory,
    file: input.authenticationCachePath,
    maximumBytes: 2 * 1024 * 1024,
  });
  need(hash(planBytes) === input.planSha256 && hash(cache) === input.authenticationCacheSha256);
  const resolvedRaw = path.resolve(root, rawDirectory),
    result = path.resolve(root, input.resultPath);
  const relativeRaw = path.relative(root, resolvedRaw).replaceAll("\\", "/");
  need(
    relativeRaw.endsWith("/raw") && input.outputDirectory === relativeRaw.slice(0, -4) + "/capture/" + input.contextId,
  );
  need(
    path.dirname(result) === resolvedRaw && path.basename(result) === `shadow-context-result-${input.contextId}.json`,
  );
  // The supervisor, rather than a caller-supplied file, supplies the loopback URL.
  const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL);
  need(
    baseURL.protocol === "http:" &&
      baseURL.hostname === "127.0.0.1" &&
      !baseURL.username &&
      !baseURL.password &&
      baseURL.port &&
      baseURL.pathname === "/" &&
      !baseURL.search &&
      !baseURL.hash &&
      process.env.SOUNDING_LINE_BROWSER_AUTHORITY === "1",
  );
  const plan = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(planBytes));
  const evidence = await captureProductExperience({
    root,
    plan,
    baseURL: baseURL.href,
    outputDirectory: input.outputDirectory,
    rawOutputDirectory: rawDirectory,
    shadowContext: { mode: "SHADOW_SINGLE_CONTEXT", contextId: input.contextId },
    shadowAuthenticationCache: cache,
  });
  need(evidence.partialContext.contextId === input.contextId && evidence.journeys.length === 1);
  const resultBytes = Buffer.from(
    JSON.stringify({
      kind: "PARTIAL_SHADOW_CONTEXT_RESULT",
      qualification: false,
      reuseAuthorized: false,
      contextId: input.contextId,
      privateAuthenticationCache: evidence.shadowPrivateState,
      capturePath: path.posix.join(input.outputDirectory, "capture.json"),
    }),
  );
  need(resultBytes.length <= 32768);
  await writeFile(result, resultBytes, { flag: "wx", mode: 0o600 });
  return { qualification: false, reuseAuthorized: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    need(
      process.argv.length === 8 &&
        process.argv[2] === "--raw-directory" &&
        process.argv[4] === "--input" &&
        process.argv[6] === "--input-sha256",
    );
    await runShadowContextWorker({
      rawDirectory: process.argv[3],
      inputPath: process.argv[5],
      inputSha256: process.argv[7],
    });
  } catch {
    console.error("SOUNDING_LINE_SHADOW_CONTEXT_WORKER_UNAVAILABLE");
    process.exitCode = 1;
  }
}
