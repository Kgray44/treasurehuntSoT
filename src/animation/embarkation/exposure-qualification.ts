import { FrameExposure, EXPOSURE_SECONDS, bindFilmLens, setFilmLens } from "./exposure";
import { FOCAL, WORLD_HEIGHT, projectionGLSL } from "./projection";

const vertex = `#version 300 es
precision highp float;layout(location=0)in vec2 uv;out vec2 vUV;
uniform float elapsed,kind;uniform vec2 viewport;
${projectionGLSL}
void main(){
 vUV=uv;vec3 p=vec3((uv-.5)*vec2(620.,230.),0.);vec3 camera=vec3(0.);float roll=0.;
 if(kind<.5){p=filmRoll(p,elapsed*28.);}
 else if(kind<1.5){p.x+=pow(abs(p.x)/310.,2.)*100.*sin(uv.y*5.+elapsed*80.);p.z+=sin(uv.x*6.+elapsed*90.)*100.;}
 else if(kind<2.5){camera=vec3(elapsed*6500.,0.,elapsed*1700.);roll=elapsed*6.;}
 else if(kind<3.5){p.xy*=.4;p.z=750.+elapsed*30000.;p.x+=elapsed*2400.;}
 else {p.z=kind<4.5?0.:750.;p.xy*=kind<4.5?1.:.35;}
 gl_Position=filmClip(p,camera,roll,viewport);
}`;
const fragment = `#version 300 es
precision highp float;in vec2 vUV;out vec4 color;
void main(){if(length((vUV-vec2(.61,.5))*vec2(1.,.6))<.12)discard;color=vec4(1.);}`;

/** Native raster proof: compare production exposure/projection to a dense
 * temporal reference. The diagnostic material has a hard silhouette and hole;
 * no texture blur can create coverage outside its instantaneous geometry. */
export function qualifyExposure(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    depth: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("WebGL2 unavailable");
  const width = canvas.width,
    height = canvas.height;
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? "exposure-probe-shader");
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? "exposure-probe-link");
  const vao = gl.createVertexArray()!,
    buffer = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const mesh: number[] = [];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 32; x++)
      for (const [i, j] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [0, 1],
        [1, 0],
        [1, 1],
      ])
        mesh.push((x + i) / 32, (y + j) / 16);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const elapsed = gl.getUniformLocation(program, "elapsed"),
    kindUniform = gl.getUniformLocation(program, "kind");
  const viewport = gl.getUniformLocation(program, "viewport");
  const clear = (rgba = [0, 0, 0, 0]) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.clearColor(rgba[0], rgba[1], rgba[2], rgba[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
  };
  const pixels = () => {
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data;
  };
  const instant = (dt: number, kind: number, aperture: [number, number] = [0, 0]) => {
    clear();
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    setFilmLens(gl, { aperture, focus: FOCAL });
    bindFilmLens(gl, program);
    gl.uniform1f(elapsed, dt);
    gl.uniform1f(kindUniform, kind);
    gl.uniform2f(viewport, (WORLD_HEIGHT * width) / height, WORLD_HEIGHT);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 2);
  };
  const reports = [];
  for (const fallback of [false, true]) {
    const exposure = new FrameExposure(gl, fallback);
    const integrate = (kind: number, count: number, lens = false) => {
      exposure.begin(width, height);
      for (let i = 0; i < count; i++) {
        const dt = ((i + 0.5) / count - 0.5) * EXPOSURE_SECONDS;
        const angle = i * 2.399963229728653,
          radius = lens ? 12 * Math.sqrt((i + 0.5) / count) : 0;
        instant(lens ? 0 : dt, kind, [Math.cos(angle) * radius, Math.sin(angle) * radius]);
        exposure.capture(1, 1 / count);
      }
      exposure.present(1);
      return pixels();
    };
    for (const [kind, name] of [
      [0, "stationary-center rotation"],
      [1, "deforming surface"],
      [2, "camera translation and roll"],
      [3, "near perspective pass"],
    ] as const) {
      instant(0, kind);
      const still = pixels(),
        reference = integrate(kind, 129),
        sampled = integrate(kind, 9);
      let absolute = 0,
        expanded = 0,
        partial = 0,
        mass = 0,
        referenceMass = 0;
      for (let p = 3; p < sampled.length; p += 4) {
        absolute += Math.abs(sampled[p] - reference[p]);
        mass += sampled[p];
        referenceMass += reference[p];
        if (still[p] === 0 && sampled[p] > 4) expanded++;
        if (sampled[p] > 4 && sampled[p] < 251) partial++;
      }
      const meanError = absolute / (width * height * 255),
        massError = Math.abs(mass - referenceMass) / Math.max(1, referenceMass);
      reports.push({
        storage: exposure.floating ? "RGBA16F" : "RGBA8",
        name,
        meanAlphaError: meanError,
        relativeCoverageError: massError,
        expandedSilhouettePixels: expanded,
        partialCoveragePixels: partial,
        pass: meanError < 0.008 && massError < 0.025 && expanded > 10 && partial > 30,
      });
    }
    for (const [kind, name] of [
      [4, "focal plane"],
      [5, "near defocus"],
    ] as const) {
      instant(0, kind);
      const still = pixels(),
        sampled = integrate(kind, 33, true);
      let changed = 0;
      for (let p = 3; p < sampled.length; p += 4) if (Math.abs(sampled[p] - still[p]) > 3) changed++;
      reports.push({
        storage: exposure.floating ? "RGBA16F" : "RGBA8",
        name,
        changedPixels: changed,
        pass: kind === 4 ? changed === 0 : changed > 30,
      });
    }
    exposure.begin(width, height);
    clear([0, 0, 0, 1]);
    exposure.capture(1, 0.25);
    clear([1, 1, 1, 1]);
    exposure.capture(1, 0.75);
    exposure.present(1);
    const result = pixels(),
      expected = Math.round((1.055 * Math.pow(0.75, 1 / 2.4) - 0.055) * 255);
    reports.push({
      storage: exposure.floating ? "RGBA16F" : "RGBA8",
      name: "linear-light weighted exposure",
      expected,
      actual: result[0],
      pass: Math.abs(result[0] - expected) <= 2 && result[3] === 255,
    });
    integrate(0, 9);
    exposure.dispose();
  }
  const error = gl.getError();
  gl.deleteBuffer(buffer);
  gl.deleteVertexArray(vao);
  gl.deleteProgram(program);
  setFilmLens(gl, { aperture: [0, 0], focus: FOCAL });
  return {
    pass: error === gl.NO_ERROR && reports.every((r) => r.pass),
    width,
    height,
    shutterSeconds: EXPOSURE_SECONDS,
    gpuError: error,
    reports,
  };
}
