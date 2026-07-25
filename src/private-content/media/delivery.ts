import { protectedMediaFailure, type ProtectedMediaDerivative, type ProtectedMediaGrant } from "./contracts";

export function authorizeProtectedMediaDelivery(input: {
  derivative: Pick<ProtectedMediaDerivative, "state" | "scanState" | "outputChecksum" | "withdrawnAt">;
  grant: Pick<
    ProtectedMediaGrant,
    "state" | "audience" | "purpose" | "authorizationRevision" | "expiresAt" | "revokedAt"
  >;
  currentAuthorizationRevision: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (
    input.derivative.state !== "READY" ||
    input.derivative.scanState !== "CLEAN" ||
    !!input.derivative.withdrawnAt ||
    input.grant.state !== "ACTIVE" ||
    !!input.grant.revokedAt ||
    (input.grant.expiresAt && input.grant.expiresAt <= now) ||
    input.grant.authorizationRevision !== input.currentAuthorizationRevision
  )
    throw protectedMediaFailure("PROTECTED_MEDIA_DELIVERY_FORBIDDEN");
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Cross-Origin-Resource-Policy": input.grant.audience === "PUBLIC" ? "cross-origin" : "same-site",
  };
  if (input.grant.audience === "PUBLIC") {
    headers["Cache-Control"] = "public, max-age=60, must-revalidate";
    headers.ETag = `\"${input.derivative.outputChecksum}\"`;
  } else headers["Cache-Control"] = "private, no-store";
  return headers;
}

export function matchesProtectedMediaEtag(value: string | undefined, checksum: string): boolean {
  return !!value && value.split(",").some((candidate) => candidate.trim().replace(/^W\//, "") === `\"${checksum}\"`);
}
