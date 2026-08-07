import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import { AccountError, authenticateAccount, registerAccount } from "../../src/wayfarer/accounts";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function opaque(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function rowCounts() {
  const [accounts, profiles, emails, credentials, roles, tokens, sessions, deliveries] = await Promise.all([
    db.userAccount.count(),
    db.playerProfile.count(),
    db.accountEmail.count(),
    db.accountCredential.count(),
    db.accountRoleAssignment.count(),
    db.accountToken.count(),
    db.accountSession.count(),
    db.transactionalEmailDelivery.count(),
  ]);
  return { accounts, profiles, emails, credentials, roles, tokens, sessions, deliveries };
}

async function capturedError(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (cause) {
    return cause;
  }
  throw new Error("EXPECTED_OPERATION_TO_FAIL");
}

async function main() {
  const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
  const approvedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectHomeport");
  const databaseUrl = required("DATABASE_URL");
  const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
  if (
    !taskRoot.startsWith(`${approvedRoot}${path.sep}`) ||
    !taskRoot.includes("phase7-owner-correction-round3-patch-a-") ||
    !databasePath.startsWith(`${taskRoot}${path.sep}`)
  )
    throw new Error("PATCH_A_REGISTRATION_VALIDATION_REFUSES_UNOWNED_STATE");
  assert.equal(process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER, "TASK_OWNED_TEST");

  const password = "lantern-harbor-42-compass";
  const baseline = await rowCounts();
  const registration = await registerAccount({
    displayName: "Patch Alpha Fresh",
    email: "patch-a-fresh@example.test",
    password,
    confirmPassword: password,
    deviceLabel: "Patch A registration validation",
  });
  assert.equal(registration.deliveryState, "SUBMITTED");
  const created = await db.userAccount.findUniqueOrThrow({
    where: { id: registration.account.id },
    include: {
      profile: true,
      emails: true,
      credential: true,
      roles: true,
      tokens: { include: { delivery: true } },
      sessions: true,
    },
  });
  assert.equal(created.status, "PENDING_VERIFICATION");
  assert.equal(created.profile?.normalizedDisplayName, "patch alpha fresh");
  assert.equal(created.emails.length, 1);
  assert.ok(created.credential);
  assert.equal(created.roles.filter((role) => role.role === "PLAYER").length, 1);
  assert.equal(created.tokens.filter((token) => token.purpose === "VERIFY_EMAIL").length, 1);
  assert.equal(created.tokens[0]?.delivery?.status, "SUBMITTED");
  assert.equal(created.sessions.filter((session) => session.sessionType === "VERIFICATION").length, 1);
  await db.playerProfile.update({
    where: { id: created.profile!.id },
    data: { username: "patch-alpha-legacy" },
  });

  const emailSignIn = await authenticateAccount(
    "  PATCH-A-FRESH@EXAMPLE.TEST  ",
    password,
    "Patch A normalized email sign-in",
  );
  assert.equal(emailSignIn?.account.id, created.id);
  const usernameSignIn = await authenticateAccount(
    "  PaTcH-AlPhA-LeGaCy  ",
    password,
    "Patch A normalized legacy Player name sign-in",
  );
  assert.equal(usernameSignIn?.account.id, created.id);
  const [emailOrdinarySession, usernameOrdinarySession] = await Promise.all([
    db.accountSession.findUniqueOrThrow({ where: { id: emailSignIn!.session.id } }),
    db.accountSession.findUniqueOrThrow({ where: { id: usernameSignIn!.session.id } }),
  ]);
  assert.equal(emailOrdinarySession.sessionType, "ORDINARY");
  assert.equal(usernameOrdinarySession.sessionType, "ORDINARY");
  assert.equal(await authenticateAccount("missing-player-name", password), null);
  assert.equal(await authenticateAccount("missing-email@example.test", password), null);
  assert.equal(await authenticateAccount("patch-a-fresh@example.test", `${password}-wrong`), null);

  const ambiguousProfile = await db.playerProfile.create({
    data: { displayName: "Patch Alpha Namespace Sentinel", username: "namespace-sentinel@example.test" },
  });
  assert.equal(await authenticateAccount("namespace-sentinel@example.test", password), null);
  await db.playerProfile.delete({ where: { id: ambiguousProfile.id } });

  const beforeDisplayConflict = await rowCounts();
  const displayConflict = await capturedError(() =>
    registerAccount({
      displayName: "  PATCH   ALPHA fresh  ",
      email: "patch-a-display-conflict@example.test",
      password,
      confirmPassword: password,
    }),
  );
  assert.ok(displayConflict instanceof AccountError);
  assert.equal(displayConflict.message, "That display name is already in use.");
  assert.equal(displayConflict.kind, "DISPLAY_NAME_CONFLICT");
  assert.deepEqual(await rowCounts(), beforeDisplayConflict);

  const beforeEmailConflict = await rowCounts();
  const emailConflict = await capturedError(() =>
    registerAccount({
      displayName: "Patch Alpha Email Conflict",
      email: "PATCH-A-FRESH@example.test",
      password,
      confirmPassword: password,
    }),
  );
  assert.ok(emailConflict instanceof AccountError);
  assert.equal(emailConflict.message, "An account already uses this email address. Sign in instead.");
  assert.equal(emailConflict.kind, "EMAIL_CONFLICT");
  assert.deepEqual(await rowCounts(), beforeEmailConflict);

  const beforeMismatch = await rowCounts();
  const mismatch = await capturedError(() =>
    registerAccount({
      displayName: "Patch Alpha Mismatch",
      email: "patch-a-mismatch@example.test",
      password,
      confirmPassword: `${password}-different`,
    }),
  );
  assert.ok(mismatch instanceof AccountError);
  assert.equal(mismatch.message, "Passwords do not match.");
  assert.deepEqual(await rowCounts(), beforeMismatch);

  const beforeConcurrent = await rowCounts();
  const concurrent = await Promise.allSettled([
    registerAccount({
      displayName: "Patch Alpha Concurrent",
      email: "patch-a-concurrent-one@example.test",
      password,
      confirmPassword: password,
    }),
    registerAccount({
      displayName: "patch alpha concurrent",
      email: "patch-a-concurrent-two@example.test",
      password,
      confirmPassword: password,
    }),
  ]);
  const fulfilled = concurrent.filter((result) => result.status === "fulfilled");
  const rejected = concurrent.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]?.status === "rejected" && rejected[0].reason instanceof AccountError);
  assert.equal(rejected[0]?.status === "rejected" ? rejected[0].reason.kind : null, "DISPLAY_NAME_CONFLICT");
  const afterConcurrent = await rowCounts();
  assert.equal(afterConcurrent.accounts - beforeConcurrent.accounts, 1);
  assert.equal(afterConcurrent.profiles - beforeConcurrent.profiles, 1);
  assert.equal(afterConcurrent.emails - beforeConcurrent.emails, 1);
  assert.equal(afterConcurrent.credentials - beforeConcurrent.credentials, 1);
  assert.equal(afterConcurrent.tokens - beforeConcurrent.tokens, 1);
  assert.equal(afterConcurrent.sessions - beforeConcurrent.sessions, 1);

  process.env.HOMEPORT_SYNTHETIC_EMAIL_FAILURE = "VERIFY_EMAIL";
  const beforeDeliveryFailure = await rowCounts();
  const deliveryFailure = await registerAccount({
    displayName: "Patch Alpha Delivery Failure",
    email: "patch-a-delivery-failure@example.test",
    password,
    confirmPassword: password,
  });
  delete process.env.HOMEPORT_SYNTHETIC_EMAIL_FAILURE;
  assert.equal(deliveryFailure.deliveryState, "FAILED");
  const afterDeliveryFailure = await rowCounts();
  assert.equal(afterDeliveryFailure.accounts - beforeDeliveryFailure.accounts, 1);
  assert.equal(afterDeliveryFailure.profiles - beforeDeliveryFailure.profiles, 1);
  assert.equal(afterDeliveryFailure.emails - beforeDeliveryFailure.emails, 1);
  assert.equal(afterDeliveryFailure.credentials - beforeDeliveryFailure.credentials, 1);
  assert.equal(afterDeliveryFailure.tokens - beforeDeliveryFailure.tokens, 1);
  assert.equal(afterDeliveryFailure.sessions - beforeDeliveryFailure.sessions, 1);
  assert.equal(afterDeliveryFailure.deliveries - beforeDeliveryFailure.deliveries, 1);
  const failedDelivery = await db.transactionalEmailDelivery.findFirstOrThrow({
    where: { accountId: deliveryFailure.account.id, purpose: "VERIFY_EMAIL" },
  });
  assert.equal(failedDelivery.status, "FAILED");

  const beforeDeliveryRetry = await rowCounts();
  const deliveryRetry = await capturedError(() =>
    registerAccount({
      displayName: "Patch Alpha Delivery Retry",
      email: "patch-a-delivery-failure@example.test",
      password,
      confirmPassword: password,
    }),
  );
  assert.ok(deliveryRetry instanceof AccountError);
  assert.equal(deliveryRetry.kind, "EMAIL_CONFLICT");
  assert.deepEqual(await rowCounts(), beforeDeliveryRetry);

  const signIn = await authenticateAccount("patch-a-delivery-failure@example.test", password, "Patch A sign-in");
  assert.ok(signIn);
  const ordinarySession = await db.accountSession.findUniqueOrThrow({ where: { id: signIn.session.id } });
  assert.equal(ordinarySession.sessionType, "ORDINARY");

  const report = {
    contract: "homeport.phase7.owner-correction.round3.patch-a.registration-validation.v1",
    generatedAt: new Date().toISOString(),
    database: "TASK_OWNED",
    baseline,
    results: {
      completeRegistration: true,
      identifierSignIn: {
        normalizedEmail: emailOrdinarySession.sessionType,
        normalizedLegacyPlayerName: usernameOrdinarySession.sessionType,
        wrongPlayerName: "REJECTED",
        wrongEmail: "REJECTED",
        wrongPassword: "REJECTED",
        emailNamespaceDoesNotFallThrough: true,
      },
      displayConflictZeroRows: true,
      emailConflictZeroRows: true,
      confirmationMismatchZeroRows: true,
      concurrentDisplayReservation: { successes: fulfilled.length, conflicts: rejected.length },
      postCommitDeliveryFailure: { oneCompleteAccount: true, deliveryState: failedDelivery.status },
      deliveryRetryNoDuplicate: true,
      unverifiedOrdinarySignIn: ordinarySession.sessionType,
      registrationRef: opaque(registration.account.id),
      deliveryFailureRef: opaque(deliveryFailure.account.id),
    },
  };
  const evidenceDirectory = path.join(taskRoot, "evidence");
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    path.join(evidenceDirectory, "patch-a-registration-validation.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
  console.log(JSON.stringify(report));
  await db.$disconnect();
}

void main().catch(async (cause: unknown) => {
  delete process.env.HOMEPORT_SYNTHETIC_EMAIL_FAILURE;
  console.error(cause instanceof Error ? cause.stack : String(cause));
  await db.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
