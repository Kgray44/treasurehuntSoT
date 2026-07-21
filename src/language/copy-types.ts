/** The known owner of a line of content. Platform copy must remain distinguishable from Chronicle prose. */
export type SpeakerType =
  | "SYSTEM"
  | "NARRATOR"
  | "CHARACTER"
  | "CAPTAIN_OPERATOR"
  | "CREATOR"
  | "PLAYER"
  | "UNATTRIBUTED_DOCUMENT";

export type CopyAudience = "PUBLIC" | "PLAYER" | "CAPTAIN" | "CREATOR" | "ADMIN" | "SYSTEM";

export type DeliveryContext = "PLATFORM" | "CHRONICLE" | "NOTIFICATION" | "EMAIL" | "CONNECTOR" | "ERROR" | "HELP";

export type VoiceLayer = "brand" | "platform" | "player" | "captain" | "studio" | "chronicle";

export type ContentVoiceMetadata = Readonly<{
  speakerType: SpeakerType;
  speakerId?: string;
  voiceProfileId?: string;
  audience: CopyAudience;
  deliveryContext: DeliveryContext;
  tone?: string;
  localizationKey: string;
  voiceLayer: VoiceLayer;
}>;

export type CopyEntry<TValue extends string | ((...args: never[]) => string) = string> = Readonly<{
  value: TValue;
  metadata: ContentVoiceMetadata;
}>;
