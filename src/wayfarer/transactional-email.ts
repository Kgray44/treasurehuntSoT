import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { ServerClient } from "postmark";
import { Resend } from "resend";
import { PublicAppOriginError, publicAppUrl } from "@/homeport/public-app-origin";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/security";

export const transactionalEmailPurposes = [
  "VERIFY_EMAIL",
  "PASSWORD_RESET",
  "EMAIL_CHANGE",
  "EMAIL_CHANGE_NOTICE",
  "PASSWORD_CHANGED_NOTICE",
  "ACCOUNT_DEACTIVATED_NOTICE",
  "ACCOUNT_REACTIVATED_NOTICE",
  "ACCOUNT_DELETION_SCHEDULED",
  "ACCOUNT_DELETION_CANCELLED",
  "IMPORTANT_SECURITY_NOTICE",
] as const;

export type TransactionalEmailPurpose = (typeof transactionalEmailPurposes)[number];

export type DevelopmentDelivery = Readonly<{
  purpose: TransactionalEmailPurpose;
  email: string;
  token?: string;
  accountId: string;
  detail?: string;
  queuedAt?: string;
}>;

export type DeliveryRequest = Readonly<{
  purpose: TransactionalEmailPurpose;
  email: string;
  accountId: string;
  accountTokenId?: string;
  displayName?: string;
  token?: string;
  detail?: string;
}>;

type ProviderStatus = Readonly<{
  providerId: "SYNTHETIC_OUTBOX" | "RESEND" | "POSTMARK";
  available: boolean;
  classification:
    | "SYNTHETIC_EMAIL_ONLY"
    | "RESEND_CONFIGURED"
    | "RESEND_BLOCKED_EXTERNAL_CONFIGURATION"
    | "POSTMARK_CONFIGURED"
    | "POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION";
  missing: readonly string[];
}>;

type DeliveryResult = Readonly<{ providerMessageId: string; submittedAt: Date }>;

export interface TransactionalEmailProvider {
  readonly providerId: ProviderStatus["providerId"];
  deliver(request: DeliveryRequest, idempotencyKey: string): Promise<DeliveryResult> | DeliveryResult;
}

const developmentOutbox: DevelopmentDelivery[] = [];

export class TransactionalEmailError extends Error {
  constructor(
    message: string,
    readonly code: "UNAVAILABLE" | "DELIVERY_FAILED" | "INVALID_CONFIGURATION",
  ) {
    super(message);
  }
}

const postmarkConfigurationKeys = [
  "POSTMARK_SERVER_TOKEN",
  "POSTMARK_FROM_ADDRESS",
  "POSTMARK_FROM_NAME",
  "POSTMARK_TRANSACTIONAL_MESSAGE_STREAM",
  "POSTMARK_TEMPLATE_ALIAS_VERIFY_EMAIL",
  "POSTMARK_TEMPLATE_ALIAS_PASSWORD_RESET",
  "POSTMARK_TEMPLATE_ALIAS_EMAIL_CHANGE",
  "POSTMARK_TEMPLATE_ALIAS_SECURITY_NOTICE",
  "POSTMARK_TEMPLATE_ALIAS_ACCOUNT_LIFECYCLE",
] as const;

const resendConfigurationKeys = ["RESEND_API_KEY", "RESEND_FROM_ADDRESS", "RESEND_FROM_NAME"] as const;

function configuredValue(key: string) {
  const value = process.env[key]?.trim();
  return value && !/^(?:replace|example|changeme|todo|placeholder)/iu.test(value) ? value : null;
}

function configuredTaskOwnedOutboxPath() {
  const requestedPath = process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH;
  const requestedRoot = process.env.HOMEPORT_PHASE7_TASK_ROOT;
  if (!requestedPath || !requestedRoot) return null;
  const taskRoot = resolve(requestedRoot);
  const outboxPath = resolve(requestedPath);
  const pathWithinTaskRoot = relative(taskRoot, outboxPath);
  if (!pathWithinTaskRoot || pathWithinTaskRoot.startsWith("..") || isAbsolute(pathWithinTaskRoot))
    throw new TransactionalEmailError(
      "Synthetic email delivery must remain inside the task root.",
      "INVALID_CONFIGURATION",
    );
  return outboxPath;
}

function taskOwnedSyntheticConfigured() {
  return (
    process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER === "TASK_OWNED_TEST" ||
    /^file:\.\/\.sounding-line-[a-f0-9]{12,40}\.sqlite$/u.test(process.env.DATABASE_URL ?? "") ||
    Boolean(configuredTaskOwnedOutboxPath())
  );
}

export function transactionalEmailProviderStatus(): ProviderStatus {
  const requestedProvider = process.env.HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER?.trim().toUpperCase();
  const forcePostmark = requestedProvider === "POSTMARK";
  const forceResend = requestedProvider === "RESEND";
  if (taskOwnedSyntheticConfigured() || (process.env.NODE_ENV !== "production" && !forcePostmark && !forceResend))
    return { providerId: "SYNTHETIC_OUTBOX", available: true, classification: "SYNTHETIC_EMAIL_ONLY", missing: [] };
  if (forcePostmark) {
    const missing = postmarkConfigurationKeys.filter((key) => !configuredValue(key));
    return missing.length
      ? {
          providerId: "POSTMARK",
          available: false,
          classification: "POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION",
          missing,
        }
      : { providerId: "POSTMARK", available: true, classification: "POSTMARK_CONFIGURED", missing: [] };
  }
  const missing = resendConfigurationKeys.filter((key) => !configuredValue(key));
  return missing.length
    ? {
        providerId: "RESEND",
        available: false,
        classification: "RESEND_BLOCKED_EXTERNAL_CONFIGURATION",
        missing,
      }
    : { providerId: "RESEND", available: true, classification: "RESEND_CONFIGURED", missing: [] };
}

export function assertTransactionalEmailAvailable() {
  const status = transactionalEmailProviderStatus();
  if (!status.available)
    throw new TransactionalEmailError(
      `Transactional email is unavailable until the approved ${status.providerId} configuration is complete.`,
      "UNAVAILABLE",
    );
  return status;
}

function taskOwnedOutboxPath() {
  const configuredPath = configuredTaskOwnedOutboxPath();
  if (configuredPath) return configuredPath;
  const genericTaskDatabase = /^file:\.\/\.sounding-line-([a-f0-9]{12,40})\.sqlite$/u.exec(
    process.env.DATABASE_URL ?? "",
  );
  if (genericTaskDatabase)
    return resolve(`.sounding-line-${genericTaskDatabase[1]}.outbox`, "outbox", "messages.jsonl");
  throw new TransactionalEmailError("Synthetic email delivery is not configured safely.", "INVALID_CONFIGURATION");
}

export class SyntheticOutboxTransactionalEmailProvider implements TransactionalEmailProvider {
  readonly providerId = "SYNTHETIC_OUTBOX" as const;

  deliver(request: DeliveryRequest) {
    const requestedFailure = process.env.HOMEPORT_SYNTHETIC_EMAIL_FAILURE;
    if (taskOwnedSyntheticConfigured() && requestedFailure === "VERIFY_EMAIL" && request.purpose === "VERIFY_EMAIL")
      throw new TransactionalEmailError("Synthetic verification delivery failed as requested.", "DELIVERY_FAILED");
    if (
      taskOwnedSyntheticConfigured() &&
      requestedFailure === "VERIFY_EMAIL_ONCE" &&
      request.purpose === "VERIFY_EMAIL"
    ) {
      const markerPath = `${taskOwnedOutboxPath()}.verify-email-failed-once`;
      if (!existsSync(markerPath)) {
        mkdirSync(dirname(markerPath), { recursive: true });
        writeFileSync(markerPath, `${new Date().toISOString()}\n`, { encoding: "utf8", mode: 0o600 });
        throw new TransactionalEmailError(
          "Synthetic verification delivery failed once as requested.",
          "DELIVERY_FAILED",
        );
      }
    }
    const delivery: DevelopmentDelivery = {
      purpose: request.purpose,
      email: request.email,
      token: request.token,
      accountId: request.accountId,
      detail: request.detail,
      queuedAt: new Date().toISOString(),
    };
    if (process.env.NODE_ENV !== "production") developmentOutbox.push(delivery);
    if (taskOwnedSyntheticConfigured()) {
      const outboxPath = taskOwnedOutboxPath();
      mkdirSync(dirname(outboxPath), { recursive: true });
      appendFileSync(outboxPath, `${JSON.stringify(delivery)}\n`, { encoding: "utf8", mode: 0o600 });
    }
    return { providerMessageId: `synthetic-${randomUUID()}`, submittedAt: new Date() };
  }
}

function templateAlias(purpose: TransactionalEmailPurpose) {
  if (purpose === "VERIFY_EMAIL") return configuredValue("POSTMARK_TEMPLATE_ALIAS_VERIFY_EMAIL");
  if (purpose === "PASSWORD_RESET") return configuredValue("POSTMARK_TEMPLATE_ALIAS_PASSWORD_RESET");
  if (purpose === "EMAIL_CHANGE") return configuredValue("POSTMARK_TEMPLATE_ALIAS_EMAIL_CHANGE");
  if (purpose.startsWith("ACCOUNT_")) return configuredValue("POSTMARK_TEMPLATE_ALIAS_ACCOUNT_LIFECYCLE");
  return configuredValue("POSTMARK_TEMPLATE_ALIAS_SECURITY_NOTICE");
}

export class PostmarkTransactionalEmailProvider implements TransactionalEmailProvider {
  readonly providerId = "POSTMARK" as const;

  async deliver(request: DeliveryRequest) {
    const token = configuredValue("POSTMARK_SERVER_TOKEN");
    const fromAddress = configuredValue("POSTMARK_FROM_ADDRESS");
    const fromName = configuredValue("POSTMARK_FROM_NAME");
    const messageStream = configuredValue("POSTMARK_TRANSACTIONAL_MESSAGE_STREAM");
    const alias = templateAlias(request.purpose);
    if (!token || !fromAddress || !fromName || !messageStream || !alias)
      throw new TransactionalEmailError("Postmark configuration is incomplete.", "INVALID_CONFIGURATION");
    const client = new ServerClient(token);
    const result = await client.sendEmailWithTemplate({
      From: `${fromName} <${fromAddress}>`,
      To: request.email,
      TemplateAlias: alias,
      TemplateModel: {
        display_name: request.displayName ?? "Voyagewright member",
        purpose: request.purpose,
        verification_code: request.purpose === "VERIFY_EMAIL" ? request.token : undefined,
        action_token: request.purpose !== "VERIFY_EMAIL" ? request.token : undefined,
        detail: request.detail,
        expires_minutes: request.purpose === "VERIFY_EMAIL" ? 10 : undefined,
      },
      MessageStream: messageStream,
      Tag: request.purpose.toLocaleLowerCase("en-US"),
      Metadata: { account_ref: hashToken(request.accountId).slice(0, 20), purpose: request.purpose },
    });
    if (result.ErrorCode !== 0 || !result.MessageID)
      throw new TransactionalEmailError("Postmark rejected the transactional message.", "DELIVERY_FAILED");
    const submittedAt = new Date(result.SubmittedAt);
    return {
      providerMessageId: result.MessageID,
      submittedAt: Number.isNaN(submittedAt.getTime()) ? new Date() : submittedAt,
    };
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/gu, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&#39;";
  });
}

function actionUrl(purpose: "PASSWORD_RESET" | "EMAIL_CHANGE", token: string) {
  const path = purpose === "PASSWORD_RESET" ? "/reset-password" : "/account/email-change";
  let url: URL;
  try {
    url = publicAppUrl(path);
  } catch (cause) {
    if (!(cause instanceof PublicAppOriginError)) throw cause;
    throw new TransactionalEmailError("The public application origin is invalid.", "INVALID_CONFIGURATION");
  }
  url.searchParams.set("token", token);
  return url.toString();
}

function resendMessage(request: DeliveryRequest) {
  const displayName = request.displayName?.trim() || "Voyagewright member";
  const greeting = `Hello ${displayName},`;
  const subjects: Record<TransactionalEmailPurpose, string> = {
    VERIFY_EMAIL: "Your Voyagewright verification code",
    PASSWORD_RESET: "Reset your Voyagewright password",
    EMAIL_CHANGE: "Confirm your Voyagewright email change",
    EMAIL_CHANGE_NOTICE: "Your Voyagewright email address changed",
    PASSWORD_CHANGED_NOTICE: "Your Voyagewright password changed",
    ACCOUNT_DEACTIVATED_NOTICE: "Your Voyagewright account was deactivated",
    ACCOUNT_REACTIVATED_NOTICE: "Your Voyagewright account was reactivated",
    ACCOUNT_DELETION_SCHEDULED: "Voyagewright account deletion scheduled",
    ACCOUNT_DELETION_CANCELLED: "Voyagewright account deletion cancelled",
    IMPORTANT_SECURITY_NOTICE: "Important Voyagewright security notice",
  };
  let instruction = request.detail?.trim() || "Review this account notice.";
  if (request.purpose === "VERIFY_EMAIL") {
    if (!request.token)
      throw new TransactionalEmailError("Verification delivery has no code.", "INVALID_CONFIGURATION");
    instruction = `Enter this six-digit code to verify your email: ${request.token}. It expires in 10 minutes.`;
  } else if (request.purpose === "PASSWORD_RESET" || request.purpose === "EMAIL_CHANGE") {
    if (!request.token)
      throw new TransactionalEmailError("Account action delivery has no token.", "INVALID_CONFIGURATION");
    const url = actionUrl(request.purpose, request.token);
    instruction = `${request.purpose === "PASSWORD_RESET" ? "Reset your password" : "Confirm your email change"}: ${url}`;
  }
  const text = `${greeting}\n\n${instruction}\n\nIf you did not request this, secure your Voyagewright account.\n\nVoyagewright`;
  const htmlInstruction = escapeHtml(instruction).replace(/(https?:\/\/[^\s<]+)/gu, '<a href="$1">$1</a>');
  const html = `<p>${escapeHtml(greeting)}</p><p>${htmlInstruction}</p><p>If you did not request this, secure your Voyagewright account.</p><p>Voyagewright</p>`;
  return { subject: subjects[request.purpose], text, html };
}

export class ResendTransactionalEmailProvider implements TransactionalEmailProvider {
  readonly providerId = "RESEND" as const;

  async deliver(request: DeliveryRequest, idempotencyKey: string) {
    const apiKey = configuredValue("RESEND_API_KEY");
    const fromAddress = configuredValue("RESEND_FROM_ADDRESS");
    const fromName = configuredValue("RESEND_FROM_NAME");
    if (!apiKey || !fromAddress || !fromName)
      throw new TransactionalEmailError("Resend configuration is incomplete.", "INVALID_CONFIGURATION");
    const client = new Resend(apiKey);
    const message = resendMessage(request);
    const result = await client.emails.send(
      {
        from: `${fromName} <${fromAddress}>`,
        to: request.email,
        ...message,
        tags: [
          { name: "purpose", value: request.purpose.toLowerCase() },
          { name: "account_ref", value: hashToken(request.accountId).slice(0, 20) },
        ],
      },
      { idempotencyKey },
    );
    if (result.error || !result.data?.id)
      throw new TransactionalEmailError("Resend rejected the transactional message.", "DELIVERY_FAILED");
    return { providerMessageId: result.data.id, submittedAt: new Date() };
  }
}

function providerFor(status: ProviderStatus): TransactionalEmailProvider {
  if (status.providerId === "RESEND") return new ResendTransactionalEmailProvider();
  if (status.providerId === "POSTMARK") return new PostmarkTransactionalEmailProvider();
  return new SyntheticOutboxTransactionalEmailProvider();
}

function failureCode(cause: unknown) {
  if (cause instanceof TransactionalEmailError) return cause.code;
  if (typeof cause === "object" && cause && "code" in cause)
    return String((cause as { code?: unknown }).code).slice(0, 64);
  return "PROVIDER_FAILURE";
}

export async function sendTransactionalEmail(request: DeliveryRequest) {
  const status = assertTransactionalEmailAvailable();
  const receipt = await db.transactionalEmailDelivery.create({
    data: {
      accountId: request.accountId,
      accountTokenId: request.accountTokenId,
      purpose: request.purpose,
      provider: status.providerId,
      recipientHash: hashToken(request.email.trim().toLocaleLowerCase("en-US")),
      status: "PENDING",
    },
  });
  try {
    const result = await providerFor(status).deliver(request, receipt.id);
    return await db.transactionalEmailDelivery.update({
      where: { id: receipt.id },
      data: {
        providerMessageId: result.providerMessageId,
        submittedAt: result.submittedAt,
        status: "SUBMITTED",
      },
    });
  } catch (cause) {
    await db.transactionalEmailDelivery.update({
      where: { id: receipt.id },
      data: { status: "FAILED", failureCode: failureCode(cause) },
    });
    throw cause instanceof TransactionalEmailError
      ? cause
      : new TransactionalEmailError("Transactional email delivery failed.", "DELIVERY_FAILED");
  }
}

export function takeDevelopmentDelivery(purpose: TransactionalEmailPurpose, email: string) {
  const normalized = email.trim().toLocaleLowerCase("en-US");
  const index = developmentOutbox.findIndex(
    (item) => item.purpose === purpose && item.email.trim().toLocaleLowerCase("en-US") === normalized,
  );
  return index < 0 ? null : developmentOutbox.splice(index, 1)[0];
}

export async function recordPostmarkWebhook(input: {
  recordType: "Delivery" | "Bounce" | "SpamComplaint";
  messageId: string;
  payload: unknown;
  deliveredAt?: Date;
  bouncedAt?: Date;
  failureCode?: string;
}) {
  const payloadChecksum = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
  const providerEventKey = `${input.recordType}:${input.messageId}:${payloadChecksum}`;
  try {
    await db.$transaction(async (tx) => {
      await tx.transactionalEmailEvent.create({
        data: { providerEventKey, providerMessageId: input.messageId, recordType: input.recordType, payloadChecksum },
      });
      const complaint = input.recordType === "SpamComplaint";
      await tx.transactionalEmailDelivery.updateMany({
        where: { providerMessageId: input.messageId },
        data:
          input.recordType === "Delivery"
            ? { status: "DELIVERED", deliveredAt: input.deliveredAt ?? new Date() }
            : {
                status: complaint ? "COMPLAINED" : "BOUNCED",
                bouncedAt: input.bouncedAt ?? new Date(),
                failureCode: input.failureCode?.slice(0, 64) ?? (complaint ? "SPAM_COMPLAINT" : "BOUNCE"),
              },
      });
    });
  } catch (cause) {
    if (typeof cause === "object" && cause && "code" in cause && (cause as { code?: string }).code === "P2002")
      return { state: "DUPLICATE" as const };
    throw cause;
  }
  return { state: "RECORDED" as const };
}
