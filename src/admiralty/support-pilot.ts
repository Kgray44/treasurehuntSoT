import { createHash } from "node:crypto";
import type { AdmiraltyDataClass } from "./read-models";
import type { SupportAccessScope } from "./schemas";
import { AdmiraltyError } from "./errors";
import { authorizeSupportGrantRecord } from "./support-access";

export const supportExecutionLifetimeMs = 10 * 60 * 1000;
export const supportPilotRiskCeiling = "READ_ONLY" as const;

export type SupportCaseGrantBinding = Readonly<{
  id: string;
  requestingOperatorId: string;
  targetAccountId: string;
  supportAccessRequestId: string | null;
}>;

export type ParentSupportGrant = Readonly<{
  id: string;
  requestId: string;
  operatorAccountId: string;
  targetAccountId: string;
  grantedScopes: string;
  status: string;
  expiresAt: Date;
  revokedAt: Date | null;
  request: { status: string };
}>;

export type SupportExecutionCapability = Readonly<{
  supportCaseId: string;
  parentSupportGrantId: string;
  operatorAccountId: string;
  targetAccountId: string;
  scopes: readonly SupportAccessScope[];
  dataClasses: readonly AdmiraltyDataClass[];
  riskCeiling: typeof supportPilotRiskCeiling;
  expiresAt: Date;
}>;

export type SupportPilotObservation = Readonly<{
  scope: SupportAccessScope;
  domain: string;
  dataClassification: AdmiraltyDataClass;
  sourceType: string;
  sourceId: string;
  sourceDigest: string;
  safeSummary: string;
  facts: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type SupportPilotFinding = Readonly<{
  code: string;
  summary: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  uncertainty: string;
}>;

export type SupportPilotDiagnosis = Readonly<{
  primaryCause: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  uncertainty: string;
  unresolvedQuestions: readonly string[];
  proposal: Readonly<{
    proposalType: string;
    summary: string;
    requiredUserConsent: boolean;
    requiresAdministrator: boolean;
    state: "INFORMATION_ONLY";
  }>;
}>;

const scopeDataClasses: Record<SupportAccessScope, AdmiraltyDataClass> = {
  ACCOUNT_STATE: "ACCOUNT_PRIVATE",
  AUTH_EVENTS: "ACCOUNT_PRIVATE",
  CHRONICLE_HISTORY_METADATA: "ACCOUNT_PRIVATE",
  TIDEGLASS_DIAGNOSTICS: "OPERATIONAL_SENSITIVE",
  COMMUNITY_ACTIVITY: "ACCOUNT_PRIVATE",
  SESSION_DIAGNOSTICS: "ACCOUNT_PRIVATE",
  PROFILE_DIAGNOSTICS: "ACCOUNT_PRIVATE",
  VOYAGE_MEMBERSHIP: "ACCOUNT_PRIVATE",
  RUNTIME_STATUS: "OPERATIONAL_SENSITIVE",
  AUDIT_CORRELATION: "OPERATIONAL_SENSITIVE",
};

const forbiddenNarrative =
  /\b(password|passphrase|token|secret|credential|cookie|private\s+(?:chronicle|media)|raw\s+log)\b(?:\s*[:=]\s*\S+)?/giu;

export function parseSupportScopes(value: string): SupportAccessScope[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter((item): item is SupportAccessScope => typeof item === "string" && item in scopeDataClasses),
          ),
        ].sort()
      : [];
  } catch {
    return [];
  }
}

export function sanitizeSupportNarrative(value: string, maximum = 480) {
  return value.replace(forbiddenNarrative, "[redacted]").replaceAll(/\s+/gu, " ").trim().slice(0, maximum);
}

export function supportScopeDataClass(scope: SupportAccessScope) {
  return scopeDataClasses[scope];
}

export function createSupportExecutionCapability(
  supportCase: SupportCaseGrantBinding,
  grant: ParentSupportGrant | null,
  operatorAccountId: string,
  now = new Date(),
): SupportExecutionCapability {
  if (!grant) throw new AdmiraltyError("SUPPORT_GRANT_REQUIRED", "An active support grant is required.", 403);
  authorizeSupportGrantRecord(
    grant,
    operatorAccountId,
    {
      targetAccountId: supportCase.targetAccountId,
      scope: parseSupportScopes(grant.grantedScopes)[0] ?? "ACCOUNT_STATE",
    },
    now,
  );
  if (
    supportCase.requestingOperatorId !== operatorAccountId ||
    supportCase.targetAccountId !== grant.targetAccountId ||
    supportCase.supportAccessRequestId !== grant.requestId
  )
    throw new AdmiraltyError("SUPPORT_GRANT_SCOPE_DENIED", "The grant is not bound to this support case.", 403);
  const scopes = parseSupportScopes(grant.grantedScopes);
  if (!scopes.length)
    throw new AdmiraltyError("SUPPORT_GRANT_SCOPE_DENIED", "The grant does not authorize a diagnostic scope.", 403);
  return {
    supportCaseId: supportCase.id,
    parentSupportGrantId: grant.id,
    operatorAccountId,
    targetAccountId: supportCase.targetAccountId,
    scopes,
    dataClasses: [...new Set(scopes.map(supportScopeDataClass))].sort(),
    riskCeiling: supportPilotRiskCeiling,
    expiresAt: new Date(Math.min(grant.expiresAt.getTime(), now.getTime() + supportExecutionLifetimeMs)),
  };
}

export function requireSupportExecutionScope(capability: SupportExecutionCapability, scope: SupportAccessScope) {
  if (capability.riskCeiling !== supportPilotRiskCeiling || !capability.scopes.includes(scope))
    throw new AdmiraltyError(
      "SUPPORT_GRANT_SCOPE_DENIED",
      "The delegated capability does not authorize this diagnostic domain.",
      403,
    );
  return true;
}

export function deriveSupportDiagnosis(observations: readonly SupportPilotObservation[]): {
  findings: readonly SupportPilotFinding[];
  diagnosis: SupportPilotDiagnosis;
} {
  const account = observations.find((observation) => observation.scope === "ACCOUNT_STATE");
  const sessions = observations.find((observation) => observation.scope === "SESSION_DIAGNOSTICS");
  const voyage = observations.find((observation) => observation.scope === "VOYAGE_MEMBERSHIP");
  if (account?.facts.accountStatus === "SUSPENDED" || account?.facts.accountLocked === true)
    return diagnosisFor(
      "ACCOUNT_ACCESS_RESTRICTION",
      "The account lifecycle state is preventing ordinary access.",
      "HIGH",
      "The diagnostic is read-only and cannot determine whether a future account action is appropriate.",
      "REVIEW_ACCOUNT_LIFECYCLE",
      "A qualified administrator must review the canonical account lifecycle state before any separate, consented repair action.",
      false,
    );
  if (sessions?.facts.activeSessionCount === 0)
    return diagnosisFor(
      "NO_ACTIVE_SESSION",
      "No active ordinary session was found in the authorized session diagnostic window.",
      "MEDIUM",
      "The diagnostic cannot establish client, network, or provider conditions from server metadata alone.",
      "REAUTHENTICATE_ACCOUNT",
      "Ask the account owner to sign in again; any session action remains outside Support Pilot S1.",
      true,
    );
  if (voyage?.facts.membershipCount === 0)
    return diagnosisFor(
      "VOYAGE_MEMBERSHIP_NOT_FOUND",
      "No current or historical Voyage membership was found in the approved diagnostic view.",
      "MEDIUM",
      "This does not evaluate private Chronicle content or change membership state.",
      "REVIEW_VOYAGE_MEMBERSHIP",
      "A future owner-domain Voyage review may be needed; S1 cannot create, remove, or rebuild membership state.",
      true,
    );
  return diagnosisFor(
    "INSUFFICIENT_SANITIZED_EVIDENCE",
    "The approved read-only projections did not establish a single likely root cause.",
    "LOW",
    "Only user-approved, sanitized scopes were examined; private content, credentials, and unapproved domains remain unavailable.",
    "REQUEST_ADDITIONAL_CONSENT",
    "Ask the account owner whether an additional narrowly defined diagnostic scope is appropriate. No repair is available in S1.",
    true,
  );
}

function diagnosisFor(
  code: string,
  summary: string,
  confidence: SupportPilotFinding["confidence"],
  uncertainty: string,
  proposalType: string,
  proposalSummary: string,
  requiredUserConsent: boolean,
) {
  const finding: SupportPilotFinding = {
    code,
    summary: sanitizeSupportNarrative(summary),
    confidence,
    uncertainty: sanitizeSupportNarrative(uncertainty),
  };
  return {
    findings: [finding],
    diagnosis: {
      primaryCause: finding.code,
      confidence,
      uncertainty: finding.uncertainty,
      unresolvedQuestions: [finding.uncertainty],
      proposal: {
        proposalType,
        summary: sanitizeSupportNarrative(proposalSummary),
        requiredUserConsent,
        requiresAdministrator: true,
        state: "INFORMATION_ONLY" as const,
      },
    },
  };
}

export function deterministicDiagnosticReceipt(input: {
  caseId: string;
  executionGrantId: string;
  scopes: readonly SupportAccessScope[];
  observations: readonly SupportPilotObservation[];
  findings: readonly SupportPilotFinding[];
}) {
  return createHash("sha256")
    .update(
      stableJson({
        caseId: input.caseId,
        executionGrantId: input.executionGrantId,
        scopes: [...input.scopes].sort(),
        observations: input.observations
          .map(({ scope, domain, sourceType, sourceId, sourceDigest }) => ({
            scope,
            domain,
            sourceType,
            sourceId,
            sourceDigest,
          }))
          .sort((left, right) => `${left.scope}:${left.sourceId}`.localeCompare(`${right.scope}:${right.sourceId}`)),
        findings: input.findings
          .map((finding) => ({ ...finding }))
          .sort((left, right) => left.code.localeCompare(right.code)),
      }),
    )
    .digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}
