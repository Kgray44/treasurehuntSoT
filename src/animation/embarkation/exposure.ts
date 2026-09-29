import { camera, CUT, focusPose, mix, smooth, type Tier } from "./program";
import { FOCAL, WORLD_HEIGHT, rotateRoll, type CameraFrame, type Point3 } from "./projection";
import { EXTERIOR } from "./scene-space";
import { colorGLSL } from "./color";

/** A 180-degree shutter at the authored 60 fps acquisition rate. Playback
 * inspection speed, monitor refresh and actual frame cadence never retime it. */
export const FILM_SHUTTER = { acquisitionFPS: 60, angle: 180 } as const;
export const EXPOSURE_SECONDS = FILM_SHUTTER.angle / 360 / FILM_SHUTTER.acquisitionFPS;
export type LensSample = { aperture: [number, number]; focus: number };
export type ExposureSample = LensSample & { time: number; weight: number };
export function focusDistance(time: number, width: number, height: number, origin?: Parameters<typeof focusPose>[3]) {
  const eyeZ = camera(time).position[2] + FOCAL;
  const title = Math.max(100, eyeZ - focusPose(time, width, height, origin).position[2]);
  const wonder = mix(title, 12500, smooth(15.5, 18.7, time));
  // While backing inside, the threshold lantern initially lies BEHIND the
  // eye. Clamping its negative distance to a near focus plane invents a macro
  // focus pull and spreads the distant world into discrete aperture images.
  // Rack toward the architecture entering view instead. Near-lens lanterns
  // remain naturally defocused while the opening establishes the new place.
  const threshold = mix(wonder, Math.max(FOCAL, eyeZ - EXTERIOR.openingZ), smooth(27.4, 28.65, time));
  return mix(threshold, FOCAL, smooth(29.3, CUT.room, time));
}
export function exposureSamples(
  time: number,
  tier: Tier,
  width: number,
  height: number,
  origin?: Parameters<typeof focusPose>[3],
): ExposureSample[] {
  const count = tier === "CINEMATIC" ? 9 : tier === "BALANCED" ? 5 : 3;
  const focus = focusDistance(time, width, height, origin);
  // Stop down during the final dolly, before the spatial room converges onto
  // its canonical painted projection. Otherwise flattening its depths at 31s
  // snaps blurred lanterns/water into focus in one frame. Temporal exposure is
  // still applied to every moving incoming surface across the same shutter.
  const aperture = 4.5 * smooth(0.65, 3, time) * (1 - smooth(29.3, CUT.room, time));
  const samples = Array.from({ length: count }, (_, i) => {
    const centered = i - (count - 1) / 2;
    // Paired lens positions, plus the optical center. The central instant is
    // rendered last so canonical DOM presentation is restored to current time.
    const pair = Math.abs(centered),
      angle = pair * 2.399963229728653;
    const radius = Math.sqrt(pair / ((count - 1) / 2 + 1)) * aperture * Math.sign(centered);
    return {
      time: time + (centered / count) * EXPOSURE_SECONDS,
      weight: 1 / count,
      aperture: [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number],
      focus,
    };
  });
  samples.push(...samples.splice((count - 1) / 2, 1));
  return samples;
}
const lensState = new WeakMap<WebGL2RenderingContext, LensSample>();
const uniformCache = new WeakMap<
  WebGLProgram,
  { aperture: WebGLUniformLocation | null; focus: WebGLUniformLocation | null }
>();
export function setFilmLens(gl: WebGL2RenderingContext, lens: LensSample) {
  lensState.set(gl, lens);
}
export function filmLens(gl: WebGL2RenderingContext): LensSample {
  return lensState.get(gl) ?? { aperture: [0, 0], focus: FOCAL };
}
export function bindFilmLens(gl: WebGL2RenderingContext, program: WebGLProgram) {
  let locations = uniformCache.get(program);
  if (!locations) {
    locations = {
      aperture: gl.getUniformLocation(program, "filmAperture"),
      focus: gl.getUniformLocation(program, "filmFocus"),
    };
    uniformCache.set(program, locations);
  }
  const lens = filmLens(gl);
  gl.uniform2fv(locations.aperture, lens.aperture);
  gl.uniform1f(locations.focus, lens.focus);
}
/** CPU oracle for the thin-lens projection used in native qualification. */
export function lensProject(point: Point3, cam: CameraFrame, width: number, height: number, lens: LensSample) {
  const p = rotateRoll(point.map((v, i) => v - cam.position[i]) as Point3, -cam.roll),
    d = FOCAL - p[2];
  return {
    x: width / 2 + (((p[0] * FOCAL) / d + lens.aperture[0] * FOCAL * (1 / lens.focus - 1 / d)) * height) / WORLD_HEIGHT,
    y:
      height / 2 - (((p[1] * FOCAL) / d + lens.aperture[1] * FOCAL * (1 / lens.focus - 1 / d)) * height) / WORLD_HEIGHT,
    distance: d,
  };
}

const vertex = `#version 300 es
precision highp float;layout(location=0)in vec2 uv;out vec2 vUV;
void main(){vUV=uv;gl_Position=vec4(uv*2.-1.,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;in vec2 vUV;out vec4 color;
uniform sampler2D currentImage,previousImage;uniform float weight;uniform int mode;uniform bool inputLinear;
${colorGLSL}
void main(){vec4 c=texture(currentImage,vUV);
 if(mode==0)color=(inputLinear?c:linearPremult(c))*weight;
 else if(mode==1)color=displayPremult(mix(linearPremult(texture(previousImage,vUV)),inputLinear?c:linearPremult(c),weight));
 else if(mode==2)color=displayPremult(c);
 else color=c;
}`;

/** Temporal integration of real rasterized geometry, including cutout alpha.
 * High precision is capability checked. The bounded RGBA8 fallback keeps a
 * running mean in encoded storage, decoding for every linear-light average.
 * Scene inputs are already linear; standalone encoded-input probes explicitly
 * use the default framebuffer path. Never decode the scene a second time.
 */
export class FrameExposure {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private vertices: WebGLBuffer;
  private framebuffer: WebGLFramebuffer;
  private sample: WebGLTexture;
  private targets: WebGLTexture[][] = [];
  private active = [0, 0];
  private counts = [0, 0];
  private width = 0;
  private height = 0;
  readonly floating: boolean;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  constructor(
    private gl: WebGL2RenderingContext,
    encodedFallback = false,
  ) {
    const g = gl;
    this.floating = Boolean(g.getExtension("EXT_color_buffer_float")) && !encodedFallback;
    this.program = g.createProgram()!;
    for (const [type, source] of [
      [g.VERTEX_SHADER, vertex],
      [g.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = g.createShader(type)!;
      g.shaderSource(shader, source);
      g.compileShader(shader);
      if (!g.getShaderParameter(shader, g.COMPILE_STATUS))
        throw new Error(g.getShaderInfoLog(shader) ?? "exposure-shader");
      g.attachShader(this.program, shader);
      g.deleteShader(shader);
    }
    g.linkProgram(this.program);
    if (!g.getProgramParameter(this.program, g.LINK_STATUS))
      throw new Error(g.getProgramInfoLog(this.program) ?? "exposure-link");
    for (const name of ["currentImage", "previousImage", "weight", "mode", "inputLinear"])
      this.uniforms[name] = g.getUniformLocation(this.program, name);
    this.vao = g.createVertexArray()!;
    this.vertices = g.createBuffer()!;
    g.bindVertexArray(this.vao);
    g.bindBuffer(g.ARRAY_BUFFER, this.vertices);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), g.STATIC_DRAW);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    this.framebuffer = g.createFramebuffer()!;
    this.sample = g.createTexture()!;
    this.targets = Array.from({ length: 2 }, () =>
      Array.from({ length: this.floating ? 1 : 2 }, () => g.createTexture()!),
    );
  }
  begin(width: number, height: number) {
    const g = this.gl;
    const resized = width !== this.width || height !== this.height;
    if (resized) {
      this.width = width;
      this.height = height;
      g.activeTexture(g.TEXTURE0);
      for (const texture of [this.sample, ...this.targets.flat()]) {
        g.bindTexture(g.TEXTURE_2D, texture);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        const floating = this.floating && texture !== this.sample;
        g.texImage2D(
          g.TEXTURE_2D,
          0,
          floating ? g.RGBA16F : g.RGBA8,
          width,
          height,
          0,
          g.RGBA,
          floating ? g.HALF_FLOAT : g.UNSIGNED_BYTE,
          null,
        );
      }
    }
    g.viewport(0, 0, width, height);
    g.bindFramebuffer(g.FRAMEBUFFER, this.framebuffer);
    g.colorMask(true, true, true, true);
    g.clearColor(0, 0, 0, 0);
    for (const texture of this.targets.flat()) {
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, texture, 0);
      if (resized && g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
        throw new Error("exposure-target-unavailable");
      g.clear(g.COLOR_BUFFER_BIT);
    }
    this.active = [0, 0];
    this.counts = [0, 0];
    g.bindFramebuffer(g.FRAMEBUFFER, null);
  }
  capture(layer: 0 | 1, weight: number, linearTexture?: WebGLTexture) {
    const g = this.gl;
    const framebuffer = g.getParameter(g.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, linearTexture ?? this.sample);
    if (!linearTexture) {
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, this.width, this.height);
    }
    const previous = this.targets[layer][this.active[layer]];
    if (!this.floating) this.active[layer] = 1 - this.active[layer];
    g.bindFramebuffer(g.FRAMEBUFFER, this.framebuffer);
    g.framebufferTexture2D(
      g.FRAMEBUFFER,
      g.COLOR_ATTACHMENT0,
      g.TEXTURE_2D,
      this.targets[layer][this.active[layer]],
      0,
    );
    g.disable(g.DEPTH_TEST);
    g.depthMask(false);
    g.useProgram(this.program);
    g.bindVertexArray(this.vao);
    g.uniform1i(this.uniforms.currentImage, 0);
    g.uniform1i(this.uniforms.previousImage, 1);
    g.uniform1i(this.uniforms.mode, this.floating ? 0 : 1);
    g.uniform1i(this.uniforms.inputLinear, linearTexture ? 1 : 0);
    g.uniform1f(this.uniforms.weight, this.floating ? weight : weight / (this.counts[layer] + weight));
    // An active sampler may not name the attached render target, even when a
    // uniform branch would avoid reading it. Float accumulation uses blending.
    g.activeTexture(g.TEXTURE1);
    g.bindTexture(g.TEXTURE_2D, this.floating ? (linearTexture ?? this.sample) : previous);
    if (this.floating) {
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE);
    } else g.disable(g.BLEND);
    g.drawArrays(g.TRIANGLES, 0, 6);
    this.counts[layer] += weight;
    g.bindFramebuffer(g.FRAMEBUFFER, framebuffer);
    g.activeTexture(g.TEXTURE0);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  }
  present(layer: 0 | 1) {
    const g = this.gl;
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.disable(g.DEPTH_TEST);
    g.depthMask(false);
    g.disable(g.BLEND);
    g.useProgram(this.program);
    g.bindVertexArray(this.vao);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, this.targets[layer][this.active[layer]]);
    g.uniform1i(this.uniforms.currentImage, 0);
    g.uniform1i(this.uniforms.mode, this.floating ? 2 : 3);
    g.drawArrays(g.TRIANGLES, 0, 6);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  }
  get bytes() {
    return this.width * this.height * 20;
  }
  dispose() {
    const g = this.gl;
    [this.sample, ...this.targets.flat()].forEach((t) => g.deleteTexture(t));
    g.deleteFramebuffer(this.framebuffer);
    g.deleteVertexArray(this.vao);
    g.deleteBuffer(this.vertices);
    g.deleteProgram(this.program);
  }
}
