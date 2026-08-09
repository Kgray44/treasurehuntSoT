import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/wayfarer/accounts";
import { writeAdministrativeAudit } from "./audit";
import { AdmiraltyError } from "./errors";

export type BootstrapInput = Readonly<{ accountIds: readonly string[]; emails: readonly string[] }>;

function splitList(value?: string) {
  return [
    ...new Set(
      (value ?? "")
        .split(/[\s,;]+/u)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function bootstrapInputFromEnvironment(environment: NodeJS.ProcessEnv = process.env): BootstrapInput {
  return {
    accountIds: splitList(environment.ADMIRALTY_BOOTSTRAP_ACCOUNT_IDS),
    emails: [...new Set(splitList(environment.ADMIRALTY_BOOTSTRAP_EMAILS).map(normalizeEmail))],
  };
}

export async function resolveBootstrapAccounts(input: BootstrapInput) {
  if (!input.accountIds.length && !input.emails.length)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "No Admiralty bootstrap accounts were configured.", 400);
  const [accounts, emailRows] = await Promise.all([
    input.accountIds.length
      ? db.userAccount.findMany({ where: { id: { in: [...input.accountIds] } }, select: { id: true } })
      : [],
    input.emails.length
      ? db.accountEmail.findMany({
          where: { normalizedEmail: { in: [...input.emails] }, isPrimary: true },
          select: { normalizedEmail: true, accountId: true },
        })
      : [],
  ]);
  const foundIds = new Set(accounts.map((account) => account.id));
  const foundEmails = new Map(emailRows.map((row) => [row.normalizedEmail, row.accountId]));
  const missingIds = input.accountIds.filter((id) => !foundIds.has(id));
  const missingEmails = input.emails.filter((email) => !foundEmails.has(email));
  if (missingIds.length || missingEmails.length)
    throw new AdmiraltyError(
      "ADMIN_TARGET_NOT_FOUND",
      `Bootstrap failed closed: ${missingIds.length} account ID and ${missingEmails.length} email lookup(s) were unresolved.`,
      404,
    );
  return [...new Set([...accounts.map((account) => account.id), ...emailRows.map((row) => row.accountId)])].sort();
}

export async function reconcileAdmiraltyBootstrap(
  input: BootstrapInput,
  options: { commit: boolean; now?: Date } = { commit: false },
) {
  const accountIds = await resolveBootstrapAccounts(input);
  const existing = await db.accountRoleAssignment.findMany({
    where: { accountId: { in: accountIds }, role: "ADMINISTRATOR", scopeType: "GLOBAL", scopeId: null },
    orderBy: { grantedAt: "desc" },
  });
  const plan = accountIds.map((accountId) => {
    const assignments = existing.filter((assignment) => assignment.accountId === accountId);
    const active = assignments.filter((assignment) => !assignment.revokedAt);
    if (active.length > 1)
      throw new AdmiraltyError("ADMIN_CONFLICT", "Bootstrap found duplicate active administrator assignments.", 409);
    return {
      accountId,
      action: active.length
        ? ("UNCHANGED" as const)
        : assignments.length
          ? ("REACTIVATE" as const)
          : ("CREATE" as const),
      assignmentId: active[0]?.id ?? assignments[0]?.id ?? null,
    };
  });
  if (!options.commit) return { mode: "DRY_RUN" as const, plan };

  const now = options.now ?? new Date();
  await db.$transaction(async (tx) => {
    for (const item of plan) {
      let assignmentId = item.assignmentId;
      if (item.action === "REACTIVATE" && assignmentId) {
        await tx.accountRoleAssignment.update({
          where: { id: assignmentId },
          data: { revokedAt: null, grantedAt: now, grantedBy: "ADMIRALTY_BOOTSTRAP" },
        });
      } else if (item.action === "CREATE") {
        assignmentId = (
          await tx.accountRoleAssignment.create({
            data: {
              accountId: item.accountId,
              role: "ADMINISTRATOR",
              scopeType: "GLOBAL",
              grantedBy: "ADMIRALTY_BOOTSTRAP",
              grantedAt: now,
            },
          })
        ).id;
      }
      await writeAdministrativeAudit(
        {
          actorAccountId: null,
          actorRole: "SYSTEM_BOOTSTRAP",
          actorType: "SYSTEM",
          capability: "SECURITY_OPERATE",
          action: "ADMIRALTY_BOOTSTRAP_RECONCILED",
          targetType: "AccountRoleAssignment",
          targetId: assignmentId ?? item.accountId,
          reason: "Explicit Admiralty bootstrap reconciliation was invoked.",
          authorizationBasis: "EXPLICIT_BOOTSTRAP_RECONCILIATION",
          correlationId: randomUUID(),
          beforeSummary: {
            administratorRole:
              item.action === "CREATE" ? "ABSENT" : item.action === "REACTIVATE" ? "REVOKED" : "ACTIVE",
          },
          afterSummary: { administratorRole: "ACTIVE", reconciliationAction: item.action },
        },
        tx,
      );
    }
  });
  return { mode: "COMMIT" as const, plan };
}
