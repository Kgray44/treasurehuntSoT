import type { ReactNode } from "react";
import { responsiveRecompositionStrategies } from "@/brightwork/responsive-recomposition";

export function TechnicalDetails({
  summary = "Technical details",
  description,
  children,
  open = false,
}: {
  summary?: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      className="ui-technical-details"
      data-information-level="technical"
      data-responsive-recomposition={responsiveRecompositionStrategies.summaryToDetail}
      open={open}
    >
      <summary>{summary}</summary>
      {description ? <p className="ui-technical-details__description">{description}</p> : null}
      <div className="ui-technical-details__content">{children}</div>
    </details>
  );
}
