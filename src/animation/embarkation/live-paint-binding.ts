import {
  DOMPaintResources,
  freezeDOMPaint,
  type DecodedPaint,
  type PaintOverrides,
  type FrozenPaint,
} from "./dom-paint";
import { LivePaint } from "./live-paint";
import type { PaintRect } from "./paint-raster";

type PaintBindingOptions = {
  rect(): PaintRect;
  independent(): ReadonlySet<Element>;
  overrides(): PaintOverrides;
  pixelRatio(): number;
  padding?: number;
  freeze?(): FrozenPaint;
  published?(error: unknown | null): void;
};
const cinematicProperties = new Set(["transform", "opacity", "filter", "visibility"]);
/** Observe canonical data and layout, not animation ticks. Caller supplies the
 * scene's clean layout measurement and style overrides. Independent descendants
 * have their own binding and are omitted from this parent's paint. */
export class LivePaintBinding {
  readonly paint: LivePaint<DecodedPaint>;
  private mutations: MutationObserver;
  private resize: ResizeObserver;
  private signatures = new WeakMap<Element, string>();
  private layoutKey = "";
  constructor(
    readonly node: HTMLElement,
    resources: DOMPaintResources,
    private options: PaintBindingOptions,
  ) {
    this.paint = new LivePaint(() => {
      // freezeDOMPaint is synchronous even when resource decode is still pending.
      const rect = options.rect();
      this.layoutKey = this.rasterKey(rect);
      const frozen =
        options.freeze?.() ?? freezeDOMPaint(node, rect, options.independent(), options.overrides(), options.padding);
      return resources.decode(frozen, options.pixelRatio());
    }, options.published);
    this.signatures.set(node, this.styleSignature(node));
    this.mutations = new MutationObserver((records) => {
      if (records.some((record) => this.affectsPaint(record))) this.paint.invalidate();
    });
    this.mutations.observe(node, { subtree: true, childList: true, characterData: true, attributes: true });
    this.resize = new ResizeObserver(() => this.layoutChanged());
    this.resize.observe(node);
    node.addEventListener("input", this.changed);
    node.addEventListener("change", this.changed);
    node.addEventListener("load", this.changed, true);
    this.paint.invalidate();
  }
  private changed = () => this.paint.invalidate();
  private rasterKey(rect: PaintRect) {
    const ratio = this.options.pixelRatio();
    return [rect.width, rect.height, ratio, ((rect.x ?? 0) * ratio) % 1, ((rect.y ?? 0) * ratio) % 1].join(":");
  }
  /** Called after the scene's canonical measurement, also covering position-
   * driven reflow and DPR changes whose observer callbacks arrive in any order. */
  layoutChanged() {
    const r = this.options.rect(),
      key = this.rasterKey(r);
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.paint.invalidate();
    }
  }
  private styleSignature(node: Element) {
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) return "";
    const owned = this.options.overrides().has(node);
    return Array.from(node.style)
      .filter((p) => !owned || !cinematicProperties.has(p))
      .map((p) => `${p}:${node.style.getPropertyValue(p)}!${node.style.getPropertyPriority(p)}`)
      .join(";");
  }
  private affectsPaint(record: MutationRecord) {
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    const excluded = this.options.independent();
    for (let ancestor = target; ancestor && ancestor !== this.node; ancestor = ancestor.parentElement)
      if (excluded.has(ancestor)) return false;
    if (record.type === "attributes" && target) {
      if (record.attributeName === "style") {
        const value = this.styleSignature(target),
          previous = this.signatures.get(target);
        this.signatures.set(target, value);
        return value !== (previous ?? "");
      }
      // Accessibility/lifecycle ownership does not change painted content.
      if (["inert", "aria-hidden", "tabindex", "data-embarkation-materials"].includes(record.attributeName ?? ""))
        return false;
    }
    return true;
  }
  dispose() {
    this.mutations.disconnect();
    this.resize.disconnect();
    this.node.removeEventListener("input", this.changed);
    this.node.removeEventListener("change", this.changed);
    this.node.removeEventListener("load", this.changed, true);
    this.paint.dispose();
  }
}
