// @vitest-environment node
import { createHash } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { parseFilamentSceneProof, validateFilamentFramePng } from "./android-scene-rendering";

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
let source: ReturnType<typeof parseFilamentSceneProof>;
let populatedPng: Buffer;
let clearedPng: Buffer;
beforeAll(async () => {
  const populated = Buffer.alloc(256 * 256 * 4),
    cleared = Buffer.alloc(256 * 256 * 4);
  for (let y = 40; y <= 120; y++)
    for (let x = 80; x <= 150; x++) {
      populated.set([231, 102, 11, 255], (y * 256 + x) * 4);
    }
  populatedPng = await sharp(populated, { raw: { width: 256, height: 256, channels: 4 } })
    .png()
    .toBuffer();
  clearedPng = await sharp(cleared, { raw: { width: 256, height: 256, channels: 4 } })
    .png()
    .toBuffer();
  const assets = (["brass-compass", "treasure-chest"] as const).map((assetId) => {
    const entityId = `fixture-model-${assetId}` as const;
    const pick = (kind: "MODEL_HIT" | "BACKGROUND_MISS" | "CLEARED_MISS", x: number, y: number) => ({
      kind,
      x,
      y,
      viewPickX: x,
      viewPickY: 255 - y,
      neighborhoodRadius: 3,
      expectedEntityId: kind === "MODEL_HIT" ? entityId : null,
      observedEntityId: kind === "MODEL_HIT" ? entityId : null,
      callbackElapsedMs: 240,
      callbackCount: 1,
    });
    const frame = (empty: boolean) => ({
      fileName: `ncl01-filament-${assetId}-${empty ? "cleared" : "populated"}.png`,
      width: 256,
      height: 256,
      bytes: (empty ? clearedPng : populatedPng).length,
      sha256: sha256(empty ? clearedPng : populatedPng),
      rgbaSha256: sha256(empty ? cleared : populated),
      nontransparentPixels: empty ? 0 : 71 * 81,
      rgbaOrigin: "TOP_LEFT",
      pngRowTransform: "NONE_FILAMENT_ALREADY_TOP_LEFT",
      pickCoordinateSpace: "ANDROID_VIEW_TOP_LEFT",
      sharedBudgetMs: 10000,
      readbackElapsedMs: 200,
      artifactPublishedElapsedMs: 260,
      picks: empty ? [pick("CLEARED_MISS", 128, 128)] : [pick("MODEL_HIT", 100, 60), pick("BACKGROUND_MISS", 20, 20)],
    });
    return {
      assetId,
      entityId,
      sha256:
        assetId === "brass-compass"
          ? "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb"
          : "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f",
      renderables: 4,
      materialInstances: 4,
      originalWorldBoundsMeters: [-0.08, 0, -0.095, 0.08, 0.045, 0.095],
      rootTransformAndBottomPivotVerified: true,
      renderedNontransparentPixels: 71 * 81,
      clearedNontransparentPixels: 0,
      renderedFrame: frame(false),
      clearedFrame: frame(true),
      assetDisposed: true,
    };
  });
  source = parseFilamentSceneProof(
    JSON.stringify({
      schemaVersion: 1,
      evidenceClass: "INSTRUMENTED_FILAMENT_GLTF_RENDERING_ONLY",
      renderer: "FILAMENT_1_75_1_OPENGL",
      fixtureUsesCamera: false,
      fixtureCreatesARCoreSession: false,
      physicalTrackingProven: false,
      engineDisposed: true,
      assets,
    }),
  );
});

describe("bounded Android original-frame and production-pick evidence", () => {
  it("accepts both distinct model entities and all four original upright frames", async () => {
    for (const asset of source.assets) {
      await validateFilamentFramePng(asset.renderedFrame, populatedPng);
      await validateFilamentFramePng(asset.clearedFrame, clearedPng);
    }
  });
  it("rejects duplicate/missing catalog identities and arbitrary file paths", () => {
    const duplicate = structuredClone(source);
    duplicate.assets[1] = duplicate.assets[0];
    expect(() => parseFilamentSceneProof(JSON.stringify(duplicate))).toThrow();
    const path = structuredClone(source);
    path.assets[0].renderedFrame.fileName = "../../private.png" as never;
    expect(() => parseFilamentSceneProof(JSON.stringify(path))).toThrow();
  });
  it("requires the transformed model entity rather than another model or a catalog label", () => {
    const wrong = structuredClone(source);
    wrong.assets[0].renderedFrame.picks[0].observedEntityId = "fixture-model-treasure-chest";
    expect(() => parseFilamentSceneProof(JSON.stringify(wrong))).toThrow();
    wrong.assets[0].renderedFrame.picks[0].observedEntityId = "brass-compass" as never;
    expect(() => parseFilamentSceneProof(JSON.stringify(wrong))).toThrow();
  });
  it("rejects double-flipped View.pick coordinates and hit points off the actual opaque pixels", async () => {
    const wrong = structuredClone(source);
    wrong.assets[0].renderedFrame.picks[0].viewPickY = wrong.assets[0].renderedFrame.picks[0].y;
    expect(() => parseFilamentSceneProof(JSON.stringify(wrong))).toThrow();
    const frame = structuredClone(source.assets[0].renderedFrame);
    frame.picks[0].y = 195;
    frame.picks[0].viewPickY = 60;
    await expect(validateFilamentFramePng(frame, populatedPng)).rejects.toThrow();
  });
  it("requires an all-zero-alpha background neighborhood", async () => {
    const frame = structuredClone(source.assets[0].renderedFrame);
    frame.picks[1].x = 100;
    frame.picks[1].y = 60;
    frame.picks[1].viewPickX = 100;
    frame.picks[1].viewPickY = 195;
    await expect(validateFilamentFramePng(frame, populatedPng)).rejects.toThrow();
  });
  it("accepts real transparent background within a full-extent alpha AABB while rejecting opaque or faint-alpha samples", async () => {
    const rgba = await sharp(populatedPng).raw().toBuffer();
    // Opposite opaque corners span the viewport; the actual 7x7 background remains transparent.
    rgba.set([231, 102, 11, 255], 0);
    rgba.set([231, 102, 11, 255], rgba.length - 4);
    const png = await sharp(rgba, { raw: { width: 256, height: 256, channels: 4 } })
      .png()
      .toBuffer();
    const frame = {
      ...source.assets[0].renderedFrame,
      bytes: png.length,
      sha256: sha256(png),
      rgbaSha256: sha256(rgba),
      nontransparentPixels: source.assets[0].renderedFrame.nontransparentPixels + 2,
    };
    await validateFilamentFramePng(frame, png);
    const opaquePick = structuredClone(frame);
    opaquePick.picks[1].x = 100;
    opaquePick.picks[1].y = 60;
    opaquePick.picks[1].viewPickX = 100;
    opaquePick.picks[1].viewPickY = 195;
    await expect(validateFilamentFramePng(opaquePick, png)).rejects.toThrow();
    // Alpha1 is below the raster-count threshold but still invalid for the strict background proof.
    rgba[(20 * 256 + 20) * 4 + 3] = 1;
    const faint = await sharp(rgba, { raw: { width: 256, height: 256, channels: 4 } })
      .png()
      .toBuffer();
    await expect(
      validateFilamentFramePng(
        { ...frame, bytes: faint.length, sha256: sha256(faint), rgbaSha256: sha256(rgba) },
        faint,
      ),
    ).rejects.toThrow();
  });
  it("rejects changed PNG bytes, raw RGBA digest, dimensions and false alpha counts", async () => {
    const frame = source.assets[0].renderedFrame;
    const corrupted = Buffer.from(populatedPng);
    corrupted[corrupted.length - 1] ^= 1;
    await expect(validateFilamentFramePng(frame, corrupted)).rejects.toThrow();
    await expect(validateFilamentFramePng({ ...frame, rgbaSha256: "0".repeat(64) }, populatedPng)).rejects.toThrow();
    await expect(
      validateFilamentFramePng({ ...frame, nontransparentPixels: frame.nontransparentPixels + 1 }, populatedPng),
    ).rejects.toThrow();
    const smaller = await sharp(populatedPng).resize(128, 128).png().toBuffer();
    await expect(
      validateFilamentFramePng({ ...frame, bytes: smaller.length, sha256: sha256(smaller) }, smaller),
    ).rejects.toThrow();
  });
  it("rejects retained model pixels in the cleared frame and missing clear picks", async () => {
    const frame = { ...source.assets[0].clearedFrame, bytes: populatedPng.length, sha256: sha256(populatedPng) };
    await expect(validateFilamentFramePng(frame, populatedPng)).rejects.toThrow();
    const noPick = structuredClone(source);
    noPick.assets[0].clearedFrame.picks = [];
    expect(() => parseFilamentSceneProof(JSON.stringify(noPick))).toThrow();
  });
  it("rejects missing/duplicate callbacks, fresh picker windows and publication after the original deadline", () => {
    for (const mutate of [
      (frame: (typeof source.assets)[0]["renderedFrame"]) => {
        frame.picks[0].callbackElapsedMs = 10001;
      },
      (frame: (typeof source.assets)[0]["renderedFrame"]) => {
        frame.picks[0].callbackElapsedMs = 199;
      },
      (frame: (typeof source.assets)[0]["renderedFrame"]) => {
        frame.picks[0].callbackElapsedMs = 261;
      },
      (frame: (typeof source.assets)[0]["renderedFrame"]) => {
        frame.picks[0].callbackCount = 2 as never;
      },
      (frame: (typeof source.assets)[0]["renderedFrame"]) => {
        frame.artifactPublishedElapsedMs = 10001;
      },
    ]) {
      const wrong = structuredClone(source);
      mutate(wrong.assets[0].renderedFrame);
      expect(() => parseFilamentSceneProof(JSON.stringify(wrong))).toThrow();
    }
  });
});
