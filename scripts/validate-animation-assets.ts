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
  artboard?: string | null;
  stateMachine?: string | null;
  runtimeInterface?: Readonly<{ kind: "state-machine-inputs" }> | Readonly<{ kind: "view-model"; viewModel: string }>;
  inputContract?: readonly Readonly<{ name: string; type: "boolean" | "number" | "trigger" }>[];
  stateContract?: readonly string[];
  sourceBackupPath?: string | null;
  sourceSha256?: string | null;
  blockedReason?: string;
}>;

type AnimationManifest = Readonly<{ schemaVersion: number; assets: readonly ManifestAsset[] }>;

const root = process.cwd();
const animationRoot = path.join(root, "public", "animations");
const manifestPath = path.join(animationRoot, "manifest.json");
const errors: string[] = [];
const blockers: string[] = [];
const riveValidation: Promise<void>[] = [];

function localPath(publicPath: string) {
  if (!publicPath.startsWith("/animations/"))
    throw new Error(`asset path must remain local to /animations: ${publicPath}`);
  return path.join(root, "public", publicPath.slice(1));
}

function sha256(file: string) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const riveInputMarkers: Readonly<Record<"boolean" | "number" | "trigger", readonly number[][]>> = {
  // Rive has used both of these serializations in project-owned editor exports. The final byte is the UTF-8 name
  // length, so a matching name alone is not accepted as proof of the frozen input type.
  boolean: [
    [0x3b, 0x8a, 0x01],
    [0x81, 0x01, 0x04],
  ],
  number: [
    [0x38, 0x8a, 0x01],
    [0x7f, 0x04],
  ],
  trigger: [
    [0x3a, 0x8a, 0x01],
    [0xe5, 0x04, 0x04],
  ],
};

function hasSerializedRiveInput(
  bytes: Buffer,
  input: Readonly<{ name: string; type: "boolean" | "number" | "trigger" }>,
) {
  const name = Buffer.from(input.name, "utf8");
  const markers = riveInputMarkers[input.type];
  for (let offset = bytes.indexOf(name); offset !== -1; offset = bytes.indexOf(name, offset + 1)) {
    if (bytes[offset - 1] !== name.length) continue;
    if (markers.some((marker) => marker.every((value, index) => bytes[offset - marker.length - 1 + index] === value))) {
      return true;
    }
  }
  return false;
}

async function validateProductionRiveRuntime(asset: ManifestAsset, bytes: Buffer) {
  if (!asset.artboard?.trim() || !asset.stateMachine?.trim()) return;
  if (!asset.runtimeInterface) {
    errors.push(`manifest ${asset.id}: runtime-ready Rive asset needs a runtime interface declaration`);
    return;
  }
  try {
    // `require` keeps the validator runnable from a local Windows dependency mirror as
    // well as a normal repository install; the Rive package itself remains a declared app dependency.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RiveFile } = require("@rive-app/webgl2") as typeof import("@rive-app/webgl2");
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const file = new RiveFile({ buffer });
    await file.init();
    const artboard = file.getArtboard(asset.artboard);
    if (!artboard) {
      errors.push(`${asset.id}: canonical artboard ${asset.artboard} is not loadable by the Rive runtime`);
      return;
    }
    if (!artboard.nativeArtboard.stateMachineByName(asset.stateMachine)) {
      errors.push(`${asset.id}: canonical state machine ${asset.stateMachine} is not loadable by the Rive runtime`);
      return;
    }

    if (asset.runtimeInterface.kind === "view-model") {
      const viewModel = file.viewModelByName(asset.runtimeInterface.viewModel);
      const runtimeFile = file.getInstance() as unknown as {
        defaultArtboardViewModel: (artboard: unknown) => { name: string } | null;
      };
      const boundViewModel = runtimeFile.defaultArtboardViewModel(artboard.nativeArtboard);
      if (!viewModel) {
        errors.push(`${asset.id}: view model ${asset.runtimeInterface.viewModel} is not present in the runtime binary`);
      } else if (boundViewModel?.name !== asset.runtimeInterface.viewModel) {
        errors.push(
          `${asset.id}: artboard ${asset.artboard} is not bound to view model ${asset.runtimeInterface.viewModel}`,
        );
      } else {
        const properties = new Map(viewModel.properties.map((property) => [property.name, property.type]));
        for (const input of asset.inputContract ?? []) {
          if (properties.get(input.name) !== input.type) {
            errors.push(`${asset.id}: view model is missing frozen ${input.type} property ${input.name}`);
          }
        }
      }
    } else {
      for (const input of asset.inputContract ?? []) {
        if (!hasSerializedRiveInput(bytes, input)) {
          errors.push(`${asset.id}: runtime binary is missing frozen ${input.type} input ${input.name}`);
        }
      }
    }
    file.cleanup();
  } catch (error) {
    errors.push(
      `${asset.id}: Rive runtime inspection failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

function sourceBackupLocalPath(sourceBackupPath: string) {
  const normalized = sourceBackupPath.replace(/\\/g, "/");
  if (!normalized.startsWith("Development_Docs/Animation_Assets/Rive_Sources/")) {
    throw new Error(`Rive source must remain in the governed Rive_Sources directory: ${sourceBackupPath}`);
  }
  return path.join(root, ...normalized.split("/"));
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
    if (!asset.blockedReason?.trim())
      errors.push(`manifest ${asset.id}: blocked asset needs a specific blocked reason`);
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
    if (requiredProductionRive.includes(asset.id)) {
      if (bytes.subarray(0, 4).toString("utf8") !== "RIVE") {
        errors.push(`${asset.id}: runtime file does not have a RIVE binary header`);
      }
      if (!asset.inputContract?.length) {
        errors.push(`manifest ${asset.id}: runtime-ready Rive asset needs a frozen input contract`);
      }
      for (const input of asset.inputContract ?? []) {
        if (!input.name?.trim() || !["boolean", "number", "trigger"].includes(input.type)) {
          errors.push(`manifest ${asset.id}: invalid frozen Rive input contract entry`);
        }
      }
      riveValidation.push(validateProductionRiveRuntime(asset, bytes));
      if (!asset.sourceBackupPath) {
        errors.push(`manifest ${asset.id}: runtime-ready Rive asset needs a governed .rev source backup path`);
      } else {
        try {
          const sourceBackup = sourceBackupLocalPath(asset.sourceBackupPath);
          if (!fs.existsSync(sourceBackup)) {
            errors.push(`manifest ${asset.id}: missing governed Rive source backup ${asset.sourceBackupPath}`);
          } else if (!asset.sourceSha256 || sha256(sourceBackup) !== asset.sourceSha256.toLowerCase()) {
            errors.push(`manifest ${asset.id}: Rive source-backup SHA-256 mismatch`);
          } else {
            const sourceText = fs.readFileSync(sourceBackup).toString("latin1");
            if (!sourceText.includes(asset.artboard ?? ""))
              errors.push(`${asset.id}: source backup is missing the artboard`);
            if (!sourceText.includes(asset.stateMachine ?? ""))
              errors.push(`${asset.id}: source backup is missing the state machine`);
            for (const input of asset.inputContract ?? []) {
              if (!sourceText.includes(input.name))
                errors.push(`${asset.id}: source backup is missing frozen input ${input.name}`);
            }
          }
        } catch (error) {
          errors.push(
            `manifest ${asset.id}: ${error instanceof Error ? error.message : "invalid Rive source backup path"}`,
          );
        }
      }
    }
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
    if (!source.includes("<svg") || !source.includes("</svg>"))
      errors.push(`${directory}/${file}: malformed SVG wrapper`);
    if (/https?:\/\//i.test(source.replace("http://www.w3.org/2000/svg", ""))) {
      errors.push(`${directory}/${file}: remote dependency found`);
    }
  }
}

function finishValidation() {
  if (errors.length) {
    console.error(`Animation asset validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }

  if (blockers.length) {
    console.error(
      `Animation asset validation NO-GO: ${blockers.length} production Rive asset-authoring blocker(s) remain.\n${blockers
        .map((blocker) => `- ${blocker}`)
        .join("\n")}`,
    );
    process.exitCode = 2;
    return;
  }

  console.log(
    "Animation assets validated: 4 production Rive binaries, 4 governed Rive sources, 3 Lottie JSON assets, and local SVG fallbacks.",
  );
}

void Promise.all(riveValidation)
  .then(finishValidation)
  .catch((error: unknown) => {
    console.error(`Animation asset validation failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
