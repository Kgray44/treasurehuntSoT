export type CompanionView = "journal" | "chart" | "treasures" | "quests" | "log" | "finale";

export const companionViews: Array<{ key: CompanionView; label: string; shortLabel: string; symbol: string }> = [
  { key: "journal", label: "Journal", shortLabel: "Journal", symbol: "¶" },
  { key: "chart", label: "Voyage Chart", shortLabel: "Chart", symbol: "⌖" },
  { key: "treasures", label: "Artifact Collection", shortLabel: "Artifacts", symbol: "◇" },
  { key: "quests", label: "Echo Ledger", shortLabel: "Echoes", symbol: "☾" },
  { key: "log", label: "Ship's Log", shortLabel: "Log", symbol: "≋" },
  { key: "finale", label: "Finale Chamber", shortLabel: "Finale", symbol: "✺" },
];
