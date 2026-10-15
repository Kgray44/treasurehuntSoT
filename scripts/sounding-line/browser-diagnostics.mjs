/* Diagnostic custody only. These bindings neither grant nor replace acceptance. */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BROWSER_DIAGNOSTIC_CONTEXT = "SOUNDING_LINE_BROWSER_DIAGNOSTIC_CONTEXT";
const receiptNames = new Set(["browser-runtime.json", "browser-suite-profile.json"]);
const bindingKeys = ["version", "runId", "scopeId", "baseSha", "candidateSha", "planDigest"];
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;

function validBinding(binding) {
  return (
    binding &&
    Object.keys(binding).length === bindingKeys.length &&
    binding.version === 1 &&
    uuid.test(binding.runId) &&
    uuid.test(binding.scopeId) &&
    sha.test(binding.baseSha) &&
    sha.test(binding.candidateSha) &&
    digest.test(binding.planDigest)
  );
}

export function browserReceiptPaths(root, environment = process.env) {
  const encoded = environment[BROWSER_DIAGNOSTIC_CONTEXT];
  let binding = null;
  if (encoded !== undefined) {
    try {
      binding = JSON.parse(encoded);
    } catch {
      /* reject below without echoing input */
    }
    if (!validBinding(binding)) return null;
  }
  const directory = binding
    ? path.join(root, "artifacts", "sounding-line", "browser-diagnostics", binding.runId, binding.scopeId)
    : path.join(root, "artifacts", "sounding-line");
  return {
    directory,
    binding,
    runtime: path.join(directory, "browser-runtime.json"),
    profile: path.join(directory, "browser-suite-profile.json"),
  };
}

export async function writeBrowserDiagnosticReceipt(root, name, receipt, environment = process.env) {
  if (!receiptNames.has(name)) throw new Error("SOUNDING_LINE_BROWSER_DIAGNOSTIC_NAME_INVALID");
  const paths = browserReceiptPaths(root, environment);
  if (!paths) return null;
  const { directory, binding } = paths;
  const record = binding ? { ...receipt, diagnosticBinding: binding } : receipt;
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, name), JSON.stringify(record, null, 2) + "\n");
  } catch (error) {
    // Scoped diagnostics never create an acceptance outcome or fall back to
    // an unbound historical file. Standalone legacy I/O retains its behavior.
    if (binding) return null;
    throw error;
  }
  return record;
}

export async function readBrowserDiagnosticReceipt(root, name, environment = process.env) {
  if (!receiptNames.has(name)) return null;
  try {
    const { directory, binding } = browserReceiptPaths(root, environment);
    const receipt = JSON.parse(await readFile(path.join(directory, name), "utf8"));
    if (
      binding &&
      (!validBinding(receipt?.diagnosticBinding) ||
        !bindingKeys.every((key) => receipt.diagnosticBinding[key] === binding[key]))
    )
      return null;
    return receipt;
  } catch {
    return null;
  }
}

export function createBrowserDiagnosticSession(root, { baseSha, candidateSha, planDigest }) {
  // Always minted here. Ambient/inherited context cannot bind an ordinary run.
  const runId = randomUUID();
  let current = null;
  return {
    clearScope() {
      current = null;
    },
    beginScope() {
      current = { version: 1, runId, scopeId: randomUUID(), baseSha, candidateSha, planDigest };
      if (!validBinding(current)) throw new Error("SOUNDING_LINE_BROWSER_DIAGNOSTIC_CONTEXT_INVALID");
      return { [BROWSER_DIAGNOSTIC_CONTEXT]: JSON.stringify(current) };
    },
    async read() {
      if (!current) return { binding: null, runtime: null, profile: null };
      const environment = { [BROWSER_DIAGNOSTIC_CONTEXT]: JSON.stringify(current) };
      return {
        binding: current,
        runtime: await readBrowserDiagnosticReceipt(root, "browser-runtime.json", environment),
        profile: await readBrowserDiagnosticReceipt(root, "browser-suite-profile.json", environment),
      };
    },
  };
}
