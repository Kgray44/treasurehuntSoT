// Literal protected profile; no caller, CLI or environment-selected runner descriptors.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTechnicalProof } from "./experience-technical-proof.mjs";
const api = createTechnicalProof(12);
export const R12_TECHNICAL = api.TECHNICAL;
export const r12TechnicalMarkerPath = api.r12TechnicalMarkerPath;
export const r12TechnicalBrowserArguments = api.r12TechnicalBrowserArguments;
export const r12TechnicalSuiteArguments = api.r12TechnicalSuiteArguments;
export const r12TechnicalSourceManifest = api.r12TechnicalSourceManifest;
export const assertR12TechnicalSource = api.assertR12TechnicalSource;
export const r12TechnicalEnvironment = api.r12TechnicalEnvironment;
export const requireR12TechnicalSuite = api.requireR12TechnicalSuite;
export const inspectR12TechnicalReport = api.inspectR12TechnicalReport;
export const validateR12FocusedReceipt = api.validateR12FocusedReceipt;
export const runR12TechnicalProof = api.runR12TechnicalProof;
export const r12TechnicalExitCode = api.r12TechnicalExitCode;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, root, baseSha, candidateSha, stage, ...extra] = process.argv.slice(2);
  if (!["check", "run"].includes(mode) || extra.length)
    throw Error("PRODUCT_EXPERIENCE_EXCEPTION_R12_TECHNICAL_MODE_REQUIRED");
  const options = { root: path.resolve(root ?? process.cwd()), baseSha, candidateSha, stage };
  const result =
    mode === "check"
      ? (await api.admit(options)).manifest
      : mode === "preflight"
        ? await api.preflight(options)
        : await api.runR12TechnicalProof(options);
  console.log(JSON.stringify(result, null, 2));
  if (mode !== "check")
    process.exitCode = mode === "preflight" ? (result.status === "PASS" ? 0 : 1) : api.r12TechnicalExitCode(result);
}
