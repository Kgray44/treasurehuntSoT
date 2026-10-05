import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { landfallId } from "@/landfall/schema";
import {
  installationClaimSchema,
  installationScopeSchema,
  installationSigningPayload,
  readInstallationEnvelope,
  validateInstallationScope,
  type LandfallInstallationScope,
} from "@/landfall/installation-token";

type SigningConfiguration = { keyId: string; privateKey: KeyObject; publicKey: KeyObject };
/** Operator-owned key; no ephemeral signing fallback or payload-provided trust. Rotation invalidates old installations. */
export function configuredInstallationSigning(
  env: Record<string, string | undefined> = process.env,
): SigningConfiguration | null {
  try {
    const keyId = landfallId.parse(env.LANDFALL_INSTALLATION_KEY_ID);
    const pem = env.LANDFALL_INSTALLATION_SIGNING_KEY_PEM;
    if (!pem || pem.length > 8192) return null;
    const privateKey = createPrivateKey(pem);
    if (privateKey.asymmetricKeyType !== "ed25519") return null;
    return { keyId, privateKey, publicKey: createPublicKey(privateKey) };
  } catch {
    return null;
  }
}
export class LandfallInstallationSigner {
  constructor(
    private readonly configuration: SigningConfiguration | null,
    private readonly now = Date.now,
  ) {}
  status() {
    return this.configuration
      ? {
          state: "CONFIGURED" as const,
          keyId: this.configuration.keyId,
          publicKey: this.configuration.publicKey.export({ format: "jwk" }) as JsonWebKey,
          canComplete: false as const,
        }
      : { state: "NOT_CONFIGURED" as const, canComplete: false as const };
  }
  issue(scope: LandfallInstallationScope) {
    if (!this.configuration) throw new Error("LANDFALL_INSTALLATION_NOT_CONFIGURED");
    const now = this.now();
    scope = installationScopeSchema.parse(scope);
    const claim = installationClaimSchema.parse({
      version: 1,
      purpose: "LANDFALL_INSTALLATION",
      keyId: this.configuration.keyId,
      ...scope,
      issuedAt: now,
      expiresAt: now + 7 * 86400000,
    });
    validateInstallationScope(claim, scope, now);
    const payload = installationSigningPayload(claim);
    const signature = sign(null, Buffer.from(payload), this.configuration.privateKey).toString("base64url");
    const token = `${payload}.${signature}`;
    if (token.length > 2048) throw new Error("LANDFALL_INSTALLATION_TOO_LARGE");
    return { token, expiresAt: claim.expiresAt, canComplete: false as const };
  }
  verify(token: string, scope: LandfallInstallationScope) {
    if (!this.configuration) throw new Error("LANDFALL_INSTALLATION_NOT_CONFIGURED");
    const envelope = readInstallationEnvelope(token);
    if (
      envelope.claim.keyId !== this.configuration.keyId ||
      !verify(null, Buffer.from(envelope.payload), this.configuration.publicKey, envelope.signature)
    )
      throw new Error("LANDFALL_INSTALLATION_SIGNATURE_INVALID");
    validateInstallationScope(envelope.claim, scope, this.now());
    return envelope.claim;
  }
}
export const deployedLandfallInstallationSigner = new LandfallInstallationSigner(configuredInstallationSigning());
