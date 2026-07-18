import type { Variants } from "motion/react";
import type { MotionMode } from "../core/animation-types";

export const sectionVariants = (mode: MotionMode): Variants => ({
  initial: { opacity: 0, y: mode === "reduced" ? 0 : 18, scale: mode === "full" ? 0.985 : 1 },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: mode === "full" ? 0.48 : mode === "gentle" ? 0.18 : 0.01 },
  },
  exit: {
    opacity: 0,
    y: mode === "reduced" ? 0 : -10,
    transition: { duration: mode === "full" ? 0.28 : mode === "gentle" ? 0.1 : 0.01 },
  },
});

export const cardVariants = (mode: MotionMode): Variants => ({
  initial: { opacity: 0, y: mode === "reduced" ? 0 : 12 },
  enter: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: mode === "reduced" ? 0 : Math.min(index * 0.04, 0.24),
      duration: mode === "reduced" ? 0.01 : undefined,
    },
  }),
  exit: { opacity: 0, y: mode === "reduced" ? 0 : -8 },
});

export const pressable = (mode: MotionMode) =>
  mode === "reduced"
    ? { whileHover: {}, whileTap: {} }
    : { whileHover: { y: -2, scale: 1.015 }, whileTap: { y: 1, scale: 0.985 } };
