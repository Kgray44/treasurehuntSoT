import { EmptyState } from "./AdminPrimitives";

export const projectionSearchResultsId = "chartroom-search-results";

export function ProjectionSearchForm({
  value,
  label,
  placeholder,
}: {
  value: string;
  label: string;
  placeholder: string;
}) {
  return (
    <form className="chartroom-search" method="get" action={`#${projectionSearchResultsId}`}>
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
        <button type="submit">Search</button>
      </div>
      <small>Enter at least two characters. Results are bounded and never become a directory export.</small>
    </form>
  );
}

export function ProjectionSearchEmpty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div id={projectionSearchResultsId} tabIndex={-1}>
      <EmptyState title={title} detail={detail} />
    </div>
  );
}
