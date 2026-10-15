import { readFile, realpath, access, stat } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { canonicalPublicAppOrigin } from "../../src/homeport/public-app-origin";
import { homeportAllowedDevOrigins } from "../../src/homeport/dev-origin-config";
import { admitZapparAuthorization } from "../../src/parallax/zappar-authorization";
import { roomObservationResponseSchema } from "../../src/watchglass/room-observation";
import { reconstructRoomFromObservation } from "../../src/parallax/room-reconstruction";

/** Default is read-only preflight. --start launches this checkout's foreground
 * preview only after local ownership, explicit engine and ordinary TLS checks.
 * No tunnel, certificate, firewall, account, SDK download or entitlement is created.
 * Usage: node --import tsx scripts/parallax/start-browser-ar-preview.ts
 *   --engine ZAPPAR --origin https://<approved-host> --database artifacts/spatial-pilot/browser-ar-owner.db
 *   [--port 3291] [--require-bedroom] [--verify-origin] [--start]
 */
async function main() {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index++) {
    const flag = process.argv[index];
    if (
      !["--engine", "--origin", "--database", "--port", "--require-bedroom", "--verify-origin", "--start"].includes(
        flag,
      ) ||
      args.has(flag)
    )
      throw new Error("Unknown or repeated preview argument.");
    if (["--require-bedroom", "--verify-origin", "--start"].includes(flag)) args.set(flag, "1");
    else {
      const value = process.argv[++index];
      if (!value || value.startsWith("--")) throw new Error("Preview argument value is required.");
      args.set(flag, value);
    }
  }
  const taskRoot = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
  process.chdir(taskRoot);
  const blockers: string[] = [];
  if (!(await stat(resolve(taskRoot, ".git"))).isFile()) blockers.push("OWNED_GIT_WORKTREE_REQUIRED");
  const engine = args.get("--engine");
  if (!engine || !["ZAPPAR", "TINYVIO", "PUBLIC_SOURCE"].includes(engine))
    blockers.push("EXPLICIT_SUPPORTED_ENGINE_REQUIRED");
  const port = Number(args.get("--port") ?? 3291);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) blockers.push("PREVIEW_PORT_INVALID");
  else {
    try {
      await new Promise<void>((acceptPort, rejectPort) => {
        const probe = createServer();
        probe.once("error", rejectPort);
        probe.listen(port, "127.0.0.1", () => probe.close((error) => (error ? rejectPort(error) : acceptPort())));
      });
    } catch {
      blockers.push("PREVIEW_PORT_OCCUPIED_OR_UNAVAILABLE");
    }
  }
  let origin: URL | null = null;
  try {
    if (!args.get("--origin")) throw new Error("missing");
    process.env.HOMEPORT_PUBLIC_APP_ORIGIN = args.get("--origin");
    origin = canonicalPublicAppOrigin();
    if (origin.protocol !== "https:") throw new Error("https required");
    homeportAllowedDevOrigins(origin.hostname);
  } catch {
    blockers.push("EXACT_TRUSTED_HTTPS_ORIGIN_REQUIRED");
    origin = null;
  }
  const database = resolve(taskRoot, args.get("--database") ?? "artifacts/spatial-pilot/browser-ar-owner.db");
  let databaseVerified = false;
  const inside = (root: string, child: string) => {
    const path = relative(root, child);
    return Boolean(path && !path.startsWith("..") && !isAbsolute(path));
  };
  try {
    const ownedRoot = resolve(taskRoot, "artifacts/spatial-pilot");
    if (!inside(ownedRoot, database) || !database.endsWith(".db")) throw new Error("outside");
    const [actualRoot, actualDatabase, receiptText] = await Promise.all([
      realpath(ownedRoot),
      realpath(database),
      readFile(`${database}.access.private.json`, "utf8"),
    ]);
    const receipt = JSON.parse(receiptText);
    if (
      !inside(taskRoot, actualRoot) ||
      !inside(actualRoot, actualDatabase) ||
      receipt.ownerAccountId !== "spatial-pilot-navigator" ||
      resolve(receipt.database) !== database
    )
      throw new Error("binding");
    databaseVerified = true;
  } catch {
    blockers.push("TASK_OWNED_PILOT_DATABASE_AND_PRIVATE_OWNERSHIP_RECEIPT_REQUIRED");
  }
  try {
    await access(resolve(taskRoot, "node_modules/next/dist/bin/next"));
    const prismaSchema = await readFile(resolve(taskRoot, "node_modules/.prisma/client/schema.prisma"), "utf8");
    if (!/provider\s*=\s*"sqlite"/.test(prismaSchema)) throw new Error("client");
  } catch {
    blockers.push("READY_NEXT_AND_SQLITE_PRISMA_DEPENDENCIES_REQUIRED");
  }
  const assetRoot = resolve(taskRoot, "tmp/browser-ar-local-assets");
  try {
    if (engine === "ZAPPAR") {
      const authorization = admitZapparAuthorization(
        JSON.parse(await readFile(resolve(assetRoot, "zappar-4.4.0.authorization.private.json"), "utf8")),
        origin?.origin ?? "",
      );
      if (!authorization) throw new Error("authorization");
      const script = await readFile(resolve(assetRoot, "zappar-4.4.0.js"));
      if (
        script.length > 32 * 1024 * 1024 ||
        createHash("sha256").update(script).digest("hex") !== authorization.scriptSha256
      )
        throw new Error("integrity");
    } else if (engine === "TINYVIO" || engine === "PUBLIC_SOURCE") {
      const prefix = engine === "TINYVIO" ? "tinyvio-slam" : "public-source-slam";
      await Promise.all([access(resolve(assetRoot, `${prefix}.js`)), access(resolve(assetRoot, `${prefix}.wasm`))]);
      if (engine === "PUBLIC_SOURCE") await access(resolve(assetRoot, "public-source-slam.NOTICES.txt"));
    }
  } catch {
    blockers.push(
      engine === "ZAPPAR"
        ? "ACTIVE_OWNER_AUTHORIZED_ZAPPAR_ENTITLEMENT_ORIGIN_AND_MATCHING_SDK_REQUIRED"
        : "EXPERIMENTAL_TRACKER_LOCAL_ASSETS_REQUIRED",
    );
  }
  const observationPath = "tmp/haunted-bedroom-observation.private.json";
  let observationSha256: string | null = null;
  if (args.has("--require-bedroom"))
    try {
      const bytes = await readFile(resolve(taskRoot, observationPath));
      if (bytes.length > 1_048_576) throw new Error("size");
      const digest = createHash("sha256").update(bytes).digest("hex");
      const result = reconstructRoomFromObservation({
        observation: roomObservationResponseSchema.parse(JSON.parse(bytes.toString("utf8"))),
        roomId: `photo-room-${digest.slice(0, 16)}`,
        sourceMediaIds: [`reviewed-room-observation-${digest.slice(0, 24)}`],
      });
      if (result.status !== "PROPOSED") throw new Error("review");
      observationSha256 = digest;
    } catch {
      blockers.push("VALID_PRIVATE_HAUNTED_BEDROOM_OBSERVATION_REQUIRED");
    }
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirtySource = Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim());
  const https: { tlsValidated: boolean; applicationReachable: boolean; httpStatus: number | null } = {
    tlsValidated: false,
    applicationReachable: false,
    httpStatus: null,
  };
  if (origin && (args.has("--verify-origin") || (args.has("--start") && !blockers.length))) {
    try {
      const response = await fetch(new URL("/sign-in", origin), {
        signal: AbortSignal.timeout(6000),
        redirect: "manual",
      });
      https.tlsValidated = true;
      https.applicationReachable = response.ok;
      https.httpStatus = response.status;
      await response.body?.cancel();
    } catch {
      blockers.push("HTTPS_ORIGIN_NORMAL_TLS_OR_DNS_CHECK_FAILED");
    }
  }
  const report = {
    kind: "PARALLAX_BROWSER_AR_PREVIEW_PREFLIGHT",
    checkedAt: new Date().toISOString(),
    sourceCommit,
    dirtySource,
    engine: engine ?? null,
    port,
    origin: origin?.origin ?? null,
    databaseVerified,
    requiredObservation: observationPath,
    observationRequired: args.has("--require-bedroom"),
    observationSha256,
    estimatedReconstructionOwnerReviewRequired: true,
    https,
    previewOriginSourceVerified: false,
    quickTunnelSseUnavailable: origin?.hostname.endsWith(".trycloudflare.com") ?? false,
    blockers,
    servicesStarted: false,
    physicalDeviceQualified: false,
  };
  console.log(JSON.stringify(report, null, 2));
  if (blockers.length) {
    process.exitCode = 1;
    return;
  }
  if (!args.has("--start")) return;
  const env = {
    ...process.env,
    DATABASE_URL: `file:${database.replaceAll("\\", "/")}`,
    SPATIAL_PILOT_ENABLED: "1",
    SPATIAL_PILOT_OWNER_ID: "spatial-pilot-navigator",
    SPATIAL_PILOT_SOURCE_SHA: sourceCommit,
    SPATIAL_PILOT_SOURCE_DIRTY: dirtySource ? "1" : "0",
    SPATIAL_PILOT_LOCAL_HTTP: "1",
    PARALLAX_ROOM_TEST_ENABLED: "1",
    PARALLAX_LOCAL_TRACKER_PROTOTYPE: "1",
    PARALLAX_LOCAL_TRACKER_ENGINE: engine!,
    HOMEPORT_PUBLIC_APP_ORIGIN: origin!.origin,
    NEXT_PUBLIC_APP_URL: origin!.origin,
    HOMEPORT_ALLOWED_DEV_ORIGINS: origin!.hostname,
    NEXT_DIST_DIR: `tmp/browser-ar-preview-${port}/next`,
    NEXT_TELEMETRY_DISABLED: "1",
    OPENAI_API_KEY: "",
    NODE_OPTIONS: "",
  };
  console.log(`Starting owned foreground preview at 127.0.0.1:${port}; stop with Ctrl+C. No tunnel is started.`);
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: taskRoot,
      env,
      stdio: "inherit",
    },
  );
  await new Promise<void>((complete, reject) => {
    server.once("error", reject);
    server.once("exit", (code) => {
      process.exitCode = code ?? 1;
      complete();
    });
  });
}

void main().catch(() => {
  console.error("Browser AR preview preflight failed. Private configuration contents are not logged.");
  process.exitCode = 1;
});
