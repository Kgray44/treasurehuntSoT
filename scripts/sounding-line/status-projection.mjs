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
const text = (value) => (typeof value === "string" && value ? value : null);
const countMap = (value) =>
  value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).filter(([, count]) => Number.isInteger(count) && count >= 0))
    : {};
const trainCars = (plan) => {
  const cars = Array.isArray(plan?.train?.cars) ? plan.train.cars : Array.isArray(plan?.cars) ? plan.cars : [];
  return cars
    .filter((car) => car && typeof car === "object")
    .map((car, index) => ({
      id: String(car.carId ?? car.candidateId ?? index),
      state: text(car.state),
      candidateSha: text(car.candidateHeadCommitSha ?? car.candidateSha),
      candidateTreeSha: text(car.candidateHeadTreeSha ?? car.candidateTreeSha),
      predictedIntegrationTreeSha: text(car.predictedIntegrationTreeSha),
    }));
const safeStrings = (value) =>
  Array.isArray(value) ? value.filter((candidate) => typeof candidate === "string") : [];
const projectSemanticFallback = (fallback) => {
  if (!fallback || typeof fallback !== "object" || Array.isArray(fallback)) return null;
  const reasons = Array.isArray(fallback.reasons)
    ? fallback.reasons
        .filter((reason) => reason && typeof reason === "object" && !Array.isArray(reason))
        .map((reason) => ({
          ...(typeof reason.code === "string" ? { code: reason.code } : {}),
          ...(safeStrings(reason.paths).length ? { paths: safeStrings(reason.paths) } : {}),
          ...(safeStrings(reason.contractIds).length ? { contractIds: safeStrings(reason.contractIds) } : {}),
          ...(Array.isArray(reason.debts)
            ? {
                debts: reason.debts
                  .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
                  .map((entry) => ({
                    ...(typeof entry.contractId === "string" ? { contractId: entry.contractId } : {}),
                    ...(typeof entry.owner === "string" ? { owner: entry.owner } : {}),
                    ...(typeof entry.classification === "string" ? { classification: entry.classification } : {}),
                    ...(typeof entry.risk === "string" ? { risk: entry.risk } : {}),
                    ...(typeof entry.reason === "string" ? { reason: entry.reason } : {}),
                  })),
              }
            : {}),
        }))
    : [];
  return {
    ...(typeof fallback.disposition === "string" ? { disposition: fallback.disposition } : {}),
    ...(typeof fallback.failure === "string" ? { failure: fallback.failure } : {}),
    reasons,
  };
};
const legacySemanticFallback = (fallback, details) => {
  if (typeof fallback === "string") return fallback;
  return typeof details?.failure === "string" ? details.failure : null;
};

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
    const semanticFallbackDetails = projectSemanticFallback(plan?.semanticFallback);
    const nodes = (plan?.nodes ?? []).map((node) => ({
      id: String(node.id ?? node.suiteId ?? "unknown"),
      suiteId: String(node.suiteId ?? node.id ?? "unknown"),
      state: nodeState(node),
      queuedAt: node.queuedAt ?? null,
      startedAt: node.startedAt ?? null,
      completedAt: node.completedAt ?? null,
      attempt: Number.isInteger(node.attempt) ? node.attempt : 1,
      rootFailureId: node.rootFailureId ?? null,
      wave: Number.isInteger(node?.execution?.wave) ? node.execution.wave : null,
      evidenceDisposition: text(node.evidenceDisposition),
      resources: Array.isArray(node.resources) ? node.resources.filter((resource) => typeof resource === "string") : [],
    }));
    plans.push({
      id: marker.runId,
      sourceSha: plan?.sourceSha ?? plan?.sourceWatermark ?? null,
      gate: plan?.gate ?? plan?.scope ?? "UNKNOWN",
      state: marker.state ?? "UNKNOWN",
      createdAt: marker.createdAt ?? null,
      authorityVersion: text(plan?.authorityVersion),
      authorityBoundary: text(plan?.authorityBoundary),
      authorityMode: text(plan?.authorityMode),
      qualifiedBaseSha: text(plan?.qualifiedBaseSha),
      candidateTreeSha: text(plan?.candidateTreeSha),
      predictedIntegrationTreeSha: text(plan?.predictedIntegrationTreeSha),
      planDigest: text(plan?.planDigest),
      trainId: text(plan?.trainId ?? plan?.train?.trainId),
      trainCars: trainCars(plan),
      evidenceDispositionCounts: countMap(plan?.evidenceDispositionCounts),
      finalizerAuthority: text(finalization?.authority),
      evidenceDigest: text(finalization?.evidenceDigest),
      cleanupState: receipts.some((receipt) => receipt.name.includes("cleanup")) ? "CLEAN" : "UNKNOWN",
      finalDecision: finalization?.decision ?? null,
      // Keep the v1 scalar contract while exposing additive, structured diagnostics.
      semanticFallback: legacySemanticFallback(plan?.semanticFallback, semanticFallbackDetails),
      semanticFallbackDetails,
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
