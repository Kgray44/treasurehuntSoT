/** The film works in linear sRGB primaries, with premultiplied coverage. Art is
 * display-referred sRGB; coverage/depth/noise/matte channels are numeric data.
 * CSS paint and CSS blur retain their specified display-referred operations at
 * an explicit boundary, rather than acquiring a different look at DOM handoff. */
export const colorGLSL = `
vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow(max((c+.055)/1.055,vec3(0.)),vec3(2.4)),step(vec3(.04045),c));}
vec3 linearToSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec4 linearPremult(vec4 c){return vec4(c.a>.000001?srgbToLinear(c.rgb/c.a)*c.a:vec3(0.),c.a);}
vec4 displayPremult(vec4 c){return vec4(c.a>.000001?linearToSrgb(c.rgb/c.a)*c.a:vec3(0.),c.a);}
vec4 artwork(sampler2D image,vec2 uv){vec4 c=texture(image,uv);return vec4(c.a>.000001?c.rgb/c.a:vec3(0.),c.a);}
// Authored display-color grades are distinct from illumination. Applying a
// look here preserves the accepted palette; subsequent light/fog is linear.
vec3 displayGrade(vec3 c,vec3 gain,vec3 lift){return srgbToLinear(linearToSrgb(c)*gain+lift);}
`;
export function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function linearToSrgb(c: number) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}
export const DATA_TEXTURES = new Set([
  "aperture",
  "reconciliationMask",
  "backingAperture",
  "matte0",
  "matte1",
  "matte2",
  "livingMasks",
]);
export type ColorStorage = { internal: number; type: number; bytes: number; label: string };
/** Light adds radiance; coverage remains bounded. RGBA8 used to hide additive
 * alpha overflow by clamping. In float storage it would darken presentation
 * when unpremultiplying a coverage value greater than one. */
export function materialBlend(g: WebGL2RenderingContext, additive = false) {
  g.blendFuncSeparate(g.ONE, additive ? g.ONE : g.ONE_MINUS_SRC_ALPHA, g.ONE, g.ONE_MINUS_SRC_ALPHA);
}
export function linearStorage(g: WebGL2RenderingContext, forceFallback = false): ColorStorage {
  // Half-float filtering is WebGL2 core. Renderability is NOT; verify the
  // extension and the actual attachment. The sRGB fallback still blends in
  // linear light and preserves dark gradients better than linear RGBA8.
  return !forceFallback && g.getExtension("EXT_color_buffer_float")
    ? { internal: g.RGBA16F, type: g.HALF_FLOAT, bytes: 8, label: "RGBA16F linear premultiplied" }
    : { internal: g.SRGB8_ALPHA8, type: g.UNSIGNED_BYTE, bytes: 4, label: "SRGB8_ALPHA8 linear blend fallback" };
}
const vertex = `#version 300 es
precision highp float;out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;in vec2 uv;out vec4 color;
uniform sampler2D source;uniform int operation;
${colorGLSL}
void main(){vec4 c=texture(source,uv);
 if(operation==1)color=displayPremult(c);
 else if(operation==2)color=linearPremult(c);
 else if(operation==3)color=vec4(c.rgb*c.a,c.a);
 else color=c;}`;

/** Small shared transfer pass. It never invents exposure, tone mapping or a
 * creative grade. The display transform is the IEC sRGB transfer alone. */
export class ColorTransfer {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private source: WebGLUniformLocation | null;
  private operation: WebGLUniformLocation | null;
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
        throw new Error(g.getShaderInfoLog(shader) ?? "color-shader");
      g.attachShader(this.program, shader);
      g.deleteShader(shader);
    }
    g.linkProgram(this.program);
    if (!g.getProgramParameter(this.program, g.LINK_STATUS))
      throw new Error(g.getProgramInfoLog(this.program) ?? "color-link");
    this.vao = g.createVertexArray()!;
    this.source = g.getUniformLocation(this.program, "source");
    this.operation = g.getUniformLocation(this.program, "operation");
  }
  draw(texture: WebGLTexture, operation: 0 | 1 | 2 | 3) {
    const g = this.gl;
    g.useProgram(this.program);
    g.bindVertexArray(this.vao);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, texture);
    g.uniform1i(this.source, 0);
    g.uniform1i(this.operation, operation);
    g.disable(g.BLEND);
    g.disable(g.DEPTH_TEST);
    g.depthMask(false);
    g.colorMask(true, true, true, true);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  }
  dispose() {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
  }
}

export function allocateColor(
  g: WebGL2RenderingContext,
  texture: WebGLTexture,
  w: number,
  h: number,
  storage: ColorStorage,
) {
  g.bindTexture(g.TEXTURE_2D, texture);
  for (const parameter of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER])
    g.texParameteri(g.TEXTURE_2D, parameter, g.LINEAR);
  for (const parameter of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T])
    g.texParameteri(g.TEXTURE_2D, parameter, g.CLAMP_TO_EDGE);
  g.texImage2D(g.TEXTURE_2D, 0, storage.internal, w, h, 0, g.RGBA, storage.type, null);
}

/** Decode once BEFORE premultiplication and mip generation. Transparent black
 * cannot contaminate soft edges. Data inputs bypass both color and alpha math.
 * Source bitmaps are decoded into an explicit sRGB canvas by the caller. */
export class ArtworkUpload {
  private transfer: ColorTransfer;
  private framebuffer: WebGLFramebuffer;
  readonly storage: ColorStorage;
  constructor(
    private gl: WebGL2RenderingContext,
    forceFallback = false,
  ) {
    this.transfer = new ColorTransfer(gl);
    this.framebuffer = gl.createFramebuffer()!;
    this.storage = linearStorage(gl, forceFallback);
  }
  upload(image: TexImageSource, width: number, height: number, data = false, flip = true) {
    const g = this.gl,
      result = g.createTexture()!,
      source = data ? result : g.createTexture()!;
    const previous = {
      framebuffer: g.getParameter(g.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
      viewport: g.getParameter(g.VIEWPORT) as Int32Array,
      flip: g.getParameter(g.UNPACK_FLIP_Y_WEBGL),
      premult: g.getParameter(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL),
      color: g.getParameter(g.UNPACK_COLORSPACE_CONVERSION_WEBGL),
    };
    try {
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, source);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, flip);
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL, g.NONE);
      g.texImage2D(g.TEXTURE_2D, 0, data ? g.RGBA8 : g.SRGB8_ALPHA8, g.RGBA, g.UNSIGNED_BYTE, image);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
      if (!data) {
        allocateColor(g, result, width, height, this.storage);
        g.bindFramebuffer(g.FRAMEBUFFER, this.framebuffer);
        g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, result, 0);
        if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw new Error("art-color-target");
        g.viewport(0, 0, width, height);
        this.transfer.draw(source, 3);
      }
      g.bindTexture(g.TEXTURE_2D, result);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.generateMipmap(g.TEXTURE_2D);
      return { value: result, width, height, bytes: (width * height * (data ? 4 : this.storage.bytes) * 4) / 3 };
    } catch (error) {
      g.deleteTexture(result);
      throw error;
    } finally {
      if (!data) g.deleteTexture(source);
      g.bindFramebuffer(g.FRAMEBUFFER, previous.framebuffer);
      g.viewport(...(previous.viewport as unknown as [number, number, number, number]));
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, previous.flip);
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, previous.premult);
      g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL, previous.color);
    }
  }
  dispose() {
    this.transfer.dispose();
    this.gl.deleteFramebuffer(this.framebuffer);
  }
}
