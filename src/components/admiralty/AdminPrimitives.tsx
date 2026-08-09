import Link from "next/link";
import type { AdmiraltyEvidence, AdmiraltyOperationalState } from "@/admiralty/read-models";
import { CopyIdentifier } from "./CopyIdentifier";

export function ChartroomPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="chartroom-page">
      <header className="chartroom-heading">
        <div>
          <p className="chartroom-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="chartroom-heading__actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function StatusBadge({ state }: { state: AdmiraltyOperationalState | string }) {
  return (
    <span className="chartroom-status" data-state={state}>
      {humanize(state)}
    </span>
  );
}

export function EvidenceStrip({ evidence }: { evidence: AdmiraltyEvidence }) {
  return (
    <dl className="chartroom-evidence">
      <div>
        <dt>Source</dt>
        <dd>{evidence.source}</dd>
      </div>
      <div>
        <dt>Observed</dt>
        <dd>{dateTime(evidence.observedAt)}</dd>
      </div>
      <div>
        <dt>Freshness</dt>
        <dd>{humanize(evidence.freshness)}</dd>
      </div>
      <div>
        <dt>Environment</dt>
        <dd>{evidence.environment}</dd>
      </div>
      {evidence.safeError ? (
        <div>
          <dt>Safe error</dt>
          <dd>{evidence.safeError}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function Panel({
  title,
  kicker,
  actions,
  children,
  className = "",
}: {
  title: string;
  kicker?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`chartroom-panel ${className}`.trim()}>
      <header className="chartroom-panel__heading">
        <div>
          {kicker ? <p className="chartroom-eyebrow">{kicker}</p> : null}
          <h2>{title}</h2>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  detail,
  state,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  state?: string;
}) {
  return (
    <article className="chartroom-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {state ? <StatusBadge state={state} /> : null}
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export function EmptyState({
  title = "No evidence recorded",
  detail = "This source returned no matching records.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="chartroom-empty">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function SearchForm({
  value,
  placeholder,
  label = "Search",
  extra,
}: {
  value?: string;
  placeholder: string;
  label?: string;
  extra?: React.ReactNode;
}) {
  return (
    <form className="chartroom-search" method="get">
      <label htmlFor="chartroom-query">{label}</label>
      <div>
        <input
          id="chartroom-query"
          name="q"
          defaultValue={value}
          minLength={2}
          maxLength={96}
          placeholder={placeholder}
        />
        {extra}
        <button type="submit">Search</button>
      </div>
      <small>Enter at least two characters. Results are bounded and never become a directory export.</small>
    </form>
  );
}

export function Identifier({ value, label }: { value: string; label?: string }) {
  return <CopyIdentifier value={value} label={label} />;
}

export function DetailList({ items }: { items: readonly { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="chartroom-details">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? "Not available"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="chartroom-link" href={href}>
      {children}
    </Link>
  );
}

export function dateTime(value: Date | string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "No data recorded";
}

export function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLocaleLowerCase("en-US")
    .replace(/^./u, (letter) => letter.toLocaleUpperCase("en-US"));
}
