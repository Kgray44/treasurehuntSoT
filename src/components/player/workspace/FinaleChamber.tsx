"use client";

/* eslint-disable @next/next/no-img-element -- The mechanism SVG is a direct animation target. */

import { motion } from "motion/react";
import type { MotionMode } from "@/animation/core/animation-types";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import type { PublicSnapshot } from "@/domain/story";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { RiveStatefulObject } from "@/components/animation/RiveStatefulObject";

export function FinaleChamber({ snapshot, mode }: { snapshot: PublicSnapshot; mode: MotionMode }) {
  return (
    <section
      className="physical-section finale-chamber"
      aria-labelledby="finale-heading"
      data-section-heading
      tabIndex={-1}
    >
      <header className="section-masthead">
        <div>
          <p className="eyebrow">{snapshot.finale.state.replaceAll("_", " ")}</p>
          <h2 id="finale-heading">The Final Seal</h2>
        </div>
        <p>{snapshot.finale.teaser ?? "The inner chamber remains structurally present and safely unreadable."}</p>
      </header>
      <div className="celestial-chamber">
        <div className="constellation-field" aria-hidden="true">
          {Array.from({ length: 32 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <LottieEffect
          asset={lottieAssets.rollingFog}
          mode={mode}
          label="Celestial fog around the dormant finale mechanism"
          className="finale-fog"
        />
        <div className="finale-machine" data-gsap-owned>
          <img src="/illustrations/finale/celestial-mechanism.svg" alt="" aria-hidden="true" />
          <div className="finale-ring outer" data-scene-part="finale-ring-outer" data-gsap-owned aria-hidden="true" />
          <div className="finale-ring inner" data-scene-part="finale-ring-inner" data-gsap-owned aria-hidden="true" />
          <svg viewBox="0 0 640 640" aria-hidden="true">
            <path
              data-scene-part="finale-light-path"
              data-gsap-owned
              d="M320 66L500 140 574 320 500 500 320 574 140 500 66 320 140 140z"
            />
          </svg>
          <div className="finale-rive-contract">
            <RiveStatefulObject
              asset={riveAssets.finaleMechanism}
              mode={mode}
              label={`Finale mechanism, ${snapshot.finale.state.toLowerCase()}`}
            />
          </div>
        </div>
        <ul className="finale-requirements">
          {snapshot.finale.requirements.map((item) => (
            <motion.li layout key={item.key}>
              <div>
                <span>
                  {item.label}
                  {item.optional ? " · optional" : ""}
                </span>
                <strong>
                  {item.current} / {item.target}
                </strong>
              </div>
              <div className="socket-row" aria-label={`${item.current} of ${item.target}`}>
                {Array.from({ length: item.target }, (_, index) => (
                  <i key={index} className={index < item.current ? "lit" : ""} />
                ))}
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
