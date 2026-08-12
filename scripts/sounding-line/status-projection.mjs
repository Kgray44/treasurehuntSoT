#!/usr/bin/env node
/* Read-only, schema-versioned status projection for external observers. */
import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const runtimeRoot =
  process.argv[2] ??
  process.env.SOUNDING_LINE_RUNTIME_ROOT ??
  path.join(
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
    "ForeverTreasureCompanion",
    "SoundingLine",
    "runs",
  );
const readJson = async (file, fallback = null) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};
const nodeState = (node) => node?.state ?? node?.status ?? "UNKNOWN";

export async function projectStatus(base = runtimeRoot) {
  const leases = await readJson(path.join(base, "broker-leases.json"), { version: 1, leases: [] });
  let entries = [];
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const plans = [];
  for (const entry of entries.filter(
    (candidate) => candidate.isDirectory() && /^sl-[a-z0-9-]+$/u.test(candidate.name),
  )) {
    const root = path.join(base, entry.name);
    const [marker, plan, receipts, finalization] = await Promise.all([
      readJson(path.join(root, "run-marker.json")),
      readJson(path.join(root, "plans", "sealed-plan.json")),
      readdir(path.join(root, "receipts"), { withFileTypes: true }).catch(() => []),
      readJson(path.join(root, "sounding-line-finalization.json"), null),
    ]);
    if (!marker) continue;
    const nodes = (plan?.nodes ?? []).map((node) => ({
      id: String(node.id ?? node.suiteId ?? "unknown"),
      suiteId: String(node.suiteId ?? node.id ?? "unknown"),
      state: nodeState(node),
      queuedAt: node.queuedAt ?? null,
      startedAt: node.startedAt ?? null,
      completedAt: node.completedAt ?? null,
      attempt: Number.isInteger(node.attempt) ? node.attempt : 1,
      rootFailureId: node.rootFailureId ?? null,
    }));
    plans.push({
      id: marker.runId,
      sourceSha: plan?.sourceSha ?? plan?.sourceWatermark ?? null,
      gate: plan?.gate ?? plan?.scope ?? "UNKNOWN",
      state: marker.state ?? "UNKNOWN",
      createdAt: marker.createdAt ?? null,
      cleanupState: receipts.some((receipt) => receipt.name.includes("cleanup")) ? "CLEAN" : "UNKNOWN",
      finalDecision: finalization?.decision ?? null,
      nodes,
    });
  }
  const workers = (leases.leases ?? [])
    .filter((lease) => lease.state === "ACTIVE")
    .map((lease) => ({
      id: String(lease.id),
      runId: String(lease.runId),
      lane: String(lease.resource ?? lease.key ?? "resource"),
      state: "RUNNING",
      heartbeatAt: lease.expiresAt ?? null,
    }));
  return {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    source: "SOUNDING_LINE_RUNTIME",
    plans,
    workers,
    leases: (leases.leases ?? []).length,
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`)
  console.log(JSON.stringify(await projectStatus(), null, 2));
