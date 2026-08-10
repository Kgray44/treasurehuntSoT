import { createHash } from "node:crypto";
import type { DrydockIssue } from "@/drydock/issues";
import { getDrydockRuleDefinition } from "@/drydock/rules";

export type DrydockRuleWaiver = {
  id: string;
  issueId: string;
  ruleCode: string;
  ruleVersion: number;
  sourceChecksum: string;
  rationale: string;
  authorizedBy: string;
  authorizedAt: string;
  expiresAt?: string;
  revokedAt?: string;
};
export type DrydockWaiverDecision = {
  allowed: boolean;
  code?: "RULE_UNKNOWN" | "NON_WAIVABLE" | "STALE_SOURCE" | "STALE_RULE" | "EXPIRED" | "REVOKED";
};

export function createDrydockRuleWaiver(input: Omit<DrydockRuleWaiver, "id">): DrydockRuleWaiver {
  if (!input.rationale.trim() || !input.authorizedBy.trim())
    throw new Error("A waiver requires an authorization record and rationale.");
  const id = `drydock-waiver-${createHash("sha256").update(`${input.issueId}:${input.sourceChecksum}:${input.ruleVersion}`).digest("hex").slice(0, 24)}`;
  return { ...input, id };
}

export function evaluateDrydockWaiver(input: {
  waiver: DrydockRuleWaiver;
  issue: DrydockIssue;
  sourceChecksum: string;
  now?: Date;
}): DrydockWaiverDecision {
  const rule = getDrydockRuleDefinition(input.issue.code);
  if (!rule) return { allowed: false, code: "RULE_UNKNOWN" };
  if (rule.waiverPolicy === "NEVER") return { allowed: false, code: "NON_WAIVABLE" };
  if (input.waiver.sourceChecksum !== input.sourceChecksum) return { allowed: false, code: "STALE_SOURCE" };
  if (input.waiver.ruleCode !== input.issue.code || input.waiver.ruleVersion !== input.issue.ruleVersion)
    return { allowed: false, code: "STALE_RULE" };
  if (input.waiver.revokedAt) return { allowed: false, code: "REVOKED" };
  if (input.waiver.expiresAt && new Date(input.waiver.expiresAt) <= (input.now ?? new Date()))
    return { allowed: false, code: "EXPIRED" };
  return { allowed: true };
}
