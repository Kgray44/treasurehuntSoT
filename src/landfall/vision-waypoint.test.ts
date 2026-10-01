import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { compareVisionWaypoint } from "@/landfall/vision-waypoint";
import { landmarkComparisonSchema } from "@/landfall/landmark-contract";
import { signLandmarkReceipt, verifyLandmarkReceipt } from "@/landfall/landmark-receipt";

async function image(invert = false, brightness = 0) {
  const pixels = Buffer.alloc(96 * 96 * 3);
  for (let y = 0; y < 96; y++)
    for (let x = 0; x < 96; x++) {
      const foreground = x > y && x > 20 && y < 80;
      const value = (foreground !== invert ? 210 : 35) + brightness;
      pixels.fill(value, (y * 96 + x) * 3, (y * 96 + x) * 3 + 3);
    }
  return sharp(pixels, { raw: { width: 96, height: 96, channels: 3 } })
    .png()
    .toBuffer();
}
describe("bounded natural landmark reference comparison", () => {
  it("requires several clear frames and supports several authored positive views", async () => {
    const positive = await image(),
      dim = await image(false, -4),
      negative = await image(true);
    expect(
      await compareVisionWaypoint({
        frames: [positive, dim],
        references: [negative, positive],
        negatives: [],
        minimumFrames: 2,
      }),
    ).toEqual({ result: "confirmed", frameCount: 2 });
    expect(
      (await compareVisionWaypoint({ frames: [positive], references: [positive], negatives: [], minimumFrames: 2 }))
        .result,
    ).toBe("insufficient");
  });
  it("rejects negative and ambiguous examples even when a positive image matches", async () => {
    const positive = await image();
    expect(
      (
        await compareVisionWaypoint({
          frames: [positive, positive],
          references: [positive],
          negatives: [positive],
          minimumFrames: 2,
        })
      ).result,
    ).toBe("insufficient");
    const negative = await image(true);
    expect(
      (
        await compareVisionWaypoint({
          frames: [negative, negative],
          references: [positive],
          negatives: [negative],
          minimumFrames: 2,
        })
      ).result,
    ).toBe("insufficient");
  });
  it("does not identify blank views or claim an unavailable provider is configured", async () => {
    const blank = await sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } })
      .png()
      .toBuffer();
    expect(
      (await compareVisionWaypoint({ frames: [blank, blank], references: [blank], negatives: [], minimumFrames: 2 }))
        .result,
    ).toBe("insufficient");
    expect((await compareVisionWaypoint({ frames: [], references: [], negatives: [], minimumFrames: 2 })).result).toBe(
      "unavailable",
    );
    await expect(
      compareVisionWaypoint({
        frames: [Buffer.from("invalid"), Buffer.from("invalid")],
        references: [await image()],
        negatives: [],
        minimumFrames: 2,
      }),
    ).rejects.toThrow();
  });
  it("accepts only small image data and never a URL or video", () => {
    expect(landmarkComparisonSchema.safeParse({ frames: ["https://untrusted.example/frame.png"] }).success).toBe(false);
  });
});

describe("short-lived server landmark trust", () => {
  const payload = {
    id: "receipt-1",
    sessionId: "voyage-1",
    playerProfileId: "player-1",
    publishedVersionId: "edition-1",
    expectedSequence: 4,
    worldspaceId: "museum",
    waypointId: "mural",
    landmarkId: "north-mural",
    regionId: "gallery",
    definitionHash: "a".repeat(64),
    frameCount: 2,
    result: "confirmed" as const,
    issuedAt: 100_000,
    expiresAt: 130_000,
  };
  it("preserves exact Player/session/edition/sequence identity without frames", () => {
    const token = signLandmarkReceipt(payload);
    expect(verifyLandmarkReceipt(token, 101_000)).toEqual(payload);
    expect(token).not.toContain("data:image");
  });
  it("rejects tampering, stale evidence and unbounded lifetime", () => {
    const token = signLandmarkReceipt(payload);
    expect(() => verifyLandmarkReceipt(`${token.slice(0, -3)}AAA`, 101_000)).toThrow();
    expect(() => verifyLandmarkReceipt(token, 130_000)).toThrow(/EXPIRED/);
    expect(() => verifyLandmarkReceipt(token, 99_999)).toThrow(/EXPIRED/);
    expect(() => signLandmarkReceipt({ ...payload, expiresAt: 140_000 })).toThrow(/POLICY/);
  });
});
