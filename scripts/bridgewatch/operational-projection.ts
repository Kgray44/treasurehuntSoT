import { execFileSync } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { communityOperationalAlerts, emitCommunityOperationalAlert } from "@/community/alerts";
import { collectCommunityProviderHealth, communityOperationalSnapshot } from "@/community/operations";

let lastAlertSignature = "";

function statusPath() {
  const value = process.env.BRIDGEWATCH_PROVIDER_STATUS_PATH?.trim();
  if (!value || !path.isAbsolute(value)) throw new Error("BRIDGEWATCH_PROVIDER_STATUS_PATH_REQUIRED");
  const resolved = path.resolve(value);
  const repository = path.resolve(process.cwd());
  if (resolved === repository || resolved.startsWith(`${repository}${path.sep}`))
    throw new Error("BRIDGEWATCH_PROVIDER_STATUS_PATH_MUST_BE_HOST_OWNED");
  return resolved;
}

function sourceSha() {
  try {
    const value = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^[a-f0-9]{7,64}$/iu.test(value) ? value : null;
  } catch {
    return null;
  }
}

export async function writeOperationalProjection() {
  const [providers, jobs] = await Promise.all([collectCommunityProviderHealth(), communityOperationalSnapshot()]);
  const observedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    sourceSha: sourceSha(),
    observedAt,
    providers: providers.map((provider) => ({
      kind: provider.kind,
      provider: provider.provider,
      codeImplemented: provider.codeImplemented,
      configured: provider.configured,
      serviceReachable: provider.serviceReachable,
      liveValidated: provider.liveValidated,
      ready: provider.ready,
      state: provider.state,
      safeCode: provider.safeCode,
      observedAt: provider.observedAt,
    })),
    jobs: {
      queueDepth: jobs.queueDepth,
      deadLetterCount: jobs.deadLetters,
      oldestQueuedJobAgeSeconds: jobs.oldestQueuedJobAgeSeconds,
      staleScans: jobs.staleScans,
      backupSchedules: jobs.backupSchedules,
    },
  };
  const target = statusPath();
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload)}\n`, { encoding: "utf8", flag: "w" });
  await rename(temporary, target);
  const alerts = communityOperationalAlerts(providers, jobs, observedAt);
  const alertSignature = JSON.stringify(
    alerts.map(({ code, severity, providerCount, queueDepth, deadLetterCount }) => ({
      code,
      severity,
      providerCount,
      queueDepth,
      deadLetterCount,
    })),
  );
  if (alertSignature !== lastAlertSignature) {
    for (const alert of alerts) emitCommunityOperationalAlert(alert);
    lastAlertSignature = alertSignature;
  }
  return payload;
}

async function main() {
  if (!process.argv[1] || import.meta.url !== pathToFileURL(process.argv[1]).href) return;
  const once = process.argv.includes("--once");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  do {
    await writeOperationalProjection();
    if (!once && !stopping) await new Promise((resolve) => setTimeout(resolve, 15_000));
  } while (!once && !stopping);
}

void main();
