import { canonicalChecksum } from "@/drydock/canonical";
import { spatialMomentSchema, versionContentSchema, type SpatialMoment } from "./contracts";

export function materializeSpatialVersion(input: unknown) {
  const content = versionContentSchema.parse(input);
  return { ...content, checksum: canonicalChecksum(content) };
}
/** Embedded published capsule: immutable via the existing Chronicle snapshot, no library lookup at runtime. */
export function validateSpatialMoment(input: unknown, blockId?: string): SpatialMoment {
  const moment = spatialMomentSchema.parse(input);
  const { checksum, ...content } = moment.version;
  if (canonicalChecksum(content) !== checksum) throw new Error("PARALLAX_VERSION_CHECKSUM_INVALID");
  if (blockId && moment.attachment.storyMomentId !== blockId) throw new Error("PARALLAX_ATTACHMENT_BLOCK_MISMATCH");
  return moment;
}
export function validatePublishedSpatialMoments(snapshot: {
  chapters: { blocks: { id: string; presentation?: Record<string, unknown> }[] }[];
}) {
  for (const chapter of snapshot.chapters)
    for (const block of chapter.blocks) {
      const moment = block.presentation?.spatialMoment;
      if (moment !== undefined) validateSpatialMoment(moment, block.id);
    }
}
