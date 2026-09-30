import type { AnimationSceneName, SceneDefinitionV2 } from "../core/animation-types";
import { fromToTargets, mark, sceneTimeline, seconds, settleV2 } from "./scene-utils";

function landfallScene(name: AnimationSceneName, label: string): SceneDefinitionV2 {
  return {
    name,
    reversible: true,
    buildOpening(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, "landfall-readable", 0);
      return settleV2(timeline, context);
    },
    buildSuccess(context) {
      const timeline = sceneTimeline(context);
      mark(timeline, context, label, 0);
      // Animate the readable receipt only. The map engine alone controls map transforms.
      fromToTargets(
        timeline,
        context,
        "landfall-status",
        { opacity: 0.55, y: 8 },
        { opacity: 1, y: 0, duration: seconds(context, 0.42) },
      );
      return settleV2(timeline, context);
    },
  };
}

export const landfallArrivalScene = landfallScene("landfall-arrival", "canonical-arrival");
export const landfallRouteScene = landfallScene("landfall-route", "canonical-route");
export const landfallRevealScene = landfallScene("landfall-reveal", "canonical-reveal");
