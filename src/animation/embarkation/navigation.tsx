"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
let outgoing: { root: HTMLDivElement; path: string; timer: ReturnType<typeof setTimeout> } | null = null;
export function takeOutgoing(path: string) {
  if (!outgoing || outgoing.path !== path) return null;
  const source = outgoing;
  outgoing = null;
  clearTimeout(source.timer);
  return source.root;
}
function clearOutgoing() {
  if (!outgoing) return;
  clearTimeout(outgoing.timer);
  outgoing.root.remove();
  outgoing = null;
}
function cloneStyled(node: HTMLElement) {
  const copy = node.cloneNode(true) as HTMLElement;
  const source = [node, ...node.querySelectorAll<HTMLElement>("*")],
    target = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
  for (let i = 0; i < source.length; i++) {
    const css = getComputedStyle(source[i]);
    for (const property of css) target[i].style.setProperty(property, css.getPropertyValue(property));
    target[i].removeAttribute("id");
    target[i].removeAttribute("name");
    target[i].style.animation = "none";
    target[i].style.transition = "none";
  }
  return copy;
}
/** Retain actual outgoing visible platform pieces across Next's route commit.
 * Content remains ephemeral in memory, never sent to a server or persisted. */
export function EmbarkationNavigationBridge() {
  const pathname = usePathname();
  useEffect(() => {
    if (outgoing && pathname !== outgoing.path) clearOutgoing();
  }, [pathname]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, location.href);
      if (
        url.origin !== location.origin ||
        !/^\/(captain\/voyages\/[^/]+\/muster|player\/playthroughs\/[^/]+)$/.test(url.pathname)
      )
        return;
      if (document.querySelector(".embarkation-host")) return;
      const main = document.querySelector<HTMLElement>("main");
      if (!main) return;
      clearOutgoing();
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(
          ".product-shell-header, main .platform-header, main article, main .tale-card, main .captain-voyage-card, main .library-tools",
        ),
      ]
        .filter((n, index, all) => {
          const r = n.getBoundingClientRect();
          return (
            !all.some((other, i) => i !== index && other.contains(n)) &&
            r.width > 0 &&
            r.height > 0 &&
            r.bottom > 0 &&
            r.top < innerHeight
          );
        })
        .slice(0, 12);
      if (nodes.length < 2) return;
      const root = document.createElement("div");
      root.className = "embarkation-retained-source";
      root.style.cssText = "position:fixed;inset:0;background:#061f23;z-index:130;overflow:hidden;pointer-events:none";
      root.inert = true;
      root.setAttribute("aria-hidden", "true");
      for (const node of nodes) {
        const rect = node.getBoundingClientRect(),
          clone = cloneStyled(node);
        clone.dataset.departure = "";
        clone.style.position = "absolute";
        clone.style.margin = "0";
        clone.style.left = `${rect.x}px`;
        clone.style.top = `${rect.y}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        root.append(clone);
      }
      document.body.append(root);
      outgoing = { root, path: url.pathname, timer: setTimeout(clearOutgoing, 20000) };
    };
    document.addEventListener("click", click, true);
    const back = () => clearOutgoing();
    window.addEventListener("popstate", back);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", back);
      clearOutgoing();
    };
  }, []);
  return null;
}
