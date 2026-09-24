import {
  CUT,
  DURATION,
  buildActors,
  camera,
  clamp,
  gust,
  poseAt,
  materialResponse,
  focusPose,
  smooth,
  type Actor,
  type Tier,
  type Vec3,
} from "./program";
import { Atmosphere } from "./atmosphere";
import { celestialState, fogBanksAt, EXTERIOR } from "./scene-space";
import { anchorPoints } from "./adhesion";
import { environmentVertex, environmentFragment } from "./environment";
import { capturePage, pageState, pageVertex, pageFragment, type PageSurface } from "./page-material";

const vertex = `#version 300 es
precision highp float;
in vec2 uv; out vec2 vUV; out vec3 vWorld; out float vBend;
uniform vec3 position,rotation,cameraPosition;
uniform vec2 size,viewport;
uniform float time,bend,adhesion,phase,roll,focusImpact;
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
void main(){
 vUV=uv; vec2 p=(uv-.5)*size;
 float edge=pow(abs(uv.x-.46)*1.9,1.5);
 float wave=sin(uv.x*7.0+uv.y*2.2-time*14.2+phase)*.055*size.x;
 float corner=sin(uv.y*5.0-time*9.7+phase)*.035*size.x*edge;
 float curl=pow(max(0.,uv.x-.63),2.)*size.x*.9;
 float z=(wave*edge+corner+curl)*bend;
 z-=exp(-length((uv-vec2(.59,.43))*vec2(13.,8.)))*focusImpact*18.;
 float pin=1.-smoothstep(.06,.37,length(uv-vec2(.5,.5)));
 z=mix(z,-(1.-pin)*size.x*(.35+sin(uv.x*19.-time*18.)*.12+sin(uv.y*23.+time*21.)*.07),adhesion);
 vBend=z/max(size.x,1.);
 vec3 local=vec3(p.x,p.y,z);
 vWorld=rz(rotation.z)*ry(rotation.y)*rx(rotation.x)*local+position;
 vec3 view=rz(-roll)*(vWorld-cameraPosition);
 float focal=1150., distance=focal-view.z;
 gl_Position=vec4(view.x*focal/(viewport.x*.5),view.y*focal/(viewport.y*.5),distance-8.,distance);
}`;
const fragment = `#version 300 es
precision highp float;
in vec2 vUV;in vec3 vWorld;in float vBend;out vec4 color;
uniform sampler2D art;uniform vec2 texel,motionVector;uniform vec3 eye;uniform float alpha,time,blur,emissive,atmosphere,quality;
uniform vec3 coolLight,warmLight,depthTint,emissionTint;uniform float contactLight;
void main(){
 vec2 flow=vec2(sin(vUV.y*12.+time*.43),cos(vUV.x*9.-time*.37))*.018*atmosphere;
 vec2 p=vUV+flow;
 vec4 sampleColor=texture(art,p);
 if(quality>.5){
   vec2 d=texel*blur;
   sampleColor=(sampleColor*4.+texture(art,p+d)+texture(art,p-d)+texture(art,p+vec2(d.x,-d.y))+texture(art,p+vec2(-d.x,d.y)))/8.;
   if(quality>1.5){
     vec4 shutter=vec4(0.); float weights=0.;
     for(int i=-4;i<=4;i++){float f=float(i)/4.;float w=exp(-f*f*2.);shutter+=texture(art,p+motionVector*f*.5)*w;weights+=w;}
     sampleColor=mix(sampleColor,shutter/weights,.8);
   }
 }
 float a=sampleColor.a*alpha;
 if(a<.002)discard;
 vec3 dx=dFdx(vWorld),dy=dFdy(vWorld);vec3 normal=normalize(cross(dx,dy));
 float warm=smoothstep(26.,30.,time)*exp(-length((vWorld.xy-vec2(490.,190.))/vec2(1000.,850.)));
 float diffuse=.68+.30*abs(dot(normal,normalize(vec3(-.25,.45,1.))));
 vec3 light=mix(coolLight,warmLight,warm*.76)*diffuse;
 light+=vec3(.5,.24,.07)*warm*pow(abs(vBend)*5.,1.3);
 float depth=clamp((eye.z-vWorld.z-500.)/4800.,0.,.85);
 vec3 lit=mix(sampleColor.rgb*(light+vec3(.32,.24,.12)*contactLight),depthTint,depth*.65*(1.-contactLight*.7));
 lit=mix(lit,sampleColor.rgb*emissionTint,emissive);
 color=vec4(lit*a,a);
}`;
type Texture = { value: WebGLTexture; width: number; height: number; bytes: number };
/** Chronicle art can enter the same film without changing timing or physics.
 * Omitted fields preserve the approved Voyagewright crossing and light script. */
export type EmbarkationArtDirection = {
  crossingUrl?: string;
  destinationUrl?: string;
  materialUrls?: Record<string, string>;
  palette?: Partial<{ coolLight: Vec3; warmLight: Vec3; depthTint: Vec3; emissionTint: Vec3 }>;
};
const defaultPalette = {
  coolLight: [0.7, 0.86, 1.04] as Vec3,
  warmLight: [1.22, 0.91, 0.57] as Vec3,
  depthTint: [0.08, 0.19, 0.25] as Vec3,
  emissionTint: [1.12, 1.02, 0.85] as Vec3,
};
export type RendererDiagnostics = {
  failures: string[];
  textureBytes: number;
  assetBytes: number;
  gpu: string;
  gpuTimingAvailable: boolean;
  gpuSamplesMs: number[];
  runtimeTextures?: Record<string, { url: string; width: number; height: number }>;
};
export type RenderOptions = {
  ambient?: boolean;
  reduced?: boolean;
  freezeLiving?: boolean;
  projectionGrid?: boolean;
  layers?: Set<string>;
  trajectories?: boolean;
  only?: string;
  returnTime?: number;
};
export class EmbarkationRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly actors: Actor[];
  readonly diagnostics: RendererDiagnostics = {
    failures: [],
    textureBytes: 0,
    assetBytes: 0,
    gpu: "unavailable",
    gpuTimingAvailable: false,
    gpuSamplesMs: [],
  };
  private props: WebGLProgram;
  private environment: WebGLProgram;
  private pageProgram: WebGLProgram;
  private weather: Atmosphere | null;
  private pageSurfaces: PageSurface[] = [];
  private focusSurface: PageSurface | null = null;
  private grid: WebGLVertexArrayObject;
  private quad: WebGLVertexArrayObject;
  private environmentGrid: WebGLVertexArrayObject;
  private environmentCount: number;
  private roomUV = [1, 1, 0, 0];
  private roomRect = [0, 68, 1, 900];
  private gridCount: number;
  private buffers: WebGLBuffer[] = [];
  private textures = new Map<string, Texture>();
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private disposed = false;
  private canvas: HTMLCanvasElement;
  private focusActor: Actor = {
    id: "focus-line",
    asset: "focus-line",
    material: "card",
    birth: 0,
    life: 8,
    position: [0, 132, 0],
    size: 970,
    phase: 0,
    rotation: [0, 0, 0],
    layer: "props",
  };
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private timer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null;
  private queries: WebGLQuery[] = [];
  private palette = defaultPalette;
  private ambientTier: Tier | null = null;
  livingTier(tier: Tier) {
    this.ambientTier = tier;
  }
  constructor(
    canvas: HTMLCanvasElement,
    seed: number,
    readonly tier: Tier,
    onFailure: () => void,
    private backgroundCanvas?: HTMLCanvasElement,
  ) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      powerPreference: "high-performance",
      depth: true,
    });
    if (!gl) throw new Error("compositor-unavailable");
    this.gl = gl;
    this.actors = buildActors(seed);
    this.props = this.program(vertex, fragment);
    this.environment = this.program(environmentVertex, environmentFragment);
    this.pageProgram = this.program(pageVertex, pageFragment);
    this.weather = new Atmosphere(gl, seed, tier);
    const grid = this.mesh(tier === "CINEMATIC" ? 40 : tier === "BALANCED" ? 26 : 16);
    this.grid = grid.vao;
    this.gridCount = grid.count;
    this.quad = this.mesh(1).vao;
    const environmentGrid = this.mesh(tier === "CINEMATIC" ? 112 : tier === "BALANCED" ? 72 : 48);
    this.environmentGrid = environmentGrid.vao;
    this.environmentCount = environmentGrid.count;
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    this.diagnostics.gpu = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    this.timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    this.diagnostics.gpuTimingAvailable = Boolean(this.timer);
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", lost);
    this.removeContextListener = () => canvas.removeEventListener("webglcontextlost", lost);
  }
  private removeContextListener: () => void;
  private program(vs: string, fs: string) {
    const g = this.gl,
      p = g.createProgram()!;
    for (const [kind, source] of [
      [g.VERTEX_SHADER, vs],
      [g.FRAGMENT_SHADER, fs],
    ] as const) {
      const s = g.createShader(kind)!;
      g.shaderSource(s, source);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) ?? "shader-compile");
      g.attachShader(p, s);
      g.deleteShader(s);
    }
    g.bindAttribLocation(p, 0, "uv");
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error("shader-link");
    return p;
  }
  private mesh(n: number) {
    const g = this.gl,
      data: number[] = [];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        for (const [u, v] of [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x, y + 1],
          [x + 1, y],
          [x + 1, y + 1],
        ])
          data.push(u / n, v / n);
    const vao = g.createVertexArray()!,
      b = g.createBuffer()!;
    this.buffers.push(b);
    g.bindVertexArray(vao);
    g.bindBuffer(g.ARRAY_BUFFER, b);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array(data), g.STATIC_DRAW);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    return { vao, count: data.length / 2 };
  }
  private u(p: WebGLProgram, name: string) {
    let map = this.uniforms.get(p);
    if (!map) {
      map = new Map();
      this.uniforms.set(p, map);
    }
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(p, name));
    return map.get(name)!;
  }
  async preload(
    cover: string,
    signal: AbortSignal,
    omitOptional = false,
    direction: EmbarkationArtDirection = {},
    ambientOnly = false,
  ) {
    this.palette = { ...defaultPalette, ...direction.palette };
    const urls = new Map<string, string>([
      ["crossing", direction.crossingUrl ?? "/images/embarkation/stage-A-background.webp"],
      ["destination", direction.destinationUrl ?? cover],
      ["room", "/images/muster/lantern-room.png"],
      ["exterior", "/images/embarkation/derived/stage-c-water.webp"],
      ["exteriorOverscan", "/images/embarkation/derived/stage-c-extended.webp"],
      ["stage-c-pier", "/images/embarkation/derived/stage-c-pier.png"],
      ["stage-distant", "/images/embarkation/derived/stage-distant.webp"],
      ["stage-islands", "/images/embarkation/derived/stage-islands.png"],
      ["stage-middle", "/images/embarkation/derived/stage-middle.png"],
      ["stage-near", "/images/embarkation/derived/stage-near.png"],
      ["stage-rocks", "/images/embarkation/derived/stage-rocks.png"],
      ["aperture", "/images/embarkation/derived/room-aperture.png"],
      ["overscan", "/images/embarkation/derived/room-overscan-delta2.webp"],
      ["backingAperture", "/images/embarkation/derived/room-backing-aperture.png"],
      ["matte0", "/images/embarkation/derived/room-mattes-0.png"],
      ["matte1", "/images/embarkation/derived/room-mattes-1.png"],
      ["matte2", "/images/embarkation/derived/room-mattes-2.png"],
      ["backing", "/images/embarkation/derived/room-hidden-backing.webp"],
      ["livingMasks", "/images/embarkation/derived/room-living-masks.png"],
      ["liveBacking", "/images/embarkation/derived/room-static.webp"],
      ["liveProps", "/images/embarkation/derived/room-live-props.png"],
      ["liveFlames", "/images/embarkation/derived/room-live-flames.png"],
    ]);
    if (ambientOnly) {
      urls.delete("crossing");
      urls.delete("destination");
      for (const key of [...urls.keys()]) if (key.startsWith("stage-")) urls.delete(key);
    }
    for (const a of ambientOnly ? [] : this.actors.filter((a) => a.material !== "mist" && a.layer !== "spray"))
      if (!omitOptional || !["mist", "particles", "light", "spray"].includes(a.layer))
        urls.set(a.asset, direction.materialUrls?.[a.asset] ?? `/images/embarkation/${a.asset}.webp`);
    await Promise.all(
      [...urls].map(async ([key, url]) => {
        try {
          const response = await fetch(url, { signal });
          if (!response.ok) throw new Error("missing");
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob, {
            premultiplyAlpha: "none",
            colorSpaceConversion: "default",
            imageOrientation: "flipY",
          });
          if (signal.aborted || this.disposed) {
            bitmap.close();
            return;
          }
          const g = this.gl,
            texture = g.createTexture()!;
          g.bindTexture(g.TEXTURE_2D, texture);
          g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, bitmap);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
          g.generateMipmap(g.TEXTURE_2D);
          this.textures.set(key, {
            value: texture,
            width: bitmap.width,
            height: bitmap.height,
            bytes: (bitmap.width * bitmap.height * 4 * 4) / 3,
          });
          this.diagnostics.textureBytes += (bitmap.width * bitmap.height * 4 * 4) / 3;
          this.diagnostics.assetBytes += blob.size;
          (this.diagnostics.runtimeTextures ??= {})[key] = { url, width: bitmap.width, height: bitmap.height };
          bitmap.close();
        } catch {
          if (!signal.aborted) this.diagnostics.failures.push(key);
        }
      }),
    );
    if (
      [
        ...(ambientOnly
          ? []
          : [
              "crossing",
              "destination",
              "stage-distant",
              "stage-islands",
              "stage-middle",
              "stage-near",
              "stage-rocks",
              "exterior",
              "exteriorOverscan",
              "stage-c-pier",
            ]),
        "room",
        "aperture",
        "matte0",
        "matte1",
        "matte2",
        "backing",
        "backingAperture",
        "livingMasks",
        "liveBacking",
        "liveProps",
        "liveFlames",
        "overscan",
      ].some((key) => !this.textures.has(key))
    )
      throw new Error("core-art-unavailable");
    if (ambientOnly) {
      this.weather?.dispose();
      this.weather = null;
      this.resize();
      this.draw(DURATION, { ambient: true });
      return;
    }
    // Prepare deterministic trajectories during loading, not on an actor's
    // first visible frame. Yield between batches so hold-to-skip stays live.
    for (let first = 0; first < this.actors.length; first += 80) {
      if (signal.aborted) throw new DOMException("Preparation cancelled", "AbortError");
      for (const actor of this.actors.slice(first, first + 80)) materialResponse(actor, 0.01);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const focus = document.createElement("canvas");
    focus.width = 1800;
    focus.height = 620;
    const ctx = focus.getContext("2d")!;
    ctx.fillStyle = "#f7dfa5";
    ctx.textAlign = "center";
    ctx.font = "135px Georgia";
    ctx.textBaseline = "middle";
    const tracked = (text: string, y: number) => {
      const widths = [...text].map((c) => ctx.measureText(c).width),
        spacing = 7;
      let x = (1800 - widths.reduce((a, b) => a + b, 0) - spacing * (text.length - 1)) / 2;
      ctx.textAlign = "left";
      [...text].forEach((c, i) => {
        ctx.fillText(c, x, y);
        x += widths[i] + spacing;
      });
    };
    tracked("JOIN THE", 200);
    tracked("ADVENTURE", 360);
    ctx.font = "72px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("✧", 900, 540);
    const g = this.gl,
      texture = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, texture);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, focus);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    this.textures.set("focus-line", { value: texture, width: 1800, height: 620, bytes: 1800 * 620 * 4 });
    this.diagnostics.textureBytes += 1800 * 620 * 4;
    this.resize();
    this.draw(0);
    this.gl.finish();
  }
  async captureSource(root: HTMLElement, signal: AbortSignal) {
    this.pageSurfaces = await capturePage(root, signal);
    this.focusSurface = this.pageSurfaces.find((s) => s.node.dataset.departure === "focus-title") ?? null;
    const g = this.gl;
    for (const surface of this.pageSurfaces) {
      const tx = g.createTexture()!;
      // SVG foreignObject is decoded entirely from inlined local resources.
      // Draw into a bounded raster once; WebGL cannot upload vector images.
      const raster = document.createElement("canvas");
      const ratio = Math.min(devicePixelRatio || 1, this.tier === "CINEMATIC" ? 2 : 1);
      raster.width = Math.ceil(surface.rect.width * ratio);
      raster.height = Math.ceil(surface.rect.height * ratio);
      raster.getContext("2d")!.drawImage(surface.image, 0, 0, raster.width, raster.height);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, tx);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, raster);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.generateMipmap(g.TEXTURE_2D);
      this.textures.set(surface.id, {
        value: tx,
        width: raster.width,
        height: raster.height,
        bytes: (raster.width * raster.height * 4 * 4) / 3,
      });
      this.diagnostics.textureBytes += (raster.width * raster.height * 4 * 4) / 3;
    }
  }
  releaseDeparture() {
    this.diagnostics.textureBytes -= this.weather?.bytes ?? 0;
    this.weather?.dispose();
    this.weather = null;
    this.actors.length = 0;
    const keep = new Set([
      "room",
      "exterior",
      "exteriorOverscan",
      "aperture",
      "backingAperture",
      "overscan",
      "matte0",
      "matte1",
      "matte2",
      "backing",
      "livingMasks",
      "liveBacking",
      "liveProps",
      "liveFlames",
    ]);
    for (const [key, tx] of this.textures)
      if (!keep.has(key)) {
        this.gl.deleteTexture(tx.value);
        this.textures.delete(key);
        this.diagnostics.textureBytes -= tx.bytes;
      }
    this.pageSurfaces = [];
  }
  sourceDiagnostics(time: number) {
    return this.pageSurfaces.map((s) => ({
      id: s.id,
      source: s.node.dataset.departure,
      width: s.rect.width,
      height: s.rect.height,
      material: s.material,
      release: s.release,
      ...pageState(s, time, this.width, this.height),
    }));
  }
  resize() {
    const g = this.gl;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      this.tier === "CINEMATIC" ? 2 : this.tier === "BALANCED" ? 1.35 : 1,
    );
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    g.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.diagnostics.textureBytes -= this.weather?.bytes ?? 0;
    this.weather?.resize(this.canvas.width, this.canvas.height);
    this.diagnostics.textureBytes += this.weather?.bytes ?? 0;
    if (this.backgroundCanvas) {
      this.backgroundCanvas.width = this.canvas.width;
      this.backgroundCanvas.height = this.canvas.height;
    }
    const room = document.querySelector<HTMLElement>(".muster-environment");
    const texture = this.textures.get("room");
    if (room && texture) {
      const rect = room.getBoundingClientRect();
      const mobile = this.width <= 720;
      const scale = mobile ? 1050 / texture.height : Math.max(rect.width / texture.width, rect.height / texture.height);
      const w = texture.width * scale,
        h = texture.height * scale;
      const x = (rect.width - w) * (mobile ? 0.43 : this.width <= 1100 ? 0.46 : 0.5);
      const y = (rect.height - h) * (mobile ? 0 : 0.5);
      this.roomRect = [rect.x, rect.y, rect.width, rect.height];
      this.roomUV = [this.width / w, this.height / h, (-rect.x - x) / w, 1 - (this.height - rect.y - y) / h];
    }
  }
  draw(time: number, options: RenderOptions = {}) {
    if (this.disposed) return;
    const returning = options.returnTime !== undefined;
    const returnTime = options.returnTime ?? 0;
    if (returning) time = CUT.still + returnTime;
    const g = this.gl,
      p = this.props,
      cam = returning ? { position: [0, 0, 0] as Vec3, roll: 0 } : camera(time),
      worldH = 1100,
      worldW = (worldH * this.width) / this.height;
    if (this.timer) {
      this.queries = this.queries.filter((query) => {
        if (!g.getQueryParameter(query, g.QUERY_RESULT_AVAILABLE)) return true;
        if (!g.getParameter(this.timer!.GPU_DISJOINT_EXT)) {
          this.diagnostics.gpuSamplesMs.push(Number(g.getQueryParameter(query, g.QUERY_RESULT)) / 1e6);
          if (this.diagnostics.gpuSamplesMs.length > 1800) this.diagnostics.gpuSamplesMs.shift();
        }
        g.deleteQuery(query);
        return false;
      });
    }
    const query = this.timer && this.queries.length < 8 ? g.createQuery() : null;
    if (query) g.beginQuery(this.timer!.TIME_ELAPSED_EXT, query);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    if (!options.only || options.only === "environment") {
      const e = this.environment;
      g.useProgram(e);
      g.uniform1f(this.u(e, "time"), time);
      const moon = celestialState(time, this.width, this.height, this.roomUV);
      this.weather?.setMoon(moon.position);
      g.uniform3fv(this.u(e, "moonPosition"), moon.position);
      g.uniform1f(this.u(e, "moonRadius"), moon.radius);
      g.uniform1f(this.u(e, "moonReflectionSourceX"), moon.reflectionSourceX);
      g.uniform1f(this.u(e, "projectionGrid"), options.projectionGrid ? 1 : 0);
      g.uniform1f(this.u(e, "windLevel"), gust(time));
      g.uniform1f(
        this.u(e, "livingQuality"),
        (this.ambientTier ?? this.tier) === "CINEMATIC" ? 2 : (this.ambientTier ?? this.tier) === "BALANCED" ? 1 : 0,
      );
      g.uniform1f(this.u(e, "reducedMotion"), options.reduced ? 1 : 0);
      g.uniform1f(this.u(e, "livingEnabled"), options.freezeLiving ? 0 : 1);
      g.uniform3fv(this.u(e, "cameraPosition"), cam.position);
      g.uniform1f(this.u(e, "roll"), cam.roll);
      g.uniform2f(this.u(e, "worldViewport"), worldW, worldH);
      g.uniform2f(this.u(e, "viewport"), this.canvas.width, this.canvas.height);
      g.uniform4fv(this.u(e, "roomUV"), this.roomUV);
      g.uniform4fv(
        this.u(e, "roomRect"),
        this.roomRect.map((n) => n * this.pixelRatio),
      );
      for (const [unit, key, uniform] of [
        [1, "aperture", "apertureMap"],
        [2, "matte0", "matte0"],
        [3, "matte1", "matte1"],
        [4, "overscan", "roomOverscan"],
        [5, "matte2", "matte2"],
        [6, "backingAperture", "backingAperture"],
        [7, "livingMasks", "livingMasks"],
        [8, "liveBacking", "liveBacking"],
        [14, "liveProps", "liveProps"],
        [15, "liveFlames", "liveFlames"],
        [9, "room", "roomOriginal"],
        [13, "exterior", "exterior"],
        [12, "exteriorOverscan", "exteriorOverscan"],
      ] as const) {
        g.activeTexture(g.TEXTURE0 + unit);
        g.bindTexture(g.TEXTURE_2D, this.textures.get(key)!.value);
        g.uniform1i(this.u(e, uniform), unit);
      }
      const scene = (key: string, mode: number, post = 0) => {
        const tx = this.textures.get(key);
        if (!tx) return;
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, tx.value);
        g.uniform1i(this.u(e, "art"), 0);
        g.uniform2f(this.u(e, "artSize"), tx.width, tx.height);
        g.uniform1f(this.u(e, "mode"), mode);
        g.uniform1f(this.u(e, "post"), post);
        g.clear(g.DEPTH_BUFFER_BIT);
        if (mode > 0) {
          g.enable(g.DEPTH_TEST);
          g.depthFunc(g.LEQUAL);
        } else g.disable(g.DEPTH_TEST);
        const fullQuad = mode === 0 || mode === 4 || mode === 6 || (mode === 1 && post === 1);
        g.bindVertexArray(fullQuad ? this.quad : this.environmentGrid);
        g.drawArrays(g.TRIANGLES, 0, fullQuad ? 6 : this.environmentCount);
      };
      if (time < CUT.room) {
        scene("stage-distant", 0);
        if (time > 23.2) {
          scene("exteriorOverscan", 1, 0);
          scene("exterior", 1, 1);
          scene("stage-c-pier", 1, 2);
        }
        if (time < 24.66) {
          scene("stage-distant", 5, 0);
          scene("stage-islands", 5, 1);
          scene("stage-middle", 5, 2);
          scene("stage-rocks", 5, 3);
          scene("stage-near", 5, 3);
        }
        if (time > 14.5) scene("room", 6);
      }
      if (time < 19.4) scene("crossing", 2);
      if (!returning && !options.ambient && !options.only) {
        this.weather?.mist(time, this.actors, this.width, this.height);
        this.paintFocus(time, cam.position, cam.roll, worldW, worldH);
        g.useProgram(e);
        g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      }
      if (time >= CUT.room) {
        // At the calibrated final viewpoint every projection has converged.
        // Evaluate that same original-material projection once for the stable
        // living room, avoiding eight redundant fullscreen ambient passes.
        scene("room", 3, 9);
      } else if (time >= CUT.threshold) {
        scene("room", 3, 8);
        scene("backing", 3, -1);
        scene("room", 3, 0);
        if (time < CUT.room) scene("P6-lantern", 4);
        for (const layer of [4, 2, 3, 1, 7, 5, 6]) scene("room", 3, layer);
      }
    }
    g.disable(g.DEPTH_TEST);
    if (!returning && !options.only) this.weather?.captureScenery(time);
    if (this.backgroundCanvas) {
      const b = this.backgroundCanvas.getContext("2d");
      b?.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
      b?.drawImage(this.canvas, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
    }
    if (!returning && time >= 0.45 && time < 28 && (!options.only || options.only === "page")) {
      const program = this.pageProgram;
      g.useProgram(program);
      g.bindVertexArray(this.grid);
      g.activeTexture(g.TEXTURE0);
      g.uniform1i(this.u(program, "art"), 0);
      g.uniform2f(this.u(program, "viewport"), worldW, worldH);
      g.uniform3fv(this.u(program, "cameraPosition"), cam.position);
      g.uniform1f(this.u(program, "roll"), cam.roll);
      g.uniform1f(this.u(program, "time"), time);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      const surfaces = this.pageSurfaces
        .filter((s) => s !== this.focusSurface)
        .map((s) => ({ s, state: pageState(s, time, this.width, this.height) }))
        .sort((a, b) => a.state.position[2] - b.state.position[2]);
      for (const { s, state } of surfaces) {
        if (state.alpha < 0.002) continue;
        const tx = this.textures.get(s.id);
        if (!tx) continue;
        g.bindTexture(g.TEXTURE_2D, tx.value);
        g.uniform3fv(this.u(program, "position"), state.position);
        g.uniform3fv(this.u(program, "rotation"), state.rotation);
        g.uniform2f(this.u(program, "size"), (s.rect.width * 1100) / this.height, (s.rect.height * 1100) / this.height);
        g.uniform4fv(this.u(program, "anchorHold"), state.anchors);
        g.uniform2fv(this.u(program, "anchorPoints[0]"), anchorPoints(s.attachment).flat());
        for (const [name, value] of Object.entries({
          alpha: state.alpha,
          pressure: state.pressure,
          phase: s.phase,
          released: state.released,
          stiffness: state.stiffness,
          weathering: state.weathering,
        }))
          g.uniform1f(this.u(program, name), value);
        if (state.released === 0) {
          g.uniform1f(this.u(program, "support"), 1);
          g.drawArrays(g.TRIANGLES, 0, this.gridCount);
        }
        g.uniform1f(this.u(program, "support"), 0);
        g.drawArrays(g.TRIANGLES, 0, this.gridCount);
      }
    }
    if (options.ambient) {
      if (query) {
        g.endQuery(this.timer!.TIME_ELAPSED_EXT);
        this.queries.push(query);
      }
      return;
    }
    g.useProgram(p);
    g.bindVertexArray(this.grid);
    g.activeTexture(g.TEXTURE0);
    g.uniform1i(this.u(p, "art"), 0);
    g.uniform2f(this.u(p, "viewport"), worldW, worldH);
    g.uniform3fv(this.u(p, "cameraPosition"), cam.position);
    g.uniform3fv(this.u(p, "eye"), cam.position);
    for (const [name, color] of Object.entries(this.palette)) g.uniform3fv(this.u(p, name), color);
    g.uniform1f(this.u(p, "roll"), cam.roll);
    g.uniform1f(this.u(p, "time"), time);
    g.uniform1f(this.u(p, "quality"), this.tier === "CINEMATIC" ? 2 : this.tier === "BALANCED" ? 1 : 0);
    const objects = this.actors
      .filter(
        (a) =>
          !returning &&
          time >= a.birth &&
          time < CUT.room &&
          a.hero !== "lantern" &&
          a.material !== "mist" &&
          a.layer !== "spray" &&
          a.layer !== "particles" &&
          (!options.only || a.layer === options.only) &&
          (!options.layers || options.layers.has(a.layer)),
      )
      .map((a) => ({ a, pose: poseAt(a, time, this.width, this.height) }))
      .filter(
        ({ a, pose }) =>
          a.hero !== "lantern" &&
          pose.alpha > 0.001 &&
          a.material !== "mist" &&
          a.layer !== "spray" &&
          a.layer !== "particles" &&
          pose.position[2] - cam.position[2] < 1150 + pose.size &&
          !returning &&
          (!options.only || a.layer === options.only) &&
          (!options.layers || options.layers.has(a.layer)),
      );
    if (returning)
      for (const object of objects) {
        object.pose.alpha *= (1 - smooth(0.55, 1.6, returnTime)) * 0.65;
        object.pose.position[0] += returnTime * 45;
      }
    objects.sort((a, b) => a.pose.position[2] - b.pose.position[2]);
    for (const { a, pose } of objects) {
      const tx = this.textures.get(a.asset);
      if (!tx) continue;
      const prev = poseAt(a, Math.max(0, time - 0.012), this.width, this.height);
      g.bindTexture(g.TEXTURE_2D, tx.value);
      g.blendFunc(g.ONE, a.additive ? g.ONE : g.ONE_MINUS_SRC_ALPHA);
      g.uniform3fv(this.u(p, "position"), pose.position);
      g.uniform3fv(this.u(p, "rotation"), pose.rotation);
      g.uniform2f(this.u(p, "size"), pose.size, (pose.size * tx.height) / tx.width);
      g.uniform1f(this.u(p, "alpha"), pose.alpha);
      g.uniform1f(this.u(p, "bend"), pose.bend);
      g.uniform1f(this.u(p, "adhesion"), pose.adhesion);
      g.uniform1f(this.u(p, "phase"), a.phase);
      g.uniform1f(
        this.u(p, "focusImpact"),
        a.id === "focus-line" ? smooth(7.93, 8.02, time) * (1 - smooth(8.3, 8.7, time)) : 0,
      );
      const relativeDepth = pose.position[2] - cam.position[2];
      const wordFocus = smooth(CUT.catch - 0.5, CUT.catch, time) * (1 - smooth(CUT.peel, CUT.peel + 0.65, time));
      const focalDepth =
        -smooth(16, 21, time) * 850 * (1 - smooth(CUT.threshold, CUT.room, time)) * (1 - wordFocus) +
        (focusPose(time, this.width, this.height).position[2] - cam.position[2]) * wordFocus;
      g.uniform1f(this.u(p, "contactLight"), a.hero === "collision" ? pose.adhesion : 0);
      g.uniform1f(
        this.u(p, "blur"),
        a.id === "focus-line"
          ? 0
          : clamp(Math.abs(relativeDepth - focalDepth) / 3000) * 3 + clamp((relativeDepth - 210) / 250) * 4,
      );
      g.uniform1f(this.u(p, "emissive"), a.additive || a.id === "focus-line" ? 1 : 0);
      g.uniform1f(this.u(p, "atmosphere"), a.material === "mist" ? 1 : 0);
      g.uniform2f(this.u(p, "texel"), 1 / tx.width, 1 / tx.height);
      const nowScreen = this.project(pose.position, time),
        previousScreen = this.project(prev.position, Math.max(0, time - 0.012));
      const displaySize = Math.max(1, (((pose.size * 1150) / (1150 - relativeDepth)) * this.height) / 1100);
      g.uniform2f(
        this.u(p, "motionVector"),
        a.id === "focus-line" ? 0 : clamp((nowScreen.x - previousScreen.x) / displaySize, -0.035, 0.035),
        a.id === "focus-line" ? 0 : clamp((previousScreen.y - nowScreen.y) / displaySize, -0.035, 0.035),
      );
      g.drawArrays(g.TRIANGLES, 0, this.gridCount);
    }
    if (!returning && !options.ambient) {
      if (options.only === "mist") this.weather?.mist(time, this.actors, this.width, this.height);
      this.weather?.particlesAt(
        time,
        this.actors,
        this.width,
        this.height,
        (k) => this.textures.get(k)?.value,
        options.only,
        options.layers,
      );
      if (!options.only || options.only === "mist")
        this.weather?.mist(time, this.actors, this.width, this.height, true);
      if (!options.only) this.weather?.lensAt(time);
    }
    if (query) {
      g.endQuery(this.timer!.TIME_ELAPSED_EXT);
      this.queries.push(query);
    }
  }
  private paintFocus(time: number, cam: Vec3, roll: number, w: number, h: number) {
    const pose = focusPose(time, this.width, this.height, this.focusSurface?.rect),
      // The same measured heading mesh survives departure. Its casing/layout
      // resolves at the edge-on turn, so no second message appears or fades in.
      tx = this.textures.get(this.focusSurface && time < 4.725 ? this.focusSurface.id : "focus-line");
    if (!tx || pose.alpha < 0.001) return;
    const g = this.gl,
      p = this.props;
    g.disable(g.DEPTH_TEST);
    g.useProgram(p);
    g.bindVertexArray(this.grid);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, tx.value);
    g.uniform1i(this.u(p, "art"), 0);
    g.uniform2f(this.u(p, "viewport"), w, h);
    g.uniform3fv(this.u(p, "cameraPosition"), cam);
    g.uniform3fv(this.u(p, "eye"), cam);
    g.uniform3fv(this.u(p, "position"), pose.position);
    g.uniform3fv(this.u(p, "rotation"), pose.rotation);
    g.uniform2f(this.u(p, "size"), pose.size, (pose.size * tx.height) / tx.width);
    for (const [name, value] of Object.entries({
      time,
      roll,
      alpha: pose.alpha,
      bend: pose.bend,
      adhesion: 0,
      contactLight: 0,
      phase: 0,
      quality: 0,
      focusImpact: smooth(CUT.catch - 0.05, CUT.catch + 0.05, time) * (1 - smooth(CUT.peel, CUT.peel + 0.45, time)),
      blur: 0,
      emissive: 1,
      atmosphere: 0,
    }))
      g.uniform1f(this.u(p, name), value);
    for (const [name, value] of Object.entries(this.palette)) g.uniform3fv(this.u(p, name), value);
    g.uniform2f(this.u(p, "texel"), 1 / tx.width, 1 / tx.height);
    g.uniform2f(this.u(p, "motionVector"), 0, 0);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.drawArrays(g.TRIANGLES, 0, this.gridCount);
  }
  inspectScene(time: number) {
    const moon = celestialState(time, this.width, this.height, this.roomUV);
    return {
      roomUV: this.roomUV,
      moon,
      waterSurface: EXTERIOR,
      fogBanks: fogBanksAt(time),
      stormActors: this.actors
        .filter(
          (a) =>
            a.hero !== "lantern" &&
            a.material !== "mist" &&
            a.layer !== "particles" &&
            a.layer !== "spray" &&
            time >= a.birth,
        )
        .map((a) => {
          const pose = poseAt(a, time, this.width, this.height),
            distance = 1150 + camera(time).position[2] - pose.position[2];
          return {
            id: a.id,
            birth: a.birth,
            age: time - a.birth,
            z: pose.position[2],
            distance,
            screenPixels: (((pose.size * 1150) / distance) * this.height) / 1100,
            transmission: pose.alpha,
          };
        }),
    };
  }
  project(p: Vec3, t: number) {
    const c = camera(t),
      h = 1100,
      f = 1150,
      scale = f / (f - (p[2] - c.position[2]));
    return {
      x: this.width / 2 + ((p[0] - c.position[0]) * scale * this.height) / h,
      y: this.height / 2 - ((p[1] - c.position[1]) * scale * this.height) / h,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.removeContextListener();
    const g = this.gl;
    this.weather?.dispose();
    this.queries.forEach((query) => g.deleteQuery(query));
    this.queries = [];
    for (const t of this.textures.values()) g.deleteTexture(t.value);
    this.textures.clear();
    this.buffers.forEach((b) => g.deleteBuffer(b));
    g.deleteVertexArray(this.grid);
    g.deleteVertexArray(this.quad);
    g.deleteVertexArray(this.environmentGrid);
    g.deleteProgram(this.props);
    g.deleteProgram(this.environment);
    g.deleteProgram(this.pageProgram);
    this.pageSurfaces = [];
  }
}
