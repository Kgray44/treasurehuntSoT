import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    platformAuditEvent: { count: mocks.count },
  },
}));

import { GET } from "./route";

const nonceHash = "a".repeat(64);

describe("GET /api/dev/validation/database-identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "1");
    vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", nonceHash);
    vi.stubEnv("FOREVER_VALIDATION_PRODUCTION_IDENTITY", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is unavailable by default in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("is unavailable in production when only part of the required environment is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FOREVER_VALIDATION_PRODUCTION_IDENTITY", "1");
    vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "0");

    const missingIsolation = await GET();
    expect(missingIsolation.status).toBe(404);
    expect(mocks.count).not.toHaveBeenCalled();

    vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "1");
    vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", "");
    const missingNonce = await GET();
    expect(missingNonce.status).toBe(404);
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("allows production identity proof only with the explicit flag and all safeguards", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FOREVER_VALIDATION_PRODUCTION_IDENTITY", "1");
    mocks.count.mockResolvedValue(1);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      validationDatabase: true,
      nonceMatch: true,
    });
  });

  it("rejects an invalid nonce in production even when production proof is enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FOREVER_VALIDATION_PRODUCTION_IDENTITY", "1");
    vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", "not-a-hash");

    const response = await GET();

    expect(response.status).toBe(404);
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("is unavailable without an explicit isolation flag and valid nonce hash", async () => {
    vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "0");

    const response = await GET();

    expect(response.status).toBe(404);
    expect(mocks.count).not.toHaveBeenCalled();

    vi.stubEnv("FOREVER_VALIDATION_ISOLATION", "1");
    vi.stubEnv("FOREVER_VALIDATION_NONCE_HASH", "not-a-hash");
    const invalidResponse = await GET();
    expect(invalidResponse.status).toBe(404);
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("confirms one matching marker without returning the path or nonce", async () => {
    mocks.count.mockResolvedValue(1);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      validationDatabase: true,
      nonceMatch: true,
    });
    expect(mocks.count).toHaveBeenCalledWith({
      where: {
        action: "VALIDATION_DATABASE_IDENTITY",
        resourceType: "VALIDATION_DATABASE",
        resourceId: nonceHash,
        correlationId: nonceHash,
      },
    });
  });

  it("preserves development access with isolation and a valid nonce", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.count.mockResolvedValue(1);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      validationDatabase: true,
      nonceMatch: true,
    });
  });

  it("fails closed when the marker is missing, duplicated, or unreadable", async () => {
    mocks.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2).mockRejectedValueOnce(new Error("offline"));

    const missing = await GET();
    expect(missing.status).toBe(409);
    await expect(missing.json()).resolves.toEqual({
      validationDatabase: true,
      nonceMatch: false,
    });

    const duplicated = await GET();
    expect(duplicated.status).toBe(409);

    const unavailable = await GET();
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({
      validationDatabase: false,
      nonceMatch: false,
    });
  });
});
