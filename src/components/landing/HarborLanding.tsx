"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { motion } from "motion/react";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { gsap } from "@/animation/core/gsap-client";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { pressable } from "@/animation/motion/variants";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";

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

const roles = [
  {
    id: "player",
    title: "Player",
    object: "journal",
    href: "/player/sign-in",
    copy: "Continue an adventure, accept an invitation, or revisit completed voyages.",
  },
  {
    id: "captain",
    title: "Captain",
    object: "wheel",
    href: "/captain/sign-in",
    copy: "Guide voyages, invite players, reveal clues, and control the journey.",
  },
  {
    id: "creator",
    title: "Creator",
    object: "quill",
    href: "/studio/sign-in",
    copy: "Create, test, publish, and preserve Tall Tales.",
  },
] as const;

export function HarborLanding() {
  const root = useRef<HTMLElement>(null);
  const { director, snapshot } = useAnimationDirector();
  const { mode, cycle } = useMotionMode();
  const [status, setStatus] = useState<GatewayStatus | null>(null);

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
      gsap.to("[data-role-object]", {
        y: mode === "full" ? -7 : -3,
        rotate: (index) => (index - 1) * 0.8,
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.28,
      });
    },
    { scope: root, dependencies: [mode], revertOnUpdate: true },
  );

  useEffect(() => {
    void fetch("/api/gateway/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: GatewayStatus | null) => setStatus(value))
      .catch(() => setStatus(null));
    if (!root.current) return;
    const key = "tall-tale-role-gateway";
    const scene = sessionStorage.getItem(key) === "seen" ? "session-reentry" : "first-arrival";
    sessionStorage.setItem(key, "seen");
    void director.play(scene, { root: root.current, queue: false }).catch(() => undefined);
    return () => director.cancel("gateway-unmounted");
  }, [director]);

  function continuation(role: (typeof roles)[number]) {
    const current = status?.[role.id];
    return current?.authenticated && current.continue
      ? current.continue
      : { label: `Enter as ${role.title}`, href: role.href };
  }

  const replay = () => {
    if (root.current) void director.play("first-arrival", { root: root.current, queue: false }).catch(() => undefined);
  };

  return (
    <main ref={root} className="harbor-landing role-gateway" data-motion-mode={mode}>
      <div className="harbor-sky" data-scene-part="sky" data-gsap-owned aria-hidden="true">
        <div className="star-field" data-scene-part="stars">
          {Array.from({ length: 28 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <div className="moon-glow" data-scene-part="moon" />
        <div className="distant-clouds" data-scene-part="fog-back" />
      </div>
      <div className="harbor-horizon" data-scene-part="horizon" data-gsap-owned aria-hidden="true">
        <div className="distant-ship" data-scene-part="ship">
          <i />
          <i />
        </div>
      </div>
      <LottieEffect
        asset={lottieAssets.moonlitWaves}
        mode={mode}
        label="Moonlight moving across the harbor"
        className="harbor-waves"
      />
      <LottieEffect
        asset={lottieAssets.rollingFog}
        mode={mode}
        label="Fog rolling over the harbor"
        className="harbor-fog"
      />
      <div className="foreground-dock" aria-hidden="true">
        <span className="dock-rope" />
      </div>
      <div className="hanging-lantern" data-ambient="lantern" data-gsap-owned aria-hidden="true">
        <i />
      </div>
      <div className="nautical-border" data-scene-part="nautical-border" data-gsap-owned aria-hidden="true" />

      <section className="harbor-content gateway-content" aria-labelledby="gateway-title">
        <p className="eyebrow" data-scene-part="arrival-copy" data-gsap-owned>
          The chart table is ready
        </p>
        <h1 id="gateway-title" data-scene-part="title" data-gsap-owned>
          Choose your place in the Tale
        </h1>
        <p data-scene-part="arrival-copy" data-gsap-owned>
          One living collection of adventures opens three different ways. Your choice opens a sign-in path; your account
          and voyage decide what you may see.
        </p>
        <div
          className="role-object-grid"
          aria-label="Tall Tale roles"
          aria-live="polite"
          data-scene-part="arrival-action"
          data-gsap-owned
        >
          {roles.map((role) => {
            const next = continuation(role);
            const current = status?.[role.id];
            return (
              <motion.article key={role.id} className={`role-object-card role-${role.id}`} {...pressable(mode)}>
                <div className={`role-object ${role.object}`} data-role-object data-gsap-owned aria-hidden="true">
                  <i />
                  <b />
                  <span />
                </div>
                <p className="card-kicker">{current?.authenticated ? "Session remembered" : "Adventure role"}</p>
                <h2>{role.title}</h2>
                <p>{role.copy}</p>
                {role.id === "captain" && status?.captain.authenticated && (
                  <small>
                    {status.captain.waitingPlayers ?? 0} {status.captain.waitingPlayers === 1 ? "Player" : "Players"}{" "}
                    awaiting launch
                  </small>
                )}
                {role.id === "creator" && status?.creator.authenticated && status.creator.recentDraft && (
                  <small>Recent draft: {status.creator.recentDraft.title}</small>
                )}
                <Link className="role-entry" href={next.href} aria-describedby={`role-${role.id}-description`}>
                  {next.label}
                </Link>
                <span id={`role-${role.id}-description`} className="sr-only">
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
      <div className="landing-controls" aria-label="Gateway presentation controls">
        <button onClick={replay} disabled={snapshot.isPlaying}>
          Replay gateway
        </button>
        {snapshot.isPlaying && snapshot.label !== "dark-sea" && (
          <button onClick={() => director.skip()}>Skip arrival</button>
        )}
        <button onClick={cycle} aria-label={`Motion: ${mode}. Change motion setting`}>
          {mode} motion
        </button>
      </div>
      <AnimationTestButton />
    </main>
  );
}
