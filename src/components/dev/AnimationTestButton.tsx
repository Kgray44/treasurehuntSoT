"use client";

import Link from "next/link";

export function AnimationTestButton() {
  const enabled = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENABLE_ANIMATION_LAB === "true";
  if (!enabled) return null;
  return (
    <Link
      className="animation-test-button"
      href="/dev/animations"
      aria-label="TEST ANIMATIONS - open the development animation showcase"
    >
      TEST ANIMATIONS
    </Link>
  );
}
