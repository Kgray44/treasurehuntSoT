import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { db } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLandfallBoundedJson } from "@/landfall/bounded-request-body";
import { deployedLandfallInstallationSigner as signer } from "@/landfall/installation-token-server";
import { landfallId } from "@/landfall/schema";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const command = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("STATUS"), waypointId: landfallId }),
  z.strictObject({
    operation: z.literal("ISSUE"),
    waypointId: landfallId,
    publishedVersionId: landfallId,
    installationId: landfallId,
  }),
]);
/** Creator explicitly issues a public, expiring identity for an already published installation. No draft or bearer grants. */
export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  try {
    const { taleId } = await context.params;
    const owner = await requireOwnedStudioTale(taleId, request);
    if (!owner) return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 404, headers });
    if (
      !consumeRateLimit(`landfall-installation-creator:${owner.session.accountId}`, { limit: 12, windowMs: 60000 })
        .allowed
    )
      return NextResponse.json({ state: "RATE_LIMITED", canComplete: false }, { status: 429, headers });
    let input;
    try {
      input = command.parse(await readLandfallBoundedJson(request));
    } catch {
      return NextResponse.json({ state: "INVALID", canComplete: false }, { status: 400, headers });
    }
    const trust = signer.status();
    if (trust.state === "NOT_CONFIGURED") return NextResponse.json(trust, { headers });
    const version = await db.publishedTaleVersion.findFirst({
      where: { taleId, ...(input.operation === "ISSUE" ? { id: input.publishedVersionId } : { isCurrent: true }) },
      orderBy: { versionNumber: "desc" },
      select: { id: true, taleId: true, versionLabel: true, contentSnapshot: true },
    });
    if (!version) return NextResponse.json({ state: "NOT_PUBLISHED", canComplete: false }, { status: 409, headers });
    const snapshot = parsePublishedSnapshot(version.contentSnapshot);
    const definition = snapshot.landfall;
    const waypoint = definition?.waypoints.find((item) => item.id === input.waypointId);
    const world = definition?.worldspaces.find((item) => item.id === waypoint?.worldspaceId);
    if (snapshot.tale.id !== taleId || definition?.taleId !== taleId || !waypoint || world?.kind !== "PHYSICAL")
      return NextResponse.json({ state: "NOT_PUBLISHED", canComplete: false }, { status: 409, headers });
    if (input.operation === "STATUS")
      return NextResponse.json(
        {
          state: "CONFIGURED",
          publishedVersionId: version.id,
          versionLabel: version.versionLabel,
          installations: waypoint.installations ?? [],
          canComplete: false,
        },
        { headers },
      );
    const installation = waypoint.installations?.find((item) => item.id === input.installationId);
    if (!installation || !(await requireOwnedStudioTale(taleId, request)))
      return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    const issued = signer.issue({
      taleId,
      publishedVersionId: version.id,
      worldspaceId: world.id,
      waypointId: waypoint.id,
      id: installation.id,
      medium: installation.medium,
    });
    return NextResponse.json(
      {
        state: "ISSUED",
        medium: installation.medium,
        installationId: installation.id,
        ...issued,
        ...(installation.medium === "QR"
          ? {
              qrCodeDataUrl: await QRCode.toDataURL(issued.token, { errorCorrectionLevel: "M", margin: 4, width: 720 }),
            }
          : {}),
      },
      { headers },
    );
  } catch {
    return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 503, headers });
  }
}
