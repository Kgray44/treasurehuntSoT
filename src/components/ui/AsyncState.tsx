import Link from "next/link";

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

export function LoadingState({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <section className={`ui-state ui-loading-state ${compact ? "compact" : ""}`} role="status" aria-live="polite">
      <span className="ui-spinner" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      <div className="ui-skeleton-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}

export function ErrorState({ title, detail, action }: { title: string; detail: string; action?: StateAction }) {
  return (
    <section className="ui-state ui-error-state" role="alert">
      <span className="ui-state-symbol" aria-hidden="true">
        !
      </span>
      <div>
        <p className="eyebrow">Unable to continue</p>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      {action && <StateActionControl action={action} />}
    </section>
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
  return (
    <section className="ui-state ui-empty-state">
      <span className="ui-state-symbol" aria-hidden="true">
        {symbol}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      {action && <StateActionControl action={action} />}
    </section>
  );
}

export function StatusBanner({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <p className={`ui-status-banner tone-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <span aria-hidden="true" />
      {children}
    </p>
  );
}
