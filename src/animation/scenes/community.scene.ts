import type { AnimationSceneName, SceneBuildContextV2, SceneDefinitionV2 } from "../core/animation-types";
import { distance, fromToTargets, mark, sceneTimeline, seconds, settleV2 } from "./scene-utils";

export const governedCommunitySceneNames = [
  "community-harbor-arrival",
  "community-featured-reveal",
  "community-card-collection-enter",
  "community-listing-open",
  "community-profile-arrival",
  "community-voyage-log-unfurl",
  "community-save-to-collection",
  "community-filter-results",
  "community-report-submitted",
  "community-keepsake-created",
  "community-voyage-log-published",
] as const satisfies readonly AnimationSceneName[];

function receiptScene(name: AnimationSceneName) {
  return (
    name === "community-report-submitted" ||
    name === "community-keepsake-created" ||
    name === "community-voyage-log-published"
  );
}

function openingLabel(name: AnimationSceneName) {
  return `${name.replace(/^community-/, "").replaceAll("-", "-")}-opening`;
}

function communityScene(name: (typeof governedCommunitySceneNames)[number]): SceneDefinitionV2 {
  const receipt = receiptScene(name);
  const primary = receipt ? "community-receipt" : "community-heading";
  return {
    name,
    buildOpening(context: SceneBuildContextV2) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, openingLabel(name), 0);
      fromToTargets(
        timeline,
        context,
        primary,
        { opacity: 0, y: distance(context, 12) },
        { opacity: 1, y: 0, duration: seconds(context, 0.34), ease: "power2.out" },
      );
      mark(timeline, context, "await-server", ">");
      return timeline;
    },
    buildSuccess(context: SceneBuildContextV2) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "community-readable", 0);
      fromToTargets(
        timeline,
        context,
        primary,
        { opacity: 0.66, scale: context.mode === "reduced" ? 1 : 0.985 },
        { opacity: 1, scale: 1, duration: seconds(context, 0.26), ease: "power2.out" },
      );
      return settleV2(timeline, context);
    },
    buildFailure(context: SceneBuildContextV2) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "community-operation-unavailable", 0);
      return settleV2(timeline, context);
    },
  };
}

export const communityHarborScenes = governedCommunitySceneNames.map(communityScene) as SceneDefinitionV2[];
