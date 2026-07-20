import type { CopyEntry } from "./copy-types";

function platform(value: string, localizationKey: string): CopyEntry {
  return {
    value,
    metadata: {
      speakerType: "SYSTEM",
      audience: "SYSTEM",
      deliveryContext: "PLATFORM",
      localizationKey,
      voiceLayer: "platform",
    },
  };
}

export const platformCopy = {
  productName: platform("Voyagewright", "platform.product.name"),
  productTagline: platform("Stories made to be played.", "platform.product.tagline"),
  companyDescription: platform(
    "Absolute Relative Systems creates tools for interactive experiences.",
    "platform.company.description",
  ),
  createChronicle: platform("Create Chronicle", "platform.action.createChronicle"),
  beginVoyage: platform("Begin Voyage", "platform.action.beginVoyage"),
  continueVoyage: platform("Continue Voyage", "platform.action.continueVoyage"),
  endVoyage: platform("End Voyage", "platform.action.endVoyage"),
  inviteCrew: platform("Invite Crew", "platform.action.inviteCrew"),
  chronicleLibrary: platform("Chronicle Library", "platform.navigation.chronicleLibrary"),
  activeVoyages: platform("Active Voyages", "platform.navigation.activeVoyages"),
  voyageHistory: platform("Voyage History", "platform.navigation.voyageHistory"),
  invitationAccepted: platform("Invitation accepted.", "platform.invitation.accepted"),
  invitationExpired: platform("This invitation has expired.", "platform.invitation.expired"),
  invitationExpiredDetail: platform("Ask the Captain to create a new invitation.", "platform.invitation.expiredDetail"),
  connectionLost: platform("Connection lost", "platform.connection.lost"),
  connectionLostDetail: platform(
    "Your progress is safe. Voyagewright is trying to reconnect.",
    "platform.connection.lostDetail",
  ),
  unableToReconnect: platform("Unable to reconnect", "platform.connection.unavailable"),
  loadingChronicle: platform("Opening Chronicle...", "platform.loading.chronicle"),
  loadingVoyage: platform("Loading Voyage...", "platform.loading.voyage"),
  noChronicles: platform("No Chronicles yet", "platform.empty.noChronicles"),
  noActiveVoyages: platform("No active Voyages", "platform.empty.noActiveVoyages"),
  noArtifacts: platform("No Artifacts recovered", "platform.empty.noArtifacts"),
} as const;
