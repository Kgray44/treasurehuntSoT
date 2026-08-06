import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
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

describe("Project Homeport Postmark transactional adapter", () => {
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
  });

  afterEach(() => vi.unstubAllEnvs());

  it("homeport.owner-correction.round3.postmark-adapter sends the governed template model and persists the accepted MessageID", async () => {
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

  it("homeport.owner-correction.round3.postmark-webhooks atomically correlates delivery and treats duplicate events idempotently", async () => {
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
