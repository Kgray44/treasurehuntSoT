import { paintRaster, type PaintInsets, type PaintRect } from "./paint-raster";
export type PaintOverrides = ReadonlyMap<Element, Readonly<Record<string, string>>>;
export type PaintBackdrop = { sigma: number; radii: [number, number, number, number] };
export type FrozenPaint = {
  copy: HTMLElement;
  width: number;
  height: number;
  padding: number;
  origin: [number, number];
  backdrop?: PaintBackdrop;
  resources: { target: HTMLElement; property: string; value: string }[];
};
export type DecodedPaint = {
  image: HTMLImageElement;
  width: number;
  height: number;
  padding: number;
  pixelRatio: number;
  insets: PaintInsets;
  backdrop?: PaintBackdrop;
  dispose(): void;
};

/** Freeze one paint revision before any await. Independent child actors keep
 * their layout footprint but contribute no pixels to the parent's material.
 * Overrides contain the scene host's canonical styles, never an interpolated
 * cinematic transform or visibility. The actual DOM is neither moved nor edited. */
export function freezeDOMPaint(
  node: HTMLElement,
  rect: PaintRect,
  independent: ReadonlySet<Element> = new Set(),
  overrides: PaintOverrides = new Map(),
  padding = 24,
): FrozenPaint {
  const copy = node.cloneNode(true) as HTMLElement;
  const originals = [node, ...node.querySelectorAll<HTMLElement>("*")];
  const clones = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
  const resources: FrozenPaint["resources"] = [];
  const rootStyle = getComputedStyle(node);
  const blur = /^blur\(([\d.]+)px\)$/.exec(rootStyle.backdropFilter);
  const backdrop: PaintBackdrop | undefined = blur
    ? {
        sigma: Number(blur[1]),
        radii: [
          rootStyle.borderTopLeftRadius,
          rootStyle.borderTopRightRadius,
          rootStyle.borderBottomRightRadius,
          rootStyle.borderBottomLeftRadius,
        ].map((v) => parseFloat(v) || 0) as PaintBackdrop["radii"],
      }
    : undefined;
  const collect = (target: HTMLElement, property: string, value: string) => {
    if (value.includes("url(")) resources.push({ target, property, value });
  };
  for (let i = 0; i < originals.length; i++) {
    const source = originals[i],
      target = clones[i],
      css = getComputedStyle(source);
    for (const property of css) target.style.setProperty(property, css.getPropertyValue(property));
    for (const [property, value] of Object.entries(overrides.get(source) ?? {})) {
      if (value) target.style.setProperty(property, value);
      else target.style.removeProperty(property);
    }
    target.style.animation = "none";
    target.style.transition = "none";
    // Its backdrop is the live rendered world, not the SVG's empty document.
    if (i === 0 && backdrop) target.style.backdropFilter = "none";
    target.removeAttribute("id");
    target.removeAttribute("name");
    target.removeAttribute("autofocus");
    if (source instanceof HTMLInputElement) {
      target.setAttribute("value", source.value);
      target.toggleAttribute("checked", source.checked);
    }
    if (source instanceof HTMLTextAreaElement) target.textContent = source.value;
    if (source instanceof HTMLSelectElement)
      Array.from((target as HTMLSelectElement).options).forEach((option, n) =>
        option.toggleAttribute("selected", source.options[n].selected),
      );
    if (source instanceof HTMLImageElement) {
      resources.push({ target, property: "src", value: source.currentSrc || source.src });
      target.removeAttribute("srcset");
      target.removeAttribute("loading");
    }
    for (const property of ["background-image", "mask-image", "border-image-source"])
      collect(target, property, css.getPropertyValue(property));
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(source, pseudo);
      if (style.content === "none" || style.content === "normal" || !style.content) continue;
      const span = document.createElement("span");
      for (const property of style) span.style.setProperty(property, style.getPropertyValue(property));
      span.textContent = style.content.replace(/^["']|["']$/g, "");
      collect(span, "background-image", style.backgroundImage);
      if (pseudo === "::before") target.prepend(span);
      else target.append(span);
    }
  }
  for (let i = 1; i < originals.length; i++)
    if (independent.has(originals[i])) {
      // Opacity on the subtree also covers descendants with explicit visibility.
      clones[i].style.opacity = "0";
    }
  Object.assign(copy.style, {
    position: "relative",
    inset: "auto",
    left: "0px",
    top: "0px",
    margin: "0px",
    transform: "none",
    opacity: "1",
    visibility: "visible",
    boxSizing: "border-box",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  copy.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  return {
    copy,
    width: rect.width,
    height: rect.height,
    origin: [rect.x ?? 0, rect.y ?? 0],
    padding,
    resources,
    backdrop,
  };
}

/** Task-local asset cache shared by all paint revisions. No screenshots, text,
 * or raster content leave the browser. URL transport occurs on content/layout
 * invalidation only; physical deformation uses reusable GPU vertex buffers. */
export class DOMPaintResources {
  private assets = new Map<string, Promise<string>>();
  private fonts: Promise<string> | null = null;
  constructor(private signal: AbortSignal) {}
  private inline(url: string) {
    if (url.startsWith("data:")) return Promise.resolve(url);
    const absolute = new URL(url, location.href);
    if (absolute.origin !== location.origin)
      return Promise.reject(new Error("Live paint requires same-origin artwork"));
    let job = this.assets.get(absolute.href);
    if (!job) {
      job = fetch(absolute.href, { signal: this.signal }).then(async (response) => {
        if (!response.ok) throw new Error("Live paint resource unavailable");
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });
      this.assets.set(absolute.href, job);
      void job.catch(() => {
        this.assets.delete(absolute.href);
      });
    }
    return job;
  }
  private async inlineURLs(value: string, base = location.href) {
    let text = value;
    for (const match of [...text.matchAll(/url\(["']?([^"')]+)["']?\)/g)])
      text = text.replace(match[0], `url("${await this.inline(new URL(match[1], base).href)}")`);
    return text;
  }
  private fontFaces() {
    return (this.fonts ??= (async () => {
      await document.fonts.ready;
      const jobs: Promise<string>[] = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules)
            if (rule instanceof CSSFontFaceRule) jobs.push(this.inlineURLs(rule.cssText, sheet.href ?? location.href));
        } catch {
          /* Cross-origin sheets are not a supported live-paint input. */
        }
      }
      return (await Promise.all(jobs)).join("\n");
    })());
  }
  async decode(paint: FrozenPaint, pixelRatio = devicePixelRatio): Promise<DecodedPaint> {
    const fonts = this.fontFaces();
    await Promise.all(
      paint.resources.map(async ({ target, property, value }) => {
        if (property === "src") target.setAttribute("src", await this.inline(value));
        else target.style.setProperty(property, await this.inlineURLs(value));
      }),
    );
    const { width, height, padding } = paint;
    const raster = paintRaster({ width, height, x: paint.origin[0], y: paint.origin[1] }, pixelRatio, padding);
    // SVG viewBox magnification happens after layout. It rounds a computed
    // 1.6 CSS-pixel native border to one SVG pixel before scaling, although at
    // DPR 1.25 it occupies exactly two device pixels in the canonical DOM.
    // Layout at the destination device scale instead, including font hinting,
    // border quantization and image sampling; the SVG itself has a 1:1 viewBox.
    paint.copy.style.zoom = String(pixelRatio);
    const xml = new XMLSerializer().serializeToString(paint.copy);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${raster.width}" height="${raster.height}" viewBox="0 0 ${raster.width} ${raster.height}"><style>${await fonts}</style><foreignObject x="${raster.insets.left * pixelRatio}" y="${raster.insets.top * pixelRatio}" width="${width * pixelRatio}" height="${height * pixelRatio}" overflow="visible">${xml}</foreignObject></svg>`;
    this.signal.throwIfAborted();
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    try {
      await image.decode();
      this.signal.throwIfAborted();
    } catch (error) {
      image.src = "";
      throw error;
    }
    return {
      image,
      width,
      height,
      padding,
      pixelRatio,
      insets: raster.insets,
      backdrop: paint.backdrop,
      dispose: () => {
        image.src = "";
      },
    };
  }
}
