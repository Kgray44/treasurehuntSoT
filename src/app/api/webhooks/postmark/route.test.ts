import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/wayfarer/transactional-email", () => ({ recordPostmarkWebhook: mocks.record }));

import { POST } from "./route";

function request(body: unknown, credentials = "hook-user:hook-password") {
  return new Request("http://localhost/api/webhooks/postmark", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });
}

describe("Postmark webhook boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POSTMARK_WEBHOOK_USERNAME = "hook-user";
    process.env.POSTMARK_WEBHOOK_PASSWORD = "hook-password";
    mocks.record.mockResolvedValue({ state: "RECORDED" });
  });

  it("rejects missing or incorrect HTTP Basic credentials", async () => {
    expect((await POST(request({}, "wrong:value"))).status).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("strictly rejects malformed event payloads", async () => {
    expect((await POST(request({ RecordType: "Delivery", MessageID: "not-a-uuid" }))).status).toBe(400);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("correlates an authenticated delivery event without treating it as email ownership verification", async () => {
    const messageId = "84e6fbb6-dd83-4a9f-9982-73a9f1938746";
    const response = await POST(
      request({ RecordType: "Delivery", MessageID: messageId, DeliveredAt: "2026-08-05T23:31:00.000Z" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ recordType: "Delivery", messageId, deliveredAt: expect.any(Date) }),
    );
  });

  it("accepts Postmark's documented spam-complaint event shape", async () => {
    const messageId = "84e6fbb6-dd83-4a9f-9982-73a9f1938746";
    const response = await POST(
      request({
        RecordType: "SpamComplaint",
        MessageID: messageId,
        Type: "SpamComplaint",
        TypeCode: 512,
        BouncedAt: "2026-08-05T23:33:00.000Z",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        recordType: "SpamComplaint",
        messageId,
        bouncedAt: expect.any(Date),
        failureCode: "512-SpamComplaint",
      }),
    );
  });
});
