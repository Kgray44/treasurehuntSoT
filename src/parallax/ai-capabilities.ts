/** Capability identity describes the human task, independently of provider/model.
 * Extend this registry when an execution owner introduces another capability. */
export const aiCapabilities = [
  {
    id: "ROOM_RECONSTRUCTION",
    name: "Room Reconstruction",
    description: "Build and review an environment from protected room photographs.",
    owner: "Parallax / Watchglass",
    category: "ROOM_RECONSTRUCTION",
    access: "Owned saved environment and Creator authority",
    success: "ACCEPTED",
    successLabel: "accepted rooms",
    outcomes: ["GENERATED", "PREVIEWED", "REJECTED", "ACCEPTED", "ACCEPTED_THEN_EDITED"],
  },
  {
    id: "GROUNDED_ASSISTANT_EDIT",
    name: "Grounded Assistant Edit",
    description: "Prepare room-aware changes for canonical review and Apply.",
    owner: "Parallax",
    category: "AUTHORING",
    access: "Owned saved scene and existing Assistant permission",
    success: "APPLIED",
    successLabel: "applied edits",
    outcomes: ["PROPOSED", "APPLIED", "REJECTED", "UNDONE"],
  },
  {
    id: "ADVANCED_ASSISTANT",
    name: "Advanced Assistant",
    description: "Prepare reviewed changes using the effective advanced model profile.",
    owner: "Parallax",
    category: "AUTHORING",
    access: "Existing advanced permission and owned saved scene",
    success: "APPLIED",
    successLabel: "applied edits",
    outcomes: ["PROPOSED", "APPLIED", "REJECTED", "UNDONE"],
  },
  {
    id: "OTHER_AI_OPERATIONS",
    name: "Other AI Operations",
    description: "Unclassified or historical operations; outcome coverage is explicit.",
    owner: "Execution owner",
    category: "OTHER",
    access: "Canonical execution owner authorization",
    success: null,
    successLabel: "outcome unavailable",
    outcomes: [],
  },
] as const;
export type AICapabilityId = (typeof aiCapabilities)[number]["id"];
export const AI_CAPABILITY_VERSION = "voyagewright-ai-capabilities-2026-10-14-v1";
export function classifyAICapability(category: string, mode: string): AICapabilityId {
  if (category === "ROOM_RECONSTRUCTION") return "ROOM_RECONSTRUCTION";
  if (category === "AUTHORING") return mode === "ADVANCED" ? "ADVANCED_ASSISTANT" : "GROUNDED_ASSISTANT_EDIT";
  return "OTHER_AI_OPERATIONS";
}
export function aiCapability(id: string) {
  return aiCapabilities.find((entry) => entry.id === id) ?? aiCapabilities[3];
}
export const aiFailureOutcomes = [
  "FAILED",
  "PROVIDER_ERROR",
  "APPLICATION_ERROR",
  "TIMEOUT",
  "ABORTED",
  "PARTIAL",
  "CANCELLED_BEFORE_EXECUTION",
  "CANCELLED_DURING_EXECUTION",
] as const;
export function failureOutcome(code: string, dispatched: boolean) {
  if (/CANCEL|UNDISPATCHED/.test(code)) return dispatched ? "CANCELLED_DURING_EXECUTION" : "CANCELLED_BEFORE_EXECUTION";
  if (/TIMEOUT|EXPIRED/.test(code)) return "TIMEOUT";
  if (/ABORT|CONNECTION/.test(code)) return "ABORTED";
  if (/INCOMPLETE/.test(code)) return "PARTIAL";
  return /PROVIDER|UPSTREAM|MODEL|RATE/.test(code) ? "PROVIDER_ERROR" : "APPLICATION_ERROR";
}
