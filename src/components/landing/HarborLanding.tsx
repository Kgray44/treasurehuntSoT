"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { motion } from "motion/react";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { gsap } from "@/animation/core/gsap-client";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { pressable } from "@/animation/motion/variants";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { RiveStatefulObject } from "@/components/animation/RiveStatefulObject";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";

export function HarborLanding() {
  const root = useRef<HTMLElement>(null);
  const { director, snapshot } = useAnimationDirector();
  const { mode, cycle } = useMotionMode();

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
      gsap.to("[data-ambient='stars']", {
        opacity: 0.72,
        duration: 3.6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.18,
      });
    },
    { scope: root, dependencies: [mode], revertOnUpdate: true },
  );

  useEffect(() => {
    if (!root.current) return;
    const key = "forever-harbor-arrival";
    const scene = sessionStorage.getItem(key) === "seen" ? "session-reentry" : "first-arrival";
    sessionStorage.setItem(key, "seen");
    void director.play(scene, { root: root.current, queue: false }).catch(() => undefined);
    return () => director.cancel("landing-unmounted");
  }, [director]);

  const replay = () => {
    if (!root.current) return;
    void director.play("first-arrival", { root: root.current, queue: false }).catch(() => undefined);
  };

  return (
    <main ref={root} className="harbor-landing" data-motion-mode={mode}>
      <div className="harbor-sky" data-scene-part="sky" data-gsap-owned aria-hidden="true">
        <div className="star-field" data-scene-part="stars">
          {Array.from({ length: 28 }, (_, index) => (
            <i key={index} data-ambient="stars" />
          ))}
        </div>
        <div className="moon-glow" data-scene-part="moon" />
        <div className="distant-clouds" data-scene-part="fog-back" />
      </div>
      <div className="harbor-horizon" data-scene-part="horizon" data-gsap-owned aria-hidden="true">
        <div className="distant-ship" data-scene-part="ship">
          <i />
          <i />
          <span />
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
        <i />
        <i />
        <span className="dock-rope" />
      </div>
      <div
        className="hanging-lantern"
        data-scene-part="lantern"
        data-ambient="lantern"
        data-gsap-owned
        aria-hidden="true"
      >
        <i />
        <b />
      </div>
      <div className="nautical-border" data-scene-part="nautical-border" data-gsap-owned aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <section className="harbor-content" aria-labelledby="harbor-title">
        <div className="landing-emblem" data-scene-part="emblem" data-gsap-owned>
          <RiveStatefulObject asset={riveAssets.voyageCompass} mode={mode} label="Sealed voyage compass" />
        </div>
        <p className="eyebrow" data-scene-part="arrival-copy" data-gsap-owned>
          A private voyage waits beyond the fog
        </p>
        <h1 id="harbor-title" data-scene-part="title" data-gsap-owned>
          The Forever Treasure
        </h1>
        <p data-scene-part="arrival-copy" data-gsap-owned>
          A moonlit journal, an unfinished chart, and a collection of quiet mysteries are prepared for the sailor
          carrying the captain&apos;s invitation.
        </p>
        <motion.div className="harbor-actions" data-scene-part="arrival-action" data-gsap-owned {...pressable(mode)}>
          <Link className="brass-button" href="/tale/development-forever-treasure">
            Follow the invitation
          </Link>
          <Link href="/tales">Browse published Tall Tales</Link>
        </motion.div>
      </section>
      <div className="landing-controls">
        <button onClick={replay} disabled={snapshot.isPlaying}>
          Replay arrival
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
