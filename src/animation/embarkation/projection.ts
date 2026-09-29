/** The film's single lens. World units are art units, not metres: the settled
 * viewport is 1100 units tall. +X is right, +Y is up, and airflow travels -Z.
 * Camera.position is the image-plane origin; the eye is FOCAL units behind it.
 * Film time is seconds. CSS coordinates are pixels with +Y down. DPR changes
 * framebuffer resolution only, never geometry or physical time. */
export const FOCAL = 1150;
export const WORLD_HEIGHT = 1100;
export const NEAR = 4;
export type Point3 = [number, number, number];
export type CameraFrame = { position: Point3; roll: number };
export type Viewport = { width: number; height: number };
export const REST_CAMERA: CameraFrame = { position: [0, 0, 0], roll: 0 };

export function worldViewport({ width, height }: Viewport): [number, number] {
  return [(WORLD_HEIGHT * width) / height, WORLD_HEIGHT];
}
export function eyePosition(camera: CameraFrame): Point3 {
  return [camera.position[0], camera.position[1], camera.position[2] + FOCAL];
}
export function rotateRoll(p: Point3, angle: number): Point3 {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
}
export function viewPoint(p: Point3, camera: CameraFrame): Point3 {
  return rotateRoll([p[0] - camera.position[0], p[1] - camera.position[1], p[2] - camera.position[2]], -camera.roll);
}
export function projectWorld(p: Point3, camera: CameraFrame, viewport: Viewport) {
  const view = viewPoint(p, camera),
    distance = FOCAL - view[2];
  const scale = (FOCAL * viewport.height) / (WORLD_HEIGHT * distance);
  return {
    x: viewport.width / 2 + view[0] * scale,
    y: viewport.height / 2 - view[1] * scale,
    distance,
    visible: distance >= NEAR,
  };
}
/** UV is bottom-up as in WebGL. The ray parameter is axial distance, so its
 * length MUST multiply axial sample spacing when evaluating optical depth. */
export function viewRay(uv: readonly number[], worldSize: readonly number[], roll: number): Point3 {
  return rotateRoll([((uv[0] - 0.5) * worldSize[0]) / FOCAL, ((uv[1] - 0.5) * worldSize[1]) / FOCAL, -1], roll);
}
export function cssToWorld(x: number, y: number, z: number, viewport: Viewport, camera = REST_CAMERA): Point3 {
  const ray = viewRay([x / viewport.width, 1 - y / viewport.height], worldViewport(viewport), camera.roll);
  const eye = eyePosition(camera),
    distance = eye[2] - z;
  return [eye[0] + ray[0] * distance, eye[1] + ray[1] * distance, z];
}
export function opticalSegmentLength(axialLength: number, ray: Point3) {
  return Math.max(0, axialLength) * Math.hypot(...ray);
}
export function rotateEuler(p: Point3, r: Point3): Point3 {
  const sx = Math.sin(r[0]),
    cx = Math.cos(r[0]),
    sy = Math.sin(r[1]),
    cy = Math.cos(r[1]);
  const y = p[1] * cx - p[2] * sx,
    z = p[1] * sx + p[2] * cx;
  return rotateRoll([p[0] * cy + z * sy, y, -p[0] * sy + z * cy], r[2]);
}

/** Row-major 2D projective maps expressed in absolute viewport CSS pixels.
 * These preserve the same perspective divide as worldClip below, including
 * rotated planes. Nested live nodes use inverse(parent) * child, explicitly. */
export type Homography = [number, number, number, number, number, number, number, number, number];
export const IDENTITY: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function multiplyProjection(a: Homography, b: Homography): Homography {
  const out = Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) out[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return out as Homography;
}
export function inverseProjection(m: Homography): Homography {
  const [a, b, c, d, e, f, g, h, i] = m;
  const cof: Homography = [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ];
  const det = a * cof[0] + b * cof[3] + c * cof[6];
  if (Math.abs(det) < 1e-12) throw new Error("Degenerate cinematic plane");
  return cof.map((v) => v / det) as Homography;
}
export function transformPoint(h: Homography, x: number, y: number) {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}
export function planeProjection(
  center: readonly number[],
  position: Point3,
  rotation: Point3,
  camera: CameraFrame,
  viewport: Viewport,
): Homography {
  const unit = WORLD_HEIGHT / viewport.height,
    pixel = viewport.height / WORLD_HEIGHT;
  const origin = viewPoint(position, camera);
  const dx = rotateRoll(rotateEuler([unit, 0, 0], rotation), -camera.roll);
  const dy = rotateRoll(rotateEuler([0, -unit, 0], rotation), -camera.roll);
  const depth = FOCAL - origin[2];
  const coefficient = (v: Point3) => [
    (-viewport.width / 2) * v[2] + pixel * FOCAL * v[0],
    (-viewport.height / 2) * v[2] - pixel * FOCAL * v[1],
    -v[2],
  ];
  const a = coefficient(dx),
    b = coefficient(dy);
  const c = [
    (viewport.width / 2) * depth + pixel * FOCAL * origin[0],
    (viewport.height / 2) * depth - pixel * FOCAL * origin[1],
    depth,
  ];
  return [
    a[0],
    b[0],
    c[0] - a[0] * center[0] - b[0] * center[1],
    a[1],
    b[1],
    c[1] - a[1] * center[0] - b[1] * center[1],
    a[2],
    b[2],
    c[2] - a[2] * center[0] - b[2] * center[1],
  ].map((v) => v / FOCAL) as Homography;
}
/** CSS matrix3d. left/top is the absolute CSS transform origin (including the
 * node's own origin offset). Conjugation changes basis, never the lens. */
export function cssProjection(h: Homography, left: number, top: number) {
  const t: Homography = [1, 0, left, 0, 1, top, 0, 0, 1];
  const ti: Homography = [1, 0, -left, 0, 1, -top, 0, 0, 1];
  const raw = multiplyProjection(ti, multiplyProjection(h, t));
  // Blink quantizes small matrix3d perspective coefficients when parsing CSS.
  // The actual browser probe exposed ~0.11px drift for a nested ultrawide
  // plane at m44=1. Homogeneous scaling preserves the projection but keeps
  // those coefficients above the parser's small-decimal precision floor.
  const homogeneous = 16384;
  const m = raw.map((v) => (v * homogeneous) / (Math.abs(raw[8]) > 1e-10 ? raw[8] : 1));
  return `matrix3d(${[m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, homogeneous, 0, m[2], m[5], 0, m[8]].join(",")})`;
}

/** Imported into every spatial shader; values come from the CPU authority. */
export function sphereInView(point: Point3, radius: number, camera: CameraFrame, viewport: Viewport) {
  const p = viewPoint(point, camera),
    distance = FOCAL - p[2];
  if (distance + radius < NEAR) return false;
  const [width, height] = worldViewport(viewport);
  const x = width / (2 * FOCAL),
    y = height / (2 * FOCAL);
  return (
    Math.abs(p[0]) <= x * distance + radius * Math.hypot(1, x) &&
    Math.abs(p[1]) <= y * distance + radius * Math.hypot(1, y)
  );
}

export const projectionGLSL = `
const float FILM_FOCAL=${FOCAL}.;
const float FILM_NEAR=${NEAR}.;
uniform vec2 filmAperture;
uniform float filmFocus;
vec3 filmRoll(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
vec3 filmView(vec3 p,vec3 camera,float roll){return filmRoll(p-camera,-roll);}
vec4 filmClipView(vec3 p,vec2 viewport){float d=FILM_FOCAL-p.z;vec2 lens=filmAperture*(d/max(filmFocus,1.)-1.);return vec4((p.xy+lens)*FILM_FOCAL/(viewport*.5),d-2.*FILM_NEAR,d);}
vec4 filmClip(vec3 p,vec3 camera,float roll,vec2 viewport){return filmClipView(filmView(p,camera,roll),viewport);}
vec3 filmRay(vec2 uv,vec2 viewport,float roll){return filmRoll(vec3((uv-.5)*viewport/FILM_FOCAL-filmAperture/max(filmFocus,1.),-1.),roll);}
vec3 filmEye(vec3 camera,float roll){return camera+vec3(0.,0.,FILM_FOCAL)+filmRoll(vec3(filmAperture,0.),roll);}
`;
