import { compare } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { writeAdministrativeAudit } from "./audit";
import type { AdmiraltyCurrentOperator } from "./authorization";
import { AdmiraltyError } from "./errors";

export type PrivilegedAssuranceMethod = "PASSWORD" | "OAUTH_REAUTH" | "OTHER_GOVERNED_METHOD";
export type PrivilegedAssuranceState = Readonly<{
  level: "ADMIN_BASE" | "ADMIN_REAUTHENTICATED";
  method: "CANONICAL_SESSION" | PrivilegedAssuranceMethod;
  issuedAt: Date;
  expiresAt: Date;
  assuranceId?: string;
  recent: boolean;
  previousExpiredAt?: Date;
}>;

export const privilegedAssuranceLifetimeMs = 10 * 60 * 1000;

export async function privilegedAssuranceState(operator: AdmiraltyCurrentOperator, now = new Date()) {
  const latest = await db.privilegedAssurance.findFirst({
    where: {
      accountId: operator.accountId,
      accountSessionId: operator.accountSessionId,
      revokedAt: null,
    },
    orderBy: { issuedAt: "desc" },
  });
  if (latest && latest.expiresAt.getTime() > now.getTime())
    return {
      level: "ADMIN_REAUTHENTICATED",
      method: latest.method as PrivilegedAssuranceMethod,
      issuedAt: latest.issuedAt,
      expiresAt: latest.expiresAt,
      assuranceId: latest.id,
      recent: true,
    } satisfies PrivilegedAssuranceState;
  return {
    level: "ADMIN_BASE",
    method: "CANONICAL_SESSION",
    issuedAt: now,
    expiresAt: operator.sessionExpiresAt,
    recent: false,
    ...(latest ? { previousExpiredAt: latest.expiresAt } : {}),
  } satisfies PrivilegedAssuranceState;
}

export async function reauthenticatePrivilegedOperator(
  operator: AdmiraltyCurrentOperator,
  password: string,
  now = new Date(),
) {
  const credential = await db.accountCredential.findUnique({
    where: { accountId: operator.accountId },
    select: { passwordHash: true },
  });
  if (!credential)
    throw new AdmiraltyError(
      "ADMIN_OPERATION_UNAVAILABLE",
      "This account needs a governed reauthentication method that is not available in this phase.",
      409,
    );
  if (!(await compare(password, credential.passwordHash)))
    throw new AdmiraltyError("ADMIRALTY_REAUTH_FAILED", "Reauthentication was not successful.", 403);

  const correlationId = randomUUID();
  const expiresAt = new Date(
    Math.min(now.getTime() + privilegedAssuranceLifetimeMs, operator.sessionExpiresAt.getTime()),
  );
  const assurance = await db.$transaction(async (tx) => {
    await tx.privilegedAssurance.updateMany({
      where: { accountId: operator.accountId, accountSessionId: operator.accountSessionId, revokedAt: null },
      data: { revokedAt: now },
    });
    const created = await tx.privilegedAssurance.create({
      data: {
        accountId: operator.accountId,
        accountSessionId: operator.accountSessionId,
        assuranceLevel: "ADMIN_REAUTHENTICATED",
        method: "PASSWORD",
        issuedAt: now,
        expiresAt,
        correlationId,
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: operator.accountId,
        actorRole: operator.roles[0] ?? "ADMINISTRATOR",
        capability: "PLATFORM_OBSERVE",
        action: "ADMIRALTY_ASSURANCE_ISSUED",
        targetType: "AccountSession",
        targetId: operator.accountSessionId,
        reason: "Operator completed governed password reauthentication.",
        authorizationBasis: operator.authorizationBasis,
        accountSessionId: operator.accountSessionId,
        correlationId,
        beforeSummary: { assuranceLevel: "ADMIN_BASE" },
        afterSummary: { assuranceLevel: "ADMIN_REAUTHENTICATED", expiresAt },
      },
      tx,
    );
    return created;
  });
  return assurance;
}

export async function requireRecentPrivilegedAssurance(operator: AdmiraltyCurrentOperator, now = new Date()) {
  const state = await privilegedAssuranceState(operator, now);
  if (state.recent) return state;
  if (state.previousExpiredAt)
    throw new AdmiraltyError("ADMIRALTY_ASSURANCE_EXPIRED", "Recent privileged assurance has expired.", 403);
  throw new AdmiraltyError("ADMIRALTY_ASSURANCE_REQUIRED", "Recent reauthentication is required.", 403);
}
