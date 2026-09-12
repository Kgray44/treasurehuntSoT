"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, platformMotionTokens } from "@/animation/platform/motion-tokens";
import { ChevronDown } from "./icons";

/** Measure the contents, not an arbitrary max-height, including changes while open. */
export function MusterOptions({ label, children }: { label: string; children: ReactNode }) {
  const { mode } = useMotionMode();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const triggerId = useId();
  const reduced = mode === "reduced";
  const duration = reduced ? 0 : 0.28;
  const transition = { duration, ease: platformMotionEasing("layout") };

  useLayoutEffect(() => {
    if (!content.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.target.getBoundingClientRect().height);
    });
    observer.observe(content.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="muster-voyage-options">
      <button
        type="button"
        className="muster-options-trigger"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          size={13}
          aria-hidden="true"
          style={{
            transform: `rotate(${open ? 180 : 0}deg)`,
            transition: `transform ${duration}s ${platformMotionTokens.layout.easing}`,
          }}
        />
        {label}
      </button>
      <motion.div
        id={panelId}
        className="muster-options-panel"
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!open}
        inert={!open}
        initial={false}
        animate={{ height: open ? (reduced || !height ? "auto" : height) : 0 }}
        transition={transition}
        data-animation-owner="motion"
      >
        <motion.div
          ref={content}
          className="muster-options-content"
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: reduced || open ? 0 : -4 }}
          transition={{ ...transition, duration: reduced ? 0.06 : duration }}
          data-animation-owner="motion"
        >
          {children}
        </motion.div>
      </motion.div>
    </section>
  );
}
