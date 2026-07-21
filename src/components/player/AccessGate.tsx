"use client";

import { useRouter } from "next/navigation";
import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { motion } from "motion/react";
import type { AnimatedProperty, MotionMode } from "@/animation/core/animation-types";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { SceneHostHandle } from "@/animation/hosts/scene-host-types";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { pressable } from "@/animation/motion/variants";
import { LottieEffect } from "@/components/animation/LottieEffect";
import { RiveStatefulObject } from "@/components/animation/RiveStatefulObject";
import { AnimationTestButton } from "@/components/dev/AnimationTestButton";
import { platformCopy } from "@/language/platform-copy";

const accessFinalState = "access-result-readable";
const accessFallback = "readable-access-result";
const genericAccessError = "This invitation could not be confirmed. Check the phrase, then try again.";
const presentationAccessError = "The invitation could not be confirmed safely. Your access has not changed. Try again.";
const accessSuccessStatus = `${platformCopy.invitationAccepted.value} Opening your Voyage Journal.`;
const accessTargetProperties = {
  invitation: ["transform"],
  "invitation-ink": ["filter", "opacity"],
  seal: ["transform", "filter"],
  ribbon: ["transform", "opacity"],
  "seal-crack": ["path-drawing", "stroke-dasharray", "stroke-dashoffset"],
  lantern: ["transform", "opacity"],
} as const satisfies Readonly<Record<string, readonly AnimatedProperty[]>>;

const accessTargetGeometry = {
  invitation: {
    position: "relative",
    display: "block",
    width: "min(650px, 95vw)",
    minHeight: "520px",
    boxSizing: "border-box",
    transformStyle: "preserve-3d",
  },
  "invitation-ink": {
    position: "absolute",
    display: "block",
    inset: "46% 9% 12%",
    minWidth: "1px",
    minHeight: "1px",
    background: "linear-gradient(90deg, transparent, rgba(121, 215, 207, 0.09), transparent)",
  },
  seal: {
    position: "absolute",
    display: "block",
    top: "12%",
    left: "50%",
    width: "112px",
    height: "112px",
    transform: "translate(-50%, -50%)",
  },
  ribbon: {
    position: "absolute",
    display: "block",
    inset: "12% -7% auto",
    minWidth: "1px",
    height: "44px",
  },
  "seal-crack": {},
  lantern: {
    position: "absolute",
    display: "block",
    top: 0,
    right: "14%",
    width: "94px",
    height: "190px",
  },
} as const satisfies Readonly<Record<keyof typeof accessTargetProperties, CSSProperties>>;

type AccessOperationResult = { ok: true };
type AccessState = "idle" | "pending" | "accepted" | "rejected";
type AccessRouteHandoff = (signal: AbortSignal) => void | Promise<void>;

function AccessTarget({
  as = "div",
  part,
  targetKey,
  className,
  children,
}: {
  as?: "div" | "i";
  part: keyof typeof accessTargetProperties;
  targetKey: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const registration = useMemo(
    () => ({ targetKey, part, ownerHint: "gsap" as const, allowedProperties: accessTargetProperties[part] }),
    [part, targetKey],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  return createElement(
    as,
    {
      ref: bindTarget,
      className,
      style: accessTargetGeometry[part],
      "data-access-cinematic-part": part,
      "data-access-cinematic-geometry": part,
      "data-runtime-boundary": "gsap",
      // player-access remains on the bounded v1 adapter until its builder migrates.
      "data-scene-part": part,
    },
    children,
  );
}

function AccessSealCrackTarget() {
  const registration = useMemo(
    () => ({
      targetKey: "access:seal-crack",
      part: "seal-crack",
      ownerHint: "gsap" as const,
      allowedProperties: accessTargetProperties["seal-crack"],
    }),
    [],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  return (
    <svg viewBox="0 0 120 120">
      <path
        data-seal-morph
        data-morph-to="M14 57C19 24 45 8 72 14c31 7 42 36 30 61-14 30-46 38-70 21C13 83 8 70 14 57z"
        d="M12 60C12 28 35 12 60 12s48 16 48 48-23 48-48 48S12 92 12 60z"
        fill="transparent"
      />
      <path
        ref={bindTarget}
        data-access-cinematic-part="seal-crack"
        data-access-cinematic-geometry="seal-crack"
        data-runtime-boundary="gsap"
        data-scene-part="seal-crack"
        d="M59 28l-4 25 13 8-17 8 8 24M31 58l23-5M68 61l23-10"
        fill="none"
      />
    </svg>
  );
}

function AccessHostBridge({ onReady, mode }: { onReady: (host: SceneHostHandle) => void; mode: MotionMode }) {
  const host = useOptionalSceneHost();
  useLayoutEffect(() => {
    if (host) onReady(host);
  }, [host, onReady]);
  return (
    <>
      <AccessTarget part="invitation" targetKey="access:invitation" className="access-invitation-cinematic">
        <AccessTarget as="i" part="invitation-ink" targetKey="access:invitation-ink" />
        <AccessTarget as="i" part="ribbon" targetKey="access:ribbon" className="invitation-ribbon" />
      </AccessTarget>
      <AccessTarget part="seal" targetKey="access:seal" className="wax-emblem">
        <RiveStatefulObject asset={riveAssets.invitationSeal} mode={mode} label="Invitation wax seal" />
        <AccessSealCrackTarget />
      </AccessTarget>
      <AccessTarget part="lantern" targetKey="access:lantern" className="access-lantern">
        <i />
        <b />
      </AccessTarget>
    </>
  );
}

export function AccessGate({
  campaignSlug,
  onRouteHandoff,
}: {
  campaignSlug: string;
  onRouteHandoff?: AccessRouteHandoff;
}) {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const fallbackStatus = useRef<HTMLParagraphElement>(null);
  const submitRun = useRef<AbortController | null>(null);
  const accessHost = useRef<SceneHostHandle | null>(null);
  const operationSequence = useRef(0);
  const mounted = useRef(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>("idle");
  const [operationKey, setOperationKey] = useState(0);
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

  async function handOffRoute(signal: AbortSignal) {
    if (onRouteHandoff) return onRouteHandoff(signal);
    router.refresh();
  }

  function restoreInteractiveFailure(controller: AbortController, message: string) {
    if (!mounted.current || controller.signal.aborted || submitRun.current !== controller) return;
    submitRun.current = null;
    setBusy(false);
    setStatus("");
    setError(message);
    setAccessState("rejected");
    window.requestAnimationFrame(() => input.current?.focus());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!root.current || !accessHost.current || submitRun.current) return;
    const nextOperation = operationSequence.current + 1;
    operationSequence.current = nextOperation;
    setOperationKey(nextOperation);
    setBusy(true);
    setError("");
    setStatus("");
    setAccessState("pending");
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
        hostId: accessHost.current.hostId,
        hostKind: accessHost.current.kind,
        sceneHost: accessHost.current,
        requestSource: "operation",
        queue: false,
        signal: controller.signal,
        operation: authenticate,
        finalStateRuntime: {
          holdSafePose: (semanticState) => {
            if (semanticState !== accessFinalState || controller.signal.aborted) return;
            setAccessState("accepted");
            publishReadableStatus(accessSuccessStatus);
          },
          verifyReadableState: (semanticState) =>
            semanticState === accessFinalState &&
            fallbackStatus.current?.textContent?.trim() === accessSuccessStatus &&
            fallbackStatus.current?.getAttribute("role") === "status",
        },
        presentationFallback: async (context) => {
          if (
            context.hostId !== accessHost.current?.hostId ||
            context.hostKind !== accessHost.current?.kind ||
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
        setAccessState("accepted");
        if (!approvedFallbackPresented) publishReadableStatus(accessSuccessStatus);
        try {
          await handOffRoute(controller.signal);
        } catch {
          restoreInteractiveFailure(
            controller,
            "Invitation accepted, but the Voyage Journal could not be opened. Your access is preserved. Try again.",
          );
        }
      } else if (mounted.current && !controller.signal.aborted) {
        restoreInteractiveFailure(
          controller,
          receipt.outcome === "runtime-failed" || fallbackOperationFailed ? operationError : presentationAccessError,
        );
      }
    } catch {
      if (mounted.current && !controller.signal.aborted) {
        restoreInteractiveFailure(controller, operationError);
      }
    } finally {
      // A successful accepted pose remains held and single-flight until route unmount.
      if (submitRun.current === controller && (!mounted.current || controller.signal.aborted)) submitRun.current = null;
    }
  }

  return (
    <main
      ref={root}
      className="access-scene"
      data-motion-mode={mode}
      data-access-state={accessState}
      data-access-operation={operationKey}
    >
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
      <SceneHost
        kind="access"
        hostKey={`legacy-player-access:${campaignSlug}`}
        className="access-cinematic-boundary"
        data-access-cinematic-geometry="host"
        aria-hidden="true"
        style={{
          position: "absolute",
          zIndex: 11,
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <AccessHostBridge onReady={(host) => (accessHost.current = host)} mode={mode} />
      </SceneHost>
      <section className="access-card" aria-labelledby="invitation-title">
        <p className="eyebrow">Private invitation</p>
        <h1 id="invitation-title">Confirm your invitation</h1>
        <p>
          Enter the phrase provided by your Captain. This Chronicle remains unavailable until the phrase is confirmed.
        </p>
        <form onSubmit={submit} aria-busy={busy}>
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
            {busy ? "Confirming invitation…" : "Confirm invitation"}
          </motion.button>
          {error && (
            <p id="access-error" className="form-error captain-note" role="alert">
              {error}
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
            Confirming your invitation. This page remains protected.
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
