import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type ManifestAsset = Readonly<{
  id: string;
  type: "rive" | "lottie";
  status: "runtime-ready" | "blocked_external_asset" | "development_only";
  expectedPath: string;
  sha256: string | null;
  fallbackPath: string;
  blockedReason?: string;
}>;

type AnimationManifest = Readonly<{ schemaVersion: number; assets: readonly ManifestAsset[] }>;

const root = process.cwd();
const animationRoot = path.join(root, "public", "animations");
const manifestPath = path.join(animationRoot, "manifest.json");
const errors: string[] = [];
const blockers: string[] = [];

function localPath(publicPath: string) {
  if (!publicPath.startsWith("/animations/")) throw new Error(`asset path must remain local to /animations: ${publicPath}`);
  return path.join(root, "public", publicPath.slice(1));
}

function sha256(file: string) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function loadManifest(): AnimationManifest {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AnimationManifest;
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
      throw new Error("expected schemaVersion 1 with an assets array");
    }
    return manifest;
  } catch (error) {
    errors.push(`manifest.json: ${error instanceof Error ? error.message : "invalid JSON"}`);
    return { schemaVersion: 1, assets: [] };
  }
}

const manifest = loadManifest();
const manifestById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
const requiredProductionRive = ["invitationSeal", "journalClasp", "voyageCompass", "finaleMechanism"];
const requiredLottie = ["moonlitWaves", "rollingFog", "inkBloom"];

for (const id of [...requiredProductionRive, ...requiredLottie, "developmentRating"]) {
  if (!manifestById.has(id)) errors.push(`manifest.json: missing required asset ${id}`);
}

for (const asset of manifest.assets) {
  let sourcePath: string;
  let fallbackPath: string;
  try {
    sourcePath = localPath(asset.expectedPath);
    fallbackPath = localPath(asset.fallbackPath);
  } catch (error) {
    errors.push(`manifest ${asset.id}: ${error instanceof Error ? error.message : "invalid local path"}`);
    continue;
  }
  if (!fs.existsSync(fallbackPath)) errors.push(`manifest ${asset.id}: missing fallback ${asset.fallbackPath}`);

  if (asset.status === "blocked_external_asset") {
    if (fs.existsSync(sourcePath)) {
      errors.push(`manifest ${asset.id}: blocked asset unexpectedly exists; register and validate it atomically`);
    }
    if (asset.sha256 !== null) errors.push(`manifest ${asset.id}: blocked asset must not claim a SHA-256`);
    if (!asset.blockedReason?.trim()) errors.push(`manifest ${asset.id}: blocked asset needs a specific blocked reason`);
    blockers.push(`${asset.id}: ${asset.blockedReason ?? "missing blocked reason"}`);
    continue;
  }

  if (!fs.existsSync(sourcePath)) {
    errors.push(`manifest ${asset.id}: missing local asset ${asset.expectedPath}`);
    continue;
  }
  const actualHash = sha256(sourcePath);
  if (!asset.sha256 || actualHash !== asset.sha256.toLowerCase()) {
    errors.push(`manifest ${asset.id}: SHA-256 mismatch`);
  }
  const bytes = fs.readFileSync(sourcePath);
  if (asset.type === "rive") {
    if (bytes.length < 1_000) errors.push(`${asset.id}: unexpectedly small Rive binary`);
    if (bytes.subarray(0, 1).toString() === "{") errors.push(`${asset.id}: JSON is not a Rive binary`);
  } else {
    try {
      const data = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
      for (const key of ["v", "fr", "ip", "op", "w", "h", "layers"]) {
        if (!(key in data)) errors.push(`${asset.id}: missing ${key}`);
      }
      if (!Array.isArray(data.layers) || data.layers.length === 0) errors.push(`${asset.id}: layers must be non-empty`);
      if (typeof data.op !== "number" || typeof data.ip !== "number" || data.op <= data.ip) {
        errors.push(`${asset.id}: invalid frame range`);
      }
      if (/https?:\/\//i.test(JSON.stringify(data))) errors.push(`${asset.id}: remote runtime assets are forbidden`);
    } catch (error) {
      errors.push(`${asset.id}: ${error instanceof Error ? error.message : "invalid Lottie JSON"}`);
    }
  }
}

for (const directory of ["svg", "stills"]) {
  const location = path.join(animationRoot, directory);
  if (!fs.existsSync(location)) continue;
  for (const file of fs.readdirSync(location).filter((name) => name.endsWith(".svg"))) {
    const source = fs.readFileSync(path.join(location, file), "utf8");
    if (!source.includes("<svg") || !source.includes("</svg>")) errors.push(`${directory}/${file}: malformed SVG wrapper`);
    if (/https?:\/\//i.test(source.replace("http://www.w3.org/2000/svg", ""))) {
      errors.push(`${directory}/${file}: remote dependency found`);
    }
  }
}

if (errors.length) {
  console.error(`Animation asset validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

if (blockers.length) {
  console.error(
    `Animation asset validation NO-GO: ${blockers.length} production Rive asset-authoring blocker(s) remain.\n${blockers
      .map((blocker) => `- ${blocker}`)
      .join("\n")}`,
  );
  process.exit(2);
}

console.log("Animation assets validated: 4 production Rive binaries, 3 Lottie JSON assets, and local SVG fallbacks.");
