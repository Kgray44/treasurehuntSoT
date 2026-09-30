"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

type Presentation = PlayerLandfallBootstrap["presentations"][number];

function LandfallPresentationContent({
  sessionId,
  versionId,
  presentations,
}: {
  sessionId: string;
  versionId: string;
  presentations: PlayerLandfallBootstrap["presentations"];
}) {
  const { director } = useAnimationDirector();
  const host = useOptionalSceneHost();
  const root = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<Presentation | null>(null);
  const target = useMemo(
    () => ({
      targetKey: `landfall-status:${sessionId}`,
      part: "landfall-status",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [sessionId],
  );
  const { bindTarget } = useSceneTargetRegistration(target);

  useEffect(() => {
    if (!host || !root.current) return;
    let cancelled = false;
    const controller = new AbortController();
    const run = async () => {
      const hostRoot = root.current?.closest<HTMLElement>("[data-scene-host-boundary]");
      if (!hostRoot) return;
      for (const presentation of presentations) {
        if (cancelled) return;
        const age = Date.now() - Date.parse(presentation.createdAt);
        if (!Number.isFinite(age) || age < -5_000 || age > 60_000) continue;
        const key = `landfall-scene:${sessionId}:${versionId}:${presentation.eventId}`;
        if (sessionStorage.getItem(key) === "seen") continue;
        setCurrent(presentation);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (cancelled) return;
        try {
          await director.play(presentation.sceneName, {
            root: hostRoot,
            sceneHost: host,
            hostId: host.hostId,
            hostKind: host.kind,
            requestSource: "automatic",
            eventOrActionId: presentation.eventId,
            telemetryContext: { route: "player-landfall", playerSection: "chart" },
            queue: false,
            signal: controller.signal,
          });
        } catch {
          /* The readable status card remains the fallback. */
        }
        try {
          sessionStorage.setItem(key, "seen");
        } catch {
          /* Private browsing can disable storage. */
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [director, host, presentations, sessionId, versionId]);

  return (
    <div ref={root} className="landfall-presentation">
      <p ref={bindTarget} data-scene-part="landfall-status" role="status" aria-live="polite">
        {current?.label ?? "The Living Chart is ready."}
      </p>
    </div>
  );
}

/** Canonical scene order follows TaleSessionEvent.sequence; animation never acknowledges progression. */
export function LandfallPresentation({ bootstrap }: { bootstrap: PlayerLandfallBootstrap }) {
  if (bootstrap.replayOnly) return null;
  return (
    <SceneHost kind="player-section-enhancement" hostKey={`landfall:${bootstrap.sessionId}`}>
      <LandfallPresentationContent
        sessionId={bootstrap.sessionId}
        versionId={bootstrap.publishedVersionId}
        presentations={bootstrap.presentations}
      />
    </SceneHost>
  );
}
