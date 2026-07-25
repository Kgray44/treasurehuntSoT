import type { AnimationRuntimeOwner, MotionMode, SceneHostKind, SceneReachability } from "../core/animation-types";

export const communitySceneNames = [
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
] as const;
export type CommunitySceneName = (typeof communitySceneNames)[number];
export type CommunitySceneContract = Readonly<{
  name: CommunitySceneName;
  family: "community-harbor";
  reachability: Extract<SceneReachability, "production">;
  expectedHostKind: SceneHostKind;
  requiredSemanticTargets: readonly string[];
  optionalDecorativeTargets: readonly string[];
  owner: AnimationRuntimeOwner;
  reducedMotion: MotionMode;
  successBoundary: "server-confirmed" | "static-readable";
  finalState: string;
  interruption: "cleanup-and-static-fallback";
  focusRestoration: "trigger-or-heading";
}>;
const contract = (
  name: CommunitySceneName,
  requiredSemanticTargets: readonly string[],
  successBoundary: CommunitySceneContract["successBoundary"] = "server-confirmed",
): CommunitySceneContract =>
  Object.freeze({
    name,
    family: "community-harbor",
    reachability: "production",
    expectedHostKind: "platform-ceremony",
    requiredSemanticTargets,
    optionalDecorativeTargets: ["community-light", "community-parchment", "community-route"],
    owner: "gsap",
    reducedMotion: "reduced",
    successBoundary,
    finalState: "community-readable",
    interruption: "cleanup-and-static-fallback",
    focusRestoration: "trigger-or-heading",
  });
export const communitySceneContracts = Object.freeze(
  Object.fromEntries(
    communitySceneNames.map((name) => [
      name,
      contract(
        name,
        name.includes("published") || name.includes("created") || name.includes("submitted") ? ["community-receipt"] : ["community-heading"],
        name.includes("published") || name.includes("created") || name.includes("submitted") ? "server-confirmed" : "static-readable",
      ),
    ]),
  ) as Record<CommunitySceneName, CommunitySceneContract>,
);
