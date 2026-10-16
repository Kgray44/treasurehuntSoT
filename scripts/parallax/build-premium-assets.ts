import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import * as T from "three";
import { createPremiumModel } from "../../src/parallax/assets/models";
import { physicalAssets, assetPackage } from "../../src/parallax/asset-catalog";
import { createAssetShowcase, insertSpatialElement } from "../../src/parallax/element-authoring";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { embedOriginalSurfaces } from "./embed-surfaces";

// GLTFExporter uses the browser FileReader interface for its binary buffer, but these assets contain no images.
class BinaryReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((data) => {
      this.result = data;
      this.onloadend?.();
    });
  }
}
Object.assign(globalThis, { FileReader: BinaryReader });
async function main() {
  const out = "public/parallax/sc02";
  await mkdir(`${out}/models`, { recursive: true });
  await mkdir(`${out}/scenes`, { recursive: true });
  const manifest = [];
  for (const asset of physicalAssets) {
    const model = createPremiumModel(asset.id, false);
    let triangles = 0,
      drawCalls = 0;
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
        drawCalls++;
      }
    });
    const binary = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: false });
    if (!(binary instanceof ArrayBuffer)) throw new Error("SC02_BINARY_EXPORT_REQUIRED");
    const bytes = embedOriginalSurfaces(binary);
    const path = `models/${asset.id}.glb`;
    await writeFile(`${out}/${path}`, bytes);
    manifest.push({
      ...asset,
      path,
      bytes: bytes.length,
      triangles,
      drawCalls,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      provenance: assetPackage.provenance,
      license: assetPackage.license,
      pivot: "BOTTOM_CENTER",
      normals: "AUTHORED_AND_COMPUTED",
      materials: "GLTF_METALLIC_ROUGHNESS",
    });
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
  }
  await writeFile(`${out}/manifest.json`, JSON.stringify({ ...assetPackage, assets: manifest }, null, 2) + "\n");
  await writeFile(
    `${out}/LICENSE.txt`,
    `${assetPackage.license}\nCopyright 2026 Kato Gray. All rights reserved.\nAI-assisted original mesh recipes. No third-party source models or textures.\nSee repository LICENSE.md for complete terms. Redistribution requires owner authorization.\nThree.js is used as a build/runtime library under its own MIT license; see THIRD_PARTY_NOTICES.md.\n`,
  );
  await writeFile(`${out}/THREE-LICENSE.txt`, await readFile("node_modules/three/LICENSE"));
  for (const family of [...new Set(physicalAssets.map((a) => a.family))])
    await writeFile(
      `${out}/scenes/${family.toLowerCase().replaceAll(" ", "-")}.json`,
      JSON.stringify(createAssetShowcase(`sc02-${family.replaceAll(" ", "-")}`, family), null, 2) + "\n",
    );
  for (const id of ["ghostly-presence", "haunted-treasure", "lantern-embers"]) {
    const draft = insertSpatialElement(createSpatialDraft(`sc02-${id}`), id, `sc02-${id}:composition`);
    await writeFile(`${out}/scenes/${id}.json`, JSON.stringify(draft, null, 2) + "\n");
  }
  console.log(
    JSON.stringify({
      assets: manifest.length,
      bytes: manifest.reduce((n, a) => n + a.bytes, 0),
      maximumTriangles: Math.max(...manifest.map((a) => a.triangles)),
      maximumDrawCalls: Math.max(...manifest.map((a) => a.drawCalls)),
    }),
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
