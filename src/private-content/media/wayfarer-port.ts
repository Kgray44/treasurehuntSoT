import type { ProtectedMediaAssociation, ProtectedMediaDerivative, ProtectedMediaPurpose } from "./contracts";

export type WayfarerProtectedMediaSubject = "MEMORY" | "KEEPSAKE" | "ARTIFACT_RECORD" | "DISPLAY_CASE";
export interface WayfarerProtectedMediaPort {
  registerOwnerMedia(
    input: Readonly<{
      ownerAccountId: string;
      ownerProfileId?: string;
      sourceMediaId: string;
      subjectKind: WayfarerProtectedMediaSubject;
      subjectOpaqueId: string;
      purpose: Extract<
        ProtectedMediaPurpose,
        `MEMORY_${string}` | `KEEPSAKE_${string}` | `ARTIFACT_${string}` | `DISPLAY_CASE_${string}`
      >;
      sourceRevision: string;
    }>,
  ): Promise<Pick<ProtectedMediaAssociation, "id" | "protectedMediaId" | "purpose" | "subjectOpaqueId">>;
  requestDisplayDerivative(
    input: Readonly<{
      sourceMediaId: string;
      subjectOpaqueId: string;
      purpose: "DISPLAY_CASE_UNLISTED" | "DISPLAY_CASE_PUBLIC";
      idempotencyKey: string;
    }>,
  ): Promise<Pick<ProtectedMediaDerivative, "id" | "state" | "outputChecksum">>;
  withdrawAssociation(
    input: Readonly<{ associationId: string; ownerAccountId: string; reasonCode: string }>,
  ): Promise<{ associationId: string; withdrawn: boolean }>;
}

/** Test-only adapter: it asserts opaque ownership without emulating Wayfarer tables. */
export function createSyntheticWayfarerSubjectAdapter(
  records: ReadonlyMap<string, { ownerAccountId: string; revision: string }>,
) {
  return Object.freeze({
    async assertOwner(input: { ownerAccountId: string; subjectOpaqueId: string; revision: string }) {
      const record = records.get(input.subjectOpaqueId);
      return !!record && record.ownerAccountId === input.ownerAccountId && record.revision === input.revision;
    },
  });
}
