"use client";
import { useEffect, useState } from "react";
import {
  cssProjection,
  cssToWorld,
  eyePosition,
  inverseProjection,
  multiplyProjection,
  planeProjection,
  projectWorld,
  projectionGLSL,
  rotateEuler,
  WORLD_HEIGHT,
  worldViewport,
  type CameraFrame,
  type Point3,
} from "@/animation/embarkation/projection";

/** Neutral geometry repro: production GLSL lens against actual browser CSS
 * projection, including nested world-space descendants. This isolates lens
 * correctness; it does NOT certify material deformation or finished shots. */
function runProbe() {
  const canvas = document.createElement("canvas"),
    gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL2 unavailable");
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader failure");
    return s;
  };
  const vertex = shader(
    gl.VERTEX_SHADER,
    `#version 300 es
    precision highp float;uniform vec3 point,camera;uniform float roll;uniform vec2 viewport;
    ${projectionGLSL}
    void main(){gl_Position=filmClip(point,camera,roll,viewport);gl_PointSize=3.;}`,
  );
  const fragment = shader(
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision highp float;out vec4 color;void main(){color=vec4(1.,0.,0.,1.);}`,
  );
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? "link failure");
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());
  const uniforms = Object.fromEntries(
    ["point", "camera", "roll", "viewport"].map((k) => [k, gl.getUniformLocation(program, k)]),
  );
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;opacity:0;z-index:-1;";
  document.body.append(host);
  const results = [];
  try {
    for (const [width, height] of [
      [390, 844],
      [1024, 768],
      [1536, 1024],
      [3440, 1440],
    ]) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      for (const camera of [
        { position: [0, 0, 0], roll: 0 },
        { position: [170, -85, -2900], roll: 0.17 },
      ] as CameraFrame[])
        for (const depth of [300, 1150, 6000])
          for (const nested of [false, true]) {
            const viewport = { width, height },
              center: [number, number] = [width * 0.6, height * 0.45];
            const position = cssToWorld(...center, eyePosition(camera)[2] - depth, viewport, camera),
              rotation: Point3 = [0.3, -0.45, 0.2];
            const h = planeProjection(center, position, rotation, camera, viewport);
            const parentH = planeProjection(
              center,
              cssToWorld(...center, eyePosition(camera)[2] - 1700, viewport, camera),
              [-0.2, 0.35, -0.1],
              camera,
              viewport,
            );
            const parent = document.createElement("div");
            parent.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;transform-origin:0 0;`;
            if (nested) parent.style.transform = cssProjection(parentH, 0, 0);
            host.append(parent);
            const plane = document.createElement("div"),
              left = center[0] - 30,
              top = center[1] - 20;
            plane.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:60px;height:40px;transform-origin:30px 20px;`;
            plane.style.transform = cssProjection(
              nested ? multiplyProjection(inverseProjection(parentH), h) : h,
              center[0],
              center[1],
            );
            parent.append(plane);
            const parentMarker = document.createElement("span");
            parentMarker.style.cssText = `position:absolute;left:${center[0]}px;top:${center[1]}px;width:0;height:0;`;
            parent.append(parentMarker);
            const parentPoint = parentMarker.getBoundingClientRect();
            const markers = [
              [-12, -9],
              [12, -9],
              [12, 9],
              [-12, 9],
              [0, 0],
            ].map(([x, y]) => {
              const node = document.createElement("span");
              node.style.cssText = `position:absolute;left:${30 + x}px;top:${20 + y}px;width:0;height:0;`;
              plane.append(node);
              return { x, y, node };
            });
            gl.uniform3fv(uniforms.camera, camera.position);
            gl.uniform1f(uniforms.roll, camera.roll);
            gl.uniform2fv(uniforms.viewport, worldViewport(viewport));
            for (const { x, y, node } of markers) {
              const delta = rotateEuler([(x * WORLD_HEIGHT) / height, (-y * WORLD_HEIGHT) / height, 0], rotation);
              const world = position.map((v, i) => v + delta[i]) as Point3;
              const expected = projectWorld(world, camera, viewport),
                actual = node.getBoundingClientRect();
              gl.clearColor(0, 0, 0, 0);
              gl.clear(gl.COLOR_BUFFER_BIT);
              gl.uniform3fv(uniforms.point, world);
              gl.drawArrays(gl.POINTS, 0, 1);
              const px = Math.floor(expected.x) - 4,
                py = Math.floor(height - expected.y) - 4,
                bytes = new Uint8Array(9 * 9 * 4);
              gl.readPixels(px, py, 9, 9, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
              let sumX = 0,
                sumY = 0,
                count = 0;
              for (let iy = 0; iy < 9; iy++)
                for (let ix = 0; ix < 9; ix++)
                  if (bytes[(iy * 9 + ix) * 4] === 255) {
                    sumX += px + ix + 0.5;
                    sumY += height - (py + iy + 0.5);
                    count++;
                  }
              const gpu = count ? { x: sumX / count, y: sumY / count } : null;
              results.push({
                width,
                height,
                depth,
                roll: camera.roll,
                nested,
                parentPoint: { x: parentPoint.x, y: parentPoint.y },
                parentTransform: nested ? parent.style.transform : "none",
                childTransform: plane.style.transform,
                expected: { x: expected.x, y: expected.y },
                dom: { x: actual.x, y: actual.y },
                gpu,
                domError: Math.hypot(actual.x - expected.x, actual.y - expected.y),
                gpuError: gpu ? Math.hypot(gpu.x - expected.x, gpu.y - expected.y) : null,
              });
            }
            parent.remove();
          }
    }
    const maxDomError = Math.max(...results.map((r) => r.domError)),
      maxGpuError = Math.max(...results.map((r) => r.gpuError ?? Infinity));
    return {
      kind: "actual-WebGL2-and-live-CSS-projection",
      pointCases: results.length,
      maxDomError,
      maxGpuError,
      passed: maxDomError < 0.04 && maxGpuError < 0.8,
      limits:
        "GPU point centroid is rasterized at whole pixels; this does not certify final motion, filtering or depth composition.",
      results,
    };
  } finally {
    host.remove();
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteProgram(program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
export function ProjectionDiagnostic() {
  const [result, setResult] = useState<
    ReturnType<typeof runProbe> | { status?: string; passed?: boolean; error?: string }
  >({ status: "preparing" });
  useEffect(() => {
    try {
      setResult(runProbe());
    } catch (error) {
      setResult({ passed: false, error: String(error) });
    }
  }, []);
  const { results, ...summary } = "results" in result ? result : { ...result, results: [] };
  return (
    <>
      <pre id="projection-summary">{JSON.stringify(summary, null, 2)}</pre>
      <details>
        <summary>Projection measurements</summary>
        <pre id="projection-result">{JSON.stringify(results)}</pre>
      </details>
    </>
  );
}
