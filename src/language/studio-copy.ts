import type { CopyEntry } from "./copy-types";

function studio(value: string, localizationKey: string): CopyEntry {
  return {
    value,
    metadata: {
      speakerType: "SYSTEM",
      audience: "CREATOR",
      deliveryContext: "PLATFORM",
      localizationKey,
      voiceLayer: "studio",
    },
  };
}

export const studioCopy = {
  studioName: studio("Voyagewright Studio", "studio.product.name"),
  createChronicle: studio("Create Chronicle", "studio.action.createChronicle"),
  editChronicle: studio("Edit Chronicle", "studio.action.editChronicle"),
  duplicateChronicle: studio("Duplicate Chronicle", "studio.action.duplicateChronicle"),
  archiveChronicle: studio("Archive Chronicle", "studio.action.archiveChronicle"),
  deleteChronicle: studio("Delete Chronicle", "studio.action.deleteChronicle"),
  addChapter: studio("Add Chapter", "studio.action.addChapter"),
  addPassage: studio("Add Passage", "studio.action.addPassage"),
  addWaypoint: studio("Add Waypoint", "studio.action.addWaypoint"),
  addArtifact: studio("Add Artifact", "studio.action.addArtifact"),
  addEcho: studio("Add Echo", "studio.action.addEcho"),
  previewVoyage: studio("Preview Voyage", "studio.action.previewVoyage"),
  validateChronicle: studio("Validate Chronicle", "studio.action.validateChronicle"),
  publishChronicle: studio("Publish Chronicle", "studio.action.publishChronicle"),
  versionHistory: studio("Version history", "studio.navigation.versionHistory"),
  draftSaved: studio("Draft saved", "studio.status.draftSaved"),
  unpublishedChanges: studio("Unpublished changes", "studio.status.unpublishedChanges"),
} as const;
