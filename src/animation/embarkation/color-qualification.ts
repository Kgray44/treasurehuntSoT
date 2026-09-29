import { ArtworkUpload, ColorTransfer, linearToSrgb, srgbToLinear, materialBlend } from "./color";
import { SceneColor } from "./scene-color";

/** Native reference pixels exercise production upload, framebuffer, MSAA,
 * CSS boundary and presentation, in both precision paths. No screenshot
 * comparison can hide a wrong color space behind a similarly wrong oracle. */
export async function qualifyColor(canvas: HTMLCanvasElement, fallback = false) {
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true })!;
  if (!g) throw new Error("No WebGL2");
  const scene = new SceneColor(g, fallback),
    upload = new ArtworkUpload(g, fallback),
    transfer = new ColorTransfer(g);
  scene.resize(256, 128);
  const source = document.createElement("canvas");
  source.width = 256;
  source.height = 128;
  const ctx = source.getContext("2d", { colorSpace: "srgb" })!;
  for (let i = 0; i < 256; i++) {
    ctx.fillStyle = `rgb(${i} ${i} ${i})`;
    ctx.fillRect(i, 0, 1, 128);
  }
  const art = upload.upload(source, 256, 128);
  scene.bind();
  g.viewport(0, 0, 256, 128);
  transfer.draw(art.value, 0);
  scene.present();
  const pixels = new Uint8Array(256 * 4);
  g.readPixels(0, 64, 256, 1, g.RGBA, g.UNSIGNED_BYTE, pixels);
  const roundTrip = Math.max(...Array.from({ length: 256 }, (_, i) => Math.abs(pixels[i * 4] - i)));
  const program = g.createProgram()!;
  for (const [type, code] of [
    [
      g.VERTEX_SHADER,
      `#version 300 es
  void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`,
    ],
    [
      g.FRAGMENT_SHADER,
      `#version 300 es
  precision highp float;uniform vec4 value;out vec4 color;void main(){color=value;}`,
    ],
  ] as const) {
    const s = g.createShader(type)!;
    g.shaderSource(s, code);
    g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)!);
    g.attachShader(program, s);
    g.deleteShader(s);
  }
  g.linkProgram(program);
  const vao = g.createVertexArray()!,
    value = g.getUniformLocation(program, "value");
  function draw(c: number[], additive = false) {
    g.useProgram(program);
    g.bindVertexArray(vao);
    g.uniform4fv(value, c);
    g.disable(g.DEPTH_TEST);
    g.enable(g.BLEND);
    materialBlend(g, additive);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }
  function read() {
    scene.present();
    const p = new Uint8Array(4);
    g.readPixels(100, 64, 1, 1, g.RGBA, g.UNSIGNED_BYTE, p);
    return [...p];
  }
  function clear(c: number[]) {
    scene.bind();
    g.clearColor(c[0], c[1], c[2], c[3]);
    g.clear(g.COLOR_BUFFER_BIT);
  }
  const cases: Array<{ name: string; actual: number[]; expected: number[]; error: number }> = [];
  function check(name: string, expected: number[]) {
    const actual = read(),
      bytes = expected.map((c) => Math.round(c * 255));
    cases.push({ name, actual, expected: bytes, error: Math.max(...actual.map((c, i) => Math.abs(c - bytes[i]))) });
  }
  clear([0, 0, 0, 1]);
  draw([0.5, 0.5, 0.5, 0.5]);
  check("50% white over black", [linearToSrgb(0.5), linearToSrgb(0.5), linearToSrgb(0.5), 1]);
  clear([srgbToLinear(0.5), srgbToLinear(0.5), srgbToLinear(0.5), 1]);
  draw([srgbToLinear(0.5), srgbToLinear(0.5), srgbToLinear(0.5), 0.4], true);
  check("additive midgray", [
    linearToSrgb(srgbToLinear(0.5) * 2),
    linearToSrgb(srgbToLinear(0.5) * 2),
    linearToSrgb(srgbToLinear(0.5) * 2),
    1,
  ]);
  clear([0, 0, 0, 1]);
  scene.css(true);
  draw([0.5, 0.5, 0.5, 0.5]);
  scene.css(false);
  check("native CSS alpha", [0.5, 0.5, 0.5, 1]);
  const fogGradient = [];
  const background = [0.025, 0.085, 0.11],
    tint = [0.25, 0.34, 0.43];
  for (let step = 0; step <= 16; step++) {
    const transmission = Math.exp(-step / 4),
      alpha = 1 - transmission;
    clear([...background.map(srgbToLinear), 1]);
    draw([...tint.map((c) => srgbToLinear(c) * alpha), alpha]);
    const actual = read();
    const expected = tint.map((c, channel) =>
      Math.round(linearToSrgb(srgbToLinear(c) * alpha + srgbToLinear(background[channel]) * transmission) * 255),
    );
    fogGradient.push({
      opticalDepth: step / 4,
      actual: actual.slice(0, 3),
      expected,
      error: Math.max(...expected.map((c, i) => Math.abs(actual[i] - c))),
    });
  }
  const data = upload.upload(source, 256, 128, true);
  scene.bind();
  transfer.draw(data.value, 0);
  scene.present();
  g.readPixels(128, 64, 1, 1, g.RGBA, g.UNSIGNED_BYTE, pixels);
  const dataMask = { actual: pixels[0], expected: Math.round(linearToSrgb(128 / 255) * 255) };
  // A colored, deliberately soft edge catches decode-after-premultiply and
  // matte contamination. Compare native premultiplied output, not straight RGB.
  ctx.clearRect(0, 0, 256, 128);
  for (let i = 0; i < 256; i++) {
    ctx.fillStyle = `rgba(220, 151, 67, ${i / 255})`;
    ctx.fillRect(i, 0, 1, 128);
  }
  const edge = upload.upload(source, 256, 128);
  scene.bind();
  transfer.draw(edge.value, 0);
  scene.present();
  g.readPixels(0, 64, 256, 1, g.RGBA, g.UNSIGNED_BYTE, pixels);
  const sourcePixels = ctx.getImageData(0, 63, 256, 1).data;
  let edgeError = 0;
  for (let i = 0; i < 256; i++)
    for (let c = 0; c < 4; c++) {
      const expected = c === 3 ? sourcePixels[i * 4 + 3] : (sourcePixels[i * 4 + c] * sourcePixels[i * 4 + 3]) / 255;
      edgeError = Math.max(edgeError, Math.abs(pixels[i * 4 + c] - Math.round(expected)));
    }
  // Check actual accepted artwork as well as synthetic swatches. Source is
  // normalized once through browser sRGB, exactly as in production ingestion.
  const room = await createImageBitmap(await (await fetch("/images/muster/lantern-room.png")).blob());
  ctx.clearRect(0, 0, 256, 128);
  ctx.drawImage(room, 0, 0, 256, 128);
  room.close();
  const expectedRoom = ctx.getImageData(0, 0, 256, 128).data;
  const roomArt = upload.upload(source, 256, 128);
  scene.bind();
  transfer.draw(roomArt.value, 0);
  scene.present();
  const roomPixels = new Uint8Array(256 * 128 * 4);
  g.readPixels(0, 0, 256, 128, g.RGBA, g.UNSIGNED_BYTE, roomPixels);
  let roomError = 0;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 256; x++)
      for (let c = 0; c < 4; c++)
        roomError = Math.max(
          roomError,
          Math.abs(roomPixels[(y * 256 + x) * 4 + c] - expectedRoom[((127 - y) * 256 + x) * 4 + c]),
        );
  const error = g.getError();
  const report = {
    storage: scene.storage.label,
    samples: scene.samples,
    roundTrip,
    cases,
    dataMask,
    edgeError,
    roomError,
    fogGradient,
    glError: error,
    passed:
      roundTrip <= 1 &&
      edgeError <= 1 &&
      roomError <= 1 &&
      fogGradient.every((c) => c.error <= 1) &&
      cases.every((c) => c.error <= 1) &&
      Math.abs(dataMask.actual - dataMask.expected) <= 1 &&
      error === 0,
  };
  g.deleteTexture(art.value);
  g.deleteTexture(data.value);
  g.deleteTexture(edge.value);
  g.deleteTexture(roomArt.value);
  g.deleteProgram(program);
  g.deleteVertexArray(vao);
  transfer.dispose();
  upload.dispose();
  scene.dispose();
  return report;
}
