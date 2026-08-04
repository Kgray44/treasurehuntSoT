"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ActionDialogField = Readonly<{
  id: string;
  label: string;
  initialValue?: string;
  description?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  choices?: ReadonlyArray<Readonly<{ value: string; label: string }>>;
  multiple?: boolean;
}>;

export type ActionDialogRequest = Readonly<{
  title: string;
  detail: string;
  confirmLabel: string;
  cancelLabel?: string;
  eyebrow?: string;
  destructive?: boolean;
  fields?: ReadonlyArray<ActionDialogField>;
}>;

type DialogState = Readonly<{
  request: ActionDialogRequest;
  values: Readonly<Record<string, string>>;
}>;

export function useActionDialog() {
  const [state, setState] = useState<DialogState | null>(null);
  const resolver = useRef<((value: Record<string, string> | null) => void) | null>(null);
  const restoreTarget = useRef<HTMLElement | null>(null);

  const requestAction = useCallback((request: ActionDialogRequest) => {
    resolver.current?.(null);
    restoreTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return new Promise<Record<string, string> | null>((resolve) => {
      resolver.current = resolve;
      setState({
        request,
        values: Object.fromEntries((request.fields ?? []).map((field) => [field.id, field.initialValue ?? ""])),
      });
    });
  }, []);

  const finish = useCallback((value: Record<string, string> | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setState(null);
    resolve?.(value);
    const target = restoreTarget.current;
    restoreTarget.current = null;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  }, []);

  const dialog = state ? (
    <ActionDialog
      state={state}
      onChange={(id, value) =>
        setState((current) => (current ? { ...current, values: { ...current.values, [id]: value } } : current))
      }
      onCancel={() => finish(null)}
      onConfirm={() => finish({ ...state.values })}
    />
  ) : null;

  return { requestAction, dialog };
}

function ActionDialog({
  state,
  onChange,
  onCancel,
  onConfirm,
}: {
  state: DialogState;
  onChange: (id: string, value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const detailId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const backgroundRegions = [...document.querySelectorAll<HTMLElement>("main")].map((element) => ({
      element,
      inert: element.inert,
    }));
    document.body.style.overflow = "hidden";
    for (const region of backgroundRegions) region.element.inert = true;
    const frame = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    });
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const controls = [...panel.current.querySelectorAll<HTMLElement>("input, textarea, select, button")].filter(
        (control) => control.tabIndex >= 0 && !control.hasAttribute("disabled"),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keyboard);
      document.body.style.overflow = previousOverflow;
      for (const region of backgroundRegions) region.element.inert = region.inert;
    };
  }, [onCancel]);

  return (
    <div
      className="ui-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        ref={panel}
        className="ui-action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={detailId}
      >
        <p className="eyebrow">{state.request.eyebrow ?? "Confirm action"}</p>
        <h2 id={titleId}>{state.request.title}</h2>
        <p id={detailId}>{state.request.detail}</p>
        {state.request.fields?.length ? (
          <div className="ui-action-dialog__fields">
            {state.request.fields.map((field) =>
              field.choices ? (
                <fieldset key={field.id}>
                  <legend>{field.label}</legend>
                  {field.description ? <p>{field.description}</p> : null}
                  <div className="ui-action-dialog__choices">
                    {field.choices.map((choice) => {
                      const selected = state.values[field.id]?.split(",").filter(Boolean) ?? [];
                      return (
                        <label key={choice.value}>
                          <input
                            type={field.multiple ? "checkbox" : "radio"}
                            name={field.id}
                            value={choice.value}
                            checked={selected.includes(choice.value)}
                            onChange={(event) => {
                              if (!field.multiple) onChange(field.id, choice.value);
                              else
                                onChange(
                                  field.id,
                                  event.target.checked
                                    ? [...selected, choice.value].join(",")
                                    : selected.filter((value) => value !== choice.value).join(","),
                                );
                            }}
                          />
                          <span>{choice.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <label key={field.id}>
                  <span>{field.label}</span>
                  {field.description ? <small>{field.description}</small> : null}
                  {field.multiline ? (
                    <textarea
                      value={state.values[field.id] ?? ""}
                      required={field.required}
                      maxLength={field.maxLength}
                      rows={4}
                      onChange={(event) => onChange(field.id, event.target.value)}
                    />
                  ) : (
                    <input
                      value={state.values[field.id] ?? ""}
                      required={field.required}
                      maxLength={field.maxLength}
                      onChange={(event) => onChange(field.id, event.target.value)}
                    />
                  )}
                </label>
              ),
            )}
          </div>
        ) : null}
        <div className="ui-action-dialog__actions">
          <button ref={cancel} type="button" className="button-secondary" onClick={onCancel}>
            {state.request.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            className={state.request.destructive ? "button-danger" : "brass-button"}
            disabled={(state.request.fields ?? []).some(
              (field) => field.required && !(state.values[field.id] ?? "").trim(),
            )}
            onClick={onConfirm}
          >
            {state.request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
