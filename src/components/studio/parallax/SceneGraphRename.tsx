"use client";
import { useEffect, useRef, useState } from "react";

export function SceneGraphRename({
  name,
  onCommit,
  onCancel,
}: {
  name: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const finish = (cancel = false) => {
    if (finished.current) return;
    finished.current = true;
    if (!cancel && value.trim() && value.trim() !== name) onCommit(value.trim());
    else onCancel();
  };
  return (
    <input
      ref={input}
      aria-label={`Rename ${name}`}
      value={value}
      maxLength={160}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finish(event.key === "Escape");
        }
      }}
    />
  );
}
