export type PaintInsets = { left: number; right: number; top: number; bottom: number };
export type PaintRect = { width: number; height: number; x?: number; y?: number };
export const scalePaintInsets = (insets: PaintInsets, scale: number): PaintInsets => ({
  left: insets.left * scale,
  right: insets.right * scale,
  top: insets.top * scale,
  bottom: insets.bottom * scale,
});
/** Rasterize on the destination's device-pixel grid. Rounding an SVG's width
 * and height while keeping the unrounded viewBox silently rescales its text.
 * Aligning the outer gutter also preserves the native glyph raster phase. */
export function paintRaster(rect: PaintRect, ratio: number, padding: number) {
  const x = rect.x ?? 0,
    y = rect.y ?? 0;
  const left = Math.floor((x - padding) * ratio),
    top = Math.floor((y - padding) * ratio);
  const right = Math.ceil((x + rect.width + padding) * ratio),
    bottom = Math.ceil((y + rect.height + padding) * ratio);
  const width = right - left,
    height = bottom - top;
  const insets = {
    left: x - left / ratio,
    right: right / ratio - x - rect.width,
    top: y - top / ratio,
    bottom: bottom / ratio - y - rect.height,
  };
  return { width, height, cssWidth: width / ratio, cssHeight: height / ratio, insets };
}
