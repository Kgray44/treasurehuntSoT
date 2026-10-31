import { PAPER_BACK, propMaterial, propFragment, propVertex } from "./prop-material";
import { propShellFromBitmap } from "./prop-shell";
import { SurfaceQueue } from "./depth-compositor";
import { FOCAL, WORLD_HEIGHT } from "./projection";
import { ArtworkUpload, srgbToLinear } from "./color";
import { SceneColor } from "./scene-color";

/** Development-only caller. Uses the exact production material/contour shader
 * and depth passes; no screenshot stand-in or separate test renderer model. */
export async function preparePropQualification(canvas: HTMLCanvasElement, signal: AbortSignal) {
  const gl = canvas.getContext("webgl2", { alpha: true, depth: true, antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL2 unavailable");
  const g = gl,
    program = g.createProgram()!,
    buffers: WebGLBuffer[] = [],
    vaos: WebGLVertexArrayObject[] = [];
  const upload = new ArtworkUpload(g),
    scene = new SceneColor(g);
  for (const [kind, source] of [
    [g.VERTEX_SHADER, propVertex],
    [g.FRAGMENT_SHADER, propFragment],
  ] as const) {
    const shader = g.createShader(kind)!;
    g.shaderSource(shader, source);
    g.compileShader(shader);
    if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(shader)!);
    g.attachShader(program, shader);
    g.deleteShader(shader);
  }
  g.linkProgram(program);
  if (!g.getProgramParameter(program, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(program)!);
  const textures = new Map<
    string,
    {
      texture: WebGLTexture;
      substituted: WebGLTexture;
      width: number;
      height: number;
      vao: WebGLVertexArrayObject;
      count: number;
    }
  >();
  for (const asset of [
    "P1-map-fragment",
    "P2-compass",
    "P4-journal-page",
    "P7-sailcloth",
    "derived/scrap-2",
    "paperBack",
  ]) {
    const response = await fetch(asset === "paperBack" ? PAPER_BACK.url : `/images/embarkation/${asset}.webp`, {
      signal,
    });
    if (!response.ok) throw new Error(`Missing qualification material: ${asset}`);
    const bitmap = await createImageBitmap(await response.blob(), {
      premultiplyAlpha: "none",
      imageOrientation: "flipY",
    });
    const normalized = new OffscreenCanvas(bitmap.width, bitmap.height);
    normalized.getContext("2d", { colorSpace: "srgb" })!.drawImage(bitmap, 0, 0);
    const texture = upload.upload(normalized, bitmap.width, bitmap.height, false, false).value;
    // Adversarial front print, exact same alpha. If a reverse depends on front
    // ink this creates an unmistakable pixel difference in the native test.
    const substitute = new OffscreenCanvas(bitmap.width, bitmap.height),
      ctx = substitute.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const replacement = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    for (let i = 0; i < replacement.data.length; i += 4) {
      replacement.data[i] = 255;
      replacement.data[i + 1] = 12;
      replacement.data[i + 2] = 180;
    }
    ctx.putImageData(replacement, 0, 0);
    const substituted = upload.upload(substitute, bitmap.width, bitmap.height, false, false).value;
    const shell = propMaterial(asset).thicknessRatio > 0;
    const vertices = shell
      ? propShellFromBitmap(bitmap, asset === "P2-compass" ? 1 : 40)
      : new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0]);
    const vao = g.createVertexArray()!,
      buffer = g.createBuffer()!;
    buffers.push(buffer);
    vaos.push(vao);
    g.bindVertexArray(vao);
    g.bindBuffer(g.ARRAY_BUFFER, buffer);
    g.bufferData(g.ARRAY_BUFFER, vertices, g.STATIC_DRAW);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 16, 0);
    g.enableVertexAttribArray(2);
    g.vertexAttribPointer(2, 2, g.FLOAT, false, 16, 8);
    textures.set(asset, {
      texture,
      substituted,
      width: bitmap.width,
      height: bitmap.height,
      vao,
      count: vertices.length / 4,
    });
    bitmap.close();
  }
  const uniform = (name: string) => g.getUniformLocation(program, name);
  const draw = (
    asset: string,
    angle: number,
    options: {
      bend?: number;
      neutral?: boolean;
      width?: number;
      background?: "teal" | "warm";
      thickness?: boolean;
      printedReverse?: boolean;
      substitutePrint?: boolean;
    } = {},
  ) => {
    const tx = textures.get(asset);
    if (!tx) throw new Error(`Unknown prop ${asset}`);
    const profile = propMaterial(asset),
      size = options.width ?? 770;
    scene.resize(canvas.width, canvas.height);
    scene.bind();
    g.viewport(0, 0, canvas.width, canvas.height);
    g.colorMask(true, true, true, true);
    g.depthMask(true);
    g.clearColor(
      ...((options.background === "warm" ? [0.91, 0.78, 0.54, 1] : [0.055, 0.16, 0.18, 1]).map((v, i) =>
        i < 3 ? srgbToLinear(v) : v,
      ) as [number, number, number, number]),
    );
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    g.enable(g.BLEND);
    g.disable(g.CULL_FACE);
    g.useProgram(program);
    g.uniform3f(uniform("cameraPosition"), 0, 0, 0);
    g.uniform3f(uniform("eye"), 0, 0, 0);
    g.uniform2f(uniform("viewport"), (WORLD_HEIGHT * canvas.width) / canvas.height, WORLD_HEIGHT);
    g.uniform2f(uniform("filmAperture"), 0, 0);
    g.uniform1f(uniform("filmFocus"), FOCAL);
    g.uniform1f(uniform("time"), 12);
    g.uniform1f(uniform("roll"), 0);
    g.uniform3f(uniform("coolLight"), 1, 1, 1);
    g.uniform3f(uniform("warmLight"), 1, 1, 1);
    g.uniform3f(uniform("depthTint"), 0, 0, 0);
    g.uniform3f(uniform("emissionTint"), 1, 1, 1);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, options.substitutePrint ? tx.substituted : tx.texture);
    g.uniform1i(uniform("art"), 0);
    g.activeTexture(g.TEXTURE7);
    g.bindTexture(g.TEXTURE_2D, textures.get("paperBack")!.texture);
    g.uniform1i(uniform("paperBack"), 7);
    g.uniform1f(uniform("backingAvailable"), 1);
    g.uniform4fv(
      uniform("objectData[0]"),
      new Float32Array([
        0,
        0,
        0,
        1,
        0,
        angle,
        0,
        options.bend ?? 0,
        size,
        (size * tx.height) / tx.width,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        options.neutral ? 1 : 0,
        options.printedReverse ? 0 : profile.backing,
        options.thickness === false ? 0 : size * profile.thicknessRatio,
      ]),
    );
    g.bindVertexArray(tx.vao);
    const queue = new SurfaceQueue(g);
    queue.add({
      z: 0,
      draw: (pass) => {
        g.uniform1f(uniform("depthPass"), pass);
        g.drawArrays(g.TRIANGLES, 0, tx.count);
      },
    });
    queue.flush();
    scene.present();
    return { asset, angle, size, vertices: tx.count, gpuError: g.getError(), viewport: [canvas.width, canvas.height] };
  };
  const pixels = () => {
    const p = new Uint8Array(canvas.width * canvas.height * 4);
    g.readPixels(0, 0, canvas.width, canvas.height, g.RGBA, g.UNSIGNED_BYTE, p);
    return p;
  };
  return {
    draw,
    pixels,
    dispose() {
      for (const tx of textures.values()) {
        g.deleteTexture(tx.texture);
        g.deleteTexture(tx.substituted);
      }
      buffers.forEach((b) => g.deleteBuffer(b));
      vaos.forEach((v) => g.deleteVertexArray(v));
      g.deleteProgram(program);
      upload.dispose();
      scene.dispose();
    },
  };
}
