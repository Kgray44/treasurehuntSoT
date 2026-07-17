"use client";

import { motion } from "motion/react";
import type { PublicSnapshot } from "@/domain/story";
import { companionViews, type CompanionView } from "./types";

export function CompanionNavigation({
  view,
  unseen,
  navigate,
}: {
  view: CompanionView;
  unseen: PublicSnapshot["unseen"];
  navigate: (view: CompanionView) => void;
}) {
  return (
    <nav className="companion-navigation" aria-label="Companion sections" data-scene-part="peripheral" data-gsap-owned>
      {companionViews.map((item) => (
        <button
          key={item.key}
          aria-current={view === item.key ? "page" : undefined}
          className={view === item.key ? "active" : ""}
          onClick={() => navigate(item.key)}
        >
          {view === item.key && <motion.i layoutId="active-companion-section" className="active-nav-plate" />}
          <span aria-hidden="true">{item.symbol}</span>
          <b>{item.shortLabel}</b>
          {unseen[item.key] > 0 && (
            <motion.small layoutId={`unseen-${item.key}`} aria-label={`${unseen[item.key]} unseen`}>
              New
            </motion.small>
          )}
        </button>
      ))}
    </nav>
  );
}

export function MobileNavigation({
  view,
  unseen,
  navigate,
}: {
  view: CompanionView;
  unseen: PublicSnapshot["unseen"];
  navigate: (view: CompanionView) => void;
}) {
  return (
    <nav className="mobile-nav" aria-label="Companion views">
      {companionViews.map((item) => (
        <button className={view === item.key ? "active" : ""} onClick={() => navigate(item.key)} key={item.key}>
          <span aria-hidden="true">{item.symbol}</span>
          {item.shortLabel}
          {unseen[item.key] > 0 && <span className="sr-only">, new content</span>}
        </button>
      ))}
    </nav>
  );
}
