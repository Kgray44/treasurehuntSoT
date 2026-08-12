import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accountFind: vi.fn(), voyageFind: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    userAccount: { findUnique: mocks.accountFind },
    taleSession: { findUnique: mocks.voyageFind },
    platformAuditEvent: { create: vi.fn() },
  },
}));

import { getVoyageDetail } from "./one-voyage-admin-read";
import { getAccountDossier } from "./wayfarer-admin-read";

const operator = {
  accountId: "operator",
  accountSessionId: "session",
  displayName: "Operator",
  roles: ["ADMINISTRATOR"],
  capabilities: ["ACCOUNT_OBSERVE", "VOYAGE_OBSERVE"],
  csrfToken: "not-returned",
  sessionExpiresAt: new Date("2030-01-01T00:00:00Z"),
  authorizationBasis: "ROLE_CAPABILITY:ADMINISTRATOR",
} as const;

describe("owner read-port redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFind.mockResolvedValue(null);
    mocks.voyageFind.mockResolvedValue(null);
  });

  it("never selects Wayfarer credential or provider-token material", async () => {
    await getAccountDossier(operator as never, "account");
    const selection = JSON.stringify(mocks.accountFind.mock.calls[0]?.[0]?.select);
    expect(selection).not.toMatch(
      /passwordHash|tokenHash|csrfToken|encryptedToken|allowedScopes|recipientHash|providerMessageId/iu,
    );
    expect(selection).toMatch(/displayEmail|verificationState|securityEvents|supportRequestsTargeted/iu);
  });

  it("never selects One Voyage access tokens, state snapshots, or raw event payloads", async () => {
    await getVoyageDetail(operator as never, "voyage");
    const selection = JSON.stringify(mocks.voyageFind.mock.calls[0]?.[0]?.select);
    expect(selection).not.toMatch(
      /accessTokenHash|configuration|previewSnapshot|variables|inventory|payload|idempotencyKey|archiveMetadata/iu,
    );
    expect(selection).toMatch(/eventType|sequence|correlationId|verificationRequests/iu);
  });
});
