import {
  protectedMediaConsentAuthorities,
  protectedMediaDigest,
  protectedMediaFailure,
  type ProtectedMediaConsentAssertion,
  type ProtectedMediaConsentAuthority,
} from "./contracts";

type AssertionWithoutDigest = Omit<ProtectedMediaConsentAssertion, "assertionDigest">;

function assertionMaterial(assertion: AssertionWithoutDigest) {
  return {
    authority: assertion.authority,
    authorityRecordOpaqueId: assertion.authorityRecordOpaqueId,
    authorityRevision: assertion.authorityRevision,
    subjectOpaqueId: assertion.subjectOpaqueId,
    subjectParticipantOpaqueId: assertion.subjectParticipantOpaqueId ?? null,
    consumingAggregateKind: assertion.consumingAggregateKind,
    consumingAggregateOpaqueId: assertion.consumingAggregateOpaqueId,
    purpose: assertion.purpose,
    scopes: [...assertion.scopes].sort(),
    state: assertion.state,
    sourceProtectedMediaId: assertion.sourceProtectedMediaId,
    sourceChecksum: assertion.sourceChecksum,
    requestedTransformationPolicy: assertion.requestedTransformationPolicy,
    derivativeId: assertion.derivativeId ?? null,
    derivativeChecksum: assertion.derivativeChecksum ?? null,
    validFrom: assertion.validFrom.toISOString(),
    validUntil: assertion.validUntil?.toISOString() ?? null,
    revokedAt: assertion.revokedAt?.toISOString() ?? null,
    sourceWatermark: assertion.sourceWatermark,
  };
}

export function createProtectedMediaConsentAssertion(
  assertion: AssertionWithoutDigest,
): ProtectedMediaConsentAssertion {
  if (!(protectedMediaConsentAuthorities as readonly string[]).includes(assertion.authority))
    throw protectedMediaFailure("PROTECTED_MEDIA_CONSENT_AUTHORITY_INVALID");
  if (!assertion.id || !assertion.sourceProtectedMediaId || !/^[a-f0-9]{64}$/i.test(assertion.sourceChecksum))
    throw protectedMediaFailure("PROTECTED_MEDIA_CONSENT_INVALID");
  if (assertion.authority === "SEALED_HOLD_TEST" && process.env.NODE_ENV === "production")
    throw protectedMediaFailure("PROTECTED_MEDIA_TEST_AUTHORITY_FORBIDDEN");
  return Object.freeze({ ...assertion, assertionDigest: protectedMediaDigest(assertionMaterial(assertion)) });
}

export function validateProtectedMediaConsentAssertion(input: {
  assertion: ProtectedMediaConsentAssertion;
  authority: ProtectedMediaConsentAuthority;
  purpose: ProtectedMediaConsentAssertion["purpose"];
  sourceMediaId: string;
  sourceChecksum: string;
  aggregateKind: ProtectedMediaConsentAssertion["consumingAggregateKind"];
  aggregateId: string;
  requiredScopes: readonly ProtectedMediaConsentAssertion["scopes"][number][];
  derivativeId?: string;
  derivativeChecksum?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const assertion = input.assertion;
  const expected = protectedMediaDigest(assertionMaterial(assertion));
  if (
    assertion.assertionDigest !== expected ||
    assertion.authority !== input.authority ||
    assertion.state !== "GRANTED" ||
    !!assertion.revokedAt ||
    assertion.validFrom > now ||
    (assertion.validUntil && assertion.validUntil <= now) ||
    assertion.purpose !== input.purpose ||
    assertion.sourceProtectedMediaId !== input.sourceMediaId ||
    assertion.sourceChecksum !== input.sourceChecksum ||
    assertion.consumingAggregateKind !== input.aggregateKind ||
    assertion.consumingAggregateOpaqueId !== input.aggregateId ||
    input.requiredScopes.some((scope) => !assertion.scopes.includes(scope)) ||
    (input.derivativeId !== undefined && assertion.derivativeId !== input.derivativeId) ||
    (input.derivativeChecksum !== undefined && assertion.derivativeChecksum !== input.derivativeChecksum)
  )
    throw protectedMediaFailure("PROTECTED_MEDIA_CONSENT_INVALID");
  return assertion;
}
