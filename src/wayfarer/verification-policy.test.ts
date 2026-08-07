import { describe, expect, it } from "vitest";
import {
  createEmailVerificationCode,
  emailVerificationCodeHash,
  emailVerificationPolicy,
  validEmailVerificationCodeFormat,
  verificationCodeMatches,
} from "./verification-policy";

describe("homeport.owner-correction.round3.verification-code-security", () => {
  it("generates bounded six-digit challenges under one centralized policy", () => {
    const values = Array.from({ length: 64 }, () => createEmailVerificationCode());
    expect(values.every((value) => /^\d{6}$/u.test(value))).toBe(true);
    expect(emailVerificationPolicy).toEqual({
      digits: 6,
      expiresMs: 600_000,
      maxAttempts: 5,
      resendCooldownMs: 60_000,
      maxResendsPerHour: 5,
    });
  });

  it("scopes the stored digest to account and normalized email and compares without accepting malformed codes", () => {
    const digest = emailVerificationCodeHash("account-1", "owner@example.test", "123456");
    expect(digest).not.toContain("123456");
    expect(verificationCodeMatches("account-1", "owner@example.test", "123456", digest)).toBe(true);
    expect(verificationCodeMatches("account-2", "owner@example.test", "123456", digest)).toBe(false);
    expect(verificationCodeMatches("account-1", "next@example.test", "123456", digest)).toBe(false);
    expect(verificationCodeMatches("account-1", "owner@example.test", "12345", digest)).toBe(false);
    expect(validEmailVerificationCodeFormat("123456")).toBe(true);
    expect(validEmailVerificationCodeFormat("12345a")).toBe(false);
  });
});
