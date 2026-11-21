import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat, realpath } from "node:fs/promises";
import { resolve, join, dirname, relative, isAbsolute, basename } from "node:path";
import type { StudioDraftInput } from "../../src/chronicle/types";

// This helper provisions only its own synthetic database. It never starts a server,
// changes a primary environment, or replaces an existing immutable publication.
const root = resolve("D:/CodexTemp/ncl01-preview");
const accessFile = join(root, "access.private.json");
const environmentFile = join(root, "runtime-env.private.json");
const failureFile = join(root, "preparation-failure.private.json");
type Access = {
  schemaVersion: 1;
  task: "NCL01";
  database: string;
  nonceHash: string;
  email: string;
  password: string;
  schemaReady: boolean;
  accountId?: string;
  chronicleId?: string;
  versionId?: string;
  voyageId?: string;
};
let stage = "OWNERSHIP";
let privateStorageVerified = false;

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT") return false;
    throw cause;
  }
}
async function persist(access: Access) {
  await writeFile(accessFile, `${JSON.stringify(access, null, 2)}\n`, { mode: 0o600 });
}
function protectPrivateStorage() {
  // Windows ignores POSIX mode0600. Change only this exact task directory and
  // its named private files; preserve their data and verify the resulting DACLs.
  execFileSync(
    "pwsh.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      String.raw`
$ErrorActionPreference = 'Stop'
$previewRoot = 'D:\CodexTemp\ncl01-preview'
$previewItem = Get-Item -LiteralPath $previewRoot -Force
if ($previewItem.FullName -ine $previewRoot -or ($previewItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'NCL01_PREVIEW_ACL_SCOPE_REFUSED' }
$previewSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
function Test-PrivatePreviewAcl([string] $path) {
  $candidateAcl = Get-Acl -LiteralPath $path
  if (!$candidateAcl.AreAccessRulesProtected) { return $false }
  $candidateRules = $candidateAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
  if ($candidateRules.Count -ne 2) { return $false }
  foreach ($candidateRule in $candidateRules) {
    if ($candidateRule.IdentityReference.Value -notin @($previewSid.Value, $systemSid.Value) -or $candidateRule.AccessControlType -ne 'Allow' -or $candidateRule.FileSystemRights -ne 'FullControl') { return $false }
  }
  return $true
}
$directoryAcl = [Security.AccessControl.DirectorySecurity]::new()
$directoryAcl.SetOwner($previewSid)
$directoryAcl.SetAccessRuleProtection($true, $false)
foreach ($principal in @($previewSid, $systemSid)) {
  $rule = [Security.AccessControl.FileSystemAccessRule]::new($principal, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $directoryAcl.AddAccessRule($rule)
}
if (!(Test-PrivatePreviewAcl $previewRoot)) { Set-Acl -LiteralPath $previewRoot -AclObject $directoryAcl }
$targets = @($previewRoot)
foreach ($name in @('access.private.json', 'runtime-env.private.json', 'outbox.private.jsonl', 'preparation-failure.private.json')) {
  $privatePath = Join-Path $previewRoot $name
  if (!(Test-Path -LiteralPath $privatePath)) { continue }
  $privateItem = Get-Item -LiteralPath $privatePath -Force
  if ($privateItem.PSIsContainer -or ($privateItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'NCL01_PREVIEW_PRIVATE_FILE_REPARSE_REFUSED' }
  $fileAcl = [Security.AccessControl.FileSecurity]::new()
  $fileAcl.SetOwner($previewSid)
  $fileAcl.SetAccessRuleProtection($true, $false)
  foreach ($principal in @($previewSid, $systemSid)) {
    $fileAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($principal, 'FullControl', 'Allow'))
  }
  if (!(Test-PrivatePreviewAcl $privatePath)) { Set-Acl -LiteralPath $privatePath -AclObject $fileAcl }
  $targets += $privatePath
}
foreach ($target in $targets) {
  $verifiedAcl = Get-Acl -LiteralPath $target
  if (!$verifiedAcl.AreAccessRulesProtected) { throw 'NCL01_PREVIEW_ACL_NOT_PROTECTED' }
  $rules = $verifiedAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
  if ($rules.Count -ne 2) { throw 'NCL01_PREVIEW_ACL_RULE_COUNT_INVALID' }
  foreach ($rule in $rules) {
    if ($rule.IdentityReference.Value -notin @($previewSid.Value, $systemSid.Value) -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl') { throw 'NCL01_PREVIEW_ACL_RULE_INVALID' }
  }
}
Write-Output 'NCL01_PREVIEW_PRIVATE_ACL_VERIFIED'
`,
    ],
    { encoding: "utf8", stdio: "pipe", windowsHide: true, timeout: 30000 },
  );
}
function inside(parent: string, path: string) {
  const child = relative(parent, path);
  return Boolean(child) && !child.startsWith("..") && !isAbsolute(child);
}

async function main() {
  if (process.platform !== "win32" || process.env.VOYAGEWRIGHT_AUDIT_MODE === "true")
    throw new Error("NCL01_PREVIEW_TASK_ENVIRONMENT_REQUIRED");
  const mode = process.argv[2] ?? "prepare";
  if (!["prepare", "status", "rotate-password"].includes(mode)) throw new Error("NCL01_PREVIEW_COMMAND_INVALID");
  const origin = new URL(process.argv[3] ?? "https://localhost:3443");
  if (
    !["https:", "http:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("NCL01_PREVIEW_ORIGIN_INVALID");
  await mkdir(root, { recursive: true });
  const actualRoot = await realpath(root);
  if (actualRoot.toLowerCase() !== root.toLowerCase()) throw new Error("NCL01_PREVIEW_ROOT_REPARSE_REFUSED");
  protectPrivateStorage();
  privateStorageVerified = true;
  let access: Access;
  if (await exists(accessFile)) {
    access = JSON.parse(await readFile(accessFile, "utf8"));
    if (
      access.schemaVersion !== 1 ||
      access.task !== "NCL01" ||
      !inside(join(root, "artifacts", "sounding-line"), resolve(access.database)) ||
      !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/.test(basename(access.database)) ||
      !/^[a-f0-9]{64}$/.test(access.nonceHash) ||
      access.email !== "navigator.ncl01@example.test" ||
      typeof access.password !== "string"
    )
      throw new Error("NCL01_PREVIEW_OWNERSHIP_INVALID");
  } else {
    if (mode !== "prepare") throw new Error("NCL01_PREVIEW_NOT_PREPARED");
    const stamp = new Date().toISOString().replace(/\D/g, "");
    const unique = randomBytes(16).toString("hex");
    access = {
      schemaVersion: 1,
      task: "NCL01",
      schemaReady: false,
      database: join(
        root,
        "artifacts",
        "sounding-line",
        `generic-${execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim().slice(0, 12)}`,
        `validation-isolated-${stamp.slice(0, 8)}-${stamp.slice(8)}-${unique}.db`,
      ),
      nonceHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
      email: "navigator.ncl01@example.test",
      password: `Ncl!${randomBytes(30).toString("base64url")}`,
    };
    await writeFile(accessFile, `${JSON.stringify(access, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  }
  await mkdir(dirname(access.database), { recursive: true });
  if (!inside(actualRoot, await realpath(dirname(access.database))))
    throw new Error("NCL01_PREVIEW_DATABASE_REPARSE_REFUSED");
  const databaseUrl = `file:${access.database.replaceAll("\\", "/")}`;
  const environment: Record<string, string> = {
    DATABASE_URL: databaseUrl,
    FOREVER_VALIDATION_ISOLATION: "1",
    FOREVER_VALIDATION_NONCE_HASH: access.nonceHash,
    SOUNDING_LINE_SUITE_PROFILE: "generic",
    SOUNDING_LINE_TASK_OWNED_HTTP: "1",
    HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
    HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
    HOMEPORT_PHASE7_TASK_ROOT: root,
    HOMEPORT_SYNTHETIC_OUTBOX_PATH: join(root, "outbox.private.jsonl"),
    OUTBOUND_EMAIL_DISABLED: "true",
    PRIVATE_CONTENT_PROVIDER_ROOT: join(root, "private-content"),
    PROFILE_MEDIA_ROOT: join(root, "profile-media"),
  };
  Object.assign(process.env, environment, {
    LOG_LEVEL: "silent",
    NODE_ENV: "development",
    HOMEPORT_PUBLIC_APP_ORIGIN: origin.origin,
    NEXT_PUBLIC_APP_URL: origin.origin,
  });
  if (!access.schemaReady) {
    if (mode === "status" || (await exists(access.database))) throw new Error("NCL01_PREVIEW_PARTIAL_SCHEMA_PRESERVED");
    stage = "SQLITE_BOOTSTRAP";
    execFileSync(process.execPath, ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", databaseUrl], {
      env: process.env,
      stdio: "pipe",
      timeout: 120000,
      windowsHide: true,
    });
    execFileSync(process.execPath, ["scripts/sounding-line/prepare-validation-isolation.mjs"], {
      env: process.env,
      stdio: "pipe",
      timeout: 120000,
      windowsHide: true,
    });
    access.schemaReady = true;
    await persist(access);
  }
  const { PrismaClient } = await import("@prisma/client");
  const isolated = new PrismaClient({ datasourceUrl: databaseUrl, log: [] });
  // Canonical services share this process-local client, with an explicit task database.
  (globalThis as unknown as { prisma: typeof isolated }).prisma = isolated;
  const { db } = await import("../../src/lib/db");
  if (db !== isolated) throw new Error("NCL01_PREVIEW_DATABASE_SINGLETON_MISMATCH");
  try {
    if (mode === "rotate-password") {
      stage = "ROTATE_SYNTHETIC_PASSWORD";
      if (!access.accountId || !access.voyageId) throw new Error("NCL01_PREVIEW_NOT_READY");
      const owner = await db.accountEmail.findUniqueOrThrow({ where: { normalizedEmail: access.email } });
      if (owner.accountId !== access.accountId) throw new Error("NCL01_PREVIEW_ACCOUNT_BINDING_INVALID");
      const accounts = await import("../../src/wayfarer/accounts");
      await accounts.requestPasswordReset(access.email);
      const delivery = (await readFile(environment.HOMEPORT_SYNTHETIC_OUTBOX_PATH, "utf8"))
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line))
        .filter(
          (value) =>
            value.accountId === access.accountId && value.email === access.email && value.purpose === "PASSWORD_RESET",
        )
        .at(-1);
      if (!delivery?.token) throw new Error("NCL01_PREVIEW_SYNTHETIC_RESET_MISSING");
      const password = `Ncl!${randomBytes(30).toString("base64url")}`;
      await accounts.resetPassword(delivery.token, password);
      access.password = password;
      await persist(access);
      protectPrivateStorage();
    }
    // A ready preview retains its Voyage/progression and never rotates credentials.
    if (mode === "prepare" && !access.voyageId) {
      stage = "ACCOUNT";
      const accounts = await import("../../src/wayfarer/accounts");
      let account = await db.userAccount.findFirst({
        where: { emails: { some: { normalizedEmail: access.email } } },
        include: { profile: true },
      });
      if (!account) {
        const registered = await accounts.registerAccount({
          email: access.email,
          password: access.password,
          confirmPassword: access.password,
          displayName: "NCL01 Synthetic Navigator",
          deviceLabel: "NCL01 task preview",
        });
        account = registered.account;
      }
      if (access.accountId && account.id !== access.accountId) throw new Error("NCL01_PREVIEW_ACCOUNT_BINDING_INVALID");
      access.accountId = account.id;
      await persist(access);
      if (account.status === "PENDING_VERIFICATION") {
        const outbox = (await readFile(environment.HOMEPORT_SYNTHETIC_OUTBOX_PATH, "utf8"))
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line));
        const delivery = outbox
          .filter(
            (value) =>
              value.accountId === account!.id && value.email === access.email && value.purpose === "VERIFY_EMAIL",
          )
          .at(-1);
        if (!delivery?.token) throw new Error("NCL01_PREVIEW_SYNTHETIC_VERIFICATION_MISSING");
        await accounts.verifyAccountEmail(account.id, delivery.token);
      }
      const capabilities = await import("../../src/homeport/workspace-capabilities");
      await capabilities.reconcileClaimedAccountCapabilities({ accountId: account.id, mode: "COMMIT" });
      await capabilities.activateWorkspaceCapability(account.id, "CREATOR");
      await capabilities.activateWorkspaceCapability(account.id, "CAPTAIN");
      const authenticated = await accounts.authenticateAccount(
        access.email,
        access.password,
        "NCL01 fixture credential check",
      );
      if (!authenticated || authenticated.account.status !== "ACTIVE")
        throw new Error("NCL01_PREVIEW_AUTHENTICATION_FAILED");

      stage = "SPATIAL_LIBRARY";
      const library = await import("../../src/parallax/library-service");
      const { createSpatialDraft } = await import("../../src/parallax/authoring");
      const { identityTransform } = await import("../../src/parallax/contracts");
      const definitionId = "ncl01-original-model-scene";
      let record = (await library.listSpatialItems(account.id)).find((item) => item.id === definitionId);
      if (!record) {
        const draft = createSpatialDraft(definitionId, "Desk Map");
        draft.content.title = "The Compass and the Chest";
        draft.content.anchors[0].transform = identityTransform();
        const compass = draft.content.entities[0];
        compass.kind = "MARKER";
        compass.name = "The Navigator’s Brass Compass";
        compass.widthMeters = 0.16;
        compass.transform.position = { x: -0.2, y: 0, z: 0.1 };
        compass.content = "The needle marks north. The chest’s inscription says: keep the northern light burning.";
        compass.alternativeText =
          "An original brass compass, sixteen centimeters wide, resting upright beside a chest.";
        compass.element = {
          kind: "PHYSICAL_ASSET",
          enabled: true,
          modelId: "brass-compass",
          packageVersion: "1.0.0",
          articulation: 0,
        };
        const chest = structuredClone(compass);
        chest.id = `${definitionId}:chest`;
        chest.name = "The Navigator’s Treasure Chest";
        chest.widthMeters = 0.4;
        chest.transform.position = { x: 0.15, y: 0, z: -0.05 };
        chest.content = "Keep the northern light burning. This synthetic chest preserves the same clue in every view.";
        chest.alternativeText =
          "An original closed treasure chest, forty centimeters wide, standing upright on the same surface.";
        chest.element = {
          kind: "PHYSICAL_ASSET",
          enabled: true,
          modelId: "treasure-chest",
          packageVersion: "1.0.0",
          articulation: 0,
        };
        draft.content.entities.push(chest);
        draft.content.studio!.layers.push({ ...structuredClone(draft.content.studio!.layers[0]), entityId: chest.id });
        draft.content.fallback.narrative =
          "The brass compass marks north. The chest reads: keep the northern light burning. Inspect either object here to read the same clue.";
        await library.saveSpatialDraft(account.id, draft, 0);
        record = (await library.listSpatialItems(account.id)).find((item) => item.id === definitionId);
      }
      if (!record) throw new Error("NCL01_PREVIEW_SCENE_MISSING");
      if (!record.releases.length) await library.releaseSpatialVersion(account.id, definitionId, record.revision);
      record = (await library.listSpatialItems(account.id)).find((item) => item.id === definitionId)!;
      const moment = library.materializeLibraryMoment(record.draft, account.id, 1);
      if (record.releases.length !== 1 || record.releases[0].checksum !== moment.version.checksum)
        throw new Error("NCL01_PREVIEW_IMMUTABLE_SCENE_CHANGED");

      stage = "CHRONICLE_DRAFT";
      const studio = await import("../../src/chronicle/studio-service");
      const slug = "ncl01-compass-and-chest";
      let tale = await db.chronicle.findFirst({ where: { slug, creatorAccountId: account.id } });
      if (!tale) {
        const created = await studio.createStudioTale({
          title: "The Northern Light — NCL01",
          slug,
          creatorId: account.id,
          visibility: "PRIVATE",
          playerCountMin: 1,
          playerCountMax: 1,
        });
        tale = await db.chronicle.findUniqueOrThrow({ where: { id: created.id } });
      }
      access.chronicleId = tale.id;
      await persist(access);
      if (!tale.latestPublishedVersionId) {
        const source = await studio.getStudioTale(tale.id);
        const clueId = `${tale.id}:clue`,
          endId = `${tale.id}:ending`;
        moment.attachment = { ...moment.attachment, id: `${clueId}:spatial`, storyMomentId: clueId };
        const { getBlockDefinition } = await import("../../src/chronicle/block-registry");
        const defaults = (type: string) => {
          const result = { ...getBlockDefinition(type)!.defaultConfiguration };
          delete result.completionMode;
          return result;
        };
        const chapters: StudioDraftInput["chapters"] = [
          {
            id: `${tale.id}:chapter`,
            title: "The Northern Light",
            blocks: [
              {
                id: clueId,
                blockType: "narrative",
                title: "The Compass and the Chest",
                isEnabled: true,
                configuration: {
                  ...defaults("narrative"),
                  heading: "A clue on your table",
                  body: "Open Chronicle Lens to inspect the original brass compass and treasure chest. In the native app, move slowly to find a clear horizontal surface. Tap an object, then choose Inspect. Guided View carries exactly the same clue. Your Voyage advances through the Journal’s ordinary Continue action.",
                },
                presentation: {
                  transitionIn: "fade",
                  transitionOut: "fade",
                  spatialMoment: JSON.parse(JSON.stringify(moment)),
                },
                completion: { mode: "playerConfirmation" },
                connections: [{ targetBlockId: endId, connectionType: "DEFAULT" }],
              },
              {
                id: endId,
                blockType: "taleComplete",
                title: "The Northern Light",
                isEnabled: true,
                configuration: {
                  ...defaults("taleComplete"),
                  finaleHeading: "Keep the northern light burning",
                  finaleContent:
                    "You read the same authored clue through one canonical Voyage. This synthetic Journal remains available for review.",
                },
                presentation: { transitionIn: "fade", transitionOut: "fade" },
                completion: { mode: "playerConfirmation" },
                connections: [],
              },
            ],
          },
        ];
        await studio.saveStudioDraft(tale.id, { ...source.draft, tale: source.tale, chapters }, account.id);

        stage = "DRYDOCK_PUBLICATION";
        const { snapshotFromStudio, publishedSourceChecksum } = await import("../../src/chronicle/snapshot");
        const snapshot = snapshotFromStudio(await studio.getStudioTale(tale.id));
        const checksum = publishedSourceChecksum(snapshot);
        const scenarioId = `ncl01-${checksum.slice(0, 24)}`;
        const { saveDrydockScenario } = await import("../../src/drydock/scenario-store");
        const suites = await import("../../src/drydock/suite-store");
        if (!(await db.drydockScenario.findFirst({ where: { scenarioId, draft: { taleId: tale.id } } }))) {
          await saveDrydockScenario(tale.id, {
            schemaVersion: 1,
            id: scenarioId,
            revision: 1,
            sourceChecksum: checksum,
            title: "NCL01 accessible canonical Journal completion",
            purpose:
              "Verify ordinary progression with optional native rendering and identical accessible clue meaning.",
            seed: "ncl01-owner-preview",
            initialState: { variables: {}, inventory: [], actorMode: "PLAYER" },
            environment: {
              virtualStart: "2026-10-15T12:00:00.000Z",
              locale: "en-US",
              viewport: "DESKTOP",
              reducedMotion: true,
              soundEnabled: false,
              keyboardOnly: true,
            },
            limits: { maxSteps: 30, maxStates: 30, maxTraceEntries: 200, maxVirtualMilliseconds: 600000 },
            inputs: [{ kind: "CONTINUE" }, { kind: "CONTINUE" }],
            faults: [],
            assertions: [{ kind: "RUN_COMPLETES" }, { kind: "IDEMPOTENCY_PRESERVED" }],
            tags: ["required:BASELINE_SUCCESS"],
          });
        }
        const suiteId = `${scenarioId}-suite`;
        if (!(await db.drydockScenarioSuite.findFirst({ where: { suiteId, draft: { taleId: tale.id } } })))
          await suites.saveDrydockScenarioSuite(
            tale.id,
            {
              schemaVersion: 1,
              id: suiteId,
              title: "NCL01 synthetic model clue",
              sourceChecksum: checksum,
              members: [{ scenarioId, revision: 1 }],
            },
            checksum,
          );
        const proof = await suites.runDrydockScenarioSuite(tale.id, suiteId, snapshot);
        if (proof.proofStatus !== "COMPLETE") throw new Error("NCL01_PREVIEW_DRYDOCK_INCOMPLETE_PROOF");
        const { publishTale } = await import("../../src/chronicle/publishing");
        await publishTale(
          tale.id,
          account.id,
          "Synthetic owner preview: exact original compass and chest, canonical Journal progression, physical AR qualification pending.",
        );
        tale = await db.chronicle.findUniqueOrThrow({ where: { id: tale.id } });
      }
      access.versionId = tale.latestPublishedVersionId!;
      await persist(access);
      stage = "VOYAGE_LAUNCH";
      let voyage = await db.taleSession.findFirst({
        where: { taleId: tale.id, captainAccountId: account.id, previewMode: false },
        orderBy: { startedAt: "desc" },
      });
      if (!voyage) {
        const { createPlaythroughAndInvitations } = await import("../../src/platform/invitations");
        const created = await createPlaythroughAndInvitations(
          {
            taleId: tale.id,
            versionId: access.versionId,
            voyageName: "NCL01 — The Northern Light",
            captainParticipationMode: "CAPTAIN_AND_PLAYER",
            captainMode: "RULE_CONTROLLED",
            testVoyage: true,
            players: [],
          },
          account.id,
          origin.origin,
        );
        voyage = await db.taleSession.findUniqueOrThrow({ where: { id: created.playthroughId } });
      }
      if (["READY", "SCHEDULED"].includes(voyage.status)) {
        const { launchTalePlaythrough } = await import("../../src/chronicle/progression");
        await launchTalePlaythrough(voyage.id, account.id);
      }
      access.voyageId = voyage.id;
      await persist(access);
    }
    stage = "VERIFY_RELEASE";
    if (!access.accountId || !access.chronicleId || !access.versionId || !access.voyageId)
      throw new Error("NCL01_PREVIEW_NOT_READY");
    const profile = await db.playerProfile.findUniqueOrThrow({ where: { accountId: access.accountId } });
    const owner = await db.userAccount.findUniqueOrThrow({ where: { id: access.accountId } });
    const { playerCanAccessPlaythrough } = await import("../../src/platform/auth");
    if (
      owner.status !== "ACTIVE" ||
      owner.lockedAt ||
      owner.suspendedAt ||
      !(await playerCanAccessPlaythrough(access.voyageId, profile.id))
    )
      throw new Error("NCL01_PREVIEW_CURRENT_ACCESS_REVOKED");
    const { loadReleasedSpatialMoment } = await import("../../src/parallax/service");
    const bound = await loadReleasedSpatialMoment(access.voyageId, profile.id, `${access.chronicleId}:clue`);
    const membership = await db.playthroughMembership.findFirstOrThrow({
      where: { playthroughId: access.voyageId, playerProfileId: profile.id },
    });
    const { sceneRequirements } = await import("../../src/parallax/scene-delivery");
    const requirements = sceneRequirements(bound.moment.version);
    if (requirements.some((value) => !["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"].includes(value)))
      throw new Error("NCL01_PREVIEW_PROVIDER_UNSUPPORTED");
    if (!(await exists(environmentFile)))
      await writeFile(environmentFile, `${JSON.stringify(environment, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    else {
      const saved = JSON.parse(await readFile(environmentFile, "utf8"));
      if (saved.DATABASE_URL !== databaseUrl || saved.FOREVER_VALIDATION_NONCE_HASH !== access.nonceHash)
        throw new Error("NCL01_PREVIEW_RUNTIME_ENVIRONMENT_CHANGED");
    }
    protectPrivateStorage();
    console.log(
      JSON.stringify(
        {
          status: "READY",
          evidenceClass: "SYNTHETIC_AUTHENTICATED_SOFTWARE_FIXTURE",
          databaseUrl,
          accessFile,
          environmentFile,
          accountId: access.accountId,
          playerProfileId: profile.id,
          chronicleId: access.chronicleId,
          publishedVersionId: access.versionId,
          voyageId: access.voyageId,
          journalHref: `/player/playthroughs/${access.voyageId}/journal`,
          signInHref: `/sign-in?returnTo=${encodeURIComponent(`/player/playthroughs/${access.voyageId}/journal`)}`,
          blockId: bound.binding.blockId,
          sceneChecksum: bound.moment.version.checksum,
          membershipStatus: membership.status,
          replayOnly: bound.replayOnly,
          modelIds: bound.moment.version.entities.map((entity) =>
            entity.element?.kind === "PHYSICAL_ASSET" ? entity.element.modelId : null,
          ),
          requirements,
          physicalQualification: "PENDING_OWNER_DEVICE_TEST",
          sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim(),
        },
        null,
        2,
      ),
    );
  } finally {
    await isolated.$disconnect();
  }
}

void main().catch(async (cause) => {
  const error = cause instanceof Error ? cause : new Error("Unknown preview preparation failure");
  const validation = typeof cause === "object" && cause && "validation" in cause ? cause.validation : undefined;
  if (privateStorageVerified)
    await writeFile(
      failureFile,
      JSON.stringify({ stage, name: error.name, message: error.message, validation }, null, 2),
      { mode: 0o600 },
    );
  console.error(
    JSON.stringify({
      status: "BLOCKED",
      stage,
      reason: error.name,
      failureFile: privateStorageVerified ? failureFile : undefined,
    }),
  );
  process.exitCode = 1;
});
