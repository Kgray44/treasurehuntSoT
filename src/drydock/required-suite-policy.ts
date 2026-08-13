import type { PublishedTaleSnapshot } from "@/chronicle/types";

export type DrydockRequiredScenarioClass = Readonly<{
  id:
    | "BASELINE_SUCCESS"
    | "REQUIRED_ENDING"
    | "MAJOR_BRANCH"
    | "TIMER_TIMEOUT"
    | "CAPTAIN_APPROVE_REJECT"
    | "ANSWER_MATCH_AND_NO_MATCH"
    | "PROVIDER_OUTCOMES"
    | "REDUCED_MOTION_AND_SOUND_BLOCKED";
  capability: string;
  reason: string;
}>;

const policy = (id: DrydockRequiredScenarioClass["id"], capability: string, reason: string) => ({ id, capability, reason });

/** Derives explainable Scenario classes from canonical authored source, never Creator assertions. */
export function requiredScenarioClasses(snapshot: PublishedTaleSnapshot): readonly DrydockRequiredScenarioClass[] {
  const blocks = snapshot.chapters.flatMap((chapter) => chapter.blocks);
  const required: DrydockRequiredScenarioClass[] = [
    policy("BASELINE_SUCCESS", "BASELINE", "Every Chronicle needs a successful governed path."),
  ];
  if (blocks.filter((block) => block.blockType === "taleComplete").length > 1)
    required.push(policy("REQUIRED_ENDING", "MULTIPLE_ENDINGS", "Every required ending needs deterministic evidence."));
  if (blocks.some((block) => block.connections.length > 1))
    required.push(policy("MAJOR_BRANCH", "BRANCHING", "Major authored alternatives need evidence."));
  const modes = new Set(blocks.map((block) => String(block.completion?.mode ?? "playerConfirmation")));
  if (blocks.some((block) => block.blockType === "wait") || modes.has("timer"))
    required.push(policy("TIMER_TIMEOUT", "WAIT_OR_TIMER", "Virtual-time timeout behavior is present."));
  if (blocks.some((block) => block.blockType === "captainApproval") || modes.has("captainManual"))
    required.push(policy("CAPTAIN_APPROVE_REJECT", "CAPTAIN_APPROVAL", "Captain approval has two governed outcomes."));
  if (blocks.some((block) => block.blockType === "riddle" || block.blockType === "textAnswer") || modes.has("textAnswer"))
    required.push(policy("ANSWER_MATCH_AND_NO_MATCH", "TEXT_ANSWER", "Text-answer outcomes must both be deterministic."));
  if (["visionLocation", "visionObject", "externalWebhook"].some((mode) => modes.has(mode)))
    required.push(policy("PROVIDER_OUTCOMES", "PROVIDER", "Used provider outcomes need deterministic fallback evidence."));
  if (blocks.some((block) => ["imageTransformation", "cinematic", "audio"].includes(block.blockType)))
    required.push(policy("REDUCED_MOTION_AND_SOUND_BLOCKED", "MEANINGFUL_PRESENTATION", "Presentation must remain understandable without motion or sound."));
  return required;
}
