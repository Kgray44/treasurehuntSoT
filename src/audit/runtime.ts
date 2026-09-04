import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { workspaceCapabilityOverview } from "@/homeport/workspace-capabilities";
import { auditModeEnabled } from "./host";

type AuditEnvironment = NodeJS.ProcessEnv;

type AuditPersona = "player" | "captain-player" | "creator" | "admiralty";

type AuditPersonaRegistry = {
  classification: "SYNTHETIC_DISPOSABLE_AUDIT_DATA";
  sourceSha: string;
  personas: Record<AuditPersona, { accountId: string; destination: string }>;
};

type AuditFixtureReceipt = {
  classification: "SYNTHETIC_DISPOSABLE_AUDIT_DATA";
  sourceSha: string;
  fixtureVersion: string;
  databasePath: string;
  databaseHash: string;
};

export type AuditRuntimeConfig = Readonly<{
  root: string;
  sourceSha: string;
  databasePath: string;
  privateContentRoot: string;
  profileMediaRoot: string;
  syntheticOutboxPath: string;
  hostname: string;
  publicOrigin: string;
  localOrigin: string;
  fixtureReceiptPath: string;
  personaRegistryPath: string;
}>;

export class AuditRuntimeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AuditRuntimeError";
  }
}

function required(environment: AuditEnvironment, name: string) {
  const value = environment[name]?.trim();
  if (!value) throw new AuditRuntimeError(`AUDIT_REQUIRED_${name}`);
  return value;
}

function exactHostname(value: string, code: string) {
  const hostname = value.trim().toLowerCase();
  if (
    hostname.length > 253 ||
    hostname.includes(":") ||
    hostname.includes("/") ||
    hostname.includes("*") ||
    !hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
  )
    throw new AuditRuntimeError(code);
  return hostname;
}

function exactOrigin(value: string, code: string) {
  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new AuditRuntimeError(code);
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new AuditRuntimeError(code);
  return origin;
}

function isInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function requireInside(root: string, candidate: string, code: string) {
  if (!isInside(root, candidate)) throw new AuditRuntimeError(code);
  return candidate;
}

function sqlitePath(value: string) {
  if (!value.startsWith("file:")) throw new AuditRuntimeError("AUDIT_DATABASE_NOT_SQLITE");
  const raw = decodeURIComponent(value.slice("file:".length));
  if (!raw || raw.startsWith("//") || raw.includes("?") || raw.includes("#"))
    throw new AuditRuntimeError("AUDIT_DATABASE_URL_INVALID");
  return path.resolve(raw);
}

function rejectConfiguredSecrets(environment: AuditEnvironment) {
  const forbidden = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "PRIVATE_CONTENT_S3_ENDPOINT",
    "PRIVATE_CONTENT_S3_BUCKET",
    "PRIVATE_CONTENT_KMS_KEY_ID",
    "PRIVATE_CONTENT_KMS_ENDPOINT",
    "VOYAGEWRIGHT_GOOGLE_CLIENT_ID",
    "VOYAGEWRIGHT_GOOGLE_CLIENT_SECRET",
    "VOYAGEWRIGHT_GITHUB_CLIENT_ID",
    "VOYAGEWRIGHT_GITHUB_CLIENT_SECRET",
    "STEAM_OPENID_RETURN_URI",
    "STEAM_OPENID_REALM",
    "RESEND_API_KEY",
    "RESEND_FROM_ADDRESS",
    "RESEND_FROM_NAME",
    "POSTMARK_SERVER_TOKEN",
    "POSTMARK_FROM_ADDRESS",
    "POSTMARK_FROM_NAME",
    "POSTMARK_TRANSACTIONAL_MESSAGE_STREAM",
  ];
  const configured = forbidden.find((name) => environment[name]?.trim());
  if (configured) throw new AuditRuntimeError(`AUDIT_FORBIDDEN_CONFIGURATION_${configured}`);
}

export function auditRuntimeConfig(environment: AuditEnvironment = process.env): AuditRuntimeConfig | null {
  const mode = environment.VOYAGEWRIGHT_AUDIT_MODE?.trim();
  if (!mode || mode === "false") return null;
  if (!auditModeEnabled(environment)) throw new AuditRuntimeError("AUDIT_MODE_INVALID");

  const localAppData = path.resolve(required(environment, "LOCALAPPDATA"));
  const allowedRoot = path.resolve(localAppData, "VoyagewrightBrightwork");
  const root = path.resolve(required(environment, "VOYAGEWRIGHT_AUDIT_ROOT"));
  if (!isInside(allowedRoot, root)) throw new AuditRuntimeError("AUDIT_ROOT_REFUSED");

  const hostname = exactHostname(required(environment, "VOYAGEWRIGHT_AUDIT_HOSTNAME"), "AUDIT_HOSTNAME_INVALID");
  const publicOrigin = exactOrigin(
    required(environment, "VOYAGEWRIGHT_AUDIT_PUBLIC_ORIGIN"),
    "AUDIT_PUBLIC_ORIGIN_INVALID",
  );
  const localOrigin = exactOrigin(
    required(environment, "VOYAGEWRIGHT_AUDIT_LOCAL_ORIGIN"),
    "AUDIT_LOCAL_ORIGIN_INVALID",
  );
  if (publicOrigin.hostname.toLowerCase() !== hostname) throw new AuditRuntimeError("AUDIT_PUBLIC_HOST_MISMATCH");
  if (
    !["localhost", "127.0.0.1", "::1"].includes(localOrigin.hostname.toLowerCase()) &&
    !localOrigin.hostname.endsWith(".localhost")
  )
    throw new AuditRuntimeError("AUDIT_LOCAL_ORIGIN_NOT_LOOPBACK");
  if (environment.HOMEPORT_PUBLIC_APP_ORIGIN?.trim() !== publicOrigin.origin)
    throw new AuditRuntimeError("AUDIT_HOMEPORT_PUBLIC_ORIGIN_MISMATCH");
  if (environment.NEXT_PUBLIC_APP_URL?.trim() !== publicOrigin.origin)
    throw new AuditRuntimeError("AUDIT_NEXT_PUBLIC_URL_MISMATCH");

  const databasePath = sqlitePath(required(environment, "DATABASE_URL"));
  const expectedDatabasePath = path.resolve(root, "database", "brightwork-stage6-audit.db");
  if (databasePath !== expectedDatabasePath) throw new AuditRuntimeError("AUDIT_DATABASE_PATH_REFUSED");

  const privateContentRoot = requireInside(
    root,
    path.resolve(required(environment, "PRIVATE_CONTENT_PROVIDER_ROOT")),
    "AUDIT_PRIVATE_ROOT_REFUSED",
  );
  const profileMediaRoot = requireInside(
    root,
    path.resolve(required(environment, "PROFILE_MEDIA_ROOT")),
    "AUDIT_PROFILE_MEDIA_ROOT_REFUSED",
  );
  const syntheticOutboxPath = requireInside(
    root,
    path.resolve(required(environment, "HOMEPORT_SYNTHETIC_OUTBOX_PATH")),
    "AUDIT_OUTBOX_PATH_REFUSED",
  );
  if (
    environment.PRIVATE_CONTENT_ENABLED !== "false" ||
    environment.PRIVATE_CONTENT_STORAGE_PROVIDER !== "local" ||
    environment.PRIVATE_CONTENT_SCANNER_PROVIDER !== "disabled" ||
    environment.PRIVATE_CONTENT_KEY_PROVIDER !== "local" ||
    environment.PRIVATE_CONTENT_WORKER_ENABLED !== "false" ||
    environment.OUTBOUND_EMAIL_DISABLED !== "true" ||
    environment.HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER !== "SYNTHETIC_OUTBOX" ||
    environment.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER !== "TASK_OWNED_TEST" ||
    environment.HOMEPORT_PHASE7_TASK_ROOT !== root ||
    environment.VOYAGEWRIGHT_OAUTH_TEST_MODE !== "false" ||
    environment.NEXT_DIST_DIR !== ".next-brightwork-stage6-creator-continuation"
  )
    throw new AuditRuntimeError("AUDIT_PROVIDER_ISOLATION_INVALID");
  rejectConfiguredSecrets(environment);

  return {
    root,
    sourceSha: required(environment, "VOYAGEWRIGHT_BUILD_SHA"),
    databasePath,
    privateContentRoot,
    profileMediaRoot,
    syntheticOutboxPath,
    hostname,
    publicOrigin: publicOrigin.origin,
    localOrigin: localOrigin.origin,
    fixtureReceiptPath: path.resolve(root, "reports", "audit-fixture-receipt.json"),
    personaRegistryPath: path.resolve(root, "reports", "audit-personas.json"),
  };
}

async function readJson<T>(file: string, code: string) {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    throw new AuditRuntimeError(code);
  }
}

async function sha256(file: string) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

async function assertSyntheticDatabase(config: AuditRuntimeConfig, personas: AuditPersonaRegistry) {
  const sqlite = await import("node:sqlite");
  const database = new sqlite.DatabaseSync(config.databasePath, { readOnly: true });
  try {
    const emails = database.prepare("SELECT normalizedEmail FROM AccountEmail").all() as { normalizedEmail: string }[];
    if (!emails.length || emails.some(({ normalizedEmail }) => !normalizedEmail.endsWith(".example.test")))
      throw new AuditRuntimeError("AUDIT_DATABASE_NOT_SYNTHETIC");
    const statement = database.prepare("SELECT id FROM UserAccount WHERE id = ?");
    for (const persona of Object.values(personas.personas)) {
      if (!statement.get(persona.accountId)) throw new AuditRuntimeError("AUDIT_PERSONA_ACCOUNT_MISSING");
    }
    const creator = personas.personas.creator;
    const creatorAccount = database
      .prepare("SELECT status, claimedAt, ordinaryWorkspaceEntryAt FROM UserAccount WHERE id = ?")
      .get(creator.accountId) as
      | { status: string; claimedAt: string | null; ordinaryWorkspaceEntryAt: string | null }
      | undefined;
    const creatorEmail = database
      .prepare("SELECT verificationState FROM AccountEmail WHERE accountId = ? AND isPrimary = 1")
      .get(creator.accountId) as { verificationState: string } | undefined;
    const creatorProfile = database
      .prepare("SELECT id, status FROM PlayerProfile WHERE accountId = ?")
      .get(creator.accountId) as { id: string; status: string } | undefined;
    const creatorRole = database
      .prepare(
        "SELECT id FROM AccountRoleAssignment WHERE accountId = ? AND role = 'CREATOR' AND scopeType = 'GLOBAL' AND scopeId IS NULL AND revokedAt IS NULL",
      )
      .get(creator.accountId);
    const activeCreatorMembership = creatorProfile
      ? database
          .prepare(
            "SELECT membership.id FROM PlaythroughMembership membership JOIN TaleSession voyage ON voyage.id = membership.playthroughId WHERE membership.playerProfileId = ? AND membership.status IN ('ACCEPTED', 'READY', 'ACTIVE_MEMBER') AND voyage.status = 'ACTIVE' AND voyage.previewMode = 0 LIMIT 1",
          )
          .get(creatorProfile.id)
      : null;
    const ownedChronicle = database
      .prepare("SELECT id FROM Chronicle WHERE creatorAccountId = ? AND archivedAt IS NULL LIMIT 1")
      .get(creator.accountId);
    if (
      creatorAccount?.status !== "ACTIVE" ||
      !creatorAccount.claimedAt ||
      !creatorAccount.ordinaryWorkspaceEntryAt ||
      creatorEmail?.verificationState !== "VERIFIED" ||
      creatorProfile?.status !== "ACTIVE" ||
      !creatorRole ||
      activeCreatorMembership ||
      !ownedChronicle
    )
      throw new AuditRuntimeError("AUDIT_CREATOR_PERSONA_INCOHERENT");
  } finally {
    database.close();
  }
}

async function assertCreatorStudioAuthorization(personas: AuditPersonaRegistry) {
  const creator = personas.personas.creator;
  const overview = await workspaceCapabilityOverview(creator.accountId);
  const workspace = overview.workspaces.find((candidate) => candidate.id === "CREATOR");
  if (workspace?.state !== "ACTIVE" || workspace.href !== "/studio/library")
    throw new AuditRuntimeError("AUDIT_CREATOR_STUDIO_UNAVAILABLE");
}

export async function assertAuditRuntimeSafe(
  environment: AuditEnvironment = process.env,
  options: { verifyFixtureHash?: boolean } = {},
) {
  const config = auditRuntimeConfig(environment);
  if (!config) return null;
  const [receipt, personas, database] = await Promise.all([
    readJson<AuditFixtureReceipt>(config.fixtureReceiptPath, "AUDIT_FIXTURE_RECEIPT_MISSING"),
    readJson<AuditPersonaRegistry>(config.personaRegistryPath, "AUDIT_PERSONA_REGISTRY_MISSING"),
    stat(config.databasePath).catch(() => null),
  ]);
  if (!database?.isFile() || database.size < 1) throw new AuditRuntimeError("AUDIT_DATABASE_MISSING");
  if (
    receipt.classification !== "SYNTHETIC_DISPOSABLE_AUDIT_DATA" ||
    personas.classification !== "SYNTHETIC_DISPOSABLE_AUDIT_DATA" ||
    receipt.sourceSha !== config.sourceSha ||
    personas.sourceSha !== config.sourceSha ||
    path.resolve(receipt.databasePath) !== config.databasePath ||
    !/^[a-f0-9]{64}$/u.test(receipt.databaseHash) ||
    !Object.values(personas.personas).every(
      (persona) =>
        typeof persona.accountId === "string" && persona.accountId.length > 0 && persona.destination.startsWith("/"),
    )
  )
    throw new AuditRuntimeError("AUDIT_FIXTURE_RECEIPT_INVALID");
  if (options.verifyFixtureHash && receipt.databaseHash !== (await sha256(config.databasePath)))
    throw new AuditRuntimeError("AUDIT_FIXTURE_DATABASE_HASH_MISMATCH");
  await assertSyntheticDatabase(config, personas);
  await assertCreatorStudioAuthorization(personas);
  return { config, receipt, personas };
}

export function auditPersonaNames(): readonly AuditPersona[] {
  return ["player", "captain-player", "creator", "admiralty"];
}
