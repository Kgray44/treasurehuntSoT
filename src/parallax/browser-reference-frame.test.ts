// @vitest-environment node
import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { createSpatialDraft, previewReferenceFrame } from "./authoring";
import { browserReferenceFrame } from "./browser-reference-frame";

const room = { id: "room-1", width: 4, depth: 5, horizontal: true, vertical: true };

describe("browser consumer reference frames", () => {
  it("keeps the camera-free Lens client browser-bundleable", async () => {
    const result = await build({
      entryPoints: ["src/landfall/device-lab/parallax-native-client.tsx"],
      outfile: "lens-device-lab.js",
      bundle: true,
      write: false,
      jsx: "automatic",
      platform: "browser",
      format: "iife",
      target: "es2020",
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    expect(result.outputFiles[0].contents.length).toBeGreaterThan(0);
  });

  it.each(["Desk Map", "Hidden Wall Message", "Floating Compass"])("preserves the authored %s frame", (preset) => {
    const content = createSpatialDraft(`frame-${preset.replaceAll(" ", "-")}`, preset).content;
    const anchor = content.anchors[0];
    expect(browserReferenceFrame(content, anchor, room.id, room)).toEqual(
      previewReferenceFrame(content, anchor, room.id, room),
    );
  });

  it("preserves a pinned preview frame", () => {
    const content = createSpatialDraft("pinned-frame").content;
    const anchor = content.anchors[0];
    content.studio!.surfacePreviewFrames = [
      {
        anchorId: anchor.id,
        environmentId: room.id,
        surfaceId: "reference-desk",
        position: { x: 0.4, y: 0.8, z: -0.6 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      },
    ];
    expect(browserReferenceFrame(content, anchor, room.id, room)).toEqual(
      previewReferenceFrame(content, anchor, room.id, room),
    );
  });
});
