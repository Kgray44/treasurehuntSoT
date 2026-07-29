export type ProtectedMediaReconciliationFinding = Readonly<{
  code:
    | "MISSING_SOURCE_OBJECT"
    | "READY_WITHOUT_CLEAN_SCAN"
    | "ACTIVE_PUBLIC_GRANT_WITHOUT_DERIVATIVE"
    | "WITHDRAWN_DERIVATIVE_ACTIVE_GRANT"
    | "STALE_AUTHORIZATION_REVISION";
  targetOpaqueId: string;
}>;

/** Pure detector: repair planning decides what, if anything, can mutate state. */
export function reconcileProtectedMediaRecord(input: {
  mediaId: string;
  sourceExists: boolean;
  derivative?: { state: string; scanState: string; withdrawnAt?: Date };
  grant?: {
    state: string;
    audience: string;
    authorizationRevision: string;
    currentAuthorizationRevision: string;
    derivativeId?: string;
  };
}): readonly ProtectedMediaReconciliationFinding[] {
  const findings: ProtectedMediaReconciliationFinding[] = [];
  if (!input.sourceExists) findings.push({ code: "MISSING_SOURCE_OBJECT", targetOpaqueId: input.mediaId });
  if (input.derivative?.state === "READY" && input.derivative.scanState !== "CLEAN")
    findings.push({ code: "READY_WITHOUT_CLEAN_SCAN", targetOpaqueId: input.mediaId });
  if (input.grant?.state === "ACTIVE" && input.grant.audience === "PUBLIC" && !input.grant.derivativeId)
    findings.push({ code: "ACTIVE_PUBLIC_GRANT_WITHOUT_DERIVATIVE", targetOpaqueId: input.mediaId });
  if (input.grant?.state === "ACTIVE" && input.derivative?.withdrawnAt)
    findings.push({ code: "WITHDRAWN_DERIVATIVE_ACTIVE_GRANT", targetOpaqueId: input.mediaId });
  if (input.grant?.state === "ACTIVE" && input.grant.authorizationRevision !== input.grant.currentAuthorizationRevision)
    findings.push({ code: "STALE_AUTHORIZATION_REVISION", targetOpaqueId: input.mediaId });
  return Object.freeze(findings);
}
