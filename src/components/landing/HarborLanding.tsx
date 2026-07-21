"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import { motion } from "motion/react";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import type { AnimationSceneName, PresentationReceipt } from "@/animation/core/animation-types";
import { gsap } from "@/animation/core/gsap-client";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { pressable } from "@/animation/motion/variants";
import { consumeOneShot, platformOneShotKey } from "@/animation/platform/one-shot";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";
import { platformCopy } from "@/language/platform-copy";

type GatewayStatus = {
  player: {
    authenticated: boolean;
    activeCount?: number;
    continue?: { label: string; href: string };
  };
  captain: {
    authenticated: boolean;
    waitingPlayers?: number;
    continue?: { label: string; href: string };
  };
  creator: {
    authenticated: boolean;
    recentDraft?: { title: string } | null;
    continue?: { label: string; href: string };
  };
};

const harborTargets = {
  sky: { targetKey: "harbor:sky", part: "sky", ownerHint: "gsap", allowedProperties: ["opacity"] },
  stars: { targetKey: "harbor:stars", part: "stars", ownerHint: "gsap", allowedProperties: ["opacity"] },
  moon: {
    targetKey: "harbor:moon",
    part: "moon",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  horizon: {
    targetKey: "harbor:horizon",
    part: "horizon",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  ocean: {
    targetKey: "harbor:ocean",
    part: "ocean",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  fogBack: {
    targetKey: "harbor:fog-back",
    part: "fog-back",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  fogFront: {
    targetKey: "harbor:fog-front",
    part: "fog-front",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  ship: {
    targetKey: "harbor:ship",
    part: "ship",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  title: {
    targetKey: "harbor:title",
    part: "title",
    ownerHint: "gsap",
    allowedProperties: ["transform", "clip-path", "opacity"],
  },
  arrivalCopyEyebrow: {
    targetKey: "harbor:arrival-copy:eyebrow",
    part: "arrival-copy",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  arrivalCopyBody: {
    targetKey: "harbor:arrival-copy:body",
    part: "arrival-copy",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  arrivalActionPrimary: {
    targetKey: "harbor:arrival-action:primary",
    part: "arrival-action",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  arrivalActionRoles: {
    targetKey: "harbor:arrival-action:roles",
    part: "arrival-action",
    ownerHint: "gsap",
    allowedProperties: ["transform", "opacity"],
  },
  nauticalBorder: {
    targetKey: "harbor:nautical-border",
    part: "nautical-border",
    ownerHint: "gsap",
    allowedProperties: ["opacity"],
  },
} as const;

function reportNonPresentedReceipt(receipt: PresentationReceipt) {
  if (process.env.NODE_ENV === "production" || receipt.outcome === "presented") return;
  console.warn("[animation] Harbor presentation did not reach presented state.", {
    sceneName: receipt.sceneName,
    hostId: receipt.hostId,
    outcome: receipt.outcome,
  });
}

const roles = [
  {
    id: "player",
    title: "Player",
    object: "journal",
    href: "/player/sign-in",
    copy: "Continue a Voyage, accept an invitation, or revisit a Voyage Record.",
  },
  {
    id: "captain",
    title: "Captain",
    object: "wheel",
    href: "/captain/sign-in",
    copy: "Guide Voyages, invite Crew, release Chapters, and manage the live experience.",
  },
  {
    id: "creator",
    title: "Creator",
    object: "quill",
    href: "/studio/sign-in",
    copy: "Create, preview, publish, and preserve Chronicles.",
  },
] as const;

function deterministicStarStyle(index: number): CSSProperties {
  const seeded = (index * 9301 + 49297) % 233280;
  const phase = seeded / 233280;
  return {
    "--star-duration": `${3.6 + phase * 4.8}s`,
    "--star-delay": `${-phase * 7.2}s`,
    "--star-min-opacity": String(0.34 + (index % 4) * 0.08),
  } as CSSProperties;
}

function roleObjectIntent(role: (typeof roles)[number]["id"], mode: ReturnType<typeof useMotionMode>["mode"]) {
  if (mode === "reduced") return {};
  if (role === "captain") return { whileHover: { rotate: 2.5 } };
  if (role === "creator") return { whileHover: { y: -2, rotate: -1 } };
  return { whileHover: { scale: 1.012 } };
}

export function HarborLanding() {
  const motionMode = useMotionMode();
  return (
    <SceneHost as="main" kind="gateway" className="harbor-landing role-gateway" data-motion-mode={motionMode.mode}>
      <HarborGatewayContent motionMode={motionMode} />
    </SceneHost>
  );
}

function HarborGatewayContent({ motionMode }: { motionMode: ReturnType<typeof useMotionMode> }) {
  const root = useRef<HTMLElement>(null);
  const gatewayTitleId = useId();
  const explainerTitleId = useId();
  const presentationAbortRef = useRef<AbortController | null>(null);
  const automaticSceneRef = useRef<Extract<AnimationSceneName, "first-arrival" | "session-reentry"> | null>(null);
  const sceneHost = useOptionalSceneHost();
  const { director, snapshot } = useAnimationDirector();
  const { mode, cycle } = motionMode;
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [selectedRole, setSelectedRole] = useState<(typeof roles)[number]["id"] | null>(null);
  const [rememberedBadges, setRememberedBadges] = useState<ReadonlySet<string>>(new Set());
  const starStyles = useMemo(() => Array.from({ length: 28 }, (_, index) => deterministicStarStyle(index)), []);

  const bindRootSentinel = useCallback((sentinel: HTMLSpanElement | null) => {
    root.current = sentinel?.parentElement instanceof HTMLElement ? sentinel.parentElement : null;
  }, []);
  const { bindTarget: bindSky, handle: skyHandle } = useSceneTargetRegistration(harborTargets.sky);
  const { bindTarget: bindStars, handle: starsHandle } = useSceneTargetRegistration(harborTargets.stars);
  const { bindTarget: bindMoon, handle: moonHandle } = useSceneTargetRegistration(harborTargets.moon);
  const { bindTarget: bindHorizon, handle: horizonHandle } = useSceneTargetRegistration(harborTargets.horizon);
  const { bindTarget: bindOcean, handle: oceanHandle } = useSceneTargetRegistration(harborTargets.ocean);
  const { bindTarget: bindFogBack, handle: fogBackHandle } = useSceneTargetRegistration(harborTargets.fogBack);
  const { bindTarget: bindFogFront, handle: fogFrontHandle } = useSceneTargetRegistration(harborTargets.fogFront);
  const { bindTarget: bindShip, handle: shipHandle } = useSceneTargetRegistration(harborTargets.ship);
  const { bindTarget: bindTitle, handle: titleHandle } = useSceneTargetRegistration(harborTargets.title);
  const { bindTarget: bindArrivalCopyEyebrow, handle: arrivalCopyEyebrowHandle } = useSceneTargetRegistration(
    harborTargets.arrivalCopyEyebrow,
  );
  const { bindTarget: bindArrivalCopyBody, handle: arrivalCopyBodyHandle } = useSceneTargetRegistration(
    harborTargets.arrivalCopyBody,
  );
  const { bindTarget: bindArrivalActionPrimary, handle: arrivalActionPrimaryHandle } = useSceneTargetRegistration(
    harborTargets.arrivalActionPrimary,
  );
  const { bindTarget: bindArrivalActionRoles, handle: arrivalActionRolesHandle } = useSceneTargetRegistration(
    harborTargets.arrivalActionRoles,
  );
  const { bindTarget: bindNauticalBorder, handle: nauticalBorderHandle } = useSceneTargetRegistration(
    harborTargets.nauticalBorder,
  );
  const targetsReady = Boolean(
    skyHandle &&
      starsHandle &&
      moonHandle &&
      horizonHandle &&
      oceanHandle &&
      fogBackHandle &&
      fogFrontHandle &&
      shipHandle &&
      titleHandle &&
      arrivalCopyEyebrowHandle &&
      arrivalCopyBodyHandle &&
      arrivalActionPrimaryHandle &&
      arrivalActionRolesHandle &&
      nauticalBorderHandle,
  );

  useGSAP(
    () => {
      if (mode === "reduced") return;
      gsap.to("[data-ambient='lantern']", {
        rotate: mode === "full" ? 1.5 : 0.6,
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        transformOrigin: "50% 0%",
      });
    },
    { scope: root, dependencies: [mode], revertOnUpdate: true },
  );

  useEffect(() => {
    let mounted = true;
    void fetch("/api/gateway/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: GatewayStatus | null) => {
        if (!mounted) return;
        setStatus(value);
        if (value) {
          const entering = new Set<string>();
          for (const role of roles) {
            if (!value[role.id]?.authenticated) continue;
            const key = platformOneShotKey("remembered-session", role.id, value[role.id]?.continue?.href ?? "active");
            if (consumeOneShot(key)) entering.add(role.id);
          }
          setRememberedBadges(entering);
        }
      })
      .catch(() => {
        if (mounted) setStatus(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    let inView = true;
    let keyboardModality = false;
    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const updateAmbient = () => {
      host.dataset.ambientState = mode === "reduced" || document.hidden || !inView ? "paused" : "active";
    };
    const onVisibility = () => updateAmbient();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" || event.key.startsWith("Arrow")) {
        keyboardModality = true;
        host.dataset.inputModality = "keyboard";
        host.style.removeProperty("--harbor-parallax-x");
        host.style.removeProperty("--harbor-parallax-y");
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      keyboardModality = false;
      host.dataset.inputModality = "pointer";
      if (coarsePointer || mode === "reduced") return;
      const bounds = host.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5)) * 2;
      const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5)) * 2;
      host.style.setProperty("--harbor-parallax-x", keyboardModality ? "0" : x.toFixed(3));
      host.style.setProperty("--harbor-parallax-y", keyboardModality ? "0" : y.toFixed(3));
    };
    const onPointerLeave = () => {
      host.style.setProperty("--harbor-parallax-x", "0");
      host.style.setProperty("--harbor-parallax-y", "0");
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? true;
            updateAmbient();
          });
    observer?.observe(host);
    document.addEventListener("visibilitychange", onVisibility);
    host.addEventListener("keydown", onKeyDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    updateAmbient();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.style.removeProperty("--harbor-parallax-x");
      host.style.removeProperty("--harbor-parallax-y");
    };
  }, [mode]);

  useEffect(() => {
    if (!root.current || !sceneHost || !targetsReady) return;
    const presentationAbort = new AbortController();
    presentationAbortRef.current = presentationAbort;
    const key = "tall-tale-role-gateway";
    const scene =
      automaticSceneRef.current ?? (sessionStorage.getItem(key) === "seen" ? "session-reentry" : "first-arrival");
    automaticSceneRef.current = scene;
    if (scene === "first-arrival") sessionStorage.setItem(key, "seen");
    void director
      .play(scene, {
        root: root.current,
        queue: false,
        sceneHost,
        hostId: sceneHost.hostId,
        hostKind: sceneHost.kind,
        requestSource: "automatic",
        signal: presentationAbort.signal,
      })
      .then(reportNonPresentedReceipt)
      .catch(() => undefined)
      .finally(() => {
        if (presentationAbortRef.current === presentationAbort) presentationAbortRef.current = null;
      });
    return () => {
      presentationAbort.abort();
      presentationAbortRef.current?.abort();
      presentationAbortRef.current = null;
      director.cancel("gateway-unmounted");
    };
  }, [director, sceneHost, targetsReady]);

  function continuation(role: (typeof roles)[number]) {
    const current = status?.[role.id];
    return current?.authenticated && current.continue
      ? current.continue
      : { label: `Enter as ${role.title}`, href: role.href };
  }

  const replay = () => {
    if (!root.current || !sceneHost || !targetsReady) return;
    presentationAbortRef.current?.abort();
    const presentationAbort = new AbortController();
    presentationAbortRef.current = presentationAbort;
    void director
      .play("first-arrival", {
        root: root.current,
        queue: false,
        sceneHost,
        hostId: sceneHost.hostId,
        hostKind: sceneHost.kind,
        requestSource: "replay",
        signal: presentationAbort.signal,
      })
      .then(reportNonPresentedReceipt)
      .catch(() => undefined)
      .finally(() => {
        if (presentationAbortRef.current === presentationAbort) presentationAbortRef.current = null;
      });
  };

  return (
    <>
      <span ref={bindRootSentinel} hidden />
      <div ref={bindSky} className="harbor-sky" data-scene-part="sky" data-runtime-boundary="gsap" aria-hidden="true">
        <div ref={bindStars} className="star-field" data-scene-part="stars" data-runtime-boundary="gsap">
          {starStyles.map((style, index) => (
            <i key={index} style={style} />
          ))}
        </div>
        <div ref={bindMoon} className="moon-glow" data-scene-part="moon" data-runtime-boundary="gsap">
          <i />
        </div>
        <div ref={bindFogBack} className="distant-clouds" data-scene-part="fog-back" data-runtime-boundary="gsap" />
      </div>
      <div
        ref={bindHorizon}
        className="harbor-horizon"
        data-scene-part="horizon"
        data-runtime-boundary="gsap"
        aria-hidden="true"
      >
        <div ref={bindShip} className="harbor-ship-arrival-target" data-scene-part="ship" data-runtime-boundary="gsap">
          <div className="distant-ship" data-parallax-layer="ship">
            <i />
            <i />
          </div>
        </div>
      </div>
      <div ref={bindOcean} className="harbor-waves" data-scene-part="ocean" data-runtime-boundary="gsap">
        <LottieEffect asset={lottieAssets.moonlitWaves} mode={mode} label="Moonlight moving across the harbor" />
      </div>
      <div ref={bindFogFront} className="harbor-fog" data-scene-part="fog-front" data-runtime-boundary="gsap">
        <LottieEffect asset={lottieAssets.rollingFog} mode={mode} label="Fog rolling over the harbor" />
      </div>
      <div className="foreground-dock" aria-hidden="true">
        <span className="dock-rope" />
      </div>
      <div className="hanging-lantern" data-ambient="lantern" aria-hidden="true">
        <i />
      </div>
      <div
        ref={bindNauticalBorder}
        className="nautical-border"
        data-scene-part="nautical-border"
        data-runtime-boundary="gsap"
        aria-hidden="true"
      />

      <section className="harbor-content gateway-content" aria-labelledby={gatewayTitleId}>
        <p ref={bindArrivalCopyEyebrow} className="eyebrow" data-scene-part="arrival-copy" data-runtime-boundary="gsap">
          Voyagewright
        </p>
        <h1 ref={bindTitle} id={gatewayTitleId} data-scene-part="title" data-runtime-boundary="gsap">
          {platformCopy.chooseRole.value}
        </h1>
        <p ref={bindArrivalCopyBody} data-scene-part="arrival-copy" data-runtime-boundary="gsap">
          {platformCopy.brandIntroduction.value}
        </p>
        <div
          ref={bindArrivalActionPrimary}
          className="gateway-primary-actions"
          data-scene-part="arrival-action"
          data-runtime-boundary="gsap"
        >
          <Link className="brass-button" href="/tales">
            {platformCopy.exploreChronicles.value}
          </Link>
          <Link className="button-secondary" href="/player/sign-in#invitation-code">
            Join with an Invitation
          </Link>
        </div>
        <div className="landing-controls" aria-label="Opening presentation controls">
          <button onClick={replay} disabled={snapshot.isPlaying || !targetsReady || !sceneHost}>
            Replay presentation
          </button>
          {snapshot.isPlaying && snapshot.label !== "dark-sea" && (
            <button onClick={() => director.skip()}>Skip opening presentation</button>
          )}
          <button onClick={cycle} aria-label={`Motion: ${mode}. Change motion setting`}>
            {mode} motion
          </button>
        </div>
        <div
          ref={bindArrivalActionRoles}
          className="role-object-grid"
          aria-label="Voyagewright roles"
          aria-live="polite"
          data-scene-part="arrival-action"
          data-runtime-boundary="gsap"
        >
          {roles.map((role) => {
            const next = continuation(role);
            const current = status?.[role.id];
            const descriptionId = `${gatewayTitleId}-${role.id}`;
            return (
              <motion.article
                key={role.id}
                className={`role-object-card role-${role.id}`}
                data-role-selected={selectedRole === role.id ? "true" : undefined}
                data-role-softened={selectedRole && selectedRole !== role.id ? "true" : undefined}
                {...pressable(mode)}
              >
                <motion.div
                  className={`role-object ${role.object}`}
                  data-role-object={role.id}
                  layoutId={`role-object-${role.id}`}
                  aria-hidden="true"
                  {...roleObjectIntent(role.id, mode)}
                >
                  <i />
                  <b />
                  <span />
                </motion.div>
                <p
                  className={`card-kicker ${rememberedBadges.has(role.id) ? "remembered-badge-entering" : ""}`}
                  data-session-state={status ? (current?.authenticated ? "remembered" : "guest") : "loading"}
                >
                  {status ? (current?.authenticated ? "Signed in" : "Choose a role") : "Checking access..."}
                </p>
                <h2>{role.title}</h2>
                <p>{role.copy}</p>
                {role.id === "captain" && status?.captain.authenticated && (
                  <small>
                    {status.captain.waitingPlayers ?? 0} {status.captain.waitingPlayers === 1 ? "Player" : "Players"}{" "}
                    awaiting a Voyage
                  </small>
                )}
                {role.id === "creator" && status?.creator.authenticated && status.creator.recentDraft && (
                  <small>Recent draft: {status.creator.recentDraft.title}</small>
                )}
                <Link
                  className="role-entry"
                  href={next.href}
                  aria-describedby={descriptionId}
                  onClick={() => setSelectedRole(role.id)}
                >
                  {next.label}
                </Link>
                <span id={descriptionId} className="sr-only">
                  {role.copy}
                </span>
              </motion.article>
            );
          })}
        </div>
        <Link className="invitation-code-link" href="/player/sign-in#invitation-code">
          Have an invitation code?
        </Link>
      </section>
      <section className="gateway-explainer" aria-labelledby={explainerTitleId}>
        <header>
          <p className="eyebrow">Stories made to be played</p>
          <h2 id={explainerTitleId}>{platformCopy.chronicleExplainer.value}</h2>
          <p>
            {platformCopy.chronicleExplainerDetail.value} It can support a game night, celebration, trip, reunion, date,
            family adventure, or an entirely custom experience.
          </p>
        </header>
        <div className="gateway-how-grid">
          <article>
            <span aria-hidden="true">01</span>
            <h3>Choose a Chronicle</h3>
            <p>Browse published Chronicles and understand the time, group size, and premise before you begin.</p>
          </article>
          <article>
            <span aria-hidden="true">02</span>
            <h3>Gather participants</h3>
            <p>A Captain configures the voyage and sends each Player a private invitation link or short code.</p>
          </article>
          <article>
            <span aria-hidden="true">03</span>
            <h3>Continue your Voyage</h3>
            <p>
              The journal preserves live progress, reconnects safely, and keeps completed editions available to revisit.
            </p>
          </article>
        </div>
        <div className="gateway-trust-panel">
          <div>
            <p className="eyebrow">Designed around your group</p>
            <h3>Flexible by default, personal when you choose</h3>
            <p>
              System controls stay inclusive and reusable. Personal details belong only to the Chronicle, invitation, or
              customization your group selected.
            </p>
          </div>
          <ul aria-label="Experience examples">
            <li>Friends</li>
            <li>Families</li>
            <li>Celebrations</li>
            <li>Game nights</li>
            <li>Trips</li>
            <li>Custom events</li>
          </ul>
        </div>
      </section>
      <AnimationTestButton />
    </>
  );
}
