import { describe, expect, it } from "vitest";
import { captainCopy } from "./captain-copy";
import { canonicalTerms } from "./canonical-terms";
import { playerCopy } from "./player-copy";
import { platformCopy } from "./platform-copy";
import { studioCopy } from "./studio-copy";

describe("Voyagewright copy registry", () => {
  it("keeps the approved product terms and shared actions canonical", () => {
    expect(canonicalTerms.product).toBe("Voyagewright");
    expect(canonicalTerms.studio).toBe("Voyagewright Studio");
    expect(canonicalTerms.captainConsole).toBe("Captain's Console");
    expect(canonicalTerms.chronicleLibrary).toBe("Chronicle Library");
    expect(canonicalTerms.activeVoyages).toBe("Active Voyages");
    expect(platformCopy.createChronicle.value).toBe("Create Chronicle");
    expect(platformCopy.beginVoyage.value).toBe("Begin Voyage");
    expect(platformCopy.continueVoyage.value).toBe("Continue Voyage");
    expect(playerCopy.replayPresentation.value).toBe("Replay presentation");
    expect(captainCopy.advancePassage.value).toBe("Advance to next Passage");
    expect(studioCopy.addPassage.value).toBe("Add Passage");
    expect(studioCopy.previewVoyage.value).toBe("Preview Voyage");
  });

  it("records ownership and localization context for shared platform copy", () => {
    expect(playerCopy.chapterReleased.metadata).toMatchObject({
      speakerType: "SYSTEM",
      audience: "PLAYER",
      voiceLayer: "player",
      localizationKey: "player.progression.chapterReleased",
    });
    expect(captainCopy.endConfirmation.metadata).toMatchObject({
      audience: "CAPTAIN",
      voiceLayer: "captain",
      localizationKey: "captain.confirmation.end.title",
    });
  });
});
