export function observeDocumentVisibility(onChange: (visible: boolean) => void) {
  if (typeof document === "undefined") return () => undefined;
  const handler = () => onChange(!document.hidden);
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

export function observeElementVisibility(element: Element, onChange: (visible: boolean) => void) {
  if (typeof IntersectionObserver === "undefined") {
    onChange(true);
    return () => undefined;
  }
  const observer = new IntersectionObserver(([entry]) => onChange(entry.isIntersecting), { rootMargin: "100px" });
  observer.observe(element);
  return () => observer.disconnect();
}
