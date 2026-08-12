"use client";

import { useState } from "react";

export function CopyIdentifier({ value, label = "identifier" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="chartroom-copy">
      <code>{value}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }}
        aria-label={`Copy ${label}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
