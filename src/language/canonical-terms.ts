export const canonicalTerms = {
  company: "Absolute Relative Systems",
  product: "Voyagewright",
  studio: "Voyagewright Studio",
  player: "Voyagewright Player",
  captainConsole: "Captain's Console",
  connector: "Voyagewright Connector",
  chronicle: { singular: "Chronicle", plural: "Chronicles" },
  voyage: { singular: "Voyage", plural: "Voyages" },
  captain: { singular: "Captain", plural: "Captains" },
  crew: { singular: "Crew", plural: "Crews" },
  chapter: { singular: "Chapter", plural: "Chapters" },
  passage: { singular: "Passage", plural: "Passages" },
  waypoint: { singular: "Waypoint", plural: "Waypoints" },
  echo: { singular: "Echo", plural: "Echoes" },
  artifact: { singular: "Artifact", plural: "Artifacts" },
  previewVoyage: "Preview Voyage",
  voyageRecord: { singular: "Voyage Record", plural: "Voyage Records" },
  chronicleLibrary: "Chronicle Library",
  activeVoyages: "Active Voyages",
  voyageHistory: "Voyage History",
  archive: "Archive",
} as const;

/**
 * Product-facing replacements only. Internal table names, API routes, and persisted identifiers are deliberately
 * not renamed here; the language validator prevents them from becoming visible product copy.
 */
export const deprecatedUserFacingTerms = [
  "Chronicle",
  "Chronicles",
  "campaign",
  "campaigns",
  "game session",
  "game master",
  "GM dashboard",
  "admin dashboard",
  "quest editor",
  "story block",
  "content block",
  "player campaign",
  "active campaign",
  "campaign library",
  "campaign history",
  "session dashboard",
  "run campaign",
  "start story",
  "launch campaign",
  "play campaign",
  "mission builder",
  "scenario editor",
  "operator dashboard",
] as const;

export const copyCapitalizationPolicy = {
  canonicalObjects:
    "Capitalize Chronicle, Voyage, Captain, Crew, Chapter, Passage, Waypoint, Echo, Artifact, and named interfaces when they refer to Voyagewright product concepts.",
  ordinaryUsage:
    "Use ordinary sentence case when the same word describes a non-product concept, such as a fictional captain in Chronicle-authored prose.",
  controls:
    "Keep ordinary controls literal: Save, Cancel, Delete, Email, Password, Privacy, Version history, and Validation errors.",
} as const;
