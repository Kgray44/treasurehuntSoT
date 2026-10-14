"use client";
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./SpatialStudio.module.css";

export type GraphCategory = "ASSET" | "ROOM_FEATURE" | "GROUP";
type Drag = {
  category: GraphCategory;
  id: string;
  name: string;
  ids: string[];
  original: string[];
  startY: number;
  x: number;
  y: number;
  width: number;
  active: boolean;
};
/** Preview only while dragging; one canonical edit on drop. Escape/cancel edits nothing. */
export function useSceneGraphOrder(disabled: boolean, commit: (category: GraphCategory, ids: string[]) => void) {
  const pending = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);
  const reset = () => {
    pending.current = null;
    setDrag(null);
  };
  useEffect(() => {
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") reset();
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  useEffect(() => {
    if (disabled) queueMicrotask(reset);
  }, [disabled]);
  const rows = <T extends { id: string }>(category: GraphCategory, items: readonly T[]): T[] => {
    if (!drag?.active || drag.category !== category) return [...items];
    const indices = new Map(drag.ids.map((id, index) => [id, index]));
    return [...items].sort((a, b) => (indices.get(a.id) ?? Infinity) - (indices.get(b.id) ?? Infinity));
  };
  const bind = (category: GraphCategory, id: string, name: string, ids: string[]) => ({
    "data-graph-dragging": drag?.active && drag.id === id && drag.category === category ? "true" : undefined,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      suppressClick.current = false;
      if (
        disabled ||
        event.button !== 0 ||
        (event.pointerType === "touch" && !(event.target as HTMLElement).closest("[data-graph-reorder-handle]"))
      )
        return;
      const rect = event.currentTarget.getBoundingClientRect();
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      pending.current = {
        category,
        id,
        name,
        ids: [...ids],
        original: [...ids],
        startY: event.clientY,
        x: rect.x,
        y: event.clientY,
        width: rect.width,
        active: false,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const current = pending.current;
      if (!current || current.id !== id || current.category !== category) return;
      if (!current.active && Math.abs(event.clientY - current.startY) < 5) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      current.active = true;
      suppressClick.current = true;
      current.y = event.clientY;
      const list = event.currentTarget.closest("ul");
      const attribute =
        category === "ASSET"
          ? "data-graph-entity"
          : category === "ROOM_FEATURE"
            ? "data-graph-feature"
            : "data-graph-group";
      const targets = [...(list?.querySelectorAll<HTMLButtonElement>(`button[${attribute}]`) ?? [])].filter(
        (row) => row.getAttribute(attribute) !== id,
      );
      const remainder = current.ids.filter((value) => value !== id);
      const next = targets.find((row) => {
        const rect = row.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2;
      });
      const index = next ? remainder.indexOf(next.getAttribute(attribute)!) : remainder.length;
      remainder.splice(Math.max(0, index), 0, id);
      current.ids = remainder;
      setDrag({ ...current });
      if (list && event.clientY > list.getBoundingClientRect().bottom - 20) list.scrollIntoView({ block: "end" });
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      const current = pending.current;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      reset();
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (current?.active && !disabled && current.ids.join("\0") !== current.original.join("\0"))
        commit(category, current.ids);
    },
    onPointerCancel: reset,
    onClickCapture: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  });
  const key = (event: KeyboardEvent<HTMLButtonElement>, category: GraphCategory, id: string, ids: string[]) => {
    if (disabled || !event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return false;
    event.preventDefault();
    event.stopPropagation();
    const next = [...ids],
      from = next.indexOf(id),
      to = from + (event.key === "ArrowUp" ? -1 : 1);
    if (from >= 0 && to >= 0 && to < next.length) {
      const button = event.currentTarget;
      next.splice(from, 1);
      next.splice(to, 0, id);
      commit(category, next);
      requestAnimationFrame(() => button.focus());
    }
    return true;
  };
  const ghost = drag?.active
    ? createPortal(
        <div
          className={styles.graphDragGhost}
          style={{ left: drag.x, top: drag.y - 20, width: drag.width }}
          aria-hidden="true"
        >
          {drag.name}
        </div>,
        document.body,
      )
    : null;
  return { rows, bind, key, ghost };
}
