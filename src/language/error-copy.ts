import type { CopyEntry } from "./copy-types";

function error(value: string, localizationKey: string): CopyEntry {
  return {
    value,
    metadata: {
      speakerType: "SYSTEM",
      audience: "SYSTEM",
      deliveryContext: "ERROR",
      localizationKey,
      voiceLayer: "platform",
    },
  };
}

export const errorCopy = {
  chronicleCouldNotOpen: error("This Chronicle could not be opened", "error.chronicle.open.title"),
  chronicleCouldNotOpenDetail: error(
    "Your progress has not changed. Try again, or return to the Chronicle Library.",
    "error.chronicle.open.detail",
  ),
  fileNotSaved: error("The file was not saved", "error.file.save.title"),
  fileNotSavedDetail: error("Check your connection, then choose the file again.", "error.file.save.detail"),
  chronicleNotPublished: error("The Chronicle was not published", "error.chronicle.publish.title"),
  chronicleNotPublishedDetail: (chapterTitle: string, passageTitle: string) =>
    `"${chapterTitle}" cannot be published because the Passage "${passageTitle}" has no valid destination. Your draft has been preserved.`,
  newerVersionRequired: error(
    "This Chronicle requires a newer version of Voyagewright",
    "error.chronicle.version.title",
  ),
  newerVersionRequiredDetail: error(
    "Update the application before continuing. Your Voyage has not advanced.",
    "error.chronicle.version.detail",
  ),
  verificationFailed: error("The object could not be confirmed", "error.verification.title"),
  verificationFailedDetail: error(
    "Adjust the view so the full marker is visible, then try again.",
    "error.verification.detail",
  ),
} as const;
