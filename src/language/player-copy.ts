import type { CopyEntry } from "./copy-types";

function player(value: string, localizationKey: string): CopyEntry {
  return {
    value,
    metadata: {
      speakerType: "SYSTEM",
      audience: "PLAYER",
      deliveryContext: "PLATFORM",
      localizationKey,
      voiceLayer: "player",
    },
  };
}

export const playerCopy = {
  chapterReleased: player("Chapter released", "player.progression.chapterReleased"),
  chapterReleasedDetail: player("A new entry has opened in the journal.", "player.progression.chapterReleasedDetail"),
  waypointRevealed: player("Waypoint revealed", "player.progression.waypointRevealed"),
  waypointRevealedDetail: player(
    "A new bearing has been marked on the chart.",
    "player.progression.waypointRevealedDetail",
  ),
  artifactRecovered: player("Artifact recovered", "player.progression.artifactRecovered"),
  artifactRecoveredDetail: player("Added to your collection.", "player.progression.artifactRecoveredDetail"),
  echoDiscovered: player("Echo discovered", "player.progression.echoDiscovered"),
  echoDiscoveredDetail: player(
    "This memory is optional, but it may change what the Voyage means.",
    "player.progression.echoDiscoveredDetail",
  ),
  awaitingCaptain: player("Awaiting the Captain", "player.waiting.awaitingCaptain"),
  awaitingCaptainDetail: player(
    "Your progress is saved. The Voyage will continue when the next Passage is released.",
    "player.waiting.awaitingCaptainDetail",
  ),
  replayPresentation: player("Replay presentation", "player.action.replayPresentation"),
  returnToLibrary: player("Return to Chronicle Library", "player.action.returnToLibrary"),
} as const;
