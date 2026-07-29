"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AnimationSceneName } from "@/animation/core/animation-types";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";

function CommunitySceneTrigger({ sceneName, root }: { sceneName: AnimationSceneName; root: HTMLElement | null }) {
  const { director } = useAnimationDirector();
  const host = useOptionalSceneHost();
  useEffect(() => {
    if (!host || !root) return;
    const presentation = director.play<void>(sceneName, {
      root,
      hostId: host.hostId,
      hostKind: host.kind,
      sceneHost: host,
      requestSource: "explicit",
      queue: false,
      finalStateRuntime: {
        holdSafePose: () => undefined,
        verifyReadableState: (state) => state === "community-readable",
      },
    });
    // Presentation is never allowed to break the public semantic surface.
    void presentation.catch(() => undefined);
  }, [director, host, root, sceneName]);
  return null;
}

function CommunitySceneTarget({
  sceneName,
  children,
  onRoot,
}: {
  sceneName: AnimationSceneName;
  children: ReactNode;
  onRoot: (root: HTMLElement | null) => void;
}) {
  const receipt =
    sceneName === "community-report-submitted" ||
    sceneName === "community-keepsake-created" ||
    sceneName === "community-voyage-log-published";
  const registration = useMemo(
    () => ({
      targetKey: receipt ? "community-receipt" : "community-heading",
      part: receipt ? "community-receipt" : "community-heading",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [receipt],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  const bindRoot = useCallback(
    (node: HTMLDivElement | null) => {
      bindTarget(node);
      onRoot(node);
    },
    [bindTarget, onRoot],
  );
  return (
    <div ref={bindRoot} data-scene-part={receipt ? "community-receipt" : "community-heading"}>
      {children}
    </div>
  );
}

/** A single target-permitted Community ceremony boundary; reduced motion is resolved by the Lanternwake director. */
export function CommunitySceneCeremony({
  sceneName,
  children,
}: {
  sceneName: AnimationSceneName;
  children: ReactNode;
}) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  return (
    <SceneHost kind="platform-ceremony" hostKey={`community:${sceneName}`} className="community-scene-boundary">
      <CommunitySceneTrigger sceneName={sceneName} root={root} />
      <CommunitySceneTarget sceneName={sceneName} onRoot={setRoot}>
        {children}
      </CommunitySceneTarget>
    </SceneHost>
  );
}
