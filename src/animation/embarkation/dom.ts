import type { SceneHostHandle, RuntimeSurfaceLease, SceneTargetHandle } from "../hosts/scene-host-types";
import { CUT, camera, hash, materials, smooth, wind } from "./program";
import { ArrivalPath, type ArrivalMaterial as MaterialKind, type ArrivalSpec } from "./arrival";
import { ArrivalMaterial, type ArrivalMaterialCache } from "./arrival-material";
import { DOMPaintResources, freezeDOMPaint } from "./dom-paint";
import { LivePaintBinding } from "./live-paint-binding";
import { PaintSurface } from "./paint-surface";
import { PaintMesh } from "./paint-mesh";
import { scalePaintInsets } from "./paint-raster";
import type { MaterialBackdrop } from "./material-backdrop";
import { SurfaceQueue } from "./depth-compositor";
import { prepareMaterials } from "./prepare-materials";
import { eulerFromOrientation } from "./dynamics";
import { soundPan, type SoundCue } from "./sound-cues";
import {
  WORLD_HEIGHT,
  cssToWorld,
  cssProjection,
  planeProjection,
  inverseProjection,
  multiplyProjection,
  projectWorld,
  IDENTITY,
  type Homography,
} from "./projection";

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
  gpu?: {
    binding: LivePaintBinding;
    surface: PaintSurface;
    mesh?: PaintMesh;
    motion?: ArrivalMaterial;
    key?: string;
    paintSize?: [number, number];
    rasterKey?: string;
  };
  parent?: Target;
  projection: Homography;
  origin: [number, number];
  arrival?: { key: string; path: ArrivalPath };
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
  private gl: WebGL2RenderingContext | null = null;
  private resources: DOMPaintResources | null = null;
  private preparation = new AbortController();
  private disposed = false;
  private preparing: Promise<void> | null = null;
  private failure: ((reason: unknown) => void) | null = null;
  private generation = 0;
  constructor(
    private main: HTMLElement,
    private host: SceneHostHandle,
    private onMeasured: () => void = () => {},
  ) {
    this.main.dataset.embarkationMaterials = "true";
    this.measure();
    this.observer = new MutationObserver(() => this.measure());
    this.observer.observe(main, { childList: true, characterData: true, subtree: true });
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(main);
    for (const t of this.targets) this.resizeObserver.observe(t.node);
  }
  measure() {
    // Reset EVERY cinematic ancestor before measuring ANY descendant. The
    // entire operation is synchronous and restored before the browser paints.
    // Reading child rectangles after resetting only that child double-counts
    // the moving parchment's transform during cover/readiness assembly.
    const restore = this.targets.map((t) => ({ t, transform: t.node.style.transform, filter: t.node.style.filter }));
    for (const { t } of restore)
      t.lease.withProperties(properties, (element) => {
        const n = element as HTMLElement;
        n.style.transform = t.previous.transform;
        n.style.filter = t.previous.filter;
      });
    try {
      for (const [selector, start, end] of selectors)
        Array.from(this.main.querySelectorAll<HTMLElement>(selector)).forEach((node, index) => {
          const existing = this.targets.find((t) => t.node === node);
          if (existing) {
            existing.rect = node.getBoundingClientRect();
            existing.origin = getComputedStyle(node).transformOrigin.split(" ").slice(0, 2).map(parseFloat) as [
              number,
              number,
            ];
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
            projection: [...IDENTITY],
            origin: getComputedStyle(node).transformOrigin.split(" ").slice(0, 2).map(parseFloat) as [number, number],
          });
          this.resizeObserver?.observe(node);
        });
    } finally {
      for (const { t, transform, filter } of restore)
        t.lease.withProperties(properties, (element) => {
          const n = element as HTMLElement;
          n.style.transform = transform;
          n.style.filter = filter;
        });
    }
    this.targets = this.targets.filter((t) => {
      if (t.node.isConnected) return true;
      t.lease.release();
      t.handle.release();
      t.gpu?.binding.dispose();
      t.gpu?.surface.dispose();
      this.resizeObserver?.unobserve(t.node);
      return false;
    });
    for (const t of this.targets) {
      t.parent = undefined;
      for (let ancestor = t.node.parentElement; ancestor && ancestor !== this.main; ancestor = ancestor.parentElement) {
        const owner = this.targets.find((candidate) => candidate.node === ancestor);
        if (owner) {
          t.parent = owner;
          break;
        }
      }
    }
    this.generation++;
    for (const t of this.targets) t.gpu?.binding.layoutChanged();
    if (this.gl)
      void this.prepareGPU().catch((error) => {
        if (!this.preparation.signal.aborted) this.failure?.(error);
      });
    this.onMeasured();
  }
  private specification(t: Target): ArrivalSpec {
    const scale = WORLD_HEIGHT / innerHeight;
    const material: MaterialKind = t.node.matches(".muster-parchment")
      ? "parchment"
      : t.node.matches(".muster-chat")
        ? "chat"
        : t.node.matches(".muster-title-group,.muster-quote")
          ? "label"
          : "card";
    return {
      home: cssToWorld(t.rect.x + t.rect.width / 2, t.rect.y + t.rect.height / 2, 0, {
        width: innerWidth,
        height: innerHeight,
      }),
      width: t.rect.width * scale,
      height: t.rect.height * scale,
      start: t.start,
      flight: material === "parchment" || material === "chat" ? 1.19 : 1.02 + (t.index % 3) * 0.075,
      material,
      index: t.index,
    };
  }
  private canonicalPaint(t: Target) {
    const saved = this.targets.map((target) => ({
      target,
      styles: Object.fromEntries(properties.map((p) => [p, target.node.style.getPropertyValue(p)])),
    }));
    try {
      for (const { target } of saved)
        target.lease.withProperties(properties, (element) => {
          const n = element as HTMLElement;
          n.style.transform = target.previous.transform;
          n.style.filter = target.baseFilter || "none";
          n.style.opacity = target.previous.opacity || "1";
          n.style.visibility = "visible";
        });
      return freezeDOMPaint(
        t.node,
        t.rect,
        new Set(this.targets.filter((target) => target !== t).map((target) => target.node)),
      );
    } finally {
      for (const { target, styles } of saved)
        target.lease.withProperties(properties, (element) => {
          for (const p of properties) (element as HTMLElement).style.setProperty(p, styles[p]);
        });
    }
  }
  private backdrop?: MaterialBackdrop;
  async prepare(
    gl: WebGL2RenderingContext,
    signal: AbortSignal,
    onFailure: (reason: unknown) => void,
    backdrop?: MaterialBackdrop,
  ) {
    this.gl = gl;
    this.backdrop = backdrop;
    this.resources = new DOMPaintResources(this.preparation.signal);
    this.failure = onFailure;
    signal.addEventListener("abort", () => this.preparation.abort(), { once: true });
    signal.throwIfAborted();
    await this.prepareGPU();
  }
  private prepareGPU(): Promise<void> {
    if (this.preparing) return this.preparing;
    this.preparing = this.prepareCurrent().finally(() => {
      this.preparing = null;
    });
    return this.preparing;
  }
  private async prepareCurrent() {
    let measured = -1;
    while (!this.disposed && measured !== this.generation) {
      measured = this.generation;
      const jobs: Array<{ key: string; spec: ArrivalSpec; end: number; t: Target }> = [];
      for (const t of this.targets) {
        if (t.rect.width <= 0 || t.rect.height <= 0) continue;
        if (!t.gpu) {
          const binding = new LivePaintBinding(t.node, this.resources!, {
            rect: () => t.rect,
            independent: () => new Set(this.targets.filter((target) => target !== t).map((target) => target.node)),
            overrides: () => new Map(this.targets.map((target) => [target.node, target.previous])),
            pixelRatio: () => devicePixelRatio,
            freeze: () => this.canonicalPaint(t),
            published: (error) => {
              if (this.disposed || this.preparation.signal.aborted) return;
              if (error) this.failure?.(error);
              else this.onMeasured();
            },
          });
          t.gpu = { binding, surface: new PaintSurface(this.gl!) };
        }
        const spec = this.specification(t),
          key = JSON.stringify(spec);
        if (t.gpu.key !== key) jobs.push({ key, spec, end: Math.min(CUT.settled, t.end), t });
      }
      const cacheJob = jobs.length
        ? prepareMaterials<Array<ArrivalMaterialCache & { key: string }>>(
            { arrivals: jobs.map(({ key, spec, end }) => ({ key, spec, end })) },
            this.preparation.signal,
          )
        : Promise.resolve([]);
      await Promise.all(this.targets.map((t) => t.gpu?.binding.paint.flush()));
      const caches = await cacheJob;
      for (const job of jobs) {
        if (this.disposed || !this.targets.includes(job.t) || JSON.stringify(this.specification(job.t)) !== job.key)
          continue;
        const cache = caches.find((c) => c.key === job.key)!;
        const gpu = job.t.gpu!;
        const paint = gpu.binding.paint.current;
        // Texture and mesh dimensions are a single presentation transaction.
        // Keep the previous texture/mesh together until both replacements are
        // ready; never stretch newly reflowed text over the old physical sheet.
        if (
          !paint ||
          Math.abs(paint.width - job.t.rect.width) > 0.001 ||
          Math.abs(paint.height - job.t.rect.height) > 0.001
        )
          continue;
        gpu.motion = new ArrivalMaterial(job.spec, cache);
        gpu.key = job.key;
        gpu.paintSize = [paint.width, paint.height];
        const scale = job.spec.width / paint.width;
        gpu.mesh = new PaintMesh(gpu.motion.sheet, paint.padding * scale, scalePaintInsets(paint.insets, scale));
        gpu.rasterKey = JSON.stringify(paint.insets);
        gpu.surface.topology(gpu.mesh.uv, gpu.mesh.indices);
        gpu.surface.updatePaint(paint);
        job.t.arrival = { key: job.key, path: gpu.motion.body };
      }
      for (const t of this.targets) if (t.gpu?.binding.paint.failure) throw t.gpu.binding.paint.failure;
      this.onMeasured();
    }
  }
  private gpuFrame(time: number, shared?: SurfaceQueue, present = true) {
    const g = this.gl!,
      viewport = { width: innerWidth, height: innerHeight },
      cam = camera(time);
    // The shared compositor owns its linear-light target and depth. Only the
    // standalone canonical-paint diagnostic draws to the default framebuffer.
    if (!shared) g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    const surfaces = shared ?? new SurfaceQueue(g);
    const visible = [];
    for (const t of this.targets) {
      if (present)
        t.lease.withProperties(properties, (element) => {
          const n = element as HTMLElement;
          n.style.transform = t.previous.transform;
          n.style.filter = t.previous.filter;
          n.style.visibility = "visible";
          n.style.opacity = time >= CUT.settled ? t.previous.opacity : "0";
        });
      if (time < t.start || time >= CUT.settled || !t.gpu?.motion || !t.gpu.mesh || !t.gpu.binding.paint.current)
        continue;
      const sample = Math.min(time, t.end, CUT.settled),
        body = t.gpu.motion.body.at(sample);
      visible.push({ t, body, sample });
    }
    visible.sort((a, b) => a.body.position[2] - b.body.position[2]);
    for (const { t, body, sample } of visible) {
      const gpu = t.gpu!;
      const paint = gpu.binding.paint.current!;
      if (
        gpu.paintSize &&
        Math.abs(paint.width - gpu.paintSize[0]) < 0.001 &&
        Math.abs(paint.height - gpu.paintSize[1]) < 0.001
      ) {
        const rasterKey = JSON.stringify(paint.insets);
        if (gpu.rasterKey !== rasterKey) {
          const scale = gpu.motion!.spec.width / paint.width;
          gpu.mesh = new PaintMesh(gpu.motion!.sheet, paint.padding * scale, scalePaintInsets(paint.insets, scale));
          gpu.surface.topology(gpu.mesh.uv, gpu.mesh.indices);
          gpu.rasterKey = rasterKey;
        }
        gpu.surface.updatePaint(paint);
      }
      const points = gpu.mesh!.update(gpu.motion!.sheet.at(sample));
      surfaces.add({
        css: true,
        z: body.position[2],
        draw: (pass) =>
          gpu.surface.draw(
            points,
            body.position,
            body.orientation,
            cam,
            viewport.width,
            viewport.height,
            this.backdrop,
            pass,
          ),
      });
    }
    if (!shared) surfaces.flush();
  }
  /** Canonical nodes remain mounted and receive every application update. Full
   * flight uses their invalidated GPU paint on physical meshes; short/reduced
   * arrival uses the leased native styles. Both return ownership to those same
   * nodes at the settled boundary. */
  frame(time: number, short = false, reduced = false, surfaces?: SurfaceQueue, present = true) {
    const cam = camera(time);
    if (present) {
      if (time >= CUT.settled || (short && time >= 1.9)) delete this.main.dataset.embarkationMaterials;
      else this.main.dataset.embarkationMaterials = "true";
    }
    if (this.gl && !short && !reduced) {
      this.gpuFrame(time, surfaces, present);
      return;
    }
    for (const t of this.targets) {
      const start = short ? 0.6 + (t.start - 30.9) * 0.18 : t.start;
      const end = short ? 1.25 + (t.end - 33.0) * 0.24 : Math.min(CUT.settled, t.end);
      const u = smooth(start, end, time),
        tail = 1 - u;
      const viewport = { width: innerWidth, height: innerHeight };
      const center: [number, number] = [t.rect.x + t.rect.width / 2, t.rect.y + t.rect.height / 2];
      const home = cssToWorld(center[0], center[1], 0, viewport);
      const response = materials.card,
        field = wind(time, home);
      const damping = Math.sin(u * 9.4) * Math.exp(-u * 5) * tail;
      const x = tail * ((t.index % 2 ? 1 : -1) * (innerWidth < 600 ? 45 : 170)) + field[0] * tail * 0.15;
      const y = tail * (innerWidth < 600 ? 72 : 110) + damping * 22;
      const z = -tail * tail * (short ? 260 : 1900);
      const heavy = t.node.matches(".muster-parchment,.muster-chat"),
        flightDuration = heavy ? 1.19 : 1.02 + (t.index % 3) * 0.075;
      t.lease.withProperties(properties, (element) => {
        const n = element as HTMLElement;
        t.projection = [...IDENTITY];
        n.style.visibility = time < start ? "hidden" : "visible";
        n.style.opacity = String(time < start ? 0 : reduced ? u : 1);
        n.style.filter = reduced
          ? t.baseFilter
          : `blur(${tail * tail * 2.3}px) brightness(${1 - tail * 0.18}) ${t.baseFilter}`;
        n.style.transform = reduced
          ? t.base
          : `perspective(1150px) translate3d(${x - cam.position[0] * tail * 0.1}px,${y}px,${z}px) rotateX(${tail * 13 + damping * 3}deg) rotateY(${tail * (t.index % 2 ? 12 : -12)}deg) rotateZ(${tail * (t.index % 2 ? 3 : -3) + (damping / response.inertia) * 12}deg) ${t.base}`;
        if (!short && !reduced) {
          const scale = WORLD_HEIGHT / innerHeight;
          const key = [
            t.rect.x,
            t.rect.y,
            t.rect.width,
            t.rect.height,
            innerWidth,
            innerHeight,
            start,
            flightDuration,
          ].join(":");
          if (!t.arrival || t.arrival.key !== key) {
            const material: MaterialKind = t.node.matches(".muster-parchment")
              ? "parchment"
              : t.node.matches(".muster-chat")
                ? "chat"
                : t.node.matches(".muster-title-group,.muster-quote")
                  ? "label"
                  : "card";
            t.arrival = {
              key,
              path: new ArrivalPath({
                home,
                width: t.rect.width * scale,
                height: t.rect.height * scale,
                start,
                flight: flightDuration,
                material,
                index: t.index,
              }),
            };
          }
          const physical = t.arrival.path.at(Math.max(start, Math.min(time, end)));
          const angles = eulerFromOrientation(physical.orientation);
          const distance = projectWorld(physical.position, cam, viewport).distance;
          n.style.visibility = time < start || distance < 8 ? "hidden" : "visible";
          n.style.opacity = time < start || distance < 8 ? "0" : "1";
          t.projection = planeProjection(center, physical.position, angles, cam, viewport);
          // Cover and readiness remain the canonical descendants. Their flight
          // is explicitly world-space: cancel the parent's projective mapping
          // before applying the child's, instead of stacking two camera lenses.
          const relative = t.parent
            ? multiplyProjection(inverseProjection(t.parent.projection), t.projection)
            : t.projection;
          n.style.transform = cssProjection(relative, t.rect.x + t.origin[0], t.rect.y + t.origin[1]);
          n.style.filter = `blur(${Math.min(5, (Math.abs(distance - 1150) / 1150) * 2.6)}px) ${t.baseFilter}`;
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
  soundCues(): SoundCue[] {
    const cues: SoundCue[] = [];
    for (const target of this.targets) {
      const path = target.arrival?.path;
      if (!path) continue;
      const kind =
        path.spec.material === "chat"
          ? "anchor-heavy"
          : path.spec.material === "parchment" || path.spec.material === "label"
            ? "anchor-paper"
            : "anchor-card";
      for (const capture of path.captures) {
        const pan = soundPan(path.targets[capture.anchor], capture.time, { width: innerWidth, height: innerHeight });
        cues.push({
          id: `arrival:${target.index}:${capture.anchor}`,
          time: capture.time,
          duration: kind === "anchor-heavy" ? 0.23 : 0.14,
          kind,
          energy: (Math.hypot(...capture.velocity) / (1500 + Math.hypot(...capture.velocity))) * 0.45,
          pan: [pan, pan],
          source: `ArrivalPath:${target.index}:capture-${capture.anchor}`,
        });
      }
    }
    return cues;
  }
  rectangles() {
    return this.targets.map((t) => ({
      name: t.node.className,
      parent: t.parent?.node.className ?? null,
      ownership: t.gpu
        ? "independent world-space material; canonical descendants omitted from parent paint"
        : t.parent
          ? "world-space descendant with inverse-parent projection"
          : "world-space root",
      rect: { x: t.rect.x, y: t.rect.y, width: t.rect.width, height: t.rect.height },
      start: t.start,
      catch: t.start + (t.node.matches(".muster-parchment,.muster-chat") ? 1.19 : 1.02 + (t.index % 3) * 0.075),
      end: Math.min(CUT.settled, t.end),
      captureEvents: t.arrival?.path.captures ?? [],
      paint: t.gpu
        ? {
            revision: t.gpu.binding.paint.revision,
            painted: t.gpu.binding.paint.paintedRevision,
            uploads: t.gpu.surface.uploads,
            ready: t.gpu.binding.paint.ready,
            bytes: t.gpu.motion?.sheet.bytes,
          }
        : null,
    }));
  }
  release() {
    this.disposed = true;
    this.preparation.abort();
    delete this.main.dataset.embarkationMaterials;
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    for (const t of this.targets) {
      for (const p of properties) t.node.style.setProperty(p, t.previous[p]);
      t.lease.release();
      t.handle.release();
      t.gpu?.binding.dispose();
      t.gpu?.surface.dispose();
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
