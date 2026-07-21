"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AnimatedProperty } from "@/animation/core/animation-types";
import { useAnimationDirector } from "@/animation/director/useAnimationDirector";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import type { SceneHostHandle } from "@/animation/hosts/scene-host-types";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import {
  useAuthoritativeAsyncState,
  type AuthoritativeAsyncRun,
} from "@/animation/platform/useAuthoritativeAsyncState";
import { PlatformRelic } from "./PlatformRelic";

type Invitation = {
  id: string;
  status: string;
  recipientName: string;
  expiresAt: string;
  requiresPin: boolean;
  playthrough: {
    id: string;
    voyageName: string;
    status: string;
    plannedStartAt: string | null;
    scheduleTimezone: string | null;
    versionLabel: string | null;
    tale: { title: string; subtitle: string | null; shortDescription: string | null; coverUrl: string | null } | null;
  };
};

type InvitationStage =
  | "resolving"
  | "valid"
  | "pin-required"
  | "pin-validating"
  | "account-required"
  | "invalid"
  | "expired"
  | "revoked"
  | "accepting"
  | "accepted"
  | "declining"
  | "declined"
  | "replacing"
  | "replaced"
  | "failed";

type InvitationActionResult = { ok: true; playthroughId?: string };
type InvitationRouteHandoff = (destination: string, signal: AbortSignal) => void | Promise<void>;

const accessFinalState = "access-result-readable";
const accessFallback = "readable-access-result";
const targetProperties = {
  invitation: ["transform"],
  "invitation-ink": ["filter", "opacity"],
  seal: ["transform", "filter"],
  ribbon: ["transform", "opacity"],
  "seal-crack": ["path-drawing", "stroke-dasharray", "stroke-dashoffset"],
} as const satisfies Readonly<Record<string, readonly AnimatedProperty[]>>;

const targetGeometry = {
  invitation: { position: "relative", display: "block", width: "min(650px, 94vw)", minHeight: "480px" },
  "invitation-ink": { position: "absolute", display: "block", inset: "44% 10% 12%" },
  seal: { position: "absolute", display: "block", top: "18%", left: "50%", width: "112px", height: "112px" },
  ribbon: { position: "absolute", display: "block", inset: "20% -6% auto", height: "42px" },
  "seal-crack": {},
} as const satisfies Readonly<Record<keyof typeof targetProperties, CSSProperties>>;

function InvitationTarget({
  as = "i",
  part,
  targetKey,
  children,
}: {
  as?: "div" | "i";
  part: keyof typeof targetProperties;
  targetKey: string;
  children?: React.ReactNode;
}) {
  const registration = useMemo(
    () => ({ targetKey, part, ownerHint: "gsap" as const, allowedProperties: targetProperties[part] }),
    [part, targetKey],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  return createElement(
    as,
    {
      ref: bindTarget,
      style: targetGeometry[part],
      "data-scene-part": part,
      "data-invitation-ceremony-part": part,
      "data-runtime-boundary": "gsap",
    },
    children,
  );
}

function SealCrack() {
  const registration = useMemo(
    () => ({
      targetKey: "invitation-ceremony:seal-crack",
      part: "seal-crack",
      ownerHint: "gsap" as const,
      allowedProperties: targetProperties["seal-crack"],
    }),
    [],
  );
  const { bindTarget } = useSceneTargetRegistration(registration);
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path
        ref={bindTarget}
        data-scene-part="seal-crack"
        data-runtime-boundary="gsap"
        d="M59 28l-4 25 13 8-17 8 8 24M31 58l23-5M68 61l23-10"
        fill="none"
      />
    </svg>
  );
}

function CeremonyHostBridge({
  mode,
  onReady,
}: {
  mode: ReturnType<typeof useMotionMode>["mode"];
  onReady: (host: SceneHostHandle) => void;
}) {
  const host = useOptionalSceneHost();
  useLayoutEffect(() => {
    if (host) onReady(host);
  }, [host, onReady]);
  return (
    <>
      <InvitationTarget as="div" part="invitation" targetKey="invitation-ceremony:sheet">
        <InvitationTarget part="invitation-ink" targetKey="invitation-ceremony:ink" />
        <InvitationTarget part="ribbon" targetKey="invitation-ceremony:ribbon" />
      </InvitationTarget>
      <InvitationTarget as="div" part="seal" targetKey="invitation-ceremony:seal">
        <PlatformRelic kind="invitation-seal" state="locked" mode={mode} />
        <SealCrack />
      </InvitationTarget>
    </>
  );
}

function stageFromCode(code: string | undefined, hasInvitation: boolean): InvitationStage {
  if (code === "EXPIRED") return "expired";
  if (code === "REVOKED") return "revoked";
  if (code === "REPLACED") return "replaced";
  if (code === "ACCOUNT_REQUIRED") return "account-required";
  if (code === "DECLINED") return "declined";
  if (code === "INVALID") return hasInvitation ? "pin-required" : "invalid";
  return "failed";
}

function TerminalInvitationState({
  stage,
  detail,
  retry,
}: {
  stage: Exclude<InvitationStage, "valid" | "pin-required" | "pin-validating" | "accepting" | "accepted" | "declining">;
  detail: string;
  retry: () => void;
}) {
  const title = {
    resolving: "Opening your invitation",
    "account-required": "Sign in to accept this invitation",
    invalid: "This invitation cannot be opened",
    expired: "This invitation has weathered away",
    revoked: "This invitation was locked by its Captain",
    declined: "Invitation declined",
    replacing: "Checking the replacement invitation",
    replaced: "This invitation has been replaced",
    failed: "The invitation could not be reached",
  }[stage];
  return (
    <motion.section
      key={stage}
      className={`platform-state-card invitation-state invitation-state-${stage}`}
      initial={{ opacity: 0, y: stage === "resolving" ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      aria-busy={stage === "resolving" || stage === "replacing"}
    >
      <h1 id="invitation-state-title" tabIndex={-1}>
        {title}
      </h1>
      <p>{detail}</p>
      <p className="platform-status" role="status" aria-live="polite">
        {title}
      </p>
      <div className="invitation-actions">
        {(stage === "failed" || stage === "replaced") && (
          <button className="brass-button" onClick={retry}>
            {stage === "replaced" ? "Check for replacement" : "Try again"}
          </button>
        )}
        {stage === "account-required" && (
          <Link className="brass-button" href="/player/sign-in">
            Sign in, then return here
          </Link>
        )}
        <Link className="button-subtle" href="/player/sign-in">
          Return to Player Entry
        </Link>
      </div>
    </motion.section>
  );
}

export function InvitationCeremony({ onRouteHandoff }: { onRouteHandoff?: InvitationRouteHandoff } = {}) {
  const router = useRouter();
  const search = useSearchParams();
  const root = useRef<HTMLElement>(null);
  const ceremonyHost = useRef<SceneHostHandle | null>(null);
  const resolveRun = useRef<AbortController | null>(null);
  const { director } = useAnimationDirector();
  const { mode } = useMotionMode();
  const asyncState = useAuthoritativeAsyncState(900);
  const invalidState = search.get("state") === "invalid";
  const [resolvedStage, setStage] = useState<InvitationStage>("resolving");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [csrf, setCsrf] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("Checking invitation status.");
  const [coverVisible, setCoverVisible] = useState(true);
  const stateToken = resolvePlatformMotionToken("state", mode);
  const ceremonyToken = resolvePlatformMotionToken("ceremony", mode);
  const stage: InvitationStage = invalidState ? "invalid" : resolvedStage;
  const visibleError = invalidState ? "This invitation is invalid or no longer available." : error;

  const resolveInvitation = useCallback(async (replacement = false) => {
    resolveRun.current?.abort("superseded");
    const controller = new AbortController();
    resolveRun.current = controller;
    setStage(replacement ? "replacing" : "resolving");
    setError("");
    try {
      const response = await fetch("/api/invitations/resolve", { cache: "no-store", signal: controller.signal });
      const body = (await response.json().catch(() => ({}))) as {
        invitation?: Invitation;
        csrfToken?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok || !body.invitation) {
        const next = stageFromCode(body.code, false);
        setStage(next);
        setError(body.error ?? "This invitation is not available.");
        setAnnouncement(body.error ?? "This invitation is not available.");
        return;
      }
      setInvitation(body.invitation);
      setCsrf(body.csrfToken ?? "");
      setDisplayName(body.invitation.recipientName);
      setCoverVisible(true);
      const next = body.invitation.requiresPin ? "pin-required" : "valid";
      setStage(next);
      setAnnouncement(
        body.invitation.requiresPin
          ? "Invitation found. Enter its PIN to continue."
          : "Invitation found and ready to accept.",
      );
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setStage("failed");
      setError("This invitation could not be reached. Check your connection and try again.");
      setAnnouncement("Invitation lookup failed.");
    } finally {
      if (resolveRun.current === controller) resolveRun.current = null;
    }
  }, []);

  useEffect(() => {
    if (invalidState) return;
    const timer = window.setTimeout(() => void resolveInvitation(), 0);
    return () => window.clearTimeout(timer);
  }, [invalidState, resolveInvitation]);

  useEffect(() => () => resolveRun.current?.abort("unmounted"), []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => document.getElementById("invitation-state-title")?.focus(),
      stateToken.durationMs + 20,
    );
    return () => window.clearTimeout(timer);
  }, [stage, stateToken.durationMs]);

  useEffect(() => {
    if (!invitation) return;
    const remaining = new Date(invitation.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(
      () => {
        setStage("expired");
        setAnnouncement("This invitation has expired.");
      },
      Math.min(Math.max(remaining, 0), 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [invitation]);

  async function handOffRoute(destination: string, signal: AbortSignal) {
    if (onRouteHandoff) return onRouteHandoff(destination, signal);
    router.push(destination);
    router.refresh();
  }

  function restoreFailure(run: AuthoritativeAsyncRun, message: string, code?: string) {
    if (!asyncState.fail(run)) return;
    const next = stageFromCode(code, Boolean(invitation));
    if (next === "pin-required") setPin("");
    setStage(next);
    setError(message);
    setAnnouncement(message);
  }

  async function act(action: "accept" | "decline") {
    if (!invitation || !root.current) return;
    if (action === "decline" && !window.confirm("Decline this invitation? The Captain will see your response.")) return;
    const run = asyncState.begin();
    if (!run) return;
    const pendingStage = action === "decline" ? "declining" : invitation.requiresPin ? "pin-validating" : "accepting";
    setStage(pendingStage);
    setError("");
    setAnnouncement(
      action === "decline" ? "Declining invitation." : "Validating invitation with the Captain's ledger.",
    );
    let operationError = `Unable to ${action} this invitation.`;
    let operationCode: string | undefined;
    let actionPromise: Promise<InvitationActionResult> | null = null;
    const submitAction = () => {
      actionPromise ??= (async () => {
        const response = await fetch(`/api/invitations/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify(action === "accept" ? { pin, displayName } : {}),
          signal: run.controller.signal,
        });
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          playthroughId?: string;
        };
        if (!response.ok || (action === "accept" && !body.playthroughId)) {
          operationError = body.error ?? operationError;
          operationCode = body.code;
          throw new Error("invitation-operation-rejected");
        }
        return { ok: true, playthroughId: body.playthroughId };
      })();
      return actionPromise;
    };

    try {
      if (action === "decline") {
        const result = await submitAction();
        if (!asyncState.succeed(run) || !result.ok) return;
        setStage("declined");
        setAnnouncement("Invitation declined. Returning to Player Entry.");
        await new Promise((resolve) => window.setTimeout(resolve, stateToken.durationMs));
        await handOffRoute("/player/sign-in", run.controller.signal);
        asyncState.release(run, "success");
        return;
      }
      if (!ceremonyHost.current) {
        restoreFailure(run, "The invitation ceremony is still preparing. Try again.");
        return;
      }
      let fallbackResult: InvitationActionResult | undefined;
      let fallbackReadable = false;
      const receipt = await director.play<InvitationActionResult>("player-access", {
        root: root.current,
        hostId: ceremonyHost.current.hostId,
        hostKind: ceremonyHost.current.kind,
        sceneHost: ceremonyHost.current,
        requestSource: "operation",
        eventOrActionId: invitation.id,
        queue: false,
        signal: run.controller.signal,
        operation: submitAction,
        finalStateRuntime: {
          holdSafePose: (semanticState) => {
            if (semanticState !== accessFinalState || run.controller.signal.aborted) return;
            setStage("accepted");
            setAnnouncement("Invitation accepted. Opening the waiting room.");
          },
          verifyReadableState: (semanticState) => semanticState === accessFinalState,
        },
        presentationFallback: async (context) => {
          if (context.fallback !== accessFallback || context.signal?.aborted)
            return { completed: false, readable: false };
          try {
            fallbackResult = await submitAction();
            setStage("accepted");
            setAnnouncement("Invitation accepted. Opening the waiting room.");
            fallbackReadable = true;
            return { completed: true, readable: true, semanticState: accessFinalState };
          } catch {
            return { completed: false, readable: false };
          }
        },
      });
      const result = receipt.operationResult ?? fallbackResult;
      const presented =
        result?.ok === true &&
        (receipt.outcome === "presented" ||
          receipt.outcome === "skipped-by-user" ||
          (receipt.outcome === "presented-fallback" && fallbackReadable));
      if (!presented || !result.playthroughId) {
        restoreFailure(run, operationError, operationCode);
        return;
      }
      if (!asyncState.succeed(run)) return;
      setStage("accepted");
      setAnnouncement("Invitation accepted. Opening the waiting room.");
      await handOffRoute(`/player/playthroughs/${result.playthroughId}`, run.controller.signal);
      asyncState.release(run, "success");
    } catch {
      restoreFailure(run, operationError, operationCode);
    }
  }

  const terminal =
    !invitation ||
    [
      "account-required",
      "invalid",
      "expired",
      "revoked",
      "declined",
      "replacing",
      "replaced",
      "failed",
      "resolving",
    ].includes(stage);
  if (terminal) {
    return (
      <main className="invitation-page" data-invitation-state={stage} data-motion-mode={mode}>
        <AnimatePresence mode="wait">
          <TerminalInvitationState
            stage={stage as Parameters<typeof TerminalInvitationState>[0]["stage"]}
            detail={visibleError || announcement}
            retry={() => void resolveInvitation(stage === "replaced")}
          />
        </AnimatePresence>
      </main>
    );
  }

  const tale = invitation.playthrough.tale;
  const relicState =
    stage === "accepted" ? "open" : stage === "pin-validating" || stage === "accepting" ? "accepting" : "valid";
  return (
    <main ref={root} className="invitation-page" data-invitation-state={stage} data-motion-mode={mode}>
      <SceneHost
        kind="access"
        hostKey={`invitation-ceremony:${invitation.id}`}
        className="invitation-cinematic-boundary"
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      >
        <CeremonyHostBridge mode={mode} onReady={(host) => (ceremonyHost.current = host)} />
      </SceneHost>
      <motion.section
        className="invitation-sheet"
        aria-labelledby="invitation-state-title"
        aria-busy={asyncState.busy}
        initial={{
          opacity: 0,
          rotateX: mode === "reduced" ? 0 : -8,
          clipPath: mode === "reduced" ? "inset(0)" : "inset(0 0 42% 0 round 18px)",
        }}
        animate={{ opacity: 1, rotateX: 0, clipPath: "inset(0 0 0% 0 round 18px)" }}
        transition={{ duration: stateToken.durationSeconds, ease: platformMotionEasing("state") }}
      >
        <div className="invitation-seal" aria-hidden="true">
          <PlatformRelic kind="invitation-seal" state={relicState} mode={mode} />
        </div>
        <div
          className="invitation-cover-frame"
          data-cover-state={coverVisible && tale?.coverUrl ? "image" : "fallback"}
        >
          {coverVisible && tale?.coverUrl ? (
            <motion.img
              className="invitation-cover"
              src={tale.coverUrl}
              alt=""
              onError={() => setCoverVisible(false)}
              initial={{ clipPath: mode === "reduced" ? "inset(0)" : "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: stateToken.durationSeconds, ease: platformMotionEasing("state") }}
            />
          ) : (
            <span aria-hidden="true">Charted voyage</span>
          )}
        </div>
        <p className="eyebrow">
          A Captain&apos;s invitation for{" "}
          <span className="invitation-handwritten-name">{invitation.recipientName}</span>
        </p>
        <h1 id="invitation-state-title" tabIndex={-1}>
          {tale?.title ?? "A Tall Tale awaits"}
        </h1>
        <h2>{invitation.playthrough.voyageName}</h2>
        <p>{tale?.shortDescription ?? "Your voyage is ready to join."}</p>
        <dl>
          <div>
            <dt>Edition</dt>
            <dd>{invitation.playthrough.versionLabel ?? "Published edition"}</dd>
          </div>
          <div>
            <dt>Invitation expires</dt>
            <dd>{new Date(invitation.expiresAt).toLocaleString()}</dd>
          </div>
          {invitation.playthrough.plannedStartAt && (
            <div>
              <dt>Planned start</dt>
              <dd>
                {new Date(invitation.playthrough.plannedStartAt).toLocaleString()}{" "}
                {invitation.playthrough.scheduleTimezone}
              </dd>
            </div>
          )}
        </dl>
        <label>
          <span>Your display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            disabled={asyncState.busy}
          />
        </label>
        {invitation.requiresPin && (
          <label>
            <span>Invitation PIN</span>
            <input
              aria-label="Invitation PIN"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              required
              disabled={asyncState.busy}
              aria-describedby="invitation-pin-progress"
            />
            <span id="invitation-pin-progress" className="pin-progress" aria-live="polite">
              {Array.from({ length: 4 }, (_, index) => (
                <i key={index} data-filled={index < pin.length} aria-hidden="true" />
              ))}
              <b className="sr-only">{Math.min(pin.length, 4)} PIN digits entered</b>
            </span>
          </label>
        )}
        {visibleError && (
          <p className="platform-error" role="alert">
            {visibleError}
          </p>
        )}
        <AnimatePresence mode="wait">
          <motion.p
            key={stage}
            className="platform-status invitation-live-state"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {stage === "accepted" ? "Invitation accepted. The seal is open." : announcement}
          </motion.p>
        </AnimatePresence>
        <div className="invitation-actions">
          <button
            className="brass-button"
            disabled={asyncState.busy || stage === "accepted" || !displayName || (invitation.requiresPin && !pin)}
            aria-busy={asyncState.busy}
            onClick={() => void act("accept")}
          >
            {stage === "pin-validating"
              ? "Validating PIN…"
              : stage === "accepting"
                ? "Joining voyage…"
                : stage === "accepted"
                  ? "Invitation accepted"
                  : "Accept and Join Voyage"}
          </button>
          <button className="button-subtle" disabled={asyncState.busy} onClick={() => void act("decline")}>
            Decline Invitation
          </button>
        </div>
      </motion.section>
      {stage === "accepted" && (
        <span
          className="invitation-route-hold"
          style={{ "--hold-ms": `${ceremonyToken.durationMs}ms` } as CSSProperties}
          aria-hidden="true"
        />
      )}
    </main>
  );
}
