import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  resendSend: vi.fn(),
  deliveryCreate: vi.fn(),
  deliveryUpdate: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("postmark", () => ({
  ServerClient: class MockServerClient {
    sendEmailWithTemplate = mocks.send;
  },
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mocks.resendSend };
  },
}));

vi.mock("@/lib/db", () => {
  const tx = {
    transactionalEmailDelivery: { updateMany: mocks.deliveryUpdateMany },
    transactionalEmailEvent: { create: mocks.eventCreate },
  };
  return {
    db: {
      transactionalEmailDelivery: { create: mocks.deliveryCreate, update: mocks.deliveryUpdate },
      $transaction: vi.fn(async (run: (transaction: typeof tx) => unknown) => run(tx)),
    },
  };
});

import { recordPostmarkWebhook, sendTransactionalEmail, transactionalEmailProviderStatus } from "./transactional-email";

const configuration = {
  HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "POSTMARK",
  POSTMARK_SERVER_TOKEN: "server-token-for-test",
  POSTMARK_FROM_ADDRESS: "account@example.test",
  POSTMARK_FROM_NAME: "Voyagewright",
  POSTMARK_TRANSACTIONAL_MESSAGE_STREAM: "outbound",
  POSTMARK_TEMPLATE_ALIAS_VERIFY_EMAIL: "verify-email-v1",
  POSTMARK_TEMPLATE_ALIAS_PASSWORD_RESET: "password-reset-v1",
  POSTMARK_TEMPLATE_ALIAS_EMAIL_CHANGE: "email-change-v1",
  POSTMARK_TEMPLATE_ALIAS_SECURITY_NOTICE: "security-notice-v1",
  POSTMARK_TEMPLATE_ALIAS_ACCOUNT_LIFECYCLE: "account-lifecycle-v1",
} as const;

const resendConfiguration = {
  HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "RESEND",
  RESEND_API_KEY: "resend-key-for-test",
  RESEND_FROM_ADDRESS: "account@example.test",
  RESEND_FROM_NAME: "Voyagewright",
  HOMEPORT_PUBLIC_APP_ORIGIN: "https://voyagewright.example.test",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
} as const;

let syntheticRoot: string | null = null;

describe("Project Homeport transactional email providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    for (const [key, value] of Object.entries(configuration)) vi.stubEnv(key, value);
    mocks.deliveryCreate.mockResolvedValue({ id: "delivery-1" });
    mocks.deliveryUpdate.mockImplementation(({ data }) => Promise.resolve({ id: "delivery-1", ...data }));
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventCreate.mockResolvedValue({ id: "event-1" });
    mocks.send.mockResolvedValue({
      ErrorCode: 0,
      Message: "OK",
      MessageID: "84e6fbb6-dd83-4a9f-9982-73a9f1938746",
      SubmittedAt: "2026-08-05T23:30:00.000Z",
      To: "owner@example.test",
    });
    mocks.resendSend.mockResolvedValue({
      data: { id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" },
      error: null,
      headers: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (syntheticRoot) rmSync(syntheticRoot, { force: true, recursive: true });
    syntheticRoot = null;
  });

  it("keeps the Postmark compatibility adapter functional without selecting it for production", async () => {
    await expect(
      sendTransactionalEmail({
        purpose: "VERIFY_EMAIL",
        email: "owner@example.test",
        accountId: "account-1",
        accountTokenId: "challenge-1",
        displayName: "Owner",
        token: "123456",
      }),
    ).resolves.toMatchObject({ status: "SUBMITTED" });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        From: "Voyagewright <account@example.test>",
        To: "owner@example.test",
        TemplateAlias: "verify-email-v1",
        MessageStream: "outbound",
        TemplateModel: expect.objectContaining({ verification_code: "123456", expires_minutes: 10 }),
      }),
    );
    expect(mocks.deliveryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "account-1",
        accountTokenId: "challenge-1",
        provider: "POSTMARK",
        status: "PENDING",
      }),
    });
    expect(JSON.stringify(mocks.deliveryCreate.mock.calls)).not.toContain("123456");
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: expect.objectContaining({
        providerMessageId: "84e6fbb6-dd83-4a9f-9982-73a9f1938746",
        status: "SUBMITTED",
      }),
    });
  });

  it("normalizes an explicitly selected compatibility provider name", () => {
    vi.stubEnv("HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER", "postmark");
    expect(transactionalEmailProviderStatus()).toMatchObject({
      providerId: "POSTMARK",
      available: true,
      classification: "POSTMARK_CONFIGURED",
    });
  });

  it("homeport.owner-correction.round3.email-provider-contract fails closed when production configuration is missing", () => {
    vi.stubEnv("POSTMARK_SERVER_TOKEN", "");
    const status = transactionalEmailProviderStatus();
    expect(status).toMatchObject({
      providerId: "POSTMARK",
      available: false,
      classification: "POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION",
    });
    expect(status.missing).toContain("POSTMARK_SERVER_TOKEN");
  });

  it("homeport.owner-correction.round3.resend-adapter and homeport.auth.resend-delivery select Resend without persisting the code", async () => {
    for (const [key, value] of Object.entries(resendConfiguration)) vi.stubEnv(key, value);
    await expect(
      sendTransactionalEmail({
        purpose: "VERIFY_EMAIL",
        email: "owner@example.test",
        accountId: "account-1",
        accountTokenId: "challenge-1",
        displayName: "Owner",
        token: "123456",
      }),
    ).resolves.toMatchObject({ status: "SUBMITTED" });
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Voyagewright <account@example.test>",
        to: "owner@example.test",
        subject: "Your Voyagewright verification code",
        html: expect.stringContaining("123456"),
        text: expect.stringContaining("123456"),
      }),
      { idempotencyKey: "delivery-1" },
    );
    expect(mocks.deliveryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: "RESEND", status: "PENDING" }),
    });
    expect(JSON.stringify(mocks.deliveryCreate.mock.calls)).not.toContain("123456");
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: expect.objectContaining({
        providerMessageId: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
        status: "SUBMITTED",
      }),
    });
  });

  it("makes Resend the fail-closed production default and reports its exact missing keys", () => {
    vi.stubEnv("HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM_ADDRESS", "");
    vi.stubEnv("RESEND_FROM_NAME", "");
    const status = transactionalEmailProviderStatus();
    expect(status).toMatchObject({
      providerId: "RESEND",
      available: false,
      classification: "RESEND_BLOCKED_EXTERNAL_CONFIGURATION",
    });
    expect(status.missing).toEqual(["RESEND_API_KEY", "RESEND_FROM_ADDRESS", "RESEND_FROM_NAME"]);
  });

  it("renders reset links from the configured public origin and fails once without automatic duplicate sends", async () => {
    for (const [key, value] of Object.entries(resendConfiguration)) vi.stubEnv(key, value);
    mocks.resendSend.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "refused secret detail", statusCode: 422 },
      headers: null,
    });
    await expect(
      sendTransactionalEmail({
        purpose: "PASSWORD_RESET",
        email: "owner@example.test",
        accountId: "account-1",
        token: "raw-reset-secret",
      }),
    ).rejects.toMatchObject({ code: "DELIVERY_FAILED" });
    expect(mocks.resendSend).toHaveBeenCalledTimes(1);
    expect(mocks.resendSend.mock.calls[0][0].text).toContain(
      "https://voyagewright.example.test/reset-password?token=raw-reset-secret",
    );
    expect(JSON.stringify(mocks.deliveryUpdate.mock.calls)).not.toContain("raw-reset-secret");
  });

  it("rejects a public application URL that is not an exact origin", async () => {
    for (const [key, value] of Object.entries(resendConfiguration)) vi.stubEnv(key, value);
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "https://voyagewright.example.test/unexpected-path");
    await expect(
      sendTransactionalEmail({
        purpose: "PASSWORD_RESET",
        email: "owner@example.test",
        accountId: "account-1",
        token: "raw-reset-secret",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CONFIGURATION" });
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it("records a sanitized provider failure without automatic duplicate sends", async () => {
    mocks.send.mockRejectedValue(Object.assign(new Error("provider refused secret detail"), { code: "ETIMEDOUT" }));
    await expect(
      sendTransactionalEmail({
        purpose: "PASSWORD_RESET",
        email: "owner@example.test",
        accountId: "account-1",
        token: "raw-reset-secret",
      }),
    ).rejects.toMatchObject({ code: "DELIVERY_FAILED" });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: { status: "FAILED", failureCode: "ETIMEDOUT" },
    });
    expect(JSON.stringify(mocks.deliveryUpdate.mock.calls)).not.toContain("raw-reset-secret");
  });

  it("homeport.owner-correction.round3.patch-a fails one task-owned verification delivery and lets retry succeed", async () => {
    syntheticRoot = mkdtempSync(path.join(tmpdir(), "homeport-patch-a-email-"));
    vi.stubEnv("HOMEPORT_SYNTHETIC_EMAIL_ADAPTER", "TASK_OWNED_TEST");
    vi.stubEnv("HOMEPORT_PHASE7_TASK_ROOT", syntheticRoot);
    vi.stubEnv("HOMEPORT_SYNTHETIC_OUTBOX_PATH", path.join(syntheticRoot, "outbox", "delivery.jsonl"));
    vi.stubEnv("HOMEPORT_SYNTHETIC_EMAIL_FAILURE", "VERIFY_EMAIL_ONCE");
    const request = {
      purpose: "VERIFY_EMAIL" as const,
      email: "retry@example.test",
      accountId: "account-retry",
      accountTokenId: "challenge-retry",
      token: "654321",
    };

    await expect(sendTransactionalEmail(request)).rejects.toMatchObject({ code: "DELIVERY_FAILED" });
    await expect(sendTransactionalEmail(request)).resolves.toMatchObject({ status: "SUBMITTED" });
    expect(mocks.deliveryCreate).toHaveBeenCalledTimes(2);
    expect(mocks.deliveryUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "delivery-1" },
      data: { status: "FAILED", failureCode: "DELIVERY_FAILED" },
    });
    expect(JSON.stringify(mocks.deliveryUpdate.mock.calls)).not.toContain("654321");
  });

  it("uses the candidate-scoped generic outbox when only the candidate database reaches a built server", async () => {
    const candidatePrefix = "0123456789ab";
    syntheticRoot = path.resolve(`.sounding-line-${candidatePrefix}.outbox`);
    vi.stubEnv("DATABASE_URL", `file:./.sounding-line-${candidatePrefix}.sqlite`);
    vi.stubEnv("HOMEPORT_SYNTHETIC_EMAIL_ADAPTER", "");
    vi.stubEnv("HOMEPORT_SYNTHETIC_OUTBOX_PATH", path.join(tmpdir(), "unpaired-email-outbox.jsonl"));
    vi.stubEnv("HOMEPORT_PHASE7_TASK_ROOT", "");

    expect(transactionalEmailProviderStatus()).toMatchObject({
      providerId: "SYNTHETIC_OUTBOX",
      available: true,
      classification: "SYNTHETIC_EMAIL_ONLY",
    });

    await expect(
      sendTransactionalEmail({
        purpose: "VERIFY_EMAIL",
        email: "generic-outbox@example.test",
        accountId: "generic-outbox-account",
        token: "123456",
      }),
    ).resolves.toMatchObject({ status: "SUBMITTED" });

    expect(readFileSync(path.join(syntheticRoot, "outbox", "messages.jsonl"), "utf8")).toContain(
      "generic-outbox@example.test",
    );
  });

  it("persists a task-owned production browser delivery when only its bounded embedded outbox contract reaches the server", async () => {
    syntheticRoot = mkdtempSync(path.join(tmpdir(), "homeport-browser-email-"));
    const outboxPath = path.join(syntheticRoot, "outbox", "messages.jsonl");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("HOMEPORT_SYNTHETIC_EMAIL_ADAPTER", "");
    vi.stubEnv("SOUNDING_LINE_TASK_OWNED_HTTP", "");
    vi.stubEnv("SOUNDING_LINE_SUITE_PROFILE", "");
    vi.stubEnv("HOMEPORT_PHASE7_TASK_ROOT", syntheticRoot);
    vi.stubEnv("HOMEPORT_SYNTHETIC_OUTBOX_PATH", outboxPath);

    expect(transactionalEmailProviderStatus()).toMatchObject({
      providerId: "SYNTHETIC_OUTBOX",
      available: true,
      classification: "SYNTHETIC_EMAIL_ONLY",
    });

    await expect(
      sendTransactionalEmail({
        purpose: "VERIFY_EMAIL",
        email: "browser-outbox@example.test",
        accountId: "browser-outbox-account",
        token: "654321",
      }),
    ).resolves.toMatchObject({ status: "SUBMITTED" });

    expect(readFileSync(outboxPath, "utf8")).toContain("browser-outbox@example.test");
  });

  it("keeps the dormant Postmark webhook compatibility boundary idempotent", async () => {
    const input = {
      recordType: "Delivery" as const,
      messageId: "84e6fbb6-dd83-4a9f-9982-73a9f1938746",
      payload: { RecordType: "Delivery", MessageID: "84e6fbb6-dd83-4a9f-9982-73a9f1938746" },
      deliveredAt: new Date("2026-08-05T23:31:00.000Z"),
    };
    await expect(recordPostmarkWebhook(input)).resolves.toEqual({ state: "RECORDED" });
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerMessageId: input.messageId,
        recordType: "Delivery",
        payloadChecksum: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    });
    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith({
      where: { providerMessageId: input.messageId },
      data: { status: "DELIVERED", deliveredAt: input.deliveredAt },
    });
    mocks.eventCreate.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));
    await expect(recordPostmarkWebhook(input)).resolves.toEqual({ state: "DUPLICATE" });
  });

  it("classifies bounce and spam-complaint events without verifying account ownership", async () => {
    const messageId = "84e6fbb6-dd83-4a9f-9982-73a9f1938746";
    const bouncedAt = new Date("2026-08-05T23:32:00.000Z");
    await recordPostmarkWebhook({
      recordType: "Bounce",
      messageId,
      payload: { RecordType: "Bounce", MessageID: messageId, Type: "HardBounce" },
      bouncedAt,
      failureCode: "1-HardBounce",
    });
    expect(mocks.deliveryUpdateMany).toHaveBeenLastCalledWith({
      where: { providerMessageId: messageId },
      data: { status: "BOUNCED", bouncedAt, failureCode: "1-HardBounce" },
    });
    await recordPostmarkWebhook({
      recordType: "SpamComplaint",
      messageId,
      payload: { RecordType: "SpamComplaint", MessageID: messageId, Type: "SpamComplaint" },
      bouncedAt,
      failureCode: "512-SpamComplaint",
    });
    expect(mocks.deliveryUpdateMany).toHaveBeenLastCalledWith({
      where: { providerMessageId: messageId },
      data: { status: "COMPLAINED", bouncedAt, failureCode: "512-SpamComplaint" },
    });
  });
});
