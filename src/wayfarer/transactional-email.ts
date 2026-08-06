import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { ServerClient } from "postmark";
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

type DeliveryRequest = Readonly<{
  purpose: TransactionalEmailPurpose;
  email: string;
  accountId: string;
  accountTokenId?: string;
  displayName?: string;
  token?: string;
  detail?: string;
}>;

type ProviderStatus = Readonly<{
  providerId: "SYNTHETIC_OUTBOX" | "POSTMARK";
  available: boolean;
  classification: "SYNTHETIC_EMAIL_ONLY" | "POSTMARK_CONFIGURED" | "POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION";
  missing: readonly string[];
}>;

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

function configuredValue(key: (typeof postmarkConfigurationKeys)[number]) {
  const value = process.env[key]?.trim();
  return value && !/^(?:replace|example|changeme|todo|placeholder)/iu.test(value) ? value : null;
}

function taskOwnedSyntheticConfigured() {
  return process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER === "TASK_OWNED_TEST";
}

export function transactionalEmailProviderStatus(): ProviderStatus {
  const forcePostmark = process.env.HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER === "POSTMARK";
  if (taskOwnedSyntheticConfigured() || (process.env.NODE_ENV !== "production" && !forcePostmark))
    return { providerId: "SYNTHETIC_OUTBOX", available: true, classification: "SYNTHETIC_EMAIL_ONLY", missing: [] };
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

export function assertTransactionalEmailAvailable() {
  const status = transactionalEmailProviderStatus();
  if (!status.available)
    throw new TransactionalEmailError(
      "Transactional email is unavailable until the approved Postmark configuration is complete.",
      "UNAVAILABLE",
    );
  return status;
}

function taskOwnedOutboxPath() {
  const requestedPath = process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH;
  const requestedRoot = process.env.HOMEPORT_PHASE7_TASK_ROOT;
  if (!requestedPath || !requestedRoot)
    throw new TransactionalEmailError("Synthetic email delivery is not configured safely.", "INVALID_CONFIGURATION");
  const taskRoot = resolve(requestedRoot);
  const outboxPath = resolve(requestedPath);
  if (!outboxPath.startsWith(`${taskRoot}${sep}`))
    throw new TransactionalEmailError(
      "Synthetic email delivery must remain inside the task root.",
      "INVALID_CONFIGURATION",
    );
  return outboxPath;
}

function deliverSynthetic(request: DeliveryRequest) {
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

function templateAlias(purpose: TransactionalEmailPurpose) {
  if (purpose === "VERIFY_EMAIL") return configuredValue("POSTMARK_TEMPLATE_ALIAS_VERIFY_EMAIL");
  if (purpose === "PASSWORD_RESET") return configuredValue("POSTMARK_TEMPLATE_ALIAS_PASSWORD_RESET");
  if (purpose === "EMAIL_CHANGE") return configuredValue("POSTMARK_TEMPLATE_ALIAS_EMAIL_CHANGE");
  if (purpose.startsWith("ACCOUNT_")) return configuredValue("POSTMARK_TEMPLATE_ALIAS_ACCOUNT_LIFECYCLE");
  return configuredValue("POSTMARK_TEMPLATE_ALIAS_SECURITY_NOTICE");
}

async function deliverPostmark(request: DeliveryRequest) {
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
    const result = status.providerId === "POSTMARK" ? await deliverPostmark(request) : deliverSynthetic(request);
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
