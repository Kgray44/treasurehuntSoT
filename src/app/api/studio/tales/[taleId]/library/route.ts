import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/chronicle/api";
import { slugify } from "@/chronicle/studio-service";

const schema = z.object({
  entity: z.enum(["collection", "location", "artifact"]),
  action: z.enum(["create", "update", "archive"]),
  id: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Sign in with a creator account to continue." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json(
      { error: "Your creator session has expired. Reload the page and try again." },
      { status: 403 },
    );
  try {
    const { taleId } = await context.params;
    const input = schema.parse(await request.json());
    if (input.entity === "collection") {
      if (input.action === "create")
        return NextResponse.json(
          await db.taleAssetCollection.create({
            data: {
              taleId,
              name: String(input.data.name ?? "New collection").trim(),
              description: String(input.data.description ?? "").trim() || null,
              collectionType: String(input.data.collectionType ?? "GENERAL"),
            },
          }),
        );
      if (!input.id) throw new Error("Choose a collection to update.");
      if (input.action === "archive")
        return NextResponse.json(await db.taleAssetCollection.delete({ where: { id: input.id } }));
      return NextResponse.json(
        await db.taleAssetCollection.update({
          where: { id: input.id },
          data: {
            name: input.data.name ? String(input.data.name).trim() : undefined,
            description:
              input.data.description === undefined ? undefined : String(input.data.description).trim() || null,
            collectionType: input.data.collectionType ? String(input.data.collectionType) : undefined,
          },
        }),
      );
    }
    if (input.entity === "location") {
      if (input.action === "create") {
        const name = String(input.data.name ?? "New Waypoint").trim();
        return NextResponse.json(
          await db.taleLocation.create({
            data: {
              taleId,
              name,
              slug: slugify(String(input.data.slug ?? name)),
              region: String(input.data.region ?? "").trim() || null,
              playerFacingDescription: String(input.data.playerFacingDescription ?? "").trim() || null,
              captainNotes: String(input.data.captainNotes ?? "").trim() || null,
              referenceCollectionId: String(input.data.referenceCollectionId ?? "").trim() || null,
            },
          }),
        );
      }
      if (!input.id) throw new Error("Choose a Waypoint to update.");
      if (input.action === "archive")
        return NextResponse.json(
          await db.taleLocation.update({ where: { id: input.id }, data: { archivedAt: new Date() } }),
        );
      return NextResponse.json(
        await db.taleLocation.update({
          where: { id: input.id },
          data: {
            name: input.data.name ? String(input.data.name).trim() : undefined,
            region: input.data.region === undefined ? undefined : String(input.data.region).trim() || null,
            playerFacingDescription:
              input.data.playerFacingDescription === undefined
                ? undefined
                : String(input.data.playerFacingDescription).trim() || null,
            captainNotes:
              input.data.captainNotes === undefined ? undefined : String(input.data.captainNotes).trim() || null,
            mapAssetId: input.data.mapAssetId === undefined ? undefined : String(input.data.mapAssetId) || null,
            displayAssetId:
              input.data.displayAssetId === undefined ? undefined : String(input.data.displayAssetId) || null,
            referenceCollectionId:
              input.data.referenceCollectionId === undefined
                ? undefined
                : String(input.data.referenceCollectionId) || null,
            verificationProfile:
              input.data.verificationProfile === undefined ? undefined : JSON.stringify(input.data.verificationProfile),
          },
        }),
      );
    }
    if (input.action === "create")
      return NextResponse.json(
        await db.taleArtifact.create({
          data: {
            taleId,
            name: String(input.data.name ?? "New artifact").trim(),
            shortDescription: String(input.data.shortDescription ?? "").trim() || null,
            loreDescription: String(input.data.loreDescription ?? "").trim() || null,
            ordinaryGameObjectLabel: String(input.data.ordinaryGameObjectLabel ?? "").trim() || null,
            collectionGroup: String(input.data.collectionGroup ?? "").trim() || null,
          },
        }),
      );
    if (!input.id) throw new Error("Choose an Artifact to update.");
    if (input.action === "archive")
      return NextResponse.json(
        await db.taleArtifact.update({ where: { id: input.id }, data: { archivedAt: new Date() } }),
      );
    return NextResponse.json(
      await db.taleArtifact.update({
        where: { id: input.id },
        data: {
          name: input.data.name ? String(input.data.name).trim() : undefined,
          shortDescription:
            input.data.shortDescription === undefined ? undefined : String(input.data.shortDescription).trim() || null,
          loreDescription:
            input.data.loreDescription === undefined ? undefined : String(input.data.loreDescription).trim() || null,
          ordinaryGameObjectLabel:
            input.data.ordinaryGameObjectLabel === undefined
              ? undefined
              : String(input.data.ordinaryGameObjectLabel).trim() || null,
          artworkAssetId:
            input.data.artworkAssetId === undefined ? undefined : String(input.data.artworkAssetId) || null,
          revealVideoAssetId:
            input.data.revealVideoAssetId === undefined ? undefined : String(input.data.revealVideoAssetId) || null,
          collectionGroup:
            input.data.collectionGroup === undefined ? undefined : String(input.data.collectionGroup).trim() || null,
        },
      }),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
