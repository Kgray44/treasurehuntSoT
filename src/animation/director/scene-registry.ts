import type { AnimationSceneName, SceneDefinition } from "../core/animation-types";
import { firstArrivalScene, sessionReentryScene } from "../scenes/arrival.scene";
import { playerAccessScene, quartermasterLoginScene } from "../scenes/access.scene";
import { markSolvedScene, pauseScene, prepareChapterScene, resumeScene, undoScene } from "../scenes/command.scene";
import {
  artifactAwardScene,
  artifactConnectionScene,
  artifactInspectionScene,
  chapterHeadingScene,
  chapterReleaseScene,
  finaleRequirementScene,
  finaleTeaseScene,
  journalOpenScene,
  logEntryScene,
  manualPageFlipScene,
  mapRevealScene,
  markerStampScene,
  programmaticPageFlipScene,
  proseInkScene,
  questCompleteScene,
  questDiscoveryScene,
  routeDrawScene,
  sealBreakScene,
  shipCourseScene,
} from "../scenes/story.scene";

const definitions: SceneDefinition[] = [
  firstArrivalScene,
  sessionReentryScene,
  playerAccessScene,
  quartermasterLoginScene,
  journalOpenScene,
  manualPageFlipScene,
  programmaticPageFlipScene,
  chapterHeadingScene,
  proseInkScene,
  sealBreakScene,
  chapterReleaseScene,
  mapRevealScene,
  routeDrawScene,
  markerStampScene,
  shipCourseScene,
  artifactAwardScene,
  artifactInspectionScene,
  artifactConnectionScene,
  questDiscoveryScene,
  questCompleteScene,
  logEntryScene,
  finaleTeaseScene,
  finaleRequirementScene,
  prepareChapterScene,
  markSolvedScene,
  pauseScene,
  resumeScene,
  undoScene,
];

export const sceneRegistry = Object.fromEntries(
  definitions.map((definition) => [definition.name, definition]),
) as Record<AnimationSceneName, SceneDefinition>;

export function getSceneDefinition(name: AnimationSceneName) {
  return sceneRegistry[name];
}
