"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { pressable } from "@/animation/motion/variants";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { RiveStatefulObject } from "@/components/animation/RiveStatefulObject";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";

export function AccessGate({ campaignSlug }: { campaignSlug: string }) {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { director, snapshot } = useAnimationDirector();
  const { mode, cycle } = useMotionMode();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!root.current || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await director.play("player-access", {
        root: root.current,
        queue: false,
        operation: async () => {
          const response = await fetch("/api/player/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignSlug, accessCode: form.get("accessCode") }),
          });
          const data = (await response.json()) as { error?: string };
          if (!response.ok) throw new Error(data.error ?? "The invitation could not be recognized.");
          return data;
        },
      });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invitation could not be recognized.");
      window.requestAnimationFrame(() => input.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return (
    <main ref={root} className="access-scene" data-motion-mode={mode}>
      <div className="chart-room-table" aria-hidden="true">
        <i className="table-compass" />
        <i className="table-key" />
        <i className="table-coin" />
      </div>
      <LottieEffect
        asset={lottieAssets.moonlitWaves}
        mode={mode}
        label="Reflected tide light across the invitation table"
        className="access-tide-light"
      />
      <LottieEffect
        asset={lottieAssets.rollingFog}
        mode={mode}
        label="A restrained line of fog at the chart-room edge"
        className="access-edge-fog"
      />
      <div className="access-lantern" data-scene-part="lantern" data-gsap-owned aria-hidden="true">
        <i />
        <b />
      </div>
      <section className="access-card" data-scene-part="invitation" data-gsap-owned aria-labelledby="invitation-title">
        <div className="invitation-fold top" aria-hidden="true" />
        <div className="invitation-ribbon" data-scene-part="ribbon" data-gsap-owned aria-hidden="true" />
        <div className="wax-emblem" data-scene-part="seal" data-gsap-owned aria-hidden="true">
          <RiveStatefulObject asset={riveAssets.invitationSeal} mode={mode} label="Invitation wax seal" />
          <svg viewBox="0 0 120 120">
            <path
              data-seal-morph
              data-morph-to="M14 57C19 24 45 8 72 14c31 7 42 36 30 61-14 30-46 38-70 21C13 83 8 70 14 57z"
              d="M12 60C12 28 35 12 60 12s48 16 48 48-23 48-48 48S12 92 12 60z"
              fill="transparent"
            />
            <path data-scene-part="seal-crack" d="M59 28l-4 25 13 8-17 8 8 24M31 58l23-5M68 61l23-10" fill="none" />
          </svg>
        </div>
        <p className="recipient-line">For the sailor named by the moon</p>
        <p className="eyebrow">Private invitation</p>
        <h1 id="invitation-title">The journal knows its sailor</h1>
        <p>Speak the phrase tucked inside your invitation. Nothing beyond the seal has been sent to this page.</p>
        <form onSubmit={submit} data-scene-part="invitation-ink" data-gsap-owned>
          <label htmlFor="accessCode">Invitation phrase</label>
          <input
            ref={input}
            id="accessCode"
            name="accessCode"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            aria-describedby={error ? "access-error" : undefined}
          />
          <motion.button className="brass-button" disabled={busy} {...pressable(mode)}>
            {busy ? "Listening to the tide…" : "Open the journal"}
          </motion.button>
          {error && (
            <p id="access-error" className="form-error captain-note" role="alert">
              Captain&apos;s note: {error}
            </p>
          )}
        </form>
        {snapshot.phase === "await-server" && (
          <p className="access-listening" role="status">
            The seal is listening. The locked page remains closed.
          </p>
        )}
      </section>
      <div className="access-controls">
        <button onClick={cycle} aria-label={`Motion: ${mode}. Change motion setting`}>
          {mode} motion
        </button>
        {snapshot.isPlaying && <button onClick={() => director.skip()}>Skip nonessential motion</button>}
      </div>
      <AnimationTestButton />
    </main>
  );
}
