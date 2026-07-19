"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion } from "motion/react";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { pressable } from "@/animation/motion/variants";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { RiveStatefulObject } from "@/components/animation/RiveStatefulObject";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";

const accessHostId = "legacy-player-access";
const accessHostKind = "access";
const accessFinalState = "access-result-readable";
const accessFallback = "readable-access-result";
const genericAccessError = "The invitation could not be recognized.";
const presentationAccessError = "The invitation could not be opened safely. Please try again.";
const accessSuccessStatus = "Invitation accepted. Opening the journal.";

type AccessOperationResult = { ok: true };

export function AccessGate({ campaignSlug }: { campaignSlug: string }) {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const fallbackStatus = useRef<HTMLParagraphElement>(null);
  const submitRun = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const { director, snapshot } = useAnimationDirector();
  const { mode, cycle } = useMotionMode();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      submitRun.current?.abort();
    };
  }, []);

  function publishReadableStatus(message: string) {
    if (!mounted.current) return false;
    flushSync(() => setStatus(message));
    const rendered = fallbackStatus.current;
    return (
      Boolean(rendered?.isConnected) &&
      rendered?.getAttribute("role") === "status" &&
      rendered.textContent?.trim() === message
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!root.current || busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    const form = new FormData(event.currentTarget);
    const controller = new AbortController();
    submitRun.current = controller;
    let operationError = genericAccessError;
    let authentication: Promise<AccessOperationResult> | null = null;
    let fallbackOperationResult: AccessOperationResult | undefined;
    let fallbackVerified = false;
    let fallbackOperationFailed = false;
    const authenticate = () => {
      authentication ??= (async () => {
        const response = await fetch("/api/player/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignSlug, accessCode: form.get("accessCode") }),
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as { ok?: unknown; error?: unknown };
        if (!response.ok) {
          operationError = typeof data.error === "string" && data.error.trim() ? data.error : genericAccessError;
          throw new Error("access-operation-rejected");
        }
        if (data.ok !== true) {
          operationError = genericAccessError;
          throw new Error("access-operation-invalid-response");
        }
        return { ok: true } as const;
      })();
      return authentication;
    };
    try {
      const receipt = await director.play<AccessOperationResult>("player-access", {
        root: root.current,
        hostId: accessHostId,
        hostKind: accessHostKind,
        requestSource: "operation",
        queue: false,
        signal: controller.signal,
        operation: authenticate,
        presentationFallback: async (context) => {
          if (
            context.hostId !== accessHostId ||
            context.hostKind !== accessHostKind ||
            context.fallback !== accessFallback ||
            context.signal?.aborted
          ) {
            return { completed: false, readable: false, reason: "access-fallback-context-rejected" };
          }
          try {
            fallbackOperationResult = await authenticate();
            fallbackVerified = publishReadableStatus(accessSuccessStatus);
            return fallbackVerified
              ? { completed: true, readable: true, semanticState: accessFinalState }
              : { completed: false, readable: false, reason: "access-fallback-not-readable" };
          } catch {
            fallbackOperationFailed = true;
            return { completed: false, readable: false, reason: "access-fallback-operation-failed" };
          }
        },
      });

      const operationPresented =
        (receipt.outcome === "presented" || receipt.outcome === "skipped-by-user") &&
        receipt.operationResult?.ok === true &&
        receipt.finalSemanticState === accessFinalState;
      const approvedFallbackPresented =
        receipt.outcome === "presented-fallback" &&
        receipt.fallbackUsed === accessFallback &&
        receipt.finalSemanticState === accessFinalState &&
        fallbackVerified &&
        fallbackOperationResult?.ok === true;

      if (operationPresented || approvedFallbackPresented) {
        if (!approvedFallbackPresented) publishReadableStatus(accessSuccessStatus);
        router.refresh();
      } else if (mounted.current && !controller.signal.aborted) {
        setError(
          receipt.outcome === "runtime-failed" || fallbackOperationFailed ? operationError : presentationAccessError,
        );
        window.requestAnimationFrame(() => input.current?.focus());
      }
    } catch {
      if (mounted.current && !controller.signal.aborted) {
        setError(operationError);
        window.requestAnimationFrame(() => input.current?.focus());
      }
    } finally {
      if (submitRun.current === controller) submitRun.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <main ref={root} className="access-scene" data-motion-mode={mode} data-scene-host-id={accessHostId}>
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
          {status && (
            <p ref={fallbackStatus} className="access-fallback-status" role="status" aria-live="polite">
              {status}
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
