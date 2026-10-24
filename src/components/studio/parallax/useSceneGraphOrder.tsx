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
  slots: { id: string; center: number }[];
  scrollParents: { element: HTMLElement; top: number }[];
  windowScrollY: number;
};
/** Preview only while dragging; one canonical edit on drop. Escape/cancel edits nothing. */
export function useSceneGraphOrder(disabled: boolean, commit: (category: GraphCategory, ids: string[]) => void) {
  const pending = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);
  const releaseDrag = useRef<(() => void) | null>(null);
  const reset = () => {
    releaseDrag.current?.();
    releaseDrag.current = null;
    pending.current = null;
    setDrag(null);
  };
  useEffect(() => {
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") reset();
    };
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("keydown", cancel);
      releaseDrag.current?.();
    };
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
      const list = event.currentTarget.closest("ul");
      const attribute =
        category === "ASSET"
          ? "data-graph-entity"
          : category === "ROOM_FEATURE"
            ? "data-graph-feature"
            : "data-graph-group";
      const slots = [...(list?.querySelectorAll<HTMLButtonElement>(`button[${attribute}]`) ?? [])]
        .filter((row) => row.getAttribute(attribute) !== id)
        .map((row) => ({
          id: row.getAttribute(attribute)!,
          center: row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2,
        }));
      const scrollParents: Drag["scrollParents"] = [];
      for (let element: HTMLElement | null = list; element; element = element.parentElement) {
        if (element.scrollHeight > element.clientHeight && /auto|scroll/.test(getComputedStyle(element).overflowY))
          scrollParents.push({ element, top: element.scrollTop });
      }
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      // Keep a name click targeted at the name. Capturing on press retargets
      // pointerup/click to the row and skips its inline rename handler.
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
        slots,
        scrollParents,
        windowScrollY: window.scrollY,
      };
      const button = event.currentTarget,
        pointerId = event.pointerId;
      const move = (event: globalThis.PointerEvent) => {
        const current = pending.current;
        if (!current || event.pointerId !== pointerId) return;
        if (!current.active && Math.abs(event.clientY - current.startY) < 5) return;
        event.preventDefault();
        if (!current.active) button.setPointerCapture(pointerId);
        current.active = true;
        suppressClick.current = true;
        current.y = event.clientY;
        // Use press-time slots, adjusted for scrolling. Measuring the reordered DOM
        // would move the insertion threshold each time the dragged row changes slots.
        const scrollShift =
          window.scrollY -
          current.windowScrollY +
          current.scrollParents.reduce((sum, parent) => sum + parent.element.scrollTop - parent.top, 0);
        const remainder = current.original.filter((value) => value !== id);
        const next = current.slots.find((slot) => event.clientY < slot.center - scrollShift);
        const index = next ? remainder.indexOf(next.id) : remainder.length;
        remainder.splice(Math.max(0, index), 0, id);
        current.ids = remainder;
        setDrag({ ...current });
        const scroller = current.scrollParents[0]?.element;
        if (scroller) {
          const bounds = scroller.getBoundingClientRect();
          if (event.clientY > bounds.bottom - 24) scroller.scrollTop += 12;
          else if (event.clientY < bounds.top + 24) scroller.scrollTop -= 12;
        }
      };
      const finish = (event: globalThis.PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        const current = pending.current;
        reset();
        setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        if (current?.active && current.ids.join("\0") !== current.original.join("\0")) commit(category, current.ids);
      };
      const cancel = (event: globalThis.PointerEvent) => {
        if (event.pointerId === pointerId) reset();
      };
      // Moving a captured node in the DOM can release its capture. Window listeners
      // keep the gesture alive while React reorders rows under the pointer.
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("blur", reset);
      releaseDrag.current = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("blur", reset);
        if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
      };
    },
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
