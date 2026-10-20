/** Reserved account inputs after the canonical owned database and synthetic-mail guards. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { db } from "../../src/lib/db";
import { seedSextantResourceExperiences } from "./sextant-resource-fixtures";

const cases = [
  "account-recovery-default",
  "account-recovery-1280-no-preference",
  "account-recovery-1280-reduce",
  "account-recovery-390-no-preference",
  "account-recovery-390-reduce",
] as const;
export type SextantAccountRecoveryCase = (typeof cases)[number];

export async function seedSextantAccountRecoveryExperience(
  key: SextantAccountRecoveryCase = "account-recovery-default",
) {
  if (!cases.includes(key)) throw new Error("SEXTANT_ACCOUNT_RECOVERY_CASE_INVALID");
  const candidate = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
  const taskRoot = path.resolve(`.sounding-line-${candidate.slice(0, 12)}.outbox`);
  const outboxPath = path.join(taskRoot, "outbox", "messages.jsonl");
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databasePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : "";
  if (
    !/^[a-f0-9]{40}$/u.test(candidate) ||
    process.env.FOREVER_VALIDATION_NONCE_HASH !==
      createHash("sha256").update(`sounding-line:${candidate}:generic`).digest("hex") ||
    !path.isAbsolute(databasePath) ||
    path.dirname(databasePath) !== path.resolve("artifacts/sounding-line", `generic-${candidate.slice(0, 12)}`) ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    process.env.HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER !== "SYNTHETIC_OUTBOX" ||
    process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER !== "TASK_OWNED_TEST" ||
    process.env.HOMEPORT_SYNTHETIC_EMAIL_FAILURE ||
    path.resolve(process.env.HOMEPORT_PHASE7_TASK_ROOT ?? ".") !== taskRoot ||
    path.resolve(process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH ?? ".") !== outboxPath
  )
    throw new Error("SEXTANT_ACCOUNT_OWNED_SYNTHETIC_EMAIL_REQUIRED");
  for (const entry of [taskRoot, path.dirname(outboxPath), outboxPath]) {
    if (!existsSync(entry)) continue;
    const stat = lstatSync(entry);
    if (stat.isSymbolicLink() || (entry === outboxPath ? !stat.isFile() : !stat.isDirectory()))
      throw new Error("SEXTANT_ACCOUNT_OUTBOX_IDENTITY_REFUSED");
  }
  const fixture = await seedSextantResourceExperiences(key);
  const email = `sextant.${key}@example.test`;
  const nextEmail = `sextant.changed.${key}@example.test`;
  const displayName = `Synthetic Recovery Navigator ${key}`;
  if (await db.accountEmail.count({ where: { normalizedEmail: { in: [email, nextEmail] } } }))
    throw new Error("SEXTANT_ACCOUNT_RECOVERY_ALREADY_EXISTS");
  if (await db.playerProfile.count({ where: { displayName } }))
    throw new Error("SEXTANT_ACCOUNT_RECOVERY_PROFILE_ALREADY_EXISTS");
  // No account, challenge, lifecycle transition or email is pre-created here.
  return { ...fixture, registration: { email, nextEmail, displayName }, outboxPath };
}
