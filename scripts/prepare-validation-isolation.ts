import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type Fingerprint = {
  path?: string;
  fileName?: string;
  sha256: string;
  size: number;
  mtimeMs: number;
  mtimeIso: string;
};

type FileFamilyFingerprint =
  | {
      fileName: string;
      present: false;
    }
  | {
      fileName: string;
      present: true;
      sha256: string;
      size: number;
      mtimeMs: number;
      mtimeIso: string;
    };

type MutationCounts = {
  adminAuditLog: number;
  commandExecution: number;
  platformAuditEvent: number;
  progressEvent: number;
  taleSessionEvent: number;
};

type IsolationReport = {
  version: 2;
  status: string;
  preparedAt: string;
  canonicalDatabase: Fingerprint;
  canonicalDatabaseFamily: FileFamilyFingerprint[];
  seedDatabase: Omit<Fingerprint, "path">;
  isolatedDatabase: {
    fileName: string;
    nonceHash: string;
    baselineFingerprint: Omit<Fingerprint, "path">;
    baselineCounts: MutationCounts;
    browserBaselineFingerprint?: Omit<Fingerprint, "path">;
    browserBaselineCounts?: MutationCounts;
  };
  server: null | {
    pid: number;
    port: number;
    baseUrl: string;
    databaseFileName: string;
    nonceHash: string;
    launcherPid: number;
    identityVerified: boolean;
    identityVerifiedAt?: string;
    launcherCreationTimeUtc: string;
    listenerCreationTimeUtc: string;
    ancestryVerified: boolean;
  };
  verification?: {
    checkedAt: string;
    browserSucceeded: boolean;
    expectedMutation: boolean;
    observedMutation: boolean;
    changedCounts: string[];
    isolatedDatabase: Omit<Fingerprint, "path">;
    canonicalDatabaseUnchanged: boolean;
    canonicalDatabaseFamilyUnchanged: boolean;
  };
};

const CANONICAL_DATABASE_SUFFIXES = ["", "-wal", "-shm", "-journal"] as const;

type PrismaClientLike = {
  $disconnect(): Promise<void>;
  adminAuditLog: { count(): Promise<number> };
  commandExecution: { count(): Promise<number> };
  platformAuditEvent: {
    count(args?: unknown): Promise<number>;
    create(args: unknown): Promise<unknown>;
  };
  progressEvent: { count(): Promise<number> };
  taleSessionEvent: { count(): Promise<number> };
};

function parseArguments(values: string[]) {
  const [mode, ...tokens] = values;
  if (!mode) {
    throw new Error("A mode is required.");
  }

  const options = new Map<string, string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const name = tokens[index];
    const value = tokens[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${name ?? "end of input"}.`);
    }
    options.set(name.slice(2), value);
  }

  return {
    mode,
    required(name: string) {
      const value = options.get(name);
      if (!value) {
        throw new Error(`Missing required --${name} argument.`);
      }
      return value;
    },
  };
}

function resolveAbsolute(value: string, label: string) {
  if (!path.isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path.`);
  }
  return path.normalize(path.resolve(value));
}

function assertInside(candidate: string, parent: string, label: string) {
  const relative = path.relative(parent, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a child of the validated runtime.`);
  }
}

function comparablePath(value: string) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function toPrismaFileUrl(absolutePath: string) {
  const normalized = resolveAbsolute(absolutePath, "Database path");
  if (normalized.startsWith("\\\\")) {
    throw new Error("UNC database paths are not supported by the validation harness.");
  }
  if (/[?#\r\n]/u.test(normalized)) {
    throw new Error("Database path contains characters that are unsafe in a Prisma file URL.");
  }

  const forwardSlashes = normalized.replaceAll("\\", "/");
  const fileUrl = `file:${forwardSlashes}`;
  const roundTripValue = fileUrl.slice("file:".length).replaceAll("/", path.sep);
  const roundTripPath = path.normalize(path.resolve(roundTripValue));
  if (comparablePath(roundTripPath) !== comparablePath(normalized)) {
    throw new Error("Absolute Prisma file URL failed its round-trip safety check.");
  }
  return fileUrl;
}

async function fingerprint(filePath: string, pathExposure: "absolute" | "file-name"): Promise<Fingerprint> {
  const absolutePath = resolveAbsolute(filePath, "Fingerprint target");
  const beforeRead = await stat(absolutePath);
  const contents = await readFile(absolutePath);
  const details = await stat(absolutePath);
  if (
    beforeRead.size !== details.size ||
    beforeRead.mtimeMs !== details.mtimeMs ||
    contents.byteLength !== details.size
  ) {
    throw new Error(`Fingerprint target changed while it was being read: ${path.basename(absolutePath)}.`);
  }
  const result: Fingerprint = {
    sha256: createHash("sha256").update(contents).digest("hex"),
    size: details.size,
    mtimeMs: details.mtimeMs,
    mtimeIso: details.mtime.toISOString(),
  };
  if (pathExposure === "absolute") {
    result.path = absolutePath;
  } else {
    result.fileName = path.basename(absolutePath);
  }
  return result;
}

async function fingerprintDatabaseFamily(databasePath: string): Promise<FileFamilyFingerprint[]> {
  const absoluteDatabase = resolveAbsolute(databasePath, "Canonical database");
  const family: FileFamilyFingerprint[] = [];
  for (const suffix of CANONICAL_DATABASE_SUFFIXES) {
    const memberPath = `${absoluteDatabase}${suffix}`;
    try {
      const member = await fingerprint(memberPath, "file-name");
      family.push({
        fileName: path.basename(memberPath),
        present: true,
        sha256: member.sha256,
        size: member.size,
        mtimeMs: member.mtimeMs,
        mtimeIso: member.mtimeIso,
      });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      family.push({ fileName: path.basename(memberPath), present: false });
    }
  }
  if (!family[0]?.present) {
    throw new Error("Canonical prisma/dev.db is missing.");
  }
  return family;
}

function parseExpectedDatabaseFamily(encodedValue: string): FileFamilyFingerprint[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encodedValue, "base64").toString("utf8"));
  } catch {
    throw new Error("Canonical database family preflight is not valid base64-encoded JSON.");
  }
  if (!Array.isArray(decoded) || decoded.length !== CANONICAL_DATABASE_SUFFIXES.length) {
    throw new Error("Canonical database family preflight has an unexpected member count.");
  }
  return decoded as FileFamilyFingerprint[];
}

function assertCrossRuntimeFamilyMatch(expected: FileFamilyFingerprint[], actual: FileFamilyFingerprint[]) {
  for (let index = 0; index < CANONICAL_DATABASE_SUFFIXES.length; index += 1) {
    const expectedMember = expected[index];
    const actualMember = actual[index];
    if (
      !expectedMember ||
      !actualMember ||
      expectedMember.fileName !== actualMember.fileName ||
      expectedMember.present !== actualMember.present
    ) {
      throw new Error("Canonical SQLite file-family presence changed after PowerShell preflight.");
    }
    if (!expectedMember.present || !actualMember.present) {
      continue;
    }
    const mtimeDifferenceMs = Math.abs(Date.parse(actualMember.mtimeIso) - Date.parse(expectedMember.mtimeIso));
    if (
      expectedMember.sha256 !== actualMember.sha256 ||
      expectedMember.size !== actualMember.size ||
      !Number.isFinite(mtimeDifferenceMs) ||
      mtimeDifferenceMs > 1
    ) {
      throw new Error("Canonical SQLite file-family content changed after PowerShell preflight.");
    }
  }
}

function databaseFamiliesMatchStrict(left: FileFamilyFingerprint[], right: FileFamilyFingerprint[]) {
  return (
    left.length === right.length &&
    left.every((leftMember, index) => {
      const rightMember = right[index];
      if (!rightMember || leftMember.fileName !== rightMember.fileName || leftMember.present !== rightMember.present) {
        return false;
      }
      if (!leftMember.present || !rightMember.present) {
        return true;
      }
      return (
        leftMember.sha256 === rightMember.sha256 &&
        leftMember.size === rightMember.size &&
        leftMember.mtimeMs === rightMember.mtimeMs &&
        leftMember.mtimeIso === rightMember.mtimeIso
      );
    })
  );
}

async function verifyCanonicalPreflight(args: ReturnType<typeof parseArguments>) {
  const canonicalDatabase = resolveAbsolute(args.required("canonical-db"), "Canonical database");
  const expectedFamily = parseExpectedDatabaseFamily(args.required("canonical-family-base64"));
  const currentFamily = await fingerprintDatabaseFamily(canonicalDatabase);
  assertCrossRuntimeFamilyMatch(expectedFamily, currentFamily);
  return currentFamily;
}

function withoutAbsolutePath(value: Fingerprint): Omit<Fingerprint, "path"> {
  return {
    fileName: value.fileName,
    sha256: value.sha256,
    size: value.size,
    mtimeMs: value.mtimeMs,
    mtimeIso: value.mtimeIso,
  };
}

async function createClient(databasePath: string): Promise<PrismaClientLike> {
  process.env.DATABASE_URL = toPrismaFileUrl(databasePath);
  const prisma = await import("@prisma/client");
  return new prisma.PrismaClient() as unknown as PrismaClientLike;
}

async function mutationCounts(client: PrismaClientLike): Promise<MutationCounts> {
  const [adminAuditLog, commandExecution, platformAuditEvent, progressEvent, taleSessionEvent] = await Promise.all([
    client.adminAuditLog.count(),
    client.commandExecution.count(),
    client.platformAuditEvent.count({
      where: { action: { not: "VALIDATION_DATABASE_IDENTITY" } },
    }),
    client.progressEvent.count(),
    client.taleSessionEvent.count(),
  ]);

  return {
    adminAuditLog,
    commandExecution,
    platformAuditEvent,
    progressEvent,
    taleSessionEvent,
  };
}

async function readReport(reportPath: string): Promise<IsolationReport> {
  const parsed = JSON.parse(await readFile(reportPath, "utf8")) as Partial<IsolationReport>;
  if (
    parsed.version !== 2 ||
    !parsed.canonicalDatabase ||
    !Array.isArray(parsed.canonicalDatabaseFamily) ||
    parsed.canonicalDatabaseFamily.length !== CANONICAL_DATABASE_SUFFIXES.length ||
    !parsed.isolatedDatabase ||
    parsed.server === undefined
  ) {
    throw new Error("Isolation report version or required evidence is invalid.");
  }
  return parsed as IsolationReport;
}

async function writeReport(reportPath: string, report: IsolationReport) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function fingerprintsMatch(left: Fingerprint, right: Fingerprint) {
  return left.sha256 === right.sha256 && left.size === right.size && left.mtimeMs === right.mtimeMs;
}

async function prepare(args: ReturnType<typeof parseArguments>) {
  const runtimeRoot = resolveAbsolute(args.required("runtime-root"), "Runtime root");
  const seedDatabase = resolveAbsolute(args.required("seed-db"), "Seed database");
  const isolatedDatabase = resolveAbsolute(args.required("copy-db"), "Isolated database");
  const canonicalDatabase = resolveAbsolute(args.required("canonical-db"), "Canonical database");
  const reportPath = resolveAbsolute(args.required("report"), "Isolation report");
  const expectedCanonicalSha256 = args.required("canonical-sha256");
  const expectedCanonicalSize = Number(args.required("canonical-size"));
  const expectedCanonicalMtimeIso = args.required("canonical-mtime-iso");

  assertInside(seedDatabase, runtimeRoot, "Seed database");
  assertInside(isolatedDatabase, runtimeRoot, "Isolated database");
  assertInside(reportPath, runtimeRoot, "Isolation report");
  if (path.extname(isolatedDatabase).toLowerCase() !== ".db") {
    throw new Error("Isolated database must use a .db filename.");
  }

  const databaseUrl = toPrismaFileUrl(isolatedDatabase);
  const canonicalFamily = await verifyCanonicalPreflight(args);
  const canonicalFingerprint = await fingerprint(canonicalDatabase, "absolute");
  const canonicalMtimeDifferenceMs = Math.abs(
    Date.parse(canonicalFingerprint.mtimeIso) - Date.parse(expectedCanonicalMtimeIso),
  );
  if (
    canonicalFingerprint.sha256 !== expectedCanonicalSha256 ||
    canonicalFingerprint.size !== expectedCanonicalSize ||
    !Number.isFinite(canonicalMtimeDifferenceMs) ||
    canonicalMtimeDifferenceMs > 1
  ) {
    throw new Error("Canonical prisma/dev.db changed before the isolated copy was prepared.");
  }
  const seedFingerprint = await fingerprint(seedDatabase, "file-name");
  await mkdir(path.dirname(isolatedDatabase), { recursive: true });
  await copyFile(seedDatabase, isolatedDatabase, fsConstants.COPYFILE_EXCL);

  const nonceHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  const client = await createClient(isolatedDatabase);
  let baselineCounts: MutationCounts;
  try {
    await client.platformAuditEvent.create({
      data: {
        actorType: "VALIDATION_HARNESS",
        action: "VALIDATION_DATABASE_IDENTITY",
        resourceType: "VALIDATION_DATABASE",
        resourceId: nonceHash,
        outcome: "SUCCEEDED",
        correlationId: nonceHash,
        metadata: JSON.stringify({ marker: "phase1-isolation", nonceHash }),
      },
    });
    baselineCounts = await mutationCounts(client);
  } finally {
    await client.$disconnect();
  }

  const baselineFingerprint = await fingerprint(isolatedDatabase, "file-name");
  const report: IsolationReport = {
    version: 2,
    status: "prepared",
    preparedAt: new Date().toISOString(),
    canonicalDatabase: canonicalFingerprint,
    canonicalDatabaseFamily: canonicalFamily,
    seedDatabase: withoutAbsolutePath(seedFingerprint),
    isolatedDatabase: {
      fileName: path.basename(isolatedDatabase),
      nonceHash,
      baselineFingerprint: withoutAbsolutePath(baselineFingerprint),
      baselineCounts,
    },
    server: null,
  };
  await writeReport(reportPath, report);

  console.log(
    JSON.stringify({
      databaseUrl,
      copyFileName: path.basename(isolatedDatabase),
      nonceHash,
      reportPath,
    }),
  );
}

async function recordServer(args: ReturnType<typeof parseArguments>) {
  const reportPath = resolveAbsolute(args.required("report"), "Isolation report");
  const copyDatabase = resolveAbsolute(args.required("copy-db"), "Isolated database");
  const report = await readReport(reportPath);
  const processId = Number(args.required("server-pid"));
  const launcherProcessId = Number(args.required("launcher-pid"));
  const port = Number(args.required("port"));
  const nonceHash = args.required("nonce-hash");
  const launcherCreationTimeUtc = args.required("launcher-creation-utc");
  const listenerCreationTimeUtc = args.required("listener-creation-utc");
  const ancestryVerified = args.required("ancestry-verified") === "true";
  if (!Number.isSafeInteger(processId) || processId <= 0) {
    throw new Error("Server PID is invalid.");
  }
  if (!Number.isSafeInteger(launcherProcessId) || launcherProcessId <= 0) {
    throw new Error("Server launcher PID is invalid.");
  }
  if (port !== 3100) {
    throw new Error("The validation server must own port 3100.");
  }
  if (
    path.basename(copyDatabase) !== report.isolatedDatabase.fileName ||
    nonceHash !== report.isolatedDatabase.nonceHash
  ) {
    throw new Error("Server identity does not match the prepared isolation report.");
  }
  if (
    !ancestryVerified ||
    !Number.isFinite(Date.parse(launcherCreationTimeUtc)) ||
    !Number.isFinite(Date.parse(listenerCreationTimeUtc))
  ) {
    throw new Error("Server process creation identity or ancestry proof is invalid.");
  }

  report.status = "server-started";
  report.server = {
    pid: processId,
    port,
    baseUrl: "http://127.0.0.1:3100",
    databaseFileName: path.basename(copyDatabase),
    nonceHash,
    launcherPid: launcherProcessId,
    identityVerified: false,
    launcherCreationTimeUtc,
    listenerCreationTimeUtc,
    ancestryVerified,
  };
  await writeReport(reportPath, report);
  console.log(JSON.stringify({ recorded: true }));
}

async function checkpoint(args: ReturnType<typeof parseArguments>) {
  const reportPath = resolveAbsolute(args.required("report"), "Isolation report");
  const isolatedDatabase = resolveAbsolute(args.required("copy-db"), "Isolated database");
  const report = await readReport(reportPath);
  if (path.basename(isolatedDatabase) !== report.isolatedDatabase.fileName) {
    throw new Error("Isolated database does not match the prepared report.");
  }

  const client = await createClient(isolatedDatabase);
  let counts: MutationCounts;
  let markerCount: number;
  try {
    markerCount = await client.platformAuditEvent.count({
      where: {
        action: "VALIDATION_DATABASE_IDENTITY",
        correlationId: report.isolatedDatabase.nonceHash,
        resourceId: report.isolatedDatabase.nonceHash,
      },
    });
    counts = await mutationCounts(client);
  } finally {
    await client.$disconnect();
  }
  if (markerCount !== 1) {
    throw new Error("The isolated database identity marker is missing or ambiguous.");
  }

  report.status = "browser-baseline-recorded";
  report.isolatedDatabase.browserBaselineCounts = counts;
  report.isolatedDatabase.browserBaselineFingerprint = withoutAbsolutePath(
    await fingerprint(isolatedDatabase, "file-name"),
  );
  await writeReport(reportPath, report);
  console.log(JSON.stringify({ recorded: true }));
}

async function recordIdentity(args: ReturnType<typeof parseArguments>) {
  const reportPath = resolveAbsolute(args.required("report"), "Isolation report");
  const nonceHash = args.required("nonce-hash");
  const report = await readReport(reportPath);
  if (!report.server || report.server.nonceHash !== nonceHash) {
    throw new Error("Identity response does not match the recorded server.");
  }

  report.status = "identity-verified";
  report.server.identityVerified = true;
  report.server.identityVerifiedAt = new Date().toISOString();
  await writeReport(reportPath, report);
  console.log(JSON.stringify({ recorded: true }));
}

async function verify(args: ReturnType<typeof parseArguments>) {
  const reportPath = resolveAbsolute(args.required("report"), "Isolation report");
  const isolatedDatabase = resolveAbsolute(args.required("copy-db"), "Isolated database");
  const canonicalDatabase = resolveAbsolute(args.required("canonical-db"), "Canonical database");
  const expectMutation = args.required("expect-mutation") === "true";
  const browserSucceeded = args.required("browser-succeeded") === "true";
  const report = await readReport(reportPath);

  if (path.basename(isolatedDatabase) !== report.isolatedDatabase.fileName) {
    throw new Error("Isolated database does not match the prepared report.");
  }

  const client = await createClient(isolatedDatabase);
  let currentCounts: MutationCounts;
  let markerCount: number;
  try {
    markerCount = await client.platformAuditEvent.count({
      where: {
        action: "VALIDATION_DATABASE_IDENTITY",
        correlationId: report.isolatedDatabase.nonceHash,
        resourceId: report.isolatedDatabase.nonceHash,
      },
    });
    currentCounts = await mutationCounts(client);
  } finally {
    await client.$disconnect();
  }
  if (markerCount !== 1) {
    throw new Error("The isolated database identity marker is missing or ambiguous.");
  }

  const comparisonCounts = report.isolatedDatabase.browserBaselineCounts;
  const comparisonFingerprint = report.isolatedDatabase.browserBaselineFingerprint;
  if (expectMutation && (!comparisonCounts || !comparisonFingerprint)) {
    throw new Error("Browser mutation verification requires a pre-browser checkpoint.");
  }
  const changedCounts = (Object.keys(currentCounts) as Array<keyof MutationCounts>).filter(
    (key) => currentCounts[key] > (comparisonCounts ?? report.isolatedDatabase.baselineCounts)[key],
  );
  const observedMutation = changedCounts.length > 0;
  if (expectMutation && !observedMutation) {
    throw new Error("No expected acceptance-test mutation was observed in the isolated copy.");
  }

  const currentCanonicalFamily = await fingerprintDatabaseFamily(canonicalDatabase);
  const canonicalDatabaseFamilyUnchanged = databaseFamiliesMatchStrict(
    currentCanonicalFamily,
    report.canonicalDatabaseFamily,
  );
  const currentCanonical = await fingerprint(canonicalDatabase, "absolute");
  const canonicalDatabaseUnchanged =
    canonicalDatabaseFamilyUnchanged && fingerprintsMatch(currentCanonical, report.canonicalDatabase);
  if (!canonicalDatabaseUnchanged || !canonicalDatabaseFamilyUnchanged) {
    throw new Error("Canonical SQLite file family changed during isolated validation.");
  }

  const currentIsolated = await fingerprint(isolatedDatabase, "file-name");
  if (
    expectMutation &&
    fingerprintsMatch(currentIsolated, comparisonFingerprint ?? report.isolatedDatabase.baselineFingerprint)
  ) {
    throw new Error("The isolated database fingerprint did not change after mutating tests.");
  }

  report.status = browserSucceeded
    ? "isolation-verified"
    : expectMutation
      ? "browser-failed-isolation-verified"
      : "isolation-verified-no-browser";
  report.verification = {
    checkedAt: new Date().toISOString(),
    browserSucceeded,
    expectedMutation: expectMutation,
    observedMutation,
    changedCounts,
    isolatedDatabase: withoutAbsolutePath(currentIsolated),
    canonicalDatabaseUnchanged,
    canonicalDatabaseFamilyUnchanged,
  };
  await writeReport(reportPath, report);
  console.log(
    JSON.stringify({
      canonicalDatabaseUnchanged,
      canonicalDatabaseFamilyUnchanged,
      changedCounts,
      observedMutation,
      status: report.status,
    }),
  );
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.mode === "prepare") {
    await prepare(args);
    return;
  }
  if (args.mode === "verify-canonical") {
    await verifyCanonicalPreflight(args);
    console.log(JSON.stringify({ canonicalDatabaseFamilyUnchanged: true }));
    return;
  }
  if (args.mode === "record-server") {
    await recordServer(args);
    return;
  }
  if (args.mode === "checkpoint") {
    await checkpoint(args);
    return;
  }
  if (args.mode === "record-identity") {
    await recordIdentity(args);
    return;
  }
  if (args.mode === "verify") {
    await verify(args);
    return;
  }
  throw new Error(`Unsupported mode: ${args.mode}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
