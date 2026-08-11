"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { ValidationIssue } from "@/chronicle/types";

type ValidationResult = { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[]; checkedAt?: string };

function readableField(field?: string) {
  if (!field) return "this Passage";
  return field.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function issueHeading(issue: ValidationIssue, blocking: boolean) {
  return blocking
    ? `Blocks publishing: ${readableField(issue.field)}`
    : `Needs attention: ${readableField(issue.field)}`;
}

export function StudioValidationPanel({
  result,
  onClose,
  onFocusIssue,
  children,
}: {
  result: ValidationResult;
  onClose: () => void;
  onFocusIssue: (issue: ValidationIssue, origin: HTMLElement) => void;
  children?: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const moving = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!moving.current || !panel.current) return;
      const width = panel.current.offsetWidth;
      const height = panel.current.offsetHeight;
      setPosition({
        left: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - moving.current.offsetX)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - moving.current.offsetY)),
      });
    };
    const stop = () => {
      moving.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, []);

  const startMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    const rect = panel.current?.getBoundingClientRect();
    if (!rect) return;
    moving.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    setPosition({ left: rect.left, top: rect.top });
  };

  const groups = [
    {
      title: "Blocks publishing",
      detail: "Resolve these before this Chronicle can be published.",
      issues: result.errors,
      blocking: true,
    },
    {
      title: "Needs attention",
      detail: "These do not block publication, but they still need a deliberate Creator decision or repair.",
      issues: result.warnings,
      blocking: false,
    },
  ].filter((group) => group.issues.length);

  return (
    <aside
      ref={panel}
      className={`validation-panel ${result.valid ? "valid" : "invalid"}`}
      aria-label="Chronicle validation results"
      role="region"
      style={position ? { left: position.left, top: position.top, right: "auto" } : undefined}
    >
      <header className="validation-panel__drag-region" onPointerDown={startMove}>
        <div>
          <p className="eyebrow">Validation results</p>
          <h2>
            {result.valid
              ? "Ready to publish"
              : `${result.errors.length} issue${result.errors.length === 1 ? "" : "s"} need attention`}
          </h2>
          <p className="validation-panel__hint">
            Drag this header to move the panel. Use its lower-right corner to resize it.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close validation results">
          Close
        </button>
      </header>
      {result.valid && !result.warnings.length ? (
        <p className="validation-panel__success">No current validation findings were returned.</p>
      ) : null}
      {groups.map((group) => (
        <section
          key={group.title}
          className={group.blocking ? "validation-group blocking" : "validation-group warning"}
        >
          <h3>{group.title}</h3>
          <p>{group.detail}</p>
          {group.issues.map((issue, index) => (
            <button
              type="button"
              className="validation-issue"
              key={`${issue.code}-${issue.blockId ?? "chronicle"}-${issue.field ?? "general"}-${index}`}
              data-drydock-rule-code={issue.code}
              onClick={(event) => onFocusIssue(issue, event.currentTarget)}
            >
              <span>{issueHeading(issue, group.blocking)}</span>
              <strong>{issue.message}</strong>
              <small>
                {issue.blockId
                  ? `Open the affected Passage${issue.field ? ` and ${readableField(issue.field)}` : ""}`
                  : "This Chronicle-level finding has no single Passage target."}
              </small>
              {issue.remediation ? <small>{issue.remediation}</small> : null}
              <em>Rule {issue.code}</em>
            </button>
          ))}
        </section>
      ))}
      {children}
    </aside>
  );
}
