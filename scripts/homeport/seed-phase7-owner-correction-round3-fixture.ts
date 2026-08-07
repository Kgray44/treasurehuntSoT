import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { reconcileClaimedAccountCapabilities } from "../../src/homeport/workspace-capabilities";
import {
  createAccountSession,
  registerAccount,
  resendVerification,
  revokeAccountSession,
  verifyAccountEmail,
} from "../../src/wayfarer/accounts";
import { defaultPreferences } from "../../src/wayfarer/profile";
import { removeProfileMedia, saveProfileMedia } from "../../src/wayfarer/profile-media";

const fixtureVersion =
  process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION ?? "homeport-phase7-owner-correction-round3-v1";
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const databaseUrl = required("DATABASE_URL");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const password = required("HOMEPORT_PHASE7_SYNTHETIC_PASSWORD");
const outboxPath = path.resolve(required("HOMEPORT_SYNTHETIC_OUTBOX_PATH"));
const aliasesPath = path.join(taskRoot, "credentials", "account-aliases.private.json");
const tokenPath = path.join(taskRoot, "tokens", "owner-correction-round3-email-codes.private.json");
const mediaFixtureRoot = path.join(taskRoot, "synthetic-media", "round3");

if (!taskRoot.startsWith(`${path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport")}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_FIXTURE_REFUSES_UNOWNED_DATABASE:${databasePath}`);
if (!outboxPath.startsWith(`${taskRoot}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_OUTBOX_REFUSED:${outboxPath}`);

type PrivateAlias = {
  accountId: string;
  email?: string;
  displayName: string;
  username?: string | null;
  sessionToken?: string;
};

async function latestCode(email: string) {
  const lines = (await readFile(outboxPath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { email?: string; purpose?: string; token?: string });
  const delivery = lines
    .filter((item) => item.email?.toLocaleLowerCase("en-US") === email.toLocaleLowerCase("en-US"))
    .filter((item) => item.purpose === "VERIFY_EMAIL" && /^\d{6}$/u.test(item.token ?? ""))
    .at(-1);
  if (!delivery?.token) throw new Error(`ROUND3_SYNTHETIC_CODE_MISSING:${email}`);
  return delivery.token;
}

async function accountAlias(accountId: string) {
  const account = await db.userAccount.findUniqueOrThrow({
    where: { id: accountId },
    include: { profile: true, emails: { where: { isPrimary: true }, take: 1 } },
  });
  if (!account.profile) throw new Error(`ROUND3_PROFILE_MISSING:${accountId}`);
  return {
    accountId,
    email: account.emails[0]?.normalizedEmail,
    displayName: account.profile.displayName,
    username: null,
  } satisfies PrivateAlias;
}

async function seedProfileMedia(seraAccountId: string, noMediaAccountId: string) {
  await mkdir(mediaFixtureRoot, { recursive: true });
  const avatar = await sharp({ create: { width: 1280, height: 920, channels: 3, background: "#0b6f73" } })
    .composite([
      {
        input: Buffer.from(
          '<svg width="1280" height="920"><circle cx="875" cy="390" r="240" fill="#e3b766"/><circle cx="875" cy="390" r="105" fill="#102f35"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer();
  const avatarReplacement = await sharp({
    create: { width: 1280, height: 920, channels: 3, background: "#12434a" },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="1280" height="920"><circle cx="790" cy="420" r="230" fill="#f0c978"/><path d="M680 465 Q790 560 900 465" fill="none" stroke="#132d32" stroke-width="38"/></svg>',
        ),
      },
    ])
    .webp({ quality: 92 })
    .toBuffer();
  const banner = await sharp({ create: { width: 2400, height: 1100, channels: 3, background: "#082b34" } })
    .composite([
      {
        input: Buffer.from(
          '<svg width="2400" height="1100"><path d="M0 850 Q500 480 980 760 T1900 620 T2600 800 V1100 H0Z" fill="#14636a"/><circle cx="1470" cy="330" r="155" fill="#e6bb64"/></svg>',
        ),
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
  const malformed = Buffer.from("not a decodable image", "utf8");
  const unsupported = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"/>', "utf8");
  const oversized = Buffer.alloc(8_000_001, 0x61);
  const fixtureFiles = {
    validAvatar: path.join(mediaFixtureRoot, "valid-avatar.png"),
    validAvatarReplacement: path.join(mediaFixtureRoot, "valid-avatar-replacement.webp"),
    validBanner: path.join(mediaFixtureRoot, "valid-banner.jpg"),
    malformed: path.join(mediaFixtureRoot, "malformed.png"),
    unsupported: path.join(mediaFixtureRoot, "unsupported.svg"),
    oversized: path.join(mediaFixtureRoot, "oversized.png"),
  };
  await Promise.all([
    writeFile(fixtureFiles.validAvatar, avatar),
    writeFile(fixtureFiles.validAvatarReplacement, avatarReplacement),
    writeFile(fixtureFiles.validBanner, banner),
    writeFile(fixtureFiles.malformed, malformed),
    writeFile(fixtureFiles.unsupported, unsupported),
    writeFile(fixtureFiles.oversized, oversized),
  ]);
  const seraProfile = await db.playerProfile.findUniqueOrThrow({ where: { accountId: seraAccountId } });
  const noMediaProfile = await db.playerProfile.findUniqueOrThrow({ where: { accountId: noMediaAccountId } });
  await db.playerProfile.update({
    where: { id: noMediaProfile.id },
    data: { handle: null, normalizedHandle: null },
  });
  const firstAvatar = await saveProfileMedia(
    seraProfile.id,
    "AVATAR",
    `data:image/png;base64,${avatar.toString("base64")}`,
    { centerX: 0.69, centerY: 0.43, scale: 1.35, rotation: 0 },
    "Synthetic Sera profile avatar",
    seraProfile.avatarMediaId,
  );
  let replacementFailurePreserved = false;
  try {
    await saveProfileMedia(
      seraProfile.id,
      "AVATAR",
      `data:image/png;base64,${malformed.toString("base64")}`,
      { centerX: 0.5, centerY: 0.5, scale: 1, rotation: 0 },
      "Malformed replacement",
      firstAvatar.id,
    );
  } catch {
    replacementFailurePreserved =
      (await db.playerProfile.findUniqueOrThrow({ where: { id: seraProfile.id } })).avatarMediaId === firstAvatar.id;
  }
  if (!replacementFailurePreserved) throw new Error("ROUND3_MEDIA_REPLACEMENT_FAILURE_DID_NOT_PRESERVE_ACTIVE");
  const activeAvatar = await saveProfileMedia(
    seraProfile.id,
    "AVATAR",
    `data:image/webp;base64,${avatarReplacement.toString("base64")}`,
    { centerX: 0.62, centerY: 0.47, scale: 1.55, rotation: 0 },
    "Synthetic Sera profile avatar",
    firstAvatar.id,
  );
  const activeBanner = await saveProfileMedia(
    seraProfile.id,
    "BANNER",
    `data:image/jpeg;base64,${banner.toString("base64")}`,
    { centerX: 0.62, centerY: 0.42, scale: 1.2, rotation: 0 },
    "Synthetic Sera profile banner",
    seraProfile.bannerMediaId,
  );
  const removable = await saveProfileMedia(
    noMediaProfile.id,
    "AVATAR",
    `data:image/png;base64,${avatar.toString("base64")}`,
    { centerX: 0.5, centerY: 0.5, scale: 1, rotation: 0 },
    "Synthetic removal fixture",
    noMediaProfile.avatarMediaId,
  );
  await removeProfileMedia(noMediaProfile.id, removable.id);
  return {
    fixtureFiles,
    activeAvatarId: activeAvatar.id,
    activeBannerId: activeBanner.id,
    removedMediaId: removable.id,
  };
}

async function main() {
  const privateFixture = JSON.parse(await readFile(aliasesPath, "utf8")) as {
    fixtureVersion: string;
    aliases: Record<string, PrivateAlias>;
  };
  const inherited = privateFixture.aliases;
  const sera = inherited.SERA ?? inherited.FULL_CAPABILITY;
  const activeLocked = inherited.ACTIVE_CHRONICLE_PLAYER;
  const pending = inherited.PENDING_VERIFICATION;
  const restricted = inherited.RESTRICTED;
  const noMedia = inherited.REVIEW_EMPTY;
  if (!sera || !activeLocked || !pending || !restricted || !noMedia)
    throw new Error("ROUND3_REQUIRED_INHERITED_ALIAS_MISSING");

  await db.accountRoleAssignment.deleteMany({
    where: { accountId: sera.accountId, role: { in: ["CAPTAIN", "CREATOR"] } },
  });
  await db.playerProfile.update({
    where: { accountId: sera.accountId },
    data: { preferences: JSON.stringify(defaultPreferences) },
  });

  const kgEmail = "kgtesting-new@owner-correction.example.test";
  const existingKg = await db.accountEmail.findUnique({ where: { normalizedEmail: kgEmail } });
  if (existingKg) throw new Error("ROUND3_KGTESTING_MUST_BE_CREATED_FRESH");
  const registration = await registerAccount({
    email: kgEmail,
    password,
    displayName: "KGTesting New",
    deviceLabel: "Round 3 governed registration",
  });
  const kgCode = await latestCode(kgEmail);
  await verifyAccountEmail(registration.account.id, kgCode);
  const ordinarySession = await createAccountSession(
    registration.account.id,
    "Round 3 verified ordinary session",
    "ORDINARY",
  );
  await revokeAccountSession(registration.account.id, registration.session.id);
  await db.playerProfile.update({
    where: { accountId: registration.account.id },
    data: { preferences: JSON.stringify(defaultPreferences) },
  });

  await resendVerification(pending.accountId);
  const replacedCode = await latestCode(pending.email!);
  const firstChallenge = await db.accountToken.findFirstOrThrow({
    where: { accountId: pending.accountId, purpose: "VERIFY_EMAIL", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  await db.accountToken.update({
    where: { id: firstChallenge.id },
    data: { createdAt: new Date(Date.now() - 61_000), attemptCount: 1, lastAttemptAt: new Date() },
  });
  await resendVerification(pending.accountId);
  const newestCode = await latestCode(pending.email!);
  if (newestCode === replacedCode) throw new Error("ROUND3_RESEND_DID_NOT_REPLACE_CODE");
  const pendingVerificationSession = await createAccountSession(
    pending.accountId,
    "Round 3 pending verification session",
    "VERIFICATION",
  );
  const currentPendingChallenge = await db.accountToken.findFirstOrThrow({
    where: { accountId: pending.accountId, purpose: "VERIFY_EMAIL", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  await db.accountToken.update({
    where: { id: currentPendingChallenge.id },
    data: { createdAt: new Date(Date.now() - 61_000) },
  });

  await db.accountToken.create({
    data: {
      accountId: noMedia.accountId,
      purpose: "VERIFY_EMAIL",
      tokenHash: createHash("sha256").update("expired-round3-fixture").digest("hex"),
      expiresAt: new Date(Date.now() - 60_000),
      attemptCount: 0,
      maxAttempts: 5,
    },
  });
  await db.transactionalEmailDelivery.createMany({
    data: [
      {
        id: "hp-owcr3-postmark-configured-simulation",
        accountId: sera.accountId,
        purpose: "IMPORTANT_SECURITY_NOTICE",
        provider: "POSTMARK",
        recipientHash: createHash("sha256").update("postmark-configured@owner-correction.example.test").digest("hex"),
        providerMessageId: "00000000-0000-4000-8000-000000000031",
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      {
        id: "hp-owcr3-postmark-bounce-simulation",
        accountId: sera.accountId,
        purpose: "VERIFY_EMAIL",
        provider: "POSTMARK",
        recipientHash: createHash("sha256").update("postmark-bounce@owner-correction.example.test").digest("hex"),
        providerMessageId: "00000000-0000-4000-8000-000000000032",
        status: "BOUNCED",
        submittedAt: new Date(),
        bouncedAt: new Date(),
        failureCode: "1-HardBounce",
      },
    ],
  });

  await reconcileClaimedAccountCapabilities({ mode: "COMMIT" });
  const reconciliation = await reconcileClaimedAccountCapabilities({ mode: "VERIFY" });
  if (!reconciliation.verified) throw new Error("ROUND3_WORKSPACE_RECONCILIATION_VERIFY_FAILED");

  const media = await seedProfileMedia(sera.accountId, noMedia.accountId);
  const kgAlias = await accountAlias(registration.account.id);
  const aliases = {
    KGTESTING_NEW: kgAlias,
    SERA_OWNER: await accountAlias(sera.accountId),
    PENDING_VERIFICATION: await accountAlias(pending.accountId),
    VERIFIED_FULL_CAPABILITY: await accountAlias(sera.accountId),
    ACTIVE_PLAYER_LOCKED: await accountAlias(activeLocked.accountId),
    RESTRICTED_ACCOUNT: await accountAlias(restricted.accountId),
    NO_PROFILE_MEDIA: await accountAlias(noMedia.accountId),
    PROFILE_MEDIA_COMPLETE: await accountAlias(sera.accountId),
  };
  await writeFile(
    aliasesPath,
    `${JSON.stringify({ fixtureVersion, aliases: { ...inherited, ...aliases } }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await writeFile(
    tokenPath,
    `${JSON.stringify(
      {
        classification: "TASK_OWNED_PRIVATE_SYNTHETIC_CODES",
        kgTestingVerificationCode: kgCode,
        pendingReplacedCode: replacedCode,
        pendingCurrentCode: newestCode,
        pendingVerificationSessionToken: pendingVerificationSession.token,
        kgTestingOrdinarySessionToken: ordinarySession.token,
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );

  const counts = {
    accounts: await db.userAccount.count(),
    profiles: await db.playerProfile.count(),
    ordinaryWorkspaceAccounts: await db.userAccount.count({ where: { ordinaryWorkspaceEntryAt: { not: null } } }),
    profileMedia: await db.profileMedia.count(),
    deliveryReceipts: await db.transactionalEmailDelivery.count(),
    verificationChallenges: await db.accountToken.count({ where: { purpose: "VERIFY_EMAIL" } }),
  };
  const safeAliases = Object.fromEntries(
    Object.entries(aliases).map(([key, value]) => [
      key,
      { accountId: value.accountId, displayName: value.displayName },
    ]),
  );
  const stateVariants = [
    "PROFILE_MEDIA_VALID_AVATAR",
    "PROFILE_MEDIA_VALID_BANNER",
    "PROFILE_MEDIA_OVERSIZED",
    "PROFILE_MEDIA_MALFORMED",
    "PROFILE_MEDIA_UNSUPPORTED",
    "PROFILE_MEDIA_REPLACEMENT_FAILURE_PRESERVED",
    "PROFILE_MEDIA_REMOVED",
    "SYNTHETIC_EMAIL_ACCEPTED",
    "POSTMARK_CONFIGURED_STATE_SIMULATION",
    "POSTMARK_PROVIDER_UNAVAILABLE",
    "POSTMARK_BOUNCED_SIMULATION",
    "VERIFICATION_CODE_EXPIRED",
    "VERIFICATION_CODE_INCORRECT_ATTEMPT",
    "VERIFICATION_CODE_RESENT_REPLACED",
    "ORDINARY_PLAYER_CAPTAIN_CREATOR_ENTRY",
    "ACTIVE_CHRONICLE_LOCK",
    "DARK_DEFAULT",
  ];
  const identity = {
    schemaVersion: "1.0.0",
    fixtureVersion,
    classification: "SYNTHETIC_TEST_DATA",
    aliases: safeAliases,
    counts,
    stateVariants,
    media: {
      activeAvatarId: media.activeAvatarId,
      activeBannerId: media.activeBannerId,
      removedMediaId: media.removedMediaId,
      fixtureFiles: media.fixtureFiles,
    },
    email: {
      providerStatus: "SYNTHETIC_EMAIL_ONLY",
      syntheticOutboxPath: outboxPath,
      privateCodePath: tokenPath,
    },
  };
  const fixtureChecksum = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
  process.stdout.write(
    `${JSON.stringify({ status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_FIXTURE_READY", databasePath, ...identity, fixtureChecksum })}\n`,
  );
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
