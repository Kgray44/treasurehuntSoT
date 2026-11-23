"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ProjectionSearchResult({
  id,
  children,
  className,
  tabIndex = -1,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  tabIndex?: number;
}) {
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = result.current;
    if (!target || window.location.hash !== `#${id}`) return;
    const { activeElement, body } = target.ownerDocument;
    if (activeElement !== body && !target.contains(activeElement)) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "instant", block: "start" });
  }, [id]);

  return (
    <div aria-label="Search results" role="region" id={id} className={className} tabIndex={tabIndex} ref={result}>
      {children}
    </div>
  );
}
