import { protectedMediaFailure } from "./contracts";

/** Derivatives may be withdrawn, but their key references remain retained until every governed retention hold clears. */
export function verifyProtectedMediaKeyRetirement(input: {
  candidateVersion: string;
  activeVersion: string;
  derivativeReferences: number;
  backupReferences: number;
  restoreVerified: boolean;
  explicitlyApproved: boolean;
}) {
  if (
    !input.candidateVersion ||
    input.candidateVersion === input.activeVersion ||
    input.derivativeReferences > 0 ||
    input.backupReferences > 0 ||
    !input.restoreVerified ||
    !input.explicitlyApproved
  )
    throw protectedMediaFailure("PROTECTED_MEDIA_KEY_RETIREMENT_BLOCKED");
  return { state: "RETIREMENT_ALLOWED" as const, version: input.candidateVersion };
}

export function assertProtectedMediaKeyAvailable(input: {
  knownVersions: readonly string[];
  requiredVersion?: string;
}) {
  if (!input.requiredVersion || !input.knownVersions.includes(input.requiredVersion))
    throw protectedMediaFailure("PROTECTED_MEDIA_KEY_UNAVAILABLE");
}
