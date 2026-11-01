"use client";
import { useState } from "react";

/** Keep transient whitespace/empty input local; meaningful edits use the normal command port. */
export function StudioTextField({
  value,
  onCommit,
  multiline = false,
  maxLength,
  label,
  disabled = false,
}: {
  value: string;
  onCommit(value: string): void;
  multiline?: boolean;
  maxLength: number;
  label?: string;
  disabled?: boolean;
}) {
  const [typing, setTyping] = useState<{ text: string; base: string; expected: string } | null>(null);
  const [empty, setEmpty] = useState(false);
  const shown = typing && (value === typing.base || value === typing.expected) ? typing.text : value;
  const shared = {
    value: shown,
    maxLength,
    disabled,
    "aria-label": label,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const text = event.target.value,
        normalized = text.trim();
      setTyping({ text, base: value, expected: normalized || value });
      setEmpty(false);
      if (normalized && normalized !== value) onCommit(normalized);
    },
    onBlur: () => {
      if (typing && !typing.text.trim()) setEmpty(true);
      setTyping(null);
    },
  };
  return (
    <>
      {multiline ? <textarea {...shared} /> : <input {...shared} type="text" />}
      {empty && <small role="status">Keep some text in this field. Your previous text is unchanged.</small>}
    </>
  );
}
