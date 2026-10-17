"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type KeyboardEvent,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import styles from "./SpatialStudio.module.css";

export type StudioIconName =
  | "eye"
  | "eyeOff"
  | "lock"
  | "unlock"
  | "trash"
  | "copy"
  | "inspect"
  | "frame"
  | "reset"
  | "save"
  | "undo"
  | "redo"
  | "plus"
  | "up"
  | "down"
  | "surface"
  | "move"
  | "rotate"
  | "scale"
  | "archive"
  | "menu"
  | "rename"
  | "group";
const paths: Record<StudioIconName, string> = {
  group: "M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 7h6v6H7ZM11 11h6v6h-6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  eyeOff: "m3 3 18 18M9 5.5 12 5c6.5 0 10 7 10 7l-3 4M6 7c-2.5 2-4 5-4 5s3.5 7 10 7l4-1M10 10a3 3 0 0 0 4 4",
  lock: "M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3M12 14v3",
  unlock: "M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0M12 14v3",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  copy: "M8 8h12v12H8ZM4 16V4h12",
  inspect: "M4 4h16v16H4ZM9 4v16M12 8h5M12 12h5M12 16h3",
  frame: "M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6M8 8h8v8H8Z",
  reset: "M4 10a8 8 0 1 1 1 8M4 4v6h6",
  save: "M4 3h13l4 4v14H3V3ZM7 3v6h9V3M7 21v-8h10v8",
  undo: "m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v3",
  redo: "m16 4 5 5-5 5M21 9H11a7 7 0 0 0-7 7v3",
  plus: "M12 4v16M4 12h16",
  up: "m5 14 7-7 7 7",
  down: "m5 10 7 7 7-7",
  surface: "m3 12 9-6 9 6-9 6ZM3 16l9 6 9-6",
  move: "M12 2v20M2 12h20m-13-7 3-3 3 3m-6 14 3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3",
  rotate: "M4 9a8 8 0 1 1 0 6M4 3v6h6",
  scale: "M3 9V3h6M15 21h6v-6M3 3l7 7M21 21l-7-7",
  archive: "M3 3h18v5H3ZM5 8v13h14V8M9 12h6",
  menu: "M4 6h16M4 12h16M4 18h16",
  rename: "m4 16 12-12 4 4L8 20H4ZM13 7l4 4M3 22h18",
};
export function StudioIcon({ name }: { name: StudioIconName }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export type StudioMenuAction = {
  label: string;
  icon?: StudioIconName;
  run: () => void;
  disabled?: boolean;
  danger?: boolean;
};
type Menu = {
  title: string;
  actions: StudioMenuAction[];
  x: number;
  y: number;
  trigger: HTMLElement;
  palette: CSSProperties;
};
/** Context actions use the same editor commands as visible controls. No hidden mutations. */
export function useStudioContextMenu() {
  const [state, setState] = useState<Menu | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = (restore = true) => {
    if (restore) state?.trigger.focus({ preventScroll: true });
    setState(null);
  };
  const openAt = (trigger: HTMLElement, x: number, y: number, title: string, actions: StudioMenuAction[]) => {
    const computed = getComputedStyle(trigger),
      palette: Record<string, string> = {};
    for (const name of ["panel", "border", "text", "muted", "hover", "focus", "danger", "shadow"])
      palette[`--studio-${name}`] = computed.getPropertyValue(`--studio-${name}`);
    setState({ title, actions, x, y, trigger, palette: palette as CSSProperties });
  };
  const open = (
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
    title: string,
    actions: StudioMenuAction[],
  ) => {
    if (
      event.type === "keydown" &&
      !("key" in event && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")))
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    openAt(
      (event.target as HTMLElement).closest?.<HTMLElement>("button,a,input,textarea,select,[tabindex]") ??
        event.currentTarget,
      "clientX" in event ? event.clientX : bounds.left + 12,
      "clientY" in event ? event.clientY : bounds.bottom,
      title,
      actions,
    );
  };
  useLayoutEffect(() => {
    if (!state || !ref.current) return;
    const menu = ref.current,
      bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(state.x, innerWidth - bounds.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(state.y, innerHeight - bounds.height - 8))}px`;
    (menu.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? menu).focus({ preventScroll: true });
  }, [state]);
  useEffect(() => {
    if (!state) return;
    const outside = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) setState(null);
    };
    const dismiss = () => setState(null);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("scroll", outside, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("scroll", outside, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [state]);
  const menu =
    state &&
    createPortal(
      <div
        ref={ref}
        className={styles.contextMenu}
        role="menu"
        aria-label={`${state.title} actions`}
        tabIndex={-1}
        style={{ ...state.palette, left: state.x, top: state.y }}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          const items = Array.from(ref.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && items.length) {
            event.preventDefault();
            items[
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length
            ].focus();
          }
        }}
      >
        <div className={styles.contextTitle}>{state.title}</div>
        {state.actions.map((action) => (
          <button
            key={action.label}
            role="menuitem"
            type="button"
            disabled={action.disabled}
            data-danger={action.danger || undefined}
            onClick={() => {
              close();
              action.run();
            }}
          >
            {action.icon && <StudioIcon name={action.icon} />}
            <span>{action.label}</span>
          </button>
        ))}
      </div>,
      document.body,
    );
  return { open, openAt, menu };
}
