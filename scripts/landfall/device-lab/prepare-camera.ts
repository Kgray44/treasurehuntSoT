import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { installationSigningPayload } from "../../../src/landfall/installation-token";
import { deviceLabSourceIdentity } from "./source";

/** Public synthetic installation only; the signing key exists solely in this process. */
async function main() {
  const root = path.join(process.cwd(), "artifacts", "landfall-device-lab");
  await mkdir(root, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const scope = {
    taleId: "fixture-tale",
    publishedVersionId: "version-1",
    worldspaceId: "town",
    waypointId: "town-arrival",
    id: "lab-installation",
    medium: "QR" as const,
  };
  const now = Date.now();
  const payload = installationSigningPayload({
    version: 1,
    purpose: "LANDFALL_INSTALLATION",
    keyId: "synthetic-camera-key",
    ...scope,
    issuedAt: now - 1000,
    expiresAt: now + 3_600_000,
  });
  const token = `${payload}.${sign(null, Buffer.from(payload), privateKey).toString("base64url")}`;
  const png = await QRCode.toBuffer(token, { type: "png", width: 1024, margin: 4, errorCorrectionLevel: "M" });
  await writeFile(path.join(root, "camera-qr.png"), png);
  await writeFile(
    path.join(root, "camera-fixture.json"),
    JSON.stringify(
      {
        version: 1,
        synthetic: true,
        source: await deviceLabSourceIdentity(),
        scope,
        keyId: "synthetic-camera-key",
        publicKey: publicKey.export({ format: "jwk" }),
        imageSha256: createHash("sha256").update(png).digest("hex"),
        tokenSha256: createHash("sha256").update(token).digest("hex"),
        acquisition: "EMULATOR_IMAGE_FILE_CAMERA",
        physicalPresence: "NOT_PROVEN",
        canComplete: false,
      },
      null,
      2,
    ),
  );
  process.stdout.write("LANDFALL_SYNTHETIC_CAMERA_FIXTURE_PREPARED\n");
}
void main().catch(() => {
  process.stderr.write("LANDFALL_CAMERA_FIXTURE_FAILED\n");
  process.exitCode = 1;
});
