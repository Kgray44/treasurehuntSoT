"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useOptionalMotionPolicyContext } from "@/animation/motion/MotionPolicyContext";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";

export type StateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

function StateActionControl({ action }: { action: StateAction }) {
  if (action.href)
    return (
      <Link className="brass-button" href={action.href}>
        {action.label}
      </Link>
    );
  return (
    <button className="brass-button" type="button" onClick={action.onClick}>
      {action.label}
    </button>
  );
}

function useAsyncStateMotionMode() {
  return useOptionalMotionPolicyContext()?.mode ?? "reduced";
}

export function LoadingState({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail?: string;
  compact?: boolean;
}) {
  const mode = useAsyncStateMotionMode();
  const stateMotion = resolvePlatformMotionToken("state", mode);
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const visibleTimer = window.setTimeout(() => setVisible(true), 500);
    const slowTimer = window.setTimeout(() => setSlow(true), 1_400);
    return () => {
      window.clearTimeout(visibleTimer);
      window.clearTimeout(slowTimer);
    };
  }, []);
  if (!visible)
    return (
      <span className="sr-only" role="status" aria-live="polite" aria-busy="true" data-async-state="pending-delay">
        {title}
      </span>
    );
  return (
    <motion.section
      className={`ui-state ui-loading-state ${compact ? "compact" : ""}`}
      data-async-state={slow ? "slow" : "pending"}
      role="status"
      aria-live="polite"
      aria-busy="true"
      initial={mode === "reduced" ? false : { opacity: 0, y: stateMotion.distancePx }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: stateMotion.durationSeconds, ease: platformMotionEasing("state") }}
    >
      <span className="ui-spinner" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        {detail && <p>{slow ? `${detail} This is taking longer than expected.` : detail}</p>}
      </div>
      <div className="ui-skeleton-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </motion.section>
  );
}

export function ErrorState({
  title,
  detail,
  action,
  terminal = false,
  primaryHeading = false,
}: {
  title: string;
  detail: string;
  action?: StateAction;
  terminal?: boolean;
  primaryHeading?: boolean;
}) {
  const mode = useAsyncStateMotionMode();
  const stateMotion = resolvePlatformMotionToken("state", mode);
  const heading = useRef<HTMLHeadingElement>(null);
  const Heading = primaryHeading ? "h1" : "h2";
  useEffect(() => {
    if (!terminal) return;
    const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [terminal]);
  return (
    <motion.section
      className="ui-state ui-error-state"
      data-async-state={terminal ? "terminal-error" : "recoverable-error"}
      role="alert"
      initial={mode === "reduced" ? false : { opacity: 0, x: stateMotion.distancePx }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: stateMotion.durationSeconds, ease: platformMotionEasing("state") }}
    >
      <span className="ui-state-symbol" aria-hidden="true">
        !
      </span>
      <div>
        <p className="eyebrow">Unable to continue</p>
        <Heading ref={heading} tabIndex={terminal ? -1 : undefined}>
          {title}
        </Heading>
        <p>{detail}</p>
      </div>
      {action && <StateActionControl action={action} />}
    </motion.section>
  );
}

export function EmptyState({
  title,
  detail,
  action,
  symbol = "✦",
  state = "empty",
}: {
  title: string;
  detail: string;
  action?: StateAction;
  symbol?: string;
  state?: "empty" | "no-results" | "archived-or-removed";
}) {
  const mode = useAsyncStateMotionMode();
  const stateMotion = resolvePlatformMotionToken("state", mode);
  return (
    <motion.section
      className="ui-state ui-empty-state"
      data-async-state={state}
      initial={mode === "reduced" ? false : { opacity: 0, y: stateMotion.distancePx }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: stateMotion.durationSeconds, ease: platformMotionEasing("state") }}
    >
      <span className="ui-state-symbol" aria-hidden="true">
        {symbol}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      {action && <StateActionControl action={action} />}
    </motion.section>
  );
}

export function NoResultsState({ title, detail, action }: { title: string; detail: string; action: StateAction }) {
  return <EmptyState title={title} detail={detail} action={action} symbol="⌕" state="no-results" />;
}

export function UnavailableState({
  title,
  detail,
  action,
  reference,
  primaryHeading = false,
}: {
  title: string;
  detail: string;
  action?: StateAction;
  reference?: string;
  primaryHeading?: boolean;
}) {
  const safeReference = reference?.replace(/[^a-zA-Z0-9_-]/gu, "").slice(0, 48);
  const Heading = primaryHeading ? "h1" : "h2";
  return (
    <section className="ui-state ui-unavailable-state" data-async-state="dependency-unavailable" role="alert">
      <span className="ui-state-symbol" aria-hidden="true">
        ≋
      </span>
      <div>
        <p className="eyebrow">Temporarily unavailable</p>
        <Heading>{title}</Heading>
        <p>{detail}</p>
        {safeReference ? <small>Reference: {safeReference}</small> : null}
      </div>
      {action ? <StateActionControl action={action} /> : null}
    </section>
  );
}

export function PermissionState({
  title,
  detail,
  action,
  restriction = "permission-restricted",
  primaryHeading = false,
}: {
  title: string;
  detail: string;
  action: StateAction;
  restriction?: "permission-restricted" | "account-restricted";
  primaryHeading?: boolean;
}) {
  const Heading = primaryHeading ? "h1" : "h2";
  return (
    <section className="ui-state ui-permission-state" data-async-state={restriction} role="alert">
      <span className="ui-state-symbol" aria-hidden="true">
        ◈
      </span>
      <div>
        <p className="eyebrow">Access boundary</p>
        <Heading>{title}</Heading>
        <p>{detail}</p>
      </div>
      <StateActionControl action={action} />
    </section>
  );
}

export function TokenState({
  state,
  title,
  detail,
  action,
  primaryHeading = false,
}: {
  state: "invalid" | "expired" | "consumed" | "revoked";
  title: string;
  detail: string;
  action: StateAction;
  primaryHeading?: boolean;
}) {
  const Heading = primaryHeading ? "h1" : "h2";
  return (
    <section className="ui-state ui-token-state" data-async-state={`token-${state}`} role="alert">
      <span className="ui-state-symbol" aria-hidden="true">
        ◇
      </span>
      <div>
        <p className="eyebrow">Secure link</p>
        <Heading>{title}</Heading>
        <p>{detail}</p>
      </div>
      <StateActionControl action={action} />
    </section>
  );
}

export function MutationStatus({
  state,
  children,
}: {
  state: "pending" | "success" | "failure" | "conflict" | "rate-limited";
  children: ReactNode;
}) {
  const assertive = state === "failure" || state === "conflict" || state === "rate-limited";
  return (
    <p
      className={`ui-mutation-status state-${state}`}
      data-mutation-state={state}
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
    >
      <span aria-hidden="true" />
      {children}
    </p>
  );
}

export function MediaFallback({
  label,
  detail,
  state = "missing",
}: {
  label: string;
  detail: string;
  state?: "missing" | "pending" | "quarantined" | "failed" | "removed";
}) {
  return (
    <span className="ui-media-fallback" data-media-state={state} role="img" aria-label={`${label}. ${detail}`}>
      <span aria-hidden="true">◇</span>
      <strong>{label}</strong>
      <small>{detail}</small>
    </span>
  );
}

export function StatusBanner({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  const mode = useAsyncStateMotionMode();
  const stateMotion = resolvePlatformMotionToken("state", mode);
  return (
    <motion.p
      className={`ui-status-banner tone-${tone}`}
      data-async-state={tone === "success" ? "success" : tone === "danger" ? "recoverable-error" : "idle"}
      role={tone === "danger" ? "alert" : "status"}
      initial={mode === "reduced" ? false : { opacity: 0, y: -stateMotion.distancePx }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: stateMotion.durationSeconds, ease: platformMotionEasing("state") }}
    >
      <span aria-hidden="true" />
      {children}
    </motion.p>
  );
}
