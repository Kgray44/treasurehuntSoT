import { allocateColor, ColorTransfer, linearStorage, type ColorStorage } from "./color";

const scenes = new WeakMap<WebGL2RenderingContext, SceneColor>();
export function sceneColor(gl: WebGL2RenderingContext) {
  return scenes.get(gl);
}
type Target = { draw: WebGLFramebuffer; read: WebGLFramebuffer; texture: WebGLTexture; color: WebGLRenderbuffer };

/** Owned linear-light scene with shared depth and explicit display boundaries.
 * MSAA counts are queried for BOTH color formats and depth; float MSAA is
 * optional in WebGL2. A supported sRGB attachment is the precision fallback,
 * not an encoded-RGB blend approximation. No default framebuffer is sampled. */
export class SceneColor {
  readonly storage: ColorStorage;
  readonly samples: number;
  private displayStorage: ColorStorage;
  private linear: Target;
  private display: Target;
  private depth: WebGLRenderbuffer;
  private copyFramebuffer: WebGLFramebuffer;
  private transfer: ColorTransfer;
  private width = 0;
  private height = 0;
  private displayActive = false;
  private displayAllocated = false;
  constructor(
    private gl: WebGL2RenderingContext,
    forceFallback = false,
  ) {
    const g = gl;
    this.storage = linearStorage(g, forceFallback);
    this.displayStorage =
      this.storage.internal === g.RGBA16F
        ? this.storage
        : { internal: g.RGBA8, type: g.UNSIGNED_BYTE, bytes: 4, label: "CSS encoded sRGB premultiplied" };
    const supported = [this.storage.internal, this.displayStorage.internal, g.DEPTH_COMPONENT24].map((format) =>
      Array.from(g.getInternalformatParameter(g.RENDERBUFFER, format, g.SAMPLES) as Int32Array),
    );
    const desired = g.getContextAttributes()?.antialias ? 4 : 0;
    this.samples = Math.max(
      0,
      ...supported[0].filter((n) => n <= desired && supported.every((list) => list.includes(n))),
    );
    const target = (): Target => ({
      draw: g.createFramebuffer()!,
      read: g.createFramebuffer()!,
      texture: g.createTexture()!,
      color: g.createRenderbuffer()!,
    });
    this.linear = target();
    this.display = target();
    this.depth = g.createRenderbuffer()!;
    this.copyFramebuffer = g.createFramebuffer()!;
    this.transfer = new ColorTransfer(g);
    scenes.set(g, this);
  }
  private allocate(target: Target, format: ColorStorage) {
    const g = this.gl;
    allocateColor(g, target.texture, this.width, this.height, format);
    g.bindFramebuffer(g.FRAMEBUFFER, target.read);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, target.texture, 0);
    g.bindFramebuffer(g.FRAMEBUFFER, target.draw);
    if (this.samples) {
      g.bindRenderbuffer(g.RENDERBUFFER, target.color);
      g.renderbufferStorageMultisample(g.RENDERBUFFER, this.samples, format.internal, this.width, this.height);
      g.framebufferRenderbuffer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.RENDERBUFFER, target.color);
    } else g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, target.texture, 0);
    g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, this.depth);
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw new Error("scene-color-target");
    g.bindFramebuffer(g.FRAMEBUFFER, target.read);
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw new Error("scene-color-resolve");
  }
  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    const g = this.gl;
    this.width = width;
    this.height = height;
    g.activeTexture(g.TEXTURE0);
    g.bindRenderbuffer(g.RENDERBUFFER, this.depth);
    if (this.samples)
      g.renderbufferStorageMultisample(g.RENDERBUFFER, this.samples, g.DEPTH_COMPONENT24, width, height);
    else g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT24, width, height);
    this.allocate(this.linear, this.storage);
    if (this.displayAllocated) this.allocate(this.display, this.displayStorage);
    this.bind();
  }
  bind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, (this.displayActive ? this.display : this.linear).draw);
  }
  resolve() {
    const g = this.gl,
      target = this.displayActive ? this.display : this.linear;
    if (this.samples) {
      g.bindFramebuffer(g.READ_FRAMEBUFFER, target.draw);
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER, target.read);
      g.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, g.COLOR_BUFFER_BIT, g.NEAREST);
    }
    this.bind();
    return target.texture;
  }
  /** Convert directly on GPU into a caller-owned target. The caller declares
   * whether it needs linear light (lens/fog) or CSS display values (blur). */
  copyTo(texture: WebGLTexture, display = false) {
    const g = this.gl,
      source = this.resolve();
    const depth = g.isEnabled(g.DEPTH_TEST);
    g.bindFramebuffer(g.FRAMEBUFFER, this.copyFramebuffer);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, texture, 0);
    g.viewport(0, 0, this.width, this.height);
    this.transfer.draw(source, display ? 1 : 0);
    this.bind();
    if (depth) g.enable(g.DEPTH_TEST);
  }
  /** Canonical CSS compositing is specified in encoded sRGB. Preserve it as a
   * bounded group, including shared depth, then return to linear light. Adjacent
   * CSS surfaces are grouped by SurfaceQueue to avoid per-object full copies. */
  css(enabled: boolean) {
    if (enabled === this.displayActive) return;
    const g = this.gl,
      source = this.resolve(),
      depth = g.isEnabled(g.DEPTH_TEST);
    if (enabled && !this.displayAllocated) {
      this.allocate(this.display, this.displayStorage);
      this.displayAllocated = true;
    }
    this.displayActive = enabled;
    this.bind();
    g.viewport(0, 0, this.width, this.height);
    this.transfer.draw(source, enabled ? 1 : 2);
    if (depth) g.enable(g.DEPTH_TEST);
  }
  present() {
    const g = this.gl,
      texture = this.resolve();
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, this.width, this.height);
    this.transfer.draw(texture, this.displayActive ? 0 : 1);
  }
  get bytes() {
    const pixels = this.width * this.height;
    return (
      pixels *
      (this.storage.bytes * (1 + this.samples) +
        4 * Math.max(1, this.samples) +
        (this.displayAllocated ? this.displayStorage.bytes * (1 + this.samples) : 0))
    );
  }
  dispose() {
    const g = this.gl;
    for (const t of [this.linear, this.display]) {
      g.deleteTexture(t.texture);
      g.deleteRenderbuffer(t.color);
      g.deleteFramebuffer(t.draw);
      g.deleteFramebuffer(t.read);
    }
    g.deleteRenderbuffer(this.depth);
    g.deleteFramebuffer(this.copyFramebuffer);
    this.transfer.dispose();
    scenes.delete(g);
  }
}
