"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type StudioCommand = {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
};

export function StudioCommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: StudioCommand[];
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const close = () => {
    setQuery("");
    onClose();
  };
  const visibleCommands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.description ?? ""} ${command.shortcut ?? ""}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const close = () => {
    setQuery("");
    onClose();
  };

  if (!open) return null;
  return (
    <div className="studio-command-palette-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="studio-command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-command-palette-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        <header>
          <div>
            <p className="eyebrow">Studio commands</p>
            <h2 id="studio-command-palette-title">Find an action</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close command palette">
            Close
          </button>
        </header>
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search commands"
          aria-label="Search Studio commands"
        />
        <div className="studio-command-list" role="list">
          {visibleCommands.length ? (
            visibleCommands.map((command) => (
              <button
                type="button"
                key={command.id}
                disabled={command.disabled}
                onClick={() => {
                  close();
                  command.run();
                }}
              >
                <span>
                  <strong>{command.label}</strong>
                  {command.description ? <small>{command.description}</small> : null}
                </span>
                {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
              </button>
            ))
          ) : (
            <p className="studio-command-empty">No Studio command matches &quot;{query}&quot;.</p>
          )}
        </div>
      </section>
    </div>
  );
}
