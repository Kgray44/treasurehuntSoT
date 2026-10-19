// Literal protected profile; no caller, CLI or environment-selected runner descriptors.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTechnicalProof } from "./experience-technical-proof.mjs";
const api = createTechnicalProof(13);
export const R13_TECHNICAL = api.TECHNICAL;
export const r13TechnicalMarkerPath = api.r12TechnicalMarkerPath;
export const r13TechnicalBrowserArguments = api.r12TechnicalBrowserArguments;
export const r13TechnicalSuiteArguments = api.r12TechnicalSuiteArguments;
export const r13TechnicalSourceManifest = api.r12TechnicalSourceManifest;
export const assertR13TechnicalSource = api.assertR12TechnicalSource;
export const r13TechnicalEnvironment = api.r12TechnicalEnvironment;
export const requireR13TechnicalSuite = api.requireR12TechnicalSuite;
export const inspectR13TechnicalReport = api.inspectR12TechnicalReport;
export const validateR13FocusedReceipt = api.validateR12FocusedReceipt;
export const runR13TechnicalProof = api.runR12TechnicalProof;
export const r13TechnicalExitCode = api.r12TechnicalExitCode;

export const assertR13ReadinessFocusedBinding = api.assertReadinessFocusedBinding;
export const preflightR13Dependencies = api.preflight;
export const requireR13DependencyReadinessSuite = api.requireDependencyReadinessSuite;
export const r13CaseProfileContext = api.caseProfileContext;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, root, baseSha, candidateSha, stage, ...extra] = process.argv.slice(2);
  if (!["check", "preflight", "run"].includes(mode) || extra.length)
    throw Error("PRODUCT_EXPERIENCE_EXCEPTION_R13_TECHNICAL_MODE_REQUIRED");
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
