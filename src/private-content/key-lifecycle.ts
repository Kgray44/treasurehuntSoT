import type { PrivateKeyProvider, WrappedPrivateDataKey } from "./contracts";
import { privateFailure } from "./core";
export type PrivateKeyRotationPlan = {
  sourceVersion: string;
  destinationVersion: string;
  planned: number;
  alreadyCurrent: number;
  dryRun: boolean;
};
export function planPrivateKeyRotation(input: { activeVersion: string; wrapped: readonly WrappedPrivateDataKey[] }) {
  const candidates = input.wrapped.filter((item) => item.keyVersion !== input.activeVersion);
  return {
    sourceVersion: candidates[0]?.keyVersion ?? input.activeVersion,
    destinationVersion: input.activeVersion,
    planned: candidates.length,
    alreadyCurrent: input.wrapped.length - candidates.length,
    dryRun: true,
  } as PrivateKeyRotationPlan;
}
export async function rewrapPrivateKeys(input: {
  wrapped: readonly WrappedPrivateDataKey[];
  provider: PrivateKeyProvider;
  activeVersion: string;
  cursor?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number) => Promise<void>;
}) {
  const rewritten: WrappedPrivateDataKey[] = [];
  let completed = input.cursor ?? 0;
  for (const item of input.wrapped.slice(completed)) {
    if (input.signal?.aborted) return { state: "CANCELLED" as const, completed, rewritten };
    if (item.keyVersion === input.activeVersion) {
      completed += 1;
      continue;
    }
    const next = await input.provider.rewrap(item);
    if (next.keyVersion !== input.activeVersion)
      throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private key rotation did not select the active version.");
    rewritten.push(next);
    completed += 1;
    await input.onProgress?.(completed);
  }
  return { state: "COMPLETED" as const, completed, rewritten };
}
export function verifyPrivateKeyRetirement(input: {
  candidateVersion: string;
  activeVersion: string;
  liveReferences: number;
  backupReferences: number;
  restoreVerified: boolean;
  explicitlyApproved: boolean;
}) {
  if (
    input.candidateVersion === input.activeVersion ||
    input.liveReferences ||
    input.backupReferences ||
    !input.restoreVerified ||
    !input.explicitlyApproved
  )
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private key retirement is blocked.");
  return { state: "RETIREMENT_ALLOWED" as const, version: input.candidateVersion };
}
