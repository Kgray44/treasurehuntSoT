import type { gsap } from "gsap";

export type MotionMode = "full" | "gentle" | "reduced";

export const sceneNames = [
  "first-arrival",
  "session-reentry",
  "player-access",
  "quartermaster-login",
  "journal-open",
  "manual-page-flip",
  "programmatic-page-flip",
  "chapter-heading",
  "prose-ink",
  "seal-break",
  "chapter-release",
  "map-reveal",
  "route-draw",
  "marker-stamp",
  "ship-course",
  "artifact-award",
  "artifact-inspection",
  "artifact-connection",
  "quest-discovery",
  "quest-complete",
  "log-entry",
  "finale-tease",
  "finale-requirement",
  "prepare-chapter",
  "mark-solved",
  "pause",
  "resume",
  "undo",
] as const;

export type AnimationSceneName = (typeof sceneNames)[number];
export type AnimationOwner = "gsap" | "motion" | "st-page-flip" | "rive" | "lottie" | "css";
export type SceneTimeline = ReturnType<typeof gsap.timeline>;

export type SceneDisplayContext = {
  chapterTitle?: string;
  objective?: string;
  artifactName?: string;
  locationName?: string;
  actionLabel?: string;
  [key: string]: string | number | boolean | undefined;
};

export type SceneBuildContext = {
  root: HTMLElement;
  mode: MotionMode;
  sceneName: AnimationSceneName;
  display: SceneDisplayContext;
  emitLabel: (label: string) => void;
  addCleanup: (cleanup: () => void) => void;
};

export type SceneDefinition = {
  name: AnimationSceneName;
  reversible?: boolean;
  buildOpening: (context: SceneBuildContext) => SceneTimeline;
  buildSuccess: (context: SceneBuildContext) => SceneTimeline;
  buildFailure?: (context: SceneBuildContext) => SceneTimeline;
  buildIdle?: (context: SceneBuildContext) => SceneTimeline;
};

export type DirectorSnapshot = {
  isPlaying: boolean;
  isPaused: boolean;
  scene: AnimationSceneName | null;
  label: string;
  progress: number;
  speed: number;
  mode: MotionMode;
  phase: "idle" | "opening" | "await-server" | "success" | "failure";
  queueDepth: number;
  error: string | null;
};

export type PlaySceneOptions<T> = {
  root: HTMLElement;
  display?: SceneDisplayContext;
  operation?: () => Promise<T>;
  queue?: boolean;
};

export class AnimationCancelledError extends Error {
  constructor(message = "Animation cancelled") {
    super(message);
    this.name = "AnimationCancelledError";
  }
}
