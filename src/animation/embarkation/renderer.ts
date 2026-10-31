import {
  CUT,
  DURATION,
  buildActors,
  camera,
  composition,
  gust,
  poseAt,
  materialPath,
  focusPose,
  TITLE_TURN,
  smooth,
  type Actor,
  type Tier,
  type Vec3,
} from "./program";
import { HARBOR_ENVIRONMENT, selectEnvironment, type LandscapeSet } from "./environment-set";
import { Atmosphere } from "./atmosphere";
import { celestialState, fogBanksAt, EXTERIOR, exteriorPierDepth } from "./scene-space";
import { FOCAL, WORLD_HEIGHT, projectWorld, rotateEuler, sphereInView } from "./projection";
import { FrameExposure, exposureSamples, EXPOSURE_SECONDS, setFilmLens, bindFilmLens, filmLens } from "./exposure";
import { environmentVertex, environmentFragment, specializeEnvironment } from "./environment";
import { capturePage, pageState, pageSheet, pageVertex, pageFragment, type PageSurface } from "./page-material";
import type { ConstrainedSheet } from "./cloth";
import { MaterialBackdrop } from "./material-backdrop";
import { TitleSnag, SNAG_BIRTH, type SnagCache, type SnagSpec } from "./title-snag";
import { landscapeFrame } from "./landscape-space";
import { NEAR_ROOM_LANTERN_Z, ROOM_EXTENSION } from "./room-extension";
import { SurfaceQueue, SurfaceDepth, type DepthPass } from "./depth-compositor";

import { PAPER_BACK, propMaterial, propVertex, propFragment } from "./prop-material";
import { propShellFromBitmap } from "./prop-shell";
import { paperPassCue, soundPan, type SoundCue } from "./sound-cues";
import { DEPARTURE_ANCHOR_WINDOW } from "./page-material";
import { LENS_IMPACTS } from "./lens-water";
import { ArtworkUpload, DATA_TEXTURES, materialBlend } from "./color";
import { SceneColor } from "./scene-color";

type Texture = { value: WebGLTexture; width: number; height: number; bytes: number };
/** Chronicle art can enter the same film without changing timing or physics.
 * Omitted fields preserve the approved Voyagewright crossing and light script. */
export type EmbarkationArtDirection = {
  crossingUrl?: string;
  /** Legacy single-image input receives the documented generic environment. */
  destinationUrl?: string;
  environment?: LandscapeSet;
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
  environment?: { id: string; reason: string };
  failures: string[];
  textureBytes: number;
  assetBytes: number;
  gpu: string;
  gpuTimingAvailable: boolean;
  gpuSamplesMs: number[];
  materialBackdropBytes?: number;
  surfaceDepthBytes?: number;
  exposure?: { samples: number; seconds: number; bytes: number; storage: string };
  color?: { working: string; samples: number; bytes: number; display: string; data: string[] };
  propGeometry?: { candidates: number; culled: number; vertices: number };
  runtimeTextures?: Record<string, { url: string; width: number; height: number }>;
  clothPreparation?: { ms: number; bytes: number; surfaces: number; thread: "worker" };
  motionPreparation?: { ms: number; bytes: number; actors: number; thread: "worker" };
  titleContactPreparation?: {
    ms: number;
    bytes: number;
    glyphSha256: string;
    families: Array<{ family: string; contact: SnagCache["contact"] }>;
  };
};
export type RenderOptions = {
  ambient?: boolean;
  reduced?: boolean;
  freezeLiving?: boolean;
  projectionGrid?: boolean;
  apertureMask?: boolean;
  referenceExposure?: boolean;
  layers?: Set<string>;
  trajectories?: boolean;
  only?: string;
  returnTime?: number;
  incoming?: (surfaces: SurfaceQueue, sampleTime: number, present: boolean) => void;
};
export class EmbarkationRenderer {
  private landscape = HARBOR_ENVIRONMENT;
  readonly gl: WebGL2RenderingContext;
  readonly materialBackdrop: MaterialBackdrop;
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
  private environmentPrograms = new Map<number, WebGLProgram>();
  private pageProgram: WebGLProgram;
  private weather: Atmosphere | null;
  private surfaceDepth: SurfaceDepth;
  private shutterDepth: SurfaceDepth;
  private exposure: FrameExposure;
  private sceneColor: SceneColor;
  private artworkUpload: ArtworkUpload;
  private sceneColorBytes = 0;
  private pageSurfaces: PageSurface[] = [];
  private pageGeometry = new Map<
    PageSurface,
    { sheet: ConstrainedSheet; vao: WebGLVertexArrayObject; positions: WebGLBuffer; buffers: WebGLBuffer[] }
  >();
  private focusSurface: PageSurface | null = null;
  private snags = new Map<string, TitleSnag>();
  private snagGeometry: {
    sheet: ConstrainedSheet;
    vao: WebGLVertexArrayObject;
    positions: WebGLBuffer;
    buffers: WebGLBuffer[];
  } | null = null;
  private grid: WebGLVertexArrayObject;
  private propGrids = new Map<number, { vao: WebGLVertexArrayObject; count: number }>();
  private propShells = new Map<string, { vao: WebGLVertexArrayObject; count: number }>();
  private soundCache: { key: string; cues: SoundCue[] } | null = null;
  private propGridLevels: number[];
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
    this.materialBackdrop = new MaterialBackdrop(gl);
    this.gl = gl;
    this.surfaceDepth = new SurfaceDepth(gl);
    this.shutterDepth = new SurfaceDepth(gl);
    this.exposure = new FrameExposure(gl);
    this.sceneColor = new SceneColor(gl);
    this.artworkUpload = new ArtworkUpload(gl);
    this.actors = buildActors(seed);
    this.props = this.program(propVertex, propFragment);
    this.environment = this.program(environmentVertex, environmentFragment);
    for (let mode = 0; mode <= 6; mode++)
      this.environmentPrograms.set(
        mode,
        this.program(specializeEnvironment(environmentVertex, mode), specializeEnvironment(environmentFragment, mode)),
      );
    this.pageProgram = this.program(pageVertex, pageFragment);
    this.weather = new Atmosphere(gl, seed, tier);
    const grid = this.mesh(tier === "CINEMATIC" ? 40 : tier === "BALANCED" ? 26 : 16);
    this.grid = grid.vao;
    this.gridCount = grid.count;
    this.propGrids.set(tier === "CINEMATIC" ? 40 : tier === "BALANCED" ? 26 : 16, grid);
    for (const divisions of [1, 4, 8, 16, 24]) {
      if (divisions < (tier === "CINEMATIC" ? 40 : tier === "BALANCED" ? 26 : 16))
        this.propGrids.set(divisions, this.mesh(divisions));
    }
    this.propGridLevels = [...this.propGrids.keys()].sort((a, b) => a - b);
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
    g.bindAttribLocation(p, 1, "deformed");
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
    _cover: string,
    signal: AbortSignal,
    omitOptional = false,
    direction: EmbarkationArtDirection = {},
    ambientOnly = false,
  ) {
    this.palette = { ...defaultPalette, ...direction.palette };
    const selection = selectEnvironment(direction);
    this.landscape = selection.set;
    this.diagnostics.environment = { id: selection.set.id, reason: selection.reason };
    const urls = new Map<string, string>([
      ["derived/scrap-2", direction.materialUrls?.["derived/scrap-2"] ?? "/images/embarkation/derived/scrap-2.webp"],
      ["crossing", direction.crossingUrl ?? "/images/embarkation/stage-A-background.webp"],
      ["room", "/images/muster/lantern-room.png"],
      ["paperBack", PAPER_BACK.url],
      ["exterior", "/images/embarkation/derived/stage-c-water.webp"],
      ["exteriorOverscan", "/images/embarkation/derived/stage-c-extended.webp"],
      ["stage-c-pier", "/images/embarkation/derived/stage-c-pier.png"],
      ["stage-distant", this.landscape.textures["stage-distant"]],
      ["stage-islands", this.landscape.textures["stage-islands"]],
      ["stage-middle", this.landscape.textures["stage-middle"]],
      ["stage-near", this.landscape.textures["stage-near"]],
      ["stage-rocks", this.landscape.textures["stage-rocks"]],
      ["aperture", "/images/embarkation/derived/room-aperture.png"],
      ["reconciliationMask", "/images/embarkation/derived/room-reconciliation-mask.png"],
      ["overscan", ROOM_EXTENSION.url],
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
      urls.delete("derived/scrap-2");
      urls.delete("paperBack");
      urls.delete("crossing");
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
            colorSpaceConversion: DATA_TEXTURES.has(key) ? "none" : "default",
            imageOrientation: "flipY",
          });
          if (signal.aborted || this.disposed) {
            bitmap.close();
            return;
          }
          const g = this.gl;
          // Normalize color images through a declared sRGB canvas. Data maps
          // bypass browser color conversion and retain their numeric channels.
          let image: ImageBitmap | OffscreenCanvas = bitmap;
          if (!DATA_TEXTURES.has(key)) {
            const normalized = new OffscreenCanvas(bitmap.width, bitmap.height);
            normalized.getContext("2d", { colorSpace: "srgb" })!.drawImage(bitmap, 0, 0);
            image = normalized;
          }
          const texture = this.artworkUpload.upload(image, bitmap.width, bitmap.height, DATA_TEXTURES.has(key), false);
          this.textures.set(key, texture);
          this.diagnostics.textureBytes += texture.bytes;
          this.diagnostics.assetBytes += blob.size;
          (this.diagnostics.runtimeTextures ??= {})[key] = { url, width: bitmap.width, height: bitmap.height };
          if (propMaterial(key).thicknessRatio > 0) {
            const vertices = propShellFromBitmap(bitmap, key === "P2-compass" ? 1 : 40);
            const vao = g.createVertexArray()!,
              buffer = g.createBuffer()!;
            this.buffers.push(buffer);
            g.bindVertexArray(vao);
            g.bindBuffer(g.ARRAY_BUFFER, buffer);
            g.bufferData(g.ARRAY_BUFFER, vertices, g.STATIC_DRAW);
            g.enableVertexAttribArray(0);
            g.vertexAttribPointer(0, 2, g.FLOAT, false, 16, 0);
            g.enableVertexAttribArray(2);
            g.vertexAttribPointer(2, 2, g.FLOAT, false, 16, 8);
            this.propShells.set(key, { vao, count: vertices.length / 4 });
          }
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
        "reconciliationMask",
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
    // The old 0.01s warm-up left almost the entire simulation on the first
    // visible/seeked frame. Prepare the complete visible physical horizon in
    // a worker, including reverse-seek support, without changing its equations.
    const prepareMotions = async () => {
      const motionStarted = performance.now();
      const motions = await this.prepare<Array<{ id: string; samples: Float64Array }>>({ actors: this.actors }, signal);
      const actorById = new Map(this.actors.map((a) => [a.id, a]));
      for (const motion of motions) materialPath(actorById.get(motion.id)!).importCache(motion.samples);
      this.diagnostics.motionPreparation = {
        ms: performance.now() - motionStarted,
        bytes: motions.reduce((n, m) => n + m.samples.byteLength, 0),
        actors: motions.length,
        thread: "worker",
      };
    };
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
    const texture = this.artworkUpload.upload(focus, focus.width, focus.height);
    this.textures.set("focus-line", texture);
    this.diagnostics.textureBytes += texture.bytes;
    const scrap = this.textures.get("derived/scrap-2");
    const prepareContact = async () => {
      if (!scrap) return;
      const started = performance.now();
      const pixels = ctx.getImageData(0, 0, focus.width, focus.height).data;
      const glyph = {
        width: focus.width,
        height: focus.height,
        alpha: Uint8Array.from({ length: focus.width * focus.height }, (_, i) => pixels[i * 4 + 3]),
      };
      const specs: SnagSpec[] = [
        [390, 844],
        [800, 1100],
        [1280, 720],
        [2560, 1080],
      ].map(([width, height]) => ({ viewport: { width, height }, aspect: scrap.height / scrap.width, glyph }));
      const caches = await this.prepare<SnagCache[]>({ snags: specs }, signal);
      signal.throwIfAborted();
      specs.forEach((spec, i) =>
        this.snags.set(composition(spec.viewport.width, spec.viewport.height).family, new TitleSnag(spec, caches[i])),
      );
      this.diagnostics.titleContactPreparation = {
        ms: performance.now() - started,
        bytes: caches.reduce((sum, cache) => sum + cache.sheet.samples.byteLength, 0),
        glyphSha256: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", glyph.alpha)), (v) =>
          v.toString(16).padStart(2, "0"),
        ).join(""),
        families: specs.map((spec, i) => ({
          family: composition(spec.viewport.width, spec.viewport.height).family,
          contact: caches[i].contact,
        })),
      };
    };
    // Contact geometry depends on the glyph raster, not on the loose-actor
    // trajectories. Serial preparation exhausted the production watchdog:
    // 26.6 s of actor work followed by a still-running 15.2 s contact solve.
    // Run these independent jobs together; keep every physical sample/family.
    await Promise.all([prepareMotions(), prepareContact()]);
    this.resize();
    this.draw(0);
    this.gl.finish();
  }
  async captureSource(root: HTMLElement, signal: AbortSignal) {
    this.soundCache = null;
    this.pageSurfaces = await capturePage(root, signal);
    signal.throwIfAborted();
    this.focusSurface = this.pageSurfaces.find((s) => s.node.dataset.departure === "focus-title") ?? null;
    for (const surface of this.pageSurfaces) {
      // SVG foreignObject is decoded entirely from inlined local resources.
      // Draw into a bounded raster once at the selected source resolution.
      const raster = document.createElement("canvas");
      const ratio = Math.min(devicePixelRatio || 1, this.tier === "CINEMATIC" ? 2 : 1);
      raster.width = Math.ceil(surface.rect.width * ratio);
      raster.height = Math.ceil(surface.rect.height * ratio);
      raster.getContext("2d")!.drawImage(surface.image, 0, 0, raster.width, raster.height);
      const texture = this.artworkUpload.upload(raster, raster.width, raster.height);
      this.textures.set(surface.id, texture);
      this.diagnostics.textureBytes += texture.bytes;
    }
    const started = performance.now();
    const surfaces = this.pageSurfaces.filter((s) => s !== this.focusSurface);
    const caches = await this.prepare<Array<{ id: string; samples: Float32Array; limitedSteps: number }>>(
      {
        width: this.width,
        height: this.height,
        surfaces: surfaces.map((s) => ({
          id: s.id,
          material: s.material,
          attachment: s.attachment,
          anchors: s.anchors,
          phase: s.phase,
          release: s.release,
          rect: { x: s.rect.x, y: s.rect.y, width: s.rect.width, height: s.rect.height },
        })),
      },
      signal,
    );
    signal.throwIfAborted();
    for (const cache of caches) {
      const surface = surfaces.find((s) => s.id === cache.id)!;
      pageSheet(surface, this.width, this.height).importCache(cache);
    }
    this.diagnostics.clothPreparation = {
      ms: performance.now() - started,
      bytes: caches.reduce((sum, c) => sum + c.samples.byteLength, 0),
      surfaces: caches.length,
      thread: "worker",
    };
  }
  private prepare<T>(payload: object, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./cloth-worker.ts", import.meta.url), { type: "module" });
      const cleanup = () => {
        signal.removeEventListener("abort", abort);
        worker.terminate();
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };
      worker.onmessage = (event) => {
        cleanup();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.caches);
      };
      worker.onerror = () => {
        cleanup();
        reject(new Error("material-worker-unavailable"));
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      worker.postMessage(payload);
    });
  }
  releaseDeparture() {
    this.diagnostics.textureBytes -= this.exposure.bytes;
    this.exposure.begin(1, 1);
    this.diagnostics.textureBytes += this.exposure.bytes;
    this.diagnostics.textureBytes -= this.weather?.bytes ?? 0;
    this.weather?.dispose();
    this.weather = null;
    this.actors.length = 0;
    const keep = new Set([
      "room",
      "exterior",
      "exteriorOverscan",
      "aperture",
      "reconciliationMask",
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
    for (const geometry of this.pageGeometry.values()) {
      geometry.buffers.forEach((b) => this.gl.deleteBuffer(b));
      this.gl.deleteVertexArray(geometry.vao);
    }
    this.pageGeometry.clear();
    this.releaseSnag();
    this.pageSurfaces = [];
  }
  soundCues(): readonly SoundCue[] {
    const viewport = { width: this.width, height: this.height },
      key = `${this.width}:${this.height}`;
    if (this.soundCache?.key === key) return this.soundCache.cues;
    const cues: SoundCue[] = [];
    for (const surface of this.pageSurfaces) {
      if (surface === this.focusSurface) continue;
      for (const [anchor, release] of surface.anchors.entries()) {
        const time = release + DEPARTURE_ANCHOR_WINDOW.after;
        const sheet = pageSheet(surface, this.width, this.height),
          frame = sheet.at(time),
          index = sheet.pins[anchor] * 3;
        const point: Vec3 = [frame.positions[index], frame.positions[index + 1], frame.positions[index + 2]];
        const pan = soundPan(point, time, viewport);
        cues.push({
          id: `depart:${surface.id}:${anchor}`,
          time,
          duration: surface.material === "cloth" ? 0.38 : 0.18,
          kind: `${surface.material}-release`,
          energy:
            (anchor === surface.anchors.indexOf(Math.max(...surface.anchors)) ? 0.72 : 0.35) *
            (0.45 + 0.55 * gust(time)),
          pan: [pan, pan],
          source: `${surface.id}:anchor-${anchor}:zero-hold`,
        });
      }
    }
    const snag = this.snags.get(composition(this.width, this.height).family);
    if (snag?.contact) {
      const contact = snag.contact,
        pan = soundPan(contact.point, contact.time, viewport),
        endPan = soundPan(snag.glyphPoint(CUT.peel, contact.uv), CUT.peel, viewport);
      cues.push({
        id: "snag:contact",
        time: contact.time,
        duration: 0.13,
        kind: "paper-contact",
        energy: Math.min(1, Math.hypot(...contact.velocity) / 2400),
        pan: [pan, pan],
        source: "TitleSnag.contact",
      });
      cues.push({
        id: "snag:strain",
        time: contact.time + 0.08,
        duration: Math.max(0.02, CUT.peel - contact.time - 0.08),
        kind: "paper-strain",
        energy: 0.55,
        pan: [pan, endPan],
        source: "TitleSnag.constraint-held",
      });
      cues.push({
        id: "snag:release",
        time: CUT.peel,
        duration: 0.29,
        kind: "paper-peel",
        energy: 0.7,
        pan: [endPan, endPan + 0.1],
        source: "TitleSnag.constraint-release",
      });
    }
    for (const actor of this.actors.filter((a) => a.hero === "map" || a.id.startsWith("eddy-"))) {
      const cue = paperPassCue(actor, viewport);
      if (cue) cues.push(cue);
    }
    for (const hit of LENS_IMPACTS)
      cues.push({
        id: `lens:${hit.id}`,
        time: hit.time,
        duration: 0.16,
        kind: "wet-hit",
        energy: hit.radius / 0.024,
        pan: [(hit.x - 0.5) * 1.7, (hit.x - 0.5) * 1.7],
        source: `LENS_IMPACTS:${hit.id}`,
      });
    this.soundCache = { key, cues };
    return cues;
  }
  sourceDiagnostics(time: number) {
    return this.pageSurfaces.map((s) => ({
      id: s.id,
      source: s.node.dataset.departure,
      width: s.rect.width,
      height: s.rect.height,
      material: s.material,
      release: s.release,
      // The focus title has its own continuous identity/geometry. Inspecting
      // it must not create an unused departure simulation on the main thread.
      ...(s === this.focusSurface ? { motion: "focus-title" } : pageState(s, time, this.width, this.height)),
      ...(s === this.focusSurface || time >= 28 || pageState(s, time, this.width, this.height).alpha < 0.002
        ? {}
        : {
            sheet: (() => {
              const sheet = pageSheet(s, this.width, this.height);
              return {
                strain: sheet.strain(sheet.at(time)),
                limitedSteps: sheet.limitedSteps,
                cacheBytes: sheet.bytes,
              };
            })(),
          }),
    }));
  }
  resize() {
    const g = this.gl;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      this.tier === "CINEMATIC" ? window.devicePixelRatio || 1 : this.tier === "BALANCED" ? 1.35 : 1,
    );
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    // With scrollbar-gutter:stable Chromium also subtracts the gutter from
    // viewport CSS units. The shared projection uses innerWidth: set that exact
    // CSS extent so the GPU image is not rescaled again by its inset parent.
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    g.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.diagnostics.textureBytes -= this.sceneColorBytes;
    this.sceneColor.resize(this.canvas.width, this.canvas.height);
    this.sceneColorBytes = this.sceneColor.bytes;
    this.diagnostics.textureBytes += this.sceneColorBytes;
    this.diagnostics.textureBytes -= this.weather?.bytes ?? 0;
    this.weather?.resize(this.canvas.width, this.canvas.height);
    this.diagnostics.textureBytes += this.weather?.bytes ?? 0;
    if (this.weather) {
      // Allocate exposure and holdout storage during preparation/resize, not
      // when the first supported page section begins to move.
      this.diagnostics.textureBytes -= this.exposure.bytes + this.surfaceDepth.bytes + this.shutterDepth.bytes;
      this.exposure.begin(this.canvas.width, this.canvas.height);
      this.surfaceDepth.capture(() => {});
      this.shutterDepth.capture(() => {});
      this.diagnostics.textureBytes += this.exposure.bytes + this.surfaceDepth.bytes + this.shutterDepth.bytes;
    }
    if (this.backgroundCanvas) {
      this.backgroundCanvas.width = this.canvas.width;
      this.backgroundCanvas.height = this.canvas.height;
      this.backgroundCanvas.style.width = `${this.width}px`;
      this.backgroundCanvas.style.height = `${this.height}px`;
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
    const g = this.gl;
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
    const temporal =
      !options.ambient &&
      !options.reduced &&
      options.returnTime === undefined &&
      time >= 0.45 + EXPOSURE_SECONDS / 2 &&
      time < CUT.settled - EXPOSURE_SECONDS / 2;
    try {
      if (temporal) {
        const samples = exposureSamples(time, this.tier, this.width, this.height, this.focusSurface?.rect);
        // Before assembly there is no intervening live DOM: expose the complete
        // scene together. At assembly, stable room paint remains below the live
        // shell/landed nodes and incoming transparent material remains above it.
        const split = time >= CUT.room;
        const exposureBefore = this.exposure.bytes;
        this.exposure.begin(this.canvas.width, this.canvas.height);
        this.diagnostics.textureBytes += this.exposure.bytes - exposureBefore;
        this.weather?.beginExposure(!options.referenceExposure);
        for (const [index, sample] of samples.entries()) {
          setFilmLens(g, sample);
          this.drawInstant(sample.time, options, {
            split,
            weight: sample.weight,
            first: index === 0,
            present: index === samples.length - 1,
          });
          this.exposure.capture(1, sample.weight, this.sceneColor.resolve());
        }
        if (split) {
          this.exposure.present(0);
          this.copyBackground();
        } else {
          this.backgroundCanvas
            ?.getContext("2d")
            ?.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
        }
        this.exposure.present(1);
        this.diagnostics.exposure = {
          samples: samples.length,
          seconds: EXPOSURE_SECONDS,
          bytes: this.exposure.bytes,
          storage: this.exposure.floating ? "RGBA16F linear premultiplied" : "RGBA8 encoded running mean",
        };
      } else {
        setFilmLens(g, { aperture: [0, 0], focus: FOCAL });
        this.drawInstant(time, options);
        this.sceneColor.present();
        this.diagnostics.exposure = {
          samples: 1,
          seconds: 0,
          bytes: this.exposure.bytes,
          storage: this.exposure.floating ? "RGBA16F linear premultiplied" : "RGBA8 encoded running mean",
        };
      }
    } finally {
      this.diagnostics.textureBytes += this.sceneColor.bytes - this.sceneColorBytes;
      this.sceneColorBytes = this.sceneColor.bytes;
      this.diagnostics.color = {
        working: this.sceneColor.storage.label,
        samples: this.sceneColor.samples,
        bytes: this.sceneColor.bytes,
        display: "sRGB transfer; explicit CSS composition groups",
        data: [...DATA_TEXTURES],
      };
      this.weather?.endExposure();
      setFilmLens(g, { aperture: [0, 0], focus: FOCAL });
      if (query) {
        g.endQuery(this.timer!.TIME_ELAPSED_EXT);
        this.queries.push(query);
      }
    }
  }
  private copyBackground() {
    if (!this.backgroundCanvas) return;
    const b = this.backgroundCanvas.getContext("2d");
    b?.clearRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    b?.drawImage(this.canvas, 0, 0);
  }
  private drawInstant(
    time: number,
    options: RenderOptions,
    exposure?: { split: boolean; weight: number; first: boolean; present: boolean },
  ) {
    const returning = options.returnTime !== undefined;
    const returnTime = options.returnTime ?? 0;
    if (returning) time = CUT.still + returnTime;
    const g = this.gl,
      p = this.props,
      cam = returning ? { position: [0, 0, 0] as Vec3, roll: 0 } : camera(time),
      worldH = WORLD_HEIGHT,
      worldW = (worldH * this.width) / this.height;
    this.sceneColor.bind();
    g.viewport(0, 0, this.canvas.width, this.canvas.height);
    g.clearColor(0, 0, 0, 0);
    g.depthMask(true);
    g.clearDepth(1);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    g.depthMask(false);
    const scenery = new SurfaceQueue(g),
      surfaces = new SurfaceQueue(g);
    let bindScenery = () => {};
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    if (!options.only || options.only === "environment" || options.only === "landscape" || options.only === "lens") {
      const prepared = new Set<WebGLProgram>();
      const moon = celestialState(time, this.width, this.height, this.roomUV, this.landscape.calibration);
      const pierZ = exteriorPierDepth([worldW, worldH], this.roomUV as [number, number, number, number]);
      const prepareEnvironment = (e: WebGLProgram) => {
        g.useProgram(e);
        if (prepared.has(e)) return;
        prepared.add(e);
        bindFilmLens(g, e);
        g.uniform1f(this.u(e, "time"), time);
        this.weather?.setMoon(moon.position);
        g.uniform3fv(this.u(e, "moonPosition"), moon.position);
        g.uniform1f(this.u(e, "moonRadius"), moon.radius);
        g.uniform1f(this.u(e, "moonReflectionSourceX"), moon.reflectionSourceX);
        g.uniform1f(this.u(e, "projectionGrid"), options.projectionGrid ? 1 : 0);
        g.uniform1f(this.u(e, "apertureDebug"), options.apertureMask ? 1 : 0);
        g.uniform2f(
          this.u(e, "stageCalibration"),
          this.landscape.calibration.width / this.landscape.calibration.height,
          this.landscape.calibration.referenceCameraZ,
        );
        g.uniform4fv(this.u(e, "stageDepths"), this.landscape.calibration.depths);
        const landscape = landscapeFrame({ width: this.width, height: this.height }, this.landscape.calibration);
        g.uniform2fv(this.u(e, "stagePlaneSize"), landscape.size);
        g.uniform2f(this.u(e, "stageWater"), landscape.slope, landscape.eyeHeight);
        g.uniform1f(this.u(e, "stageEyeZ"), landscape.eyeZ);
        g.uniform1f(this.u(e, "stageSkyZ"), this.landscape.calibration.depths[0]);
        g.uniform4fv(this.u(e, "stageBackingBounds"), this.landscape.calibration.backingBounds);
        g.uniform1f(this.u(e, "windLevel"), gust(time));
        g.uniform1f(this.u(e, "exteriorPierZ"), pierZ);
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
        for (const [unit, , uniform] of environmentTextures) g.uniform1i(this.u(e, uniform), unit);
      };
      const environmentTextures = [
        [1, "aperture", "apertureMap"],
        [10, "reconciliationMask", "reconciliationMask"],
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
      ] as const;
      bindScenery = () => {
        for (const [unit, key] of environmentTextures) {
          g.activeTexture(g.TEXTURE0 + unit);
          g.bindTexture(g.TEXTURE_2D, this.textures.get(key)!.value);
        }
      };
      bindScenery();
      const scene = (key: string, mode: number, post = 0) => {
        const tx = this.textures.get(key);
        if (!tx) return;
        const e = options.referenceExposure ? this.environment : this.environmentPrograms.get(mode)!;
        const draw = (pass: DepthPass) => {
          prepareEnvironment(e);
          g.uniform1f(this.u(e, "depthPass"), pass);
          g.activeTexture(g.TEXTURE0);
          g.bindTexture(g.TEXTURE_2D, tx.value);
          g.uniform1i(this.u(e, "art"), 0);
          g.uniform2f(this.u(e, "artSize"), tx.width, tx.height);
          g.uniform1f(this.u(e, "mode"), mode);
          g.uniform1f(this.u(e, "post"), post);
          // These branches are exact planes or ray intersections. Subdividing
          // them 112x112 changes neither their projection nor their material.
          // Keep tessellation for curved storm and nonplanar room surfaces.
          const fullQuad =
            mode === 0 ||
            mode === 1 ||
            mode === 4 ||
            mode === 5 ||
            mode === 6 ||
            (mode === 3 && [0, 3, 4, 7, 8, 9].includes(post));
          g.bindVertexArray(fullQuad ? this.quad : this.environmentGrid);
          g.drawArrays(g.TRIANGLES, 0, fullQuad ? 6 : this.environmentCount);
        };
        if (mode === 0) {
          g.disable(g.DEPTH_TEST);
          draw(0);
        } else {
          // Spatial depths select order for soft boundaries; opaque overlap is
          // resolved per fragment, including both ray-intersected water planes.
          const z =
            mode === 5
              ? this.landscape.calibration.depths[Math.min(3, post)]
              : mode === 6
                ? moon.position[2]
                : mode === 1
                  ? post === 2
                    ? pierZ
                    : -12500
                  : mode === 2
                    ? -2390
                    : mode === 4
                      ? -1200
                      : post === 8
                        ? -12500
                        : post === 9
                          ? 0
                          : [-2722.5, -1400, -1089, -2722.5, -2722.5, 200, 690, NEAR_ROOM_LANTERN_Z][Math.max(0, post)];
          // The painted storm is a distant cloud background, not a solid shell
          // that can stop rays. Extinction belongs to the advected volume. The
          // settled original room is a CSS background projection: canonical UI
          // lives above it; its flat Z=0 quad is not room geometry.
          scenery.add({ z, draw, holdout: mode !== 2 && !(mode === 3 && post === 9) });
        }
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
          scene("stage-distant", 5, 4);
          scene("stage-islands", 5, 1);
          scene("stage-middle", 5, 2);
          scene("stage-rocks", 5, 3);
          scene("stage-near", 5, 3);
        }
        if (time > 14.5) scene("room", 6);
      }
      if (time < 19.4 && !options.projectionGrid && options.only !== "landscape") scene("crossing", 2);
      if (!returning && !options.ambient && !options.only) {
        this.queueTitle(surfaces, time, cam.position, cam.roll, worldW, worldH);
      }
      if (time >= CUT.room) {
        // At the calibrated final viewpoint every projection has converged.
        // Evaluate that same original-material projection once for the stable
        // living room, avoiding eight redundant fullscreen ambient passes.
        scene("room", 3, 9);
      } else if (time >= CUT.threshold) {
        scene("backing", 3, -1);
        scene("room", 3, 0);
        if (time < CUT.room) scene("P6-lantern", 4);
        for (const layer of [4, 2, 3, 1, 7, 5, 6]) scene("room", 3, layer);
      }
      scenery.flush();
    }
    if (options.only === "contact") {
      this.queueTitle(surfaces, time, cam.position, cam.roll, worldW, worldH, true);
    }
    g.disable(g.DEPTH_TEST);
    if (!returning && (!options.only || options.only === "lens")) this.weather?.captureScenery(time);
    if (!returning && time >= CUT.assembly - 0.1 && time < CUT.settled) this.materialBackdrop.capture();
    this.diagnostics.materialBackdropBytes = this.materialBackdrop.bytes;
    if (exposure?.split) {
      this.exposure.capture(0, exposure.weight, this.sceneColor.resolve());
      g.clear(g.COLOR_BUFFER_BIT);
    } else if (!exposure && this.backgroundCanvas) {
      this.sceneColor.present();
      this.copyBackground();
      this.sceneColor.bind();
      g.clear(g.COLOR_BUFFER_BIT);
    }
    if (!returning && time >= 0.45 && time < 28 && (!options.only || options.only === "page")) {
      const program = this.pageProgram;
      g.useProgram(program);
      bindFilmLens(g, program);
      g.activeTexture(g.TEXTURE0);
      g.uniform1i(this.u(program, "art"), 0);
      g.uniform2f(this.u(program, "viewport"), worldW, worldH);
      g.uniform3fv(this.u(program, "cameraPosition"), cam.position);
      g.uniform1f(this.u(program, "roll"), cam.roll);
      g.uniform1f(this.u(program, "time"), time);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      const departures = this.pageSurfaces
        .filter((s) => s !== this.focusSurface)
        .map((s) => ({ s, state: pageState(s, time, this.width, this.height) }))
        .sort((a, b) => a.state.position[2] - b.state.position[2]);
      for (const { s, state } of departures) {
        if (state.alpha < 0.002) continue;
        const tx = this.textures.get(s.id);
        if (!tx) continue;
        const sheet = pageSheet(s, this.width, this.height);
        let geometry = this.pageGeometry.get(s);
        if (!geometry || geometry.sheet !== sheet) {
          if (geometry) {
            geometry.buffers.forEach((b) => g.deleteBuffer(b));
            g.deleteVertexArray(geometry.vao);
          }
          const vao = g.createVertexArray()!,
            positions = g.createBuffer()!,
            uv = g.createBuffer()!,
            indices = g.createBuffer()!;
          g.bindVertexArray(vao);
          g.bindBuffer(g.ARRAY_BUFFER, uv);
          g.bufferData(g.ARRAY_BUFFER, sheet.uv, g.STATIC_DRAW);
          g.enableVertexAttribArray(0);
          g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
          g.bindBuffer(g.ARRAY_BUFFER, positions);
          g.bufferData(g.ARRAY_BUFFER, sheet.rest.length * 4, g.DYNAMIC_DRAW);
          g.enableVertexAttribArray(1);
          g.vertexAttribPointer(1, 3, g.FLOAT, false, 0, 0);
          g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, indices);
          g.bufferData(g.ELEMENT_ARRAY_BUFFER, sheet.indices, g.STATIC_DRAW);
          geometry = { sheet, vao, positions, buffers: [positions, uv, indices] };
          this.pageGeometry.set(s, geometry);
        }
        const mesh = geometry;
        let uploaded = false;
        surfaces.add({
          z: state.position[2],
          draw: (pass) => {
            g.useProgram(program);
            g.activeTexture(g.TEXTURE0);
            g.uniform1f(this.u(program, "depthPass"), pass);
            g.bindVertexArray(mesh.vao);
            if (!uploaded) {
              g.bindBuffer(g.ARRAY_BUFFER, mesh.positions);
              g.bufferSubData(g.ARRAY_BUFFER, 0, sheet.at(time).positions);
              uploaded = true;
            }
            g.bindTexture(g.TEXTURE_2D, tx.value);
            g.uniform3fv(this.u(program, "position"), state.supportPosition);
            g.uniform3fv(this.u(program, "rotation"), state.supportRotation);
            g.uniform2f(
              this.u(program, "size"),
              (s.rect.width * 1100) / this.height,
              (s.rect.height * 1100) / this.height,
            );
            for (const [name, value] of Object.entries({
              // Recession selects visibility, not physical transparency. Fog
              // now integrates to this opaque sheet instead of past it.
              alpha: 1,
              pressure: state.pressure,
              phase: s.phase,
              released: state.released,
              stiffness: state.stiffness,
              weathering: state.weathering,
            }))
              g.uniform1f(this.u(program, name), value);
            if (state.released === 0) {
              g.uniform1f(this.u(program, "support"), 1);
              g.drawElements(g.TRIANGLES, sheet.indices.length, g.UNSIGNED_SHORT, 0);
            }
            g.uniform1f(this.u(program, "support"), 0);
            g.drawElements(g.TRIANGLES, sheet.indices.length, g.UNSIGNED_SHORT, 0);
          },
        });
      }
    }
    if (options.ambient) return;
    g.useProgram(p);
    bindFilmLens(g, p);
    g.bindVertexArray(this.grid);
    g.activeTexture(g.TEXTURE0);
    g.uniform1i(this.u(p, "art"), 0);
    g.uniform2f(this.u(p, "viewport"), worldW, worldH);
    g.uniform3fv(this.u(p, "cameraPosition"), cam.position);
    g.uniform3fv(this.u(p, "eye"), cam.position);
    for (const [name, color] of Object.entries(this.palette)) g.uniform3fv(this.u(p, name), color);
    g.uniform1f(this.u(p, "roll"), cam.roll);
    g.uniform1f(this.u(p, "time"), time);
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
    const geometryCost = { candidates: objects.length, culled: 0, vertices: 0 };
    const lens = filmLens(g);
    for (const { a, pose } of objects) {
      const tx = this.textures.get(a.asset);
      if (!tx) continue;
      // Bound every authored vertex term, including curl and adhesion. A
      // sphere/frustum test removes only geometry wholly outside the view;
      // partially framed lens passes retain their full shape and exposure.
      const distance = FOCAL + cam.position[2] - pose.position[2];
      const radius =
        Math.hypot(
          pose.size / 2,
          (pose.size * tx.height) / tx.width / 2,
          pose.size * (0.218 * Math.abs(pose.bend) + 0.54 * pose.adhesion),
        ) +
        Math.hypot(...lens.aperture) * (1 + Math.abs(distance) / lens.focus);
      if (
        !options.referenceExposure &&
        !sphereInView(pose.position, radius, cam, { width: this.width, height: this.height })
      ) {
        geometryCost.culled++;
        continue;
      }
      const displayPixels =
        ((((pose.size * FOCAL) / Math.max(1, distance)) * this.height) / WORLD_HEIGHT) * this.pixelRatio;
      // Projected interpolation error controls distant tessellation, not a
      // different deformation/motion model. Near passes keep the reference
      // mesh. Rigid zero-bend material is exactly planar and needs one quad.
      const divisions =
        pose.adhesion > 0 || distance < pose.size * 3
          ? 40
          : Math.ceil(Math.sqrt((displayPixels * Math.abs(pose.bend) * 12) / (8 * 0.25)));
      const selected = options.referenceExposure ? undefined : this.propGridLevels.find((n) => n >= divisions);
      const material = propMaterial(a.asset);
      const mesh =
        this.propShells.get(a.asset) ??
        (selected === undefined ? { vao: this.grid, count: this.gridCount } : this.propGrids.get(selected)!);
      geometryCost.vertices += mesh.count;
      const objectData = new Float32Array([
        ...pose.position,
        a.additive ? pose.alpha : 1,
        ...pose.rotation,
        pose.bend,
        pose.size,
        (pose.size * tx.height) / tx.width,
        pose.adhesion,
        a.phase,
        a.id === "focus-line" ? smooth(7.93, 8.02, time) * (1 - smooth(8.3, 8.7, time)) : 0,
        0,
        a.additive || a.id === "focus-line" ? 1 : 0,
        a.material === "mist" ? 1 : 0,
        0,
        0,
        material.backing,
        this.propShells.has(a.asset) ? pose.size * material.thicknessRatio : 0,
      ]);
      surfaces.add({
        z: pose.position[2],
        additive: a.additive,
        draw: (pass) => {
          g.useProgram(p);
          g.bindVertexArray(mesh.vao);
          g.activeTexture(g.TEXTURE0);
          g.uniform1f(this.u(p, "depthPass"), pass);
          g.bindTexture(g.TEXTURE_2D, tx.value);
          this.bindPropBacking();
          materialBlend(g, a.additive);
          g.uniform4fv(this.u(p, "objectData[0]"), objectData);
          g.drawArrays(g.TRIANGLES, 0, mesh.count);
        },
      });
    }
    this.diagnostics.propGeometry = geometryCost;
    // Incoming canonical-DOM paint contributes to the same surface queue.
    options.incoming?.(surfaces, time, exposure?.present ?? true);
    surfaces.flush();
    if (!returning && !options.ambient) {
      this.weather?.particlesAt(
        time,
        this.actors,
        this.width,
        this.height,
        (k) => this.textures.get(k)?.value,
        options.only,
        options.layers,
        options.referenceExposure,
      );
      if (!options.only || options.only === "mist")
        this.weather?.mist(time, this.actors, this.width, this.height, () => {
          const target = exposure && !exposure.first ? this.shutterDepth : this.surfaceDepth;
          const before = target.bytes;
          const texture = target.capture(() => {
            bindScenery();
            scenery.holdout();
            surfaces.holdout();
          });
          this.diagnostics.surfaceDepthBytes = this.surfaceDepth.bytes + this.shutterDepth.bytes;
          this.diagnostics.textureBytes += target.bytes - before;
          return texture;
        });
      if (!options.only || options.only === "lens") this.weather?.lensAt(time);
    }
  }
  private bindPropBacking() {
    const g = this.gl;
    g.activeTexture(g.TEXTURE7);
    // A missing optional material cannot substitute the printed face for its
    // reverse. The program also has an explicit texture-independent fallback.
    g.bindTexture(g.TEXTURE_2D, this.textures.get("paperBack")?.value ?? null);
    g.uniform1i(this.u(this.props, "paperBack"), 7);
    g.uniform1f(this.u(this.props, "backingAvailable"), this.textures.has("paperBack") ? 1 : 0);
    g.activeTexture(g.TEXTURE0);
  }
  private queueTitle(
    queue: SurfaceQueue,
    time: number,
    cam: Vec3,
    roll: number,
    w: number,
    h: number,
    diagnostic = false,
  ) {
    queue.add({
      z: focusPose(time, this.width, this.height, this.focusSurface?.rect).position[2],
      draw: (pass) => this.paintFocus(time, cam, roll, w, h, pass),
    });
    const snag = this.snags.get(composition(this.width, this.height).family);
    if (snag && time >= SNAG_BIRTH && time < CUT.room) {
      const points = snag.sheet.at(time).positions;
      let z = 0;
      for (let i = 2; i < points.length; i += 3) z += points[i] / (points.length / 3);
      queue.add({ z, draw: (pass) => this.paintSnag(time, cam, roll, w, h, diagnostic, pass) });
    }
  }
  private paintFocus(time: number, cam: Vec3, roll: number, w: number, h: number, pass: DepthPass = 0) {
    const pose = focusPose(time, this.width, this.height, this.focusSurface?.rect),
      // The same measured heading mesh survives departure. Its casing/layout
      // resolves at the edge-on turn, so no second message appears or fades in.
      tx = this.textures.get(this.focusSurface && time < TITLE_TURN.edge ? this.focusSurface.id : "focus-line");
    if (!tx || pose.alpha < 0.001) return;
    const g = this.gl,
      p = this.props;
    g.useProgram(p);
    bindFilmLens(g, p);
    g.uniform1f(this.u(p, "depthPass"), pass);
    g.bindVertexArray(this.grid);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, tx.value);
    g.uniform1i(this.u(p, "art"), 0);
    g.uniform2f(this.u(p, "viewport"), w, h);
    g.uniform3fv(this.u(p, "cameraPosition"), cam);
    g.uniform3fv(this.u(p, "eye"), cam);
    g.uniform1f(this.u(p, "time"), time);
    g.uniform1f(this.u(p, "roll"), roll);
    g.uniform4fv(
      this.u(p, "objectData[0]"),
      new Float32Array([
        ...pose.position,
        pose.alpha,
        ...pose.rotation,
        pose.bend,
        pose.size,
        (pose.size * tx.height) / tx.width,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
      ]),
    );
    for (const [name, value] of Object.entries(this.palette)) g.uniform3fv(this.u(p, name), value);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.drawArrays(g.TRIANGLES, 0, this.gridCount);
  }
  private releaseSnag() {
    if (this.snagGeometry) {
      this.snagGeometry.buffers.forEach((b) => this.gl.deleteBuffer(b));
      this.gl.deleteVertexArray(this.snagGeometry.vao);
      this.snagGeometry = null;
    }
    this.snags.clear();
  }
  private paintSnag(
    time: number,
    cam: Vec3,
    roll: number,
    w: number,
    h: number,
    diagnostic = false,
    pass: DepthPass = 0,
  ) {
    const snag = this.snags.get(composition(this.width, this.height).family);
    const tx = this.textures.get("derived/scrap-2");
    if (!snag || !tx || time < SNAG_BIRTH || time >= CUT.room) return;
    const g = this.gl,
      p = this.props,
      sheet = snag.sheet;
    let geometry = this.snagGeometry;
    if (!geometry || geometry.sheet !== sheet) {
      if (geometry) {
        geometry.buffers.forEach((b) => g.deleteBuffer(b));
        g.deleteVertexArray(geometry.vao);
      }
      const vao = g.createVertexArray()!,
        positions = g.createBuffer()!,
        uv = g.createBuffer()!,
        indices = g.createBuffer()!;
      g.bindVertexArray(vao);
      g.bindBuffer(g.ARRAY_BUFFER, uv);
      g.bufferData(g.ARRAY_BUFFER, sheet.uv, g.STATIC_DRAW);
      g.enableVertexAttribArray(0);
      g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, positions);
      g.bufferData(g.ARRAY_BUFFER, sheet.rest.length * 4, g.DYNAMIC_DRAW);
      g.enableVertexAttribArray(1);
      g.vertexAttribPointer(1, 3, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, indices);
      g.bufferData(g.ELEMENT_ARRAY_BUFFER, sheet.indices, g.STATIC_DRAW);
      geometry = { sheet, vao, positions, buffers: [positions, uv, indices] };
      this.snagGeometry = geometry;
    }
    const frame = sheet.at(time);
    g.useProgram(p);
    bindFilmLens(g, p);
    g.uniform1f(this.u(p, "depthPass"), pass);
    g.bindVertexArray(geometry.vao);
    g.bindBuffer(g.ARRAY_BUFFER, geometry.positions);
    g.bufferSubData(g.ARRAY_BUFFER, 0, frame.positions);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, tx.value);
    g.uniform1i(this.u(p, "art"), 0);
    this.bindPropBacking();
    g.uniform3fv(this.u(p, "cameraPosition"), cam);
    g.uniform3fv(this.u(p, "eye"), cam);
    g.uniform2f(this.u(p, "viewport"), w, h);
    g.uniform1f(this.u(p, "time"), time);
    g.uniform1f(this.u(p, "roll"), roll);
    g.uniform4fv(
      this.u(p, "objectData[0]"),
      new Float32Array([
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        time < CUT.peel ? 0.45 : 0,
        0,
        0,
        1,
        diagnostic ? 1 : 0,
        1,
        0,
      ]),
    );
    for (const [name, value] of Object.entries(this.palette)) g.uniform3fv(this.u(p, name), value);
    g.enable(g.DEPTH_TEST);
    g.depthFunc(g.LEQUAL);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.drawElements(g.TRIANGLES, sheet.indices.length, g.UNSIGNED_SHORT, 0);
  }
  inspectScene(time: number) {
    const moon = celestialState(time, this.width, this.height, this.roomUV, this.landscape.calibration);
    return {
      roomUV: this.roomUV,
      moon,
      waterSurface: EXTERIOR,
      titleSnag:
        time >= SNAG_BIRTH && time < CUT.room
          ? this.snags.get(composition(this.width, this.height).family)?.inspect(time)
          : null,
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
    return projectWorld(p, camera(t), { width: this.width, height: this.height });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.removeContextListener();
    const g = this.gl;
    this.weather?.dispose();
    this.surfaceDepth.dispose();
    this.shutterDepth.dispose();
    this.exposure.dispose();
    this.sceneColor.dispose();
    this.artworkUpload.dispose();
    this.materialBackdrop.dispose();
    this.queries.forEach((query) => g.deleteQuery(query));
    this.queries = [];
    for (const t of this.textures.values()) g.deleteTexture(t.value);
    this.textures.clear();
    this.buffers.forEach((b) => g.deleteBuffer(b));
    for (const geometry of this.pageGeometry.values()) {
      geometry.buffers.forEach((b) => g.deleteBuffer(b));
      g.deleteVertexArray(geometry.vao);
    }
    this.pageGeometry.clear();
    this.releaseSnag();
    for (const mesh of this.propGrids.values()) g.deleteVertexArray(mesh.vao);
    for (const mesh of this.propShells.values()) g.deleteVertexArray(mesh.vao);
    this.propGrids.clear();
    g.deleteVertexArray(this.quad);
    g.deleteVertexArray(this.environmentGrid);
    g.deleteProgram(this.props);
    g.deleteProgram(this.environment);
    for (const program of this.environmentPrograms.values()) g.deleteProgram(program);
    this.environmentPrograms.clear();
    g.deleteProgram(this.pageProgram);
    this.pageSurfaces = [];
  }
}
