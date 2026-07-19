"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useOptionalMotionPolicyContext } from "@/animation/motion/MotionPolicyContext";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";

type StateAction =
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
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 900);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <motion.section
      className={`ui-state ui-loading-state ${compact ? "compact" : ""}`}
      data-async-state={slow ? "slow" : "pending"}
      role="status"
      aria-live="polite"
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
}: {
  title: string;
  detail: string;
  action?: StateAction;
  terminal?: boolean;
}) {
  const mode = useAsyncStateMotionMode();
  const stateMotion = resolvePlatformMotionToken("state", mode);
  const heading = useRef<HTMLHeadingElement>(null);
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
        <h2 ref={heading} tabIndex={terminal ? -1 : undefined}>
          {title}
        </h2>
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
}: {
  title: string;
  detail: string;
  action?: StateAction;
  symbol?: string;
}) {
  const mode = useAsyncStateMotionMode();
  const stateMotion = resolvePlatformMotionToken("state", mode);
  return (
    <motion.section
      className="ui-state ui-empty-state"
      data-async-state="idle"
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
