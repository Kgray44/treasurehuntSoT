import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pilotEnvironmentEnabled, requirePilotOwner } from "@/spatial-pilot/authorization";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { admitZapparAuthorization } from "@/parallax/zappar-authorization";
import { eighthwallAvailability, readEighthwallAsset } from "@/parallax/eighthwall-local-assets";

export const dynamic = "force-dynamic";
const assets = {
  "tinyvio-slam.js": {
    type: "text/javascript",
    sha256: "aede7070219b40ebd13d07be6b79d6be38d57a88b39bc8ac6b919c61cefc2a40",
  },
  "tinyvio-slam.wasm": {
    type: "application/wasm",
    sha256: "78f1942ec1048fc19f93c2b9edd7b1b52d067a9d0a76b7ec1ef34777298729c3",
  },
  "public-source-slam.js": {
    type: "text/javascript",
    sha256: "9f03fea5a837022c851cc3820ee5a4f5fa047979938c516c0f83b37db2216abc",
  },
  "public-source-slam.wasm": {
    type: "application/wasm",
    sha256: "8fdd5d411163ee6bc7065efdf73b5a1ca33096341ecdda8cb1a3ee4b2ef844d1",
  },
  "public-source-slam.NOTICES.txt": {
    type: "text/plain; charset=utf-8",
    sha256: "f483dc357199201394c3101a512a9f2deff5015e7dc1a6c858e3dce9548d3994",
  },
} as const;
/** Owner authorized a local prototype only. Assets are never checked in or served by a normal release. */
export async function GET(request: Request, context: { params: Promise<{ asset: string }> }) {
  if (process.env.PARALLAX_LOCAL_TRACKER_PROTOTYPE !== "1" || !pilotEnvironmentEnabled())
    return new Response(null, { status: 404 });
  if (!(await requireWayfarerAccount())) return new Response(null, { status: 401 });
  if (
    process.env.PARALLAX_LOCAL_TRACKER_ENGINE &&
    !["TINYVIO", "PUBLIC_SOURCE", "ZAPPAR", "EIGHTHWALL"].includes(process.env.PARALLAX_LOCAL_TRACKER_ENGINE)
  )
    return new Response(null, { status: 503 });
  const { asset } = await context.params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const sourceDirty = process.env.SPATIAL_PILOT_SOURCE_DIRTY === "1";
  const sourceCommit =
    process.env.SPATIAL_PILOT_SOURCE_DIRTY === "0" && /^[a-f0-9]{40}$/.test(process.env.SPATIAL_PILOT_SOURCE_SHA ?? "")
      ? process.env.SPATIAL_PILOT_SOURCE_SHA
      : null;
  if (process.env.PARALLAX_LOCAL_TRACKER_ENGINE === "ZAPPAR") {
    // Read-only script requests carry cookies but cannot attach the mutation CSRF header.
    if (!(await requirePilotOwner())) return new Response(null, { status: 404, headers });
    if (asset !== "availability" && asset !== "zappar-4.4.0.js") return new Response(null, { status: 404 });
    const blocked = () =>
      asset === "availability"
        ? Response.json(
            {
              localPrototype: false,
              engine: "ZAPPAR",
              productionCleared: false,
              blockedReason:
                "Zappar is on hold for this test. The owner must activate a licensed account and complete secure test setup before it can start. Guided View remains available.",
            },
            { headers },
          )
        : new Response(null, { status: 503, headers });
    try {
      const authorization = admitZapparAuthorization(
        JSON.parse(
          await readFile(resolve("tmp/browser-ar-local-assets/zappar-4.4.0.authorization.private.json"), "utf8"),
        ),
        new URL(request.url).origin,
      );
      if (!authorization) return blocked();
      const binary = await readFile(resolve("tmp/browser-ar-local-assets/zappar-4.4.0.js"));
      if (
        binary.length > 32 * 1024 * 1024 ||
        createHash("sha256").update(binary).digest("hex") !== authorization.scriptSha256
      )
        return blocked();
      if (asset === "availability")
        return Response.json(
          {
            localPrototype: true,
            engine: "ZAPPAR",
            productionCleared: false,
            sourceCommit,
            sourceDirty,
            method: "VISUAL_SLAM",
            metricScaleVerified: false,
            zappar: {
              version: "4.4.0",
              scriptUrl: "/api/dev/parallax-tracker/zappar-4.4.0.js",
              integrity: `sha256-${Buffer.from(authorization.scriptSha256, "hex").toString("base64")}`,
            },
          },
          { headers },
        );
      return new Response(binary, { headers: { ...headers, "Content-Type": "text/javascript" } });
    } catch {
      return blocked();
    }
  }
  if (process.env.PARALLAX_LOCAL_TRACKER_ENGINE === "EIGHTHWALL") {
    if (!(await requirePilotOwner())) return new Response(null, { status: 404, headers });
    const origin = new URL(request.url).origin;
    if (asset === "availability") {
      const config = await eighthwallAvailability(origin);
      return Response.json(
        {
          engine: "EIGHTHWALL",
          localPrototype: Boolean(config),
          productionCleared: false,
          method: "VISUAL_SLAM",
          metricScaleVerified: false,
          sourceCommit,
          sourceDirty,
          ...(config
            ? { eighthwall: config, noticesHref: "/api/dev/parallax-tracker/LICENSE" }
            : {
                blockedReason:
                  "8th Wall is not ready for this private test. The owner must authorize its license and complete secure test setup. Guided View remains available.",
              }),
        },
        { headers },
      );
    }
    const file = await readEighthwallAsset(asset, origin);
    if (!file) return new Response(null, { status: 404, headers });
    return new Response(file.bytes, { headers: { ...headers, "Content-Type": file.type } });
  }
  const publicSource = process.env.PARALLAX_LOCAL_TRACKER_ENGINE === "PUBLIC_SOURCE";
  if (asset === "availability")
    return Response.json(
      {
        localPrototype: true,
        engine: publicSource ? "PUBLIC_SOURCE" : "TINYVIO",
        sourceCommit,
        sourceDirty,
        productionCleared: false,
        method: publicSource ? "VISUAL_SLAM" : "VISUAL_INERTIAL_SLAM",
        metricScaleVerified: false,
        ...(publicSource
          ? {
              engine: "PUBLIC_SOURCE",
              rebuildableSource: true,
              noticesHref: "/api/dev/parallax-tracker/public-source-slam.NOTICES.txt",
            }
          : {}),
      },
      { headers },
    );
  if (!Object.hasOwn(assets, asset)) return new Response(null, { status: 404 });
  if (asset.startsWith("public-source-") !== publicSource) return new Response(null, { status: 404 });
  const spec = assets[asset as keyof typeof assets];
  try {
    const binary = await readFile(resolve("tmp/browser-ar-local-assets", asset));
    if (createHash("sha256").update(binary).digest("hex") !== spec.sha256) return new Response(null, { status: 503 });
    return new Response(binary, { headers: { ...headers, "Content-Type": spec.type } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
