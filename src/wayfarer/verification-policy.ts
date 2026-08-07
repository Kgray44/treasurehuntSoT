import { randomInt } from "node:crypto";
import { hashToken, safeEqual } from "@/lib/security";

export const emailVerificationPolicy = Object.freeze({
  digits: 6,
  expiresMs: 10 * 60_000,
  maxAttempts: 5,
  resendCooldownMs: 60_000,
  maxResendsPerHour: 5,
});

export function createEmailVerificationCode() {
  return String(randomInt(0, 10 ** emailVerificationPolicy.digits)).padStart(emailVerificationPolicy.digits, "0");
}

export function emailVerificationCodeHash(accountId: string, normalizedEmail: string, code: string) {
  return hashToken(`${accountId}:${normalizedEmail}:VERIFY_EMAIL:${code}`);
}

export function validEmailVerificationCodeFormat(code: string) {
  return new RegExp(`^\\d{${emailVerificationPolicy.digits}}$`, "u").test(code);
}

export function verificationCodeMatches(
  accountId: string,
  normalizedEmail: string,
  code: string,
  expectedHash: string,
) {
  return (
    validEmailVerificationCodeFormat(code) &&
    safeEqual(emailVerificationCodeHash(accountId, normalizedEmail, code), expectedHash)
  );
}
