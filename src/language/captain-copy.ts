import type { CopyEntry } from "./copy-types";

function captain(value: string, localizationKey: string): CopyEntry {
  return {
    value,
    metadata: {
      speakerType: "SYSTEM",
      audience: "CAPTAIN",
      deliveryContext: "PLATFORM",
      localizationKey,
      voiceLayer: "captain",
    },
  };
}

export const captainCopy = {
  consoleName: captain("Captain's Console", "captain.console.name"),
  beginVoyage: captain("Begin Voyage", "captain.action.beginVoyage"),
  releaseChapter: captain("Release Chapter", "captain.action.releaseChapter"),
  advancePassage: captain("Advance to next Passage", "captain.action.advancePassage"),
  approveDiscovery: captain("Approve discovery", "captain.action.approveDiscovery"),
  requestImage: captain("Request another image", "captain.action.requestImage"),
  sendHint: captain("Send Hint", "captain.action.sendHint"),
  pauseVoyage: captain("Pause Voyage", "captain.action.pauseVoyage"),
  resumeVoyage: captain("Resume Voyage", "captain.action.resumeVoyage"),
  endVoyage: captain("End Voyage", "captain.action.endVoyage"),
  offlineDetail: captain(
    "This player is offline. The action will be delivered when they reconnect.",
    "captain.status.playerOffline",
  ),
  advanceCrewDetail: captain(
    "This action advances the entire Crew to the next Passage.",
    "captain.action.advanceDetail",
  ),
  endConfirmation: captain("End this Voyage?", "captain.confirmation.end.title"),
  endConfirmationDetail: captain(
    "Players will no longer be able to advance. The Voyage Record and current progress will be preserved.",
    "captain.confirmation.end.detail",
  ),
} as const;
