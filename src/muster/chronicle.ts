import type { Chronicle, PublishedTaleVersion } from "@prisma/client";
import { parsePublishedSnapshot } from "@/chronicle/publishing";

/** An edition's explicit nulls are authoritative too; never fill them from a later draft. */
export function musterChronicleIdentity(voyage: {
  tale: Chronicle;
  version: Pick<PublishedTaleVersion, "contentSnapshot"> | null;
}) {
  return voyage.version ? parsePublishedSnapshot(voyage.version.contentSnapshot).tale : voyage.tale;
}
