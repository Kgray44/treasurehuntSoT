import { Fragment } from "react";

function fieldLabel(key: string) {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function ReceiptDetails({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) return <>None</>;
    return (
      <ol>
        {value.map((item, index) => (
          <li key={index}>
            <ReceiptDetails value={item} />
          </li>
        ))}
      </ol>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return <>None</>;
    return (
      <dl style={{ overflowWrap: "anywhere" }}>
        {entries.map(([key, item]) => (
          <Fragment key={key}>
            <dt>{fieldLabel(key)}</dt>
            <dd>
              <ReceiptDetails value={item} />
            </dd>
          </Fragment>
        ))}
      </dl>
    );
  }

  if (value == null) return <>Not set</>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  return <>{String(value)}</>;
}
