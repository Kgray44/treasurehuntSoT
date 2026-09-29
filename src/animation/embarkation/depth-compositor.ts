/** Shared surface depth. Soft coverage never becomes a rectangular holdout.
 * The first pass writes only effectively opaque texels; the second preserves
 * authored coverage and composites back to front against those same depths.
 * Axial Z sorting is exact for parallel planes and an approximation for
 * intersecting translucent surfaces (opaque intersections use per-fragment Z).
 */
import { sceneColor } from "./scene-color";
import { materialBlend } from "./color";
export const HOLDOUT_ALPHA = 0.995;
export type DepthPass = 0 | 1;
export const surfaceDepthGLSL = `
uniform float depthPass;
void surfaceCoverage(float coverage){
 if(coverage<.002 || (depthPass>.5 && coverage<${HOLDOUT_ALPHA}))discard;
}
`;
export type DepthDraw = {
  z: number;
  draw: (pass: DepthPass) => void;
  additive?: boolean;
  holdout?: boolean;
  css?: boolean;
};
export class SurfaceQueue {
  private items: DepthDraw[] = [];
  constructor(private gl: WebGL2RenderingContext) {}
  add(item: DepthDraw) {
    this.items.push(item);
  }
  holdout() {
    const g = this.gl;
    g.enable(g.DEPTH_TEST);
    g.depthFunc(g.LEQUAL);
    g.colorMask(false, false, false, false);
    g.depthMask(true);
    for (const item of this.items) if (!item.additive && item.holdout !== false) item.draw(1);
  }
  flush() {
    const g = this.gl;
    this.holdout();
    g.colorMask(true, true, true, true);
    g.depthMask(false);
    this.items.sort((a, b) => a.z - b.z);
    for (const item of this.items) {
      sceneColor(g)?.css(Boolean(item.css));
      g.enable(g.DEPTH_TEST);
      g.depthFunc(g.LEQUAL);
      materialBlend(g, item.additive);
      item.draw(0);
    }
    sceneColor(g)?.css(false);
    g.depthMask(false);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  }
}

/** The same surface commands populate an owned, sampleable depth attachment.
 * Default-framebuffer depth formats are implementation-defined: a native
 * Chromium/D3D11 probe rejected its depth blit with INVALID_OPERATION. Drawing
 * the holdouts avoids a format guess and retains multisampled display edges.
 */
export class SurfaceDepth {
  readonly texture: WebGLTexture;
  private framebuffer: WebGLFramebuffer;
  private width = 0;
  private height = 0;
  private checked = false;
  constructor(private gl: WebGL2RenderingContext) {
    this.texture = gl.createTexture()!;
    this.framebuffer = gl.createFramebuffer()!;
  }
  capture(draw: () => void) {
    const g = this.gl,
      framebuffer = g.getParameter(g.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
      width = g.drawingBufferWidth,
      height = g.drawingBufferHeight;
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.checked = false;
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, this.texture);
      for (const key of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER]) g.texParameteri(g.TEXTURE_2D, key, g.NEAREST);
      for (const key of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T]) g.texParameteri(g.TEXTURE_2D, key, g.CLAMP_TO_EDGE);
      g.texImage2D(g.TEXTURE_2D, 0, g.DEPTH_COMPONENT24, width, height, 0, g.DEPTH_COMPONENT, g.UNSIGNED_INT, null);
      g.bindFramebuffer(g.FRAMEBUFFER, this.framebuffer);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.TEXTURE_2D, this.texture, 0);
      g.drawBuffers([g.NONE]);
      g.readBuffer(g.NONE);
      if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
        throw new Error("surface-depth-unavailable");
    }
    g.bindFramebuffer(g.FRAMEBUFFER, this.framebuffer);
    g.depthMask(true);
    g.clearDepth(1);
    g.clear(g.DEPTH_BUFFER_BIT);
    draw();
    g.bindFramebuffer(g.FRAMEBUFFER, framebuffer);
    g.colorMask(true, true, true, true);
    g.depthMask(false);
    if (!this.checked) {
      const error = g.getError();
      if (error !== g.NO_ERROR) throw new Error(`surface-depth-render-${error}`);
      this.checked = true;
    }
    return this.texture;
  }
  get bytes() {
    return this.width * this.height * 4;
  }
  dispose() {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteFramebuffer(this.framebuffer);
  }
}
