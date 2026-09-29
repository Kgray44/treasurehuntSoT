import { sceneColor } from "./scene-color";

/** Gaussian CSS blur kernel in framebuffer pixels. CSS blur() specifies sigma,
 * not a box radius: https://www.w3.org/TR/filter-effects-1/#funcdef-filter-blur */
export function gaussianKernel(sigma: number) {
  const radius = Math.min(128, Math.ceil(Math.max(0, sigma) * 3));
  const weights = new Float32Array(129);
  if (sigma <= 0) {
    weights[0] = 1;
    return { radius: 0, weights };
  }
  let sum = 0;
  for (let i = 0; i <= radius; i++) {
    weights[i] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += weights[i] * (i ? 2 : 1);
  }
  for (let i = 0; i <= radius; i++) weights[i] /= sum;
  return { radius, weights };
}

const vertex = `#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
uniform sampler2D source;
uniform vec2 direction;
uniform int radius;
uniform float weights[129];
in vec2 uv;out vec4 color;
void main(){vec4 c=texture(source,uv)*weights[0];
 for(int i=1;i<=128;i++){if(i>radius)break;vec2 d=direction*float(i);c+=(texture(source,uv+d)+texture(source,uv-d))*weights[i];}
 color=c;}`;

/** Same-frame scenery for the incoming glass materials. GPU copies and two
 * separable passes replace the missing DOM backdrop; no CPU readback, PNG or
 * data URL is produced. Equal radii share their result within one frame.
 * CSS filter functions explicitly operate in sRGB (Filter Effects 1). This
 * buffer is a declared display-referred boundary: encode the linear scenery
 * once, blur in CSS's domain, composite in the shared CSS surface group.
 */
export class MaterialBackdrop {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private fbo: WebGLFramebuffer;
  private source: WebGLTexture;
  private scratch: WebGLTexture;
  private outputs = new Map<number, { texture: WebGLTexture; generation: number }>();
  private generation = 0;
  private width = 0;
  private height = 0;
  private uniforms: Record<string, WebGLUniformLocation | null>;
  constructor(private gl: WebGL2RenderingContext) {
    const g = gl;
    this.program = g.createProgram()!;
    for (const [type, code] of [
      [g.VERTEX_SHADER, vertex],
      [g.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = g.createShader(type)!;
      g.shaderSource(shader, code);
      g.compileShader(shader);
      if (!g.getShaderParameter(shader, g.COMPILE_STATUS))
        throw new Error(g.getShaderInfoLog(shader) ?? "Backdrop shader failed");
      g.attachShader(this.program, shader);
      g.deleteShader(shader);
    }
    g.linkProgram(this.program);
    if (!g.getProgramParameter(this.program, g.LINK_STATUS))
      throw new Error(g.getProgramInfoLog(this.program) ?? "Backdrop program failed");
    this.vao = g.createVertexArray()!;
    this.fbo = g.createFramebuffer()!;
    this.uniforms = Object.fromEntries(
      ["source", "direction", "radius", "weights[0]"].map((name) => [name, g.getUniformLocation(this.program, name)]),
    );
    this.source = this.texture();
    this.scratch = this.texture();
  }
  private texture() {
    const g = this.gl,
      t = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, t);
    for (const parameter of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER])
      g.texParameteri(g.TEXTURE_2D, parameter, g.LINEAR);
    for (const parameter of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T])
      g.texParameteri(g.TEXTURE_2D, parameter, g.CLAMP_TO_EDGE);
    return t;
  }
  private allocate(texture: WebGLTexture) {
    const g = this.gl;
    g.bindTexture(g.TEXTURE_2D, texture);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, this.width, this.height, 0, g.RGBA, g.UNSIGNED_BYTE, null);
  }
  capture() {
    const g = this.gl;
    g.activeTexture(g.TEXTURE0);
    if (this.width !== g.drawingBufferWidth || this.height !== g.drawingBufferHeight) {
      this.width = g.drawingBufferWidth;
      this.height = g.drawingBufferHeight;
      this.allocate(this.source);
      this.allocate(this.scratch);
      for (const output of this.outputs.values()) g.deleteTexture(output.texture);
      this.outputs.clear();
    }
    const scene = sceneColor(g);
    if (scene) scene.copyTo(this.source, true);
    else {
      g.bindTexture(g.TEXTURE_2D, this.source);
      g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, this.width, this.height);
    }
    this.generation++;
  }
  blurred(sigmaCss: number, cssWidth: number): WebGLTexture | null {
    if (!this.generation) return null;
    const g = this.gl,
      sigma = (sigmaCss * this.width) / cssWidth;
    let output = this.outputs.get(sigma);
    if (!output) {
      output = { texture: this.texture(), generation: -1 };
      this.allocate(output.texture);
      this.outputs.set(sigma, output);
    }
    if (output.generation === this.generation) return output.texture;
    const kernel = gaussianKernel(sigma);
    const colorMask = g.getParameter(g.COLOR_WRITEMASK) as boolean[];
    const depthMask = g.getParameter(g.DEPTH_WRITEMASK) as boolean;
    const depthTest = g.isEnabled(g.DEPTH_TEST);
    const framebuffer = g.getParameter(g.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    g.colorMask(true, true, true, true);
    g.depthMask(false);
    g.useProgram(this.program);
    g.bindVertexArray(this.vao);
    g.disable(g.BLEND);
    g.disable(g.DEPTH_TEST);
    g.bindFramebuffer(g.FRAMEBUFFER, this.fbo);
    g.viewport(0, 0, this.width, this.height);
    g.activeTexture(g.TEXTURE0);
    g.uniform1i(this.uniforms.source, 0);
    g.uniform1i(this.uniforms.radius, kernel.radius);
    g.uniform1fv(this.uniforms["weights[0]"], kernel.weights);
    const pass = (from: WebGLTexture, to: WebGLTexture, x: number, y: number) => {
      g.bindTexture(g.TEXTURE_2D, from);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, to, 0);
      g.uniform2f(this.uniforms.direction, x, y);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
    pass(this.source, this.scratch, 1 / this.width, 0);
    pass(this.scratch, output.texture, 0, 1 / this.height);
    g.bindFramebuffer(g.FRAMEBUFFER, framebuffer);
    g.colorMask(colorMask[0], colorMask[1], colorMask[2], colorMask[3]);
    g.depthMask(depthMask);
    if (depthTest) g.enable(g.DEPTH_TEST);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    output.generation = this.generation;
    return output.texture;
  }
  get bytes() {
    return this.width * this.height * 4 * (2 + this.outputs.size);
  }
  dispose() {
    const g = this.gl;
    for (const texture of [this.source, this.scratch, ...[...this.outputs.values()].map((o) => o.texture)])
      g.deleteTexture(texture);
    this.outputs.clear();
    g.deleteFramebuffer(this.fbo);
    g.deleteVertexArray(this.vao);
    g.deleteProgram(this.program);
  }
}
