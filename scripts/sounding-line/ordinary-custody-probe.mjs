// Read-only full-route hint. This module never reserves, seals or writes a decision.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function custodyProbeEnvironment(environment, git) {
  const allowed = new Set(["SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]);
  const result = Object.fromEntries(Object.entries(environment).filter(([key]) => allowed.has(key.toUpperCase())));
  const system = environment.SystemRoot ?? environment.SYSTEMROOT;
  const paths = [path.dirname(git), path.dirname(process.execPath)];
  if (process.platform === "win32" && system)
    paths.push(path.join(system, "System32"), path.join(system, "System32/WindowsPowerShell/v1.0"));
  else if (process.platform !== "win32") paths.push("/usr/bin", "/bin");
  result.PATH = [...new Set(paths)].join(path.delimiter);
  result.GIT_CONFIG_GLOBAL = environment.GIT_CONFIG_GLOBAL;
  result.GIT_CONFIG_SYSTEM = environment.GIT_CONFIG_GLOBAL;
  result.GIT_CONFIG_NOSYSTEM = "1";
  result.GIT_ATTR_NOSYSTEM = "1";
  result.GIT_TERMINAL_PROMPT = "0";
  result.GIT_NO_LAZY_FETCH = "1";
  result.GIT_NO_REPLACE_OBJECTS = "1";
  result.GIT_OPTIONAL_LOCKS = "0";
  const config = [
    ["protocol.allow", "never"],
    ...["file", "http", "https", "ssh", "git", "ext"].map((name) => [`protocol.${name}.allow`, "never"]),
    ["core.fsmonitor", "false"],
  ];
  result.GIT_CONFIG_COUNT = String(config.length);
  config.forEach(([key, value], index) => {
    result[`GIT_CONFIG_KEY_${index}`] = key;
    result[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return result;
}

async function main() {
  const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
  if (
    !path.isAbsolute(input.root) ||
    !path.isAbsolute(input.git) ||
    ![input.baseSha, input.candidateSha, input.registryBlob].every((value) => /^[a-f0-9]{40}$/u.test(value)) ||
    !Number.isSafeInteger(input.prNumber) ||
    input.prNumber < 1
  )
    throw Error("CUSTODY_PROBE_INPUT_INVALID");
  if (
    process.env.GIT_NO_LAZY_FETCH !== "1" ||
    process.env.GIT_CONFIG_VALUE_0 !== "never" ||
    Object.keys(process.env).some((key) => /TOKEN|SECRET|PASSWORD|^GITHUB_|^ACTIONS_|^GH_/iu.test(key))
  )
    throw Error("CUSTODY_PROBE_ENVIRONMENT_INVALID");
  const bytes = execFileSync(input.git, ["show", `${input.baseSha}:testing/product-experience-exceptions.json`], {
    cwd: input.root,
    env: process.env,
    encoding: null,
    timeout: 30000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const blob = createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest("hex");
  if (blob !== input.registryBlob) throw Error("CUSTODY_PROBE_REGISTRY_CHANGED");
  const registry = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(registry.exceptions) || registry.exceptions.length > 64)
    throw Error("CUSTODY_PROBE_REGISTRY_INVALID");
  const { campaignComparison, CROSSDECK_CAMPAIGN } = await import("./experience-exception.mjs");
  const related = campaignComparison(input);
  const record = [CROSSDECK_CAMPAIGN, ...registry.exceptions].find(related);
  process.stdout.write(
    JSON.stringify({
      status: "PASS",
      campaign: !!record,
      relatedRecord: record?.id ?? null,
      baseSha: input.baseSha,
      candidateSha: input.candidateSha,
      prNumber: input.prNumber,
      registryBlob: blob,
      transport: "DISABLED",
      authority: "READ_ONLY_FULL_ROUTE_HINT",
      qualification: false,
    }),
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
