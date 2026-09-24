import type { SceneHostHandle, RuntimeSurfaceLease, SceneTargetHandle } from "../hosts/scene-host-types";
import { CUT, camera, gust, hash, materials, smooth, wind } from "./program";
import { LiveMembrane } from "./dom-material";

type Target = {
  node: HTMLElement;
  handle: SceneTargetHandle;
  lease: RuntimeSurfaceLease;
  base: string;
  baseFilter: string;
  previous: Record<string, string>;
  rect: DOMRect;
  start: number;
  end: number;
  index: number;
  membrane: LiveMembrane;
};
const selectors = [
  [".muster-title-group", 30.9, 33.0],
  [".muster-parchment", 31.02, 33.65],
  [".muster-crew-card, .muster-open-card", 31.32, 33.5],
  [".muster-cover", 32.18, 34.1],
  [".muster-readiness", 32.52, 34.3],
  [".muster-chat", 32.04, 34.2],
  [".muster-quote", 32.78, 34.35],
] as const;
const properties = ["transform", "opacity", "filter", "visibility"] as const;
export class MusterLanding {
  private targets: Target[] = [];
  private targetSerial = 0;
  private observer: MutationObserver;
  private resizeObserver: ResizeObserver;
  constructor(
    private main: HTMLElement,
    private host: SceneHostHandle,
    private onMeasured: () => void = () => {},
  ) {
    this.main.dataset.embarkationMaterials = "true";
    this.measure();
    this.observer = new MutationObserver(() => this.measure());
    this.observer.observe(main, { childList: true, subtree: true });
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(main);
  }
  measure() {
    for (const [selector, start, end] of selectors)
      Array.from(this.main.querySelectorAll<HTMLElement>(selector)).forEach((node, index) => {
        const existing = this.targets.find((t) => t.node === node);
        if (existing) {
          const current = node.style.transform;
          node.style.transform = existing.previous.transform;
          existing.rect = node.getBoundingClientRect();
          node.style.transform = current;
          return;
        }
        // Complete only Muster's finite introductory animation before sampling
        // layout. Keep its finished Animation alive so releasing our transform
        // cannot restart the card's entrance or restore an intermediate matrix.
        for (const animation of node.getAnimations()) {
          if (animation instanceof CSSAnimation && animation.animationName === "muster-arrive") {
            animation.finish();
            if (animation.effect instanceof KeyframeEffect) animation.effect.setKeyframes([]);
          }
        }
        const previous = Object.fromEntries(properties.map((p) => [p, node.style.getPropertyValue(p)]));
        const base = getComputedStyle(node).transform;
        const filter = getComputedStyle(node).filter;
        const rect = node.getBoundingClientRect();
        const handle = this.host.registerTarget({
          targetKey: `landing-${hash(selector)}-${this.targetSerial++}`,
          part: "muster-landing",
          element: node,
          ownerHint: "css",
          allowedProperties: properties,
        });
        const claim = this.host.claimRuntimeSurface({ target: handle, element: node, runtime: "css", properties });
        if (claim.status !== "granted") {
          handle.release();
          return;
        }
        this.targets.push({
          node,
          handle,
          lease: claim,
          base: base === "none" ? "" : base,
          baseFilter: filter === "none" ? "" : filter,
          previous,
          rect,
          start: start + Math.min(index * 0.23, 1.12),
          end: end + Math.min(index * 0.16, 0.8),
          index: this.targets.length,
          membrane: new LiveMembrane(this.targets.length),
        });
      });
    this.targets = this.targets.filter((t) => {
      if (t.node.isConnected) return true;
      t.lease.release();
      t.handle.release();
      t.membrane.dispose();
      return false;
    });
    this.onMeasured();
  }
  /** Same live node, same font and live content, at its own layout coordinates.
   * No screenshot or proxy swap is needed. Base CSS transforms are composed last. */
  frame(time: number, short = false, reduced = false) {
    const cam = camera(time);
    if (time >= CUT.settled || (short && time >= 1.9)) delete this.main.dataset.embarkationMaterials;
    else this.main.dataset.embarkationMaterials = "true";
    for (const t of this.targets) {
      const start = short ? 0.6 + (t.start - 30.9) * 0.18 : t.start;
      const end = short ? 1.25 + (t.end - 33.0) * 0.24 : Math.min(CUT.settled, t.end);
      const u = smooth(start, end, time),
        tail = 1 - u;
      const response = materials.card,
        field = wind(time, [t.rect.x, t.rect.y, -tail * 1800], t.index * 0.71);
      const damping = Math.sin(u * 9.4) * Math.exp(-u * 5) * tail;
      const x = tail * ((t.index % 2 ? 1 : -1) * (innerWidth < 600 ? 45 : 170)) + field[0] * tail * 0.15;
      const y = tail * (innerWidth < 600 ? 72 : 110) + damping * 22;
      const z = -tail * tail * (short ? 260 : 1900);
      const heavy = t.node.matches(".muster-parchment,.muster-chat"),
        flightDuration = heavy ? 1.19 : 1.02 + (t.index % 3) * 0.075,
        catchTime = start + flightDuration,
        freeAge = Math.max(0, time - start),
        flight = Math.min(1, freeAge / flightDuration),
        catchProgress = smooth(catchTime - 0.045, catchTime + 0.22, time),
        heldAge = Math.max(0, time - catchTime),
        relaxed = 1 - smooth(catchTime + 0.25, end, time),
        load = gust(time) * (heavy ? 1.55 : 3.3) * relaxed;
      if (!short && !reduced && time >= start && time < end)
        t.membrane.update(time, t.rect.width, t.rect.height, load, catchProgress);
      t.lease.withProperties(properties, (element) => {
        const n = element as HTMLElement;
        n.style.visibility = time < start ? "hidden" : "visible";
        n.style.opacity = String(time < start ? 0 : reduced ? u : 1);
        n.style.filter = reduced
          ? t.baseFilter
          : `blur(${tail * tail * 2.3}px) brightness(${1 - tail * 0.18}) ${t.baseFilter}`;
        n.style.transform = reduced
          ? t.base
          : `perspective(1150px) translate3d(${x - cam.position[0] * tail * 0.1}px,${y}px,${z}px) rotateX(${tail * 13 + damping * 3}deg) rotateY(${tail * (t.index % 2 ? 12 : -12)}deg) rotateZ(${tail * (t.index % 2 ? 3 : -3) + (damping / response.inertia) * 12}deg) ${t.base}`;
        if (!short && !reduced) {
          // A perspective-correct crossing of the eye plane, then a material
          // impulse about a fixed support point. Alpha never invents the arrival.
          const travel = Math.pow(1 - flight, 1.32),
            depth = 1435 * travel,
            sign = t.index % 2 ? 1 : -1;
          const coherent = wind(time, [t.rect.x - innerWidth * 0.5, innerHeight * 0.5 - t.rect.y, -depth]);
          const streamX = travel * (sign * (innerWidth < 600 ? 125 : 460) + coherent[0] * 0.42);
          const streamY = travel * (((t.index % 3) - 1) * 210 - coherent[1] * 0.38);
          const impulse = Math.sin(heldAge * 15) * Math.exp(-heldAge * (heavy ? 3.9 : 3.1)) * catchProgress;
          const tension = load * (0.68 + impulse * 0.65),
            rotation = heavy ? 0.38 : 1;
          n.style.visibility = time < start || depth > 1142 ? "hidden" : "visible";
          n.style.opacity = time < start || depth > 1142 ? "0" : "1";
          const pinX = (t.index % 3 === 0 ? 0 : t.index % 3 === 1 ? -0.32 : 0.32) * t.rect.width,
            pinY = (t.index % 3 === 0 ? -0.02 : -0.3) * t.rect.height;
          n.style.transform = `perspective(1150px) translate3d(${streamX}px,${streamY}px,${depth}px) translate(${pinX}px,${pinY}px) rotateX(${(travel * sign * 36 + tension * 6) * rotation}deg) rotateY(${(travel * sign * 52 + tension * sign * 4) * rotation}deg) rotateZ(${(travel * sign * 16 + impulse * load * 2.8) * rotation}deg) translate(${-pinX}px,${-pinY}px) ${t.base}`;
          n.style.filter = `url(#${t.membrane.id}) blur(${travel * travel * 2.6}px) ${t.baseFilter}`;
        }
        if (u === 1) {
          n.style.transform = t.previous.transform;
          n.style.filter = t.previous.filter;
          n.style.opacity = t.previous.opacity;
          n.style.visibility = "visible";
        }
      });
    }
  }
  rectangles() {
    return this.targets.map((t) => ({
      name: t.node.className,
      rect: { x: t.rect.x, y: t.rect.y, width: t.rect.width, height: t.rect.height },
      start: t.start,
      catch: t.start + (t.node.matches(".muster-parchment,.muster-chat") ? 1.19 : 1.02 + (t.index % 3) * 0.075),
      end: Math.min(CUT.settled, t.end),
    }));
  }
  release() {
    delete this.main.dataset.embarkationMaterials;
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    for (const t of this.targets) {
      for (const p of properties) t.node.style.setProperty(p, t.previous[p]);
      t.lease.release();
      t.handle.release();
      t.membrane.dispose();
    }
    this.targets = [];
  }
}

export function sourceFrame(root: HTMLElement, time: number) {
  // Actual page surfaces are now subdivided GPU membranes. DOM remains as
  // the readable calm source until the identical in-memory textures take over.
  for (const node of root.querySelectorAll<HTMLElement>("[data-departure]"))
    node.style.visibility = time < 0.45 ? "visible" : "hidden";
}
