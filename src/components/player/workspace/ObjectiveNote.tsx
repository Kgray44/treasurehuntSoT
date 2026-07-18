"use client";

import { AnimatePresence, motion } from "motion/react";

export function ObjectiveNote({
  objective,
  chapter,
  title,
  hintCount,
  expanded,
  setExpanded,
  returnToClue,
}: {
  objective: string;
  chapter: number;
  title?: string;
  hintCount: number;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  returnToClue: () => void;
}) {
  return (
    <motion.aside layout className={`objective-note ${expanded ? "expanded" : ""}`} data-animation-owner="motion">
      <span className="objective-pin" aria-hidden="true" />
      <p>Current objective</p>
      <strong>{objective}</strong>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span>
              Chapter {chapter}
              {title ? ` · ${title}` : ""}
            </span>
            <small>
              {hintCount ? `${hintCount} released bearing${hintCount === 1 ? "" : "s"}` : "No released bearings"}
            </small>
          </motion.div>
        )}
      </AnimatePresence>
      <div>
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? "Fold note" : "Review"}
        </button>
        <button onClick={returnToClue}>Return to clue</button>
      </div>
    </motion.aside>
  );
}
