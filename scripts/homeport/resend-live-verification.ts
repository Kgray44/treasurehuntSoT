import { createHash, randomBytes } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { db } from "@/lib/db";

const mode = process.argv[2];
const baseUrl = required("PLAYWRIGHT_BASE_URL").replace(/\/$/u, "");
const taskRoot = resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const statePath = resolve(required("HOMEPORT_RESEND_LIVE_STATE_PATH"));
if (!statePath.startsWith(`${taskRoot}${sep}`)) throw new Error("RESEND_LIVE_STATE_PATH_REFUSED");

void main();

async function main() {
  try {
    if (mode === "send") await send();
    else if (mode === "resend") await resend();
    else if (mode === "verify") await verify(process.argv[3] ?? "");
    else throw new Error("Usage: resend-live-verification.ts send|resend|verify [six-digit-code]");
  } finally {
    await db.$disconnect();
  }
}

async function resend() {
  const state = readState();
  const response = await fetch(`${baseUrl}/api/auth/email/verification/resend`, {
    method: "POST",
    headers: {
      cookie: `wayfarer_account=${state.cookie}`,
      "x-csrf-token": state.csrfToken,
      "user-agent": "Project Homeport governed Resend acceptance",
    },
  });
  const body = (await response.json()) as { codeState?: string };
  if (response.status !== 200 || body.codeState !== "CODE_REPLACED")
    throw new Error(`RESEND_LIVE_RESEND_FAILED:${response.status}:${body.codeState ?? "UNKNOWN"}`);

  const delivery = await db.transactionalEmailDelivery.findFirst({
    where: { accountId: state.accountId, purpose: "VERIFY_EMAIL" },
    orderBy: { createdAt: "desc" },
    select: { provider: true, providerMessageId: true, status: true, submittedAt: true },
  });
  if (delivery?.provider !== "RESEND" || delivery.status !== "SUBMITTED" || !delivery.providerMessageId)
    throw new Error(`RESEND_LIVE_PROVIDER_NOT_ACCEPTED:${delivery?.provider ?? "NONE"}:${delivery?.status ?? "NONE"}`);

  writeFileSync(statePath, JSON.stringify({ ...state, providerMessageId: delivery.providerMessageId }), {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(
    `${JSON.stringify({ status: "RESEND_LIVE_CODE_REPLACED", provider: delivery.provider, providerMessageId: delivery.providerMessageId, submittedAt: delivery.submittedAt?.toISOString() ?? null })}\n`,
  );
}

async function send() {
  const recipient = required("RESEND_LIVE_TEST_RECIPIENT").trim().toLocaleLowerCase("en-US");
  const password = `${randomBytes(24).toString("base64url")}!Aa7`;
  const displayName = `Resend Live ${Date.now().toString(36)}`;
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Project Homeport governed Resend acceptance",
      "x-forwarded-for": `127.0.0.${Math.floor(Math.random() * 200) + 20}`,
    },
    body: JSON.stringify({ email: recipient, password, confirmPassword: password, displayName }),
  });
  const body = (await response.json()) as { csrfToken?: string; registrationState?: string; error?: string };
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.match(/(?:^|,\s*)wayfarer_account=([^;]+)/u)?.[1];
  if (response.status !== 201 || body.registrationState !== "READY_TO_VERIFY" || !body.csrfToken || !cookie)
    throw new Error(`RESEND_LIVE_REGISTRATION_FAILED:${response.status}:${body.registrationState ?? "UNKNOWN"}`);

  const accountEmail = await db.accountEmail.findUnique({
    where: { normalizedEmail: recipient },
    select: { accountId: true },
  });
  if (!accountEmail) throw new Error("RESEND_LIVE_ACCOUNT_NOT_PERSISTED");
  const delivery = await db.transactionalEmailDelivery.findFirst({
    where: { accountId: accountEmail.accountId, purpose: "VERIFY_EMAIL" },
    orderBy: { createdAt: "desc" },
    select: { provider: true, providerMessageId: true, status: true, submittedAt: true },
  });
  if (delivery?.provider !== "RESEND" || delivery.status !== "SUBMITTED" || !delivery.providerMessageId)
    throw new Error(`RESEND_LIVE_PROVIDER_NOT_ACCEPTED:${delivery?.provider ?? "NONE"}:${delivery?.status ?? "NONE"}`);

  writeFileSync(
    statePath,
    JSON.stringify({
      accountId: accountEmail.accountId,
      cookie,
      csrfToken: body.csrfToken,
      recipientHash: createHash("sha256").update(recipient).digest("hex"),
      providerMessageId: delivery.providerMessageId,
    }),
    { encoding: "utf8", mode: 0o600 },
  );
  process.stdout.write(
    `${JSON.stringify({ status: "RESEND_PROVIDER_ACCEPTED", provider: delivery.provider, providerMessageId: delivery.providerMessageId, submittedAt: delivery.submittedAt?.toISOString() ?? null })}\n`,
  );
}

async function verify(code: string) {
  if (!/^\d{6}$/u.test(code)) throw new Error("RESEND_LIVE_CODE_MUST_BE_SIX_DIGITS");
  const state = readState();
  const response = await fetch(`${baseUrl}/api/auth/email/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `wayfarer_account=${state.cookie}`,
      "x-csrf-token": state.csrfToken,
      "user-agent": "Project Homeport governed Resend acceptance",
    },
    body: JSON.stringify({ code }),
  });
  const body = (await response.json()) as { codeState?: string };
  if (response.status !== 200 || body.codeState !== "EMAIL_VERIFIED")
    throw new Error(`RESEND_LIVE_VERIFICATION_FAILED:${response.status}:${body.codeState ?? "UNKNOWN"}`);
  const account = await db.userAccount.findUnique({
    where: { id: state.accountId },
    select: {
      status: true,
      ordinaryWorkspaceEntryAt: true,
      emails: { where: { isPrimary: true }, select: { verificationState: true, verifiedAt: true } },
    },
  });
  if (
    account?.status !== "ACTIVE" ||
    account.emails[0]?.verificationState !== "VERIFIED" ||
    !account.ordinaryWorkspaceEntryAt
  )
    throw new Error("RESEND_LIVE_ACCOUNT_NOT_VERIFIED");
  rmSync(statePath, { force: true });
  process.stdout.write(
    `${JSON.stringify({ status: "RESEND_LIVE_EMAIL_VERIFICATION_PASSED", accountStatus: account.status, verificationState: account.emails[0].verificationState, verifiedAt: account.emails[0].verifiedAt?.toISOString() ?? null, providerMessageId: state.providerMessageId })}\n`,
  );
}

function readState() {
  return JSON.parse(readFileSync(statePath, "utf8")) as {
    accountId: string;
    cookie: string;
    csrfToken: string;
    recipientHash: string;
    providerMessageId: string;
  };
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
