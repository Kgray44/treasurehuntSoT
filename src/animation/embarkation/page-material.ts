import { camera, gust, hash, materials, smooth, wind, atmosphericDepth, type Vec3 } from "./program";
import { attachments, type Attachment } from "./adhesion";
import { cssToWorld, projectionGLSL, rotateRoll } from "./projection";
import { ConstrainedSheet } from "./cloth";
import { surfaceDepthGLSL } from "./depth-compositor";
import { colorGLSL } from "./color";
export type PageSurface = {
  id: string;
  node: HTMLElement;
  image: HTMLImageElement;
  rect: DOMRect;
  material: "cloth" | "card" | "paper" | "button";
  release: number;
  phase: number;
  anchors: [number, number, number, number];
  attachment: Attachment;
};
/** The transformed page is thin stock, including its stiffer button pieces.
 * It retains structural inertia without inheriting a heavy prop's tiny drag.
 * These coefficients feed the same relative-air solver; no prescribed speed
 * or release impulse is imposed on the sheet. */
export const departureMaterials = {
  cloth: materials.cloth,
  paper: materials.paper,
  card: { ...materials.card, mass: 1.35, drag: 1.15, coupling: 1, inertia: 2.4 },
  button: { ...materials.button, mass: 2.2, drag: 1.05, coupling: 0.9 },
} as const;
export function departureSchedule(material: PageSurface["material"], index: number) {
  const release =
    material === "button"
      ? 6.15
      : material === "cloth"
        ? 5.75 + (index % 3) * 0.28
        : material === "paper"
          ? 3.75 + (index % 3) * 0.26
          : 4.7 + (index % 4) * 0.32;
  const anchors: PageSurface["anchors"] = [release - 1.05, release - 0.6, release, release - 0.32];
  if (index % 2) anchors.reverse();
  return { release, anchors };
}
const blobData = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
/** Ephemeral same-origin rasterization of the actual visible outgoing DOM.
 * No screen content is uploaded, stored, or substituted for the landing UI. */
export async function capturePage(root: HTMLElement, signal: AbortSignal): Promise<PageSurface[]> {
  const cache = new Map<string, Promise<string>>();
  const inline = (url: string) => {
    if (url.startsWith("data:")) return Promise.resolve(url);
    const absolute = new URL(url, location.href).href;
    let job = cache.get(absolute);
    if (!job) {
      job = fetch(absolute, { signal })
        .then((r) => {
          if (!r.ok) throw new Error("page-image-unavailable");
          return r.blob();
        })
        .then(blobData);
      cache.set(absolute, job);
    }
    return job;
  };
  await document.fonts.ready;
  const fontRules: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules)
        if (rule instanceof CSSFontFaceRule) {
          let text = rule.cssText;
          for (const match of [...text.matchAll(/url\(["']?([^"')]+)["']?\)/g)]) {
            const data = await inline(new URL(match[1], sheet.href ?? location.href).href);
            text = text.replace(match[0], `url("${data}")`);
          }
          fontRules.push(text);
        }
    } catch {
      /* Cross-origin fonts use their computed local fallback. */
    }
  }
  const elements = [...root.querySelectorAll<HTMLElement>("[data-departure]")].filter((n) => {
    const r = n.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight;
  });
  const surfaces: PageSurface[] = [];
  for (const [index, node] of elements.entries()) {
    if (signal.aborted) break;
    const rect = node.getBoundingClientRect(),
      copy = node.cloneNode(true) as HTMLElement;
    const originals = [node, ...node.querySelectorAll<HTMLElement>("*")],
      clones = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
    for (let i = 0; i < originals.length; i++) {
      const src = originals[i],
        dst = clones[i],
        css = getComputedStyle(src);
      for (const property of css) dst.style.setProperty(property, css.getPropertyValue(property));
      dst.style.animation = "none";
      dst.style.transition = "none";
      dst.removeAttribute("id");
      dst.removeAttribute("name");
      if (src instanceof HTMLImageElement) {
        await src.decode().catch(() => undefined);
        dst.setAttribute("src", await inline(src.currentSrc || src.src));
        dst.removeAttribute("srcset");
        dst.removeAttribute("loading");
      }
      const background = css.backgroundImage;
      if (background.includes("url(")) {
        let resolved = background;
        for (const match of [...background.matchAll(/url\(["']?([^"')]+)["']?\)/g)])
          resolved = resolved.replace(match[0], `url("${await inline(match[1])}")`);
        dst.style.backgroundImage = resolved;
      }
      for (const pseudo of ["::before", "::after"]) {
        const pc = getComputedStyle(src, pseudo);
        if (pc.content === "none" || pc.content === "normal") continue;
        const span = document.createElement("span");
        for (const prop of pc) span.style.setProperty(prop, pc.getPropertyValue(prop));
        span.textContent = pc.content.replace(/^["']|["']$/g, "");
        if (pseudo === "::before") dst.prepend(span);
        else dst.append(span);
      }
    }
    Object.assign(copy.style, {
      position: "relative",
      left: "0px",
      top: "0px",
      margin: "0px",
      transform: "none",
      opacity: "1",
      visibility: "visible",
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    // Descendant-owned material has one visual owner, never a second baked copy.
    for (const nested of copy.querySelectorAll<HTMLElement>("[data-departure]")) nested.style.visibility = "hidden";
    if (node.matches(".embarkation-begin")) {
      // Computed logical inset aliases from the absolute source otherwise
      // retain the viewport-relative bottom offset inside the SVG viewport.
      copy.style.inset = "auto";
      copy.style.left = "0px";
      copy.style.top = "0px";
      const button = copy.querySelector("button");
      if (button) {
        button.disabled = false;
        button.style.opacity = "1";
      }
      const caption = copy.querySelector("p");
      if (caption) caption.textContent = "Your crew. A new horizon.";
    }
    copy.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    const xml = new XMLSerializer().serializeToString(copy);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}"><style>${fontRules.join("\n")}</style><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const material = node.matches("header,.product-shell-header")
      ? "cloth"
      : node.matches(".embarkation-bearing")
        ? "paper"
        : node.matches(".embarkation-begin")
          ? "button"
          : rect.width > 240 && rect.height > 280
            ? "cloth"
            : node.dataset.departure === "invitation"
              ? "paper"
              : "card";
    const phase = (hash(`${node.className}:${index}`) % 628) / 100;
    const { release, anchors } = departureSchedule(material, index);
    surfaces.push({
      id: `page-${index}`,
      node,
      image,
      rect,
      material,
      release,
      phase,
      anchors,
      attachment: attachments[index % attachments.length],
    });
  }
  return surfaces;
}
type DepartureSurface = Pick<PageSurface, "material" | "release" | "phase" | "anchors" | "rect"> &
  Partial<Pick<PageSurface, "attachment">>;
export const DEPARTURE_ANCHOR_WINDOW = { before: 0.15, after: 0.05 } as const;
const departureSheets = new WeakMap<DepartureSurface, { key: string; sheet: ConstrainedSheet; extinctAt?: number }>();
function holds(s: DepartureSurface, time: number) {
  return s.anchors.map((t) => 1 - smooth(t - DEPARTURE_ANCHOR_WINDOW.before, t + DEPARTURE_ANCHOR_WINDOW.after, time));
}
function supported(s: DepartureSurface, time: number, width: number, height: number, uv = [0.5, 0.5]) {
  const cam = camera(time);
  return cssToWorld(
    s.rect.x + s.rect.width * uv[0],
    s.rect.y + s.rect.height * (1 - uv[1]),
    cam.position[2],
    { width, height },
    cam,
  );
}
function departure(s: DepartureSurface, width: number, height: number) {
  const key = [
    width,
    height,
    s.rect.x,
    s.rect.y,
    s.rect.width,
    s.rect.height,
    s.material,
    s.attachment,
    ...s.anchors,
  ].join(":");
  let cached = departureSheets.get(s);
  if (!cached || cached.key !== key) {
    const size: [number, number] = [(s.rect.width * 1100) / height, (s.rect.height * 1100) / height];
    // One world-space sheet owns strain, attachment impulses, translation and
    // rotation from pressure through recession. Release removes a constraint;
    // it never starts a different trajectory or resets material-point velocity.
    const sheet: ConstrainedSheet = new ConstrainedSheet(
      ...size,
      s.material,
      s.attachment ?? "multi",
      (time) => ({
        air: [0, 0, 0],
        holds: [],
        worldAir: (point) => wind(time, point),
        aerodynamics: departureMaterials[s.material],
      }),
      0,
      {
        initial: (_rest, uv) => ({ position: supported(s, 0, width, height, Array.from(uv)), velocity: [0, 0, 0] }),
        contacts: (time) => {
          const remaining = holds(s, time);
          return sheet.pins.flatMap((vertex, i) =>
            remaining[i] > 0
              ? [
                  {
                    vertex,
                    point: supported(s, time, width, height, Array.from(sheet.uv.subarray(vertex * 2, vertex * 2 + 2))),
                  },
                ]
              : [],
          );
        },
        transportReference: (time, previousTime, point) => {
          const from = camera(previousTime),
            to = camera(time);
          const rotated = rotateRoll(point.map((v, k) => v - from.position[k]) as Vec3, to.roll - from.roll);
          return rotated.map((v, k) => v + to.position[k]) as Vec3;
        },
      },
    );
    cached = { key, sheet };
    departureSheets.set(s, cached);
  }
  return cached;
}
export function pageSheet(s: DepartureSurface, width: number, height: number) {
  return departure(s, width, height).sheet;
}
export function pageState(s: DepartureSurface, time: number, width: number, height: number) {
  const c = camera(time),
    released = Math.max(0, time - Math.max(...s.anchors) - DEPARTURE_ANCHOR_WINDOW.after);
  const cached = departure(s, width, height),
    sheet = cached.sheet;
  const origin = supported(s, s.release, width, height);
  // Stop preparing only after every material point is beyond the same optical
  // extinction bound used for drawing. No tiny visible sheet is parked there.
  const extinct = (t: number) => {
    const p = sheet.at(t).positions;
    let nearest = -Infinity;
    for (let i = 2; i < p.length; i += 3) nearest = Math.max(nearest, p[i]);
    return origin[2] - nearest > 48000 || atmosphericDepth(Math.max(0, camera(t).position[2] - nearest)) < 0.002;
  };
  if (cached.extinctAt === undefined) {
    if (sheet.lastTime > s.release && extinct(sheet.lastTime)) cached.extinctAt = sheet.lastTime;
    while (cached.extinctAt === undefined && sheet.lastTime < time - 1e-8) {
      const next = Math.min(time, sheet.lastTime + 1 / 30);
      if (extinct(next)) cached.extinctAt = sheet.lastTime;
    }
  }
  const frame = sheet.at(Math.min(time, cached.extinctAt ?? time));
  const position: Vec3 = [0, 0, 0],
    velocity: Vec3 = [0, 0, 0];
  let nearest = -Infinity;
  const count = frame.positions.length / 3;
  for (let i = 0; i < count; i++) {
    nearest = Math.max(nearest, frame.positions[i * 3 + 2]);
    for (let k = 0; k < 3; k++) {
      position[k] += frame.positions[i * 3 + k] / count;
      velocity[k] += frame.velocities[i * 3 + k] / count;
    }
  }
  const supportPosition = supported(s, time, width, height);
  const supportRotation: Vec3 = [0, 0, c.roll];
  const travel = Math.max(0, origin[2] - position[2]);
  const stiffness = s.material === "cloth" ? 1 : s.material === "paper" ? 0.7 : s.material === "card" ? 0.58 : 0.11;
  return {
    position,
    supportPosition,
    supportRotation,
    velocity,
    alpha:
      cached.extinctAt !== undefined && time >= cached.extinctAt
        ? 0
        : atmosphericDepth(Math.max(0, c.position[2] - nearest)),
    pressure: gust(time) * stiffness * smooth(0.7, 4.2, time),
    anchors: holds(s, time),
    released,
    stiffness,
    weathering: smooth(0, 2200, travel) * 0.62,
  };
}
export const pageVertex = `#version 300 es
precision highp float;
in vec2 uv;in vec3 deformed;out vec2 vUV;out vec3 vWorld;out float vBend;
uniform vec3 position,rotation,cameraPosition;uniform vec2 size,viewport;
uniform float time,pressure,phase,roll,released,stiffness,support;
${projectionGLSL}
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
void main(){
 vUV=uv;vec3 rest=rz(rotation.z)*vec3((uv-.5)*size,0.)+position;
 vBend=(deformed.z-rest.z)/max(size.x,1.);vWorld=mix(deformed,rest,support);
 gl_Position=filmClip(vWorld,cameraPosition,roll,viewport);
}`;
export const pageFragment = `#version 300 es
precision highp float;
in vec2 vUV;in vec3 vWorld;in float vBend;out vec4 color;
uniform sampler2D art;uniform float alpha,time,weathering,pressure,support;uniform vec3 cameraPosition;
${surfaceDepthGLSL}
${colorGLSL}
void main(){vec4 sampleColor=artwork(art,vUV);if(sampleColor.a<.002)discard;
 vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));float light=.72+.28*abs(dot(n,normalize(vec3(-.2,.3,1.))));
 vec3 rgb=sampleColor.rgb;float grain=sin(vUV.x*1703.)*sin(vUV.y*1229.);
 if(support>.5){float edge=smoothstep(.0,.025,min(min(vUV.x,1.-vUV.x),min(vUV.y,1.-vUV.y)));
   float a=sampleColor.a*alpha*.34*edge;surfaceCoverage(a);color=vec4(srgbToLinear(vec3(.028,.082,.086))*a,a);return;}
 rgb=mix(rgb,displayGrade(rgb,vec3(1.13,1.03,.83),vec3(.08,.07,.035)+grain*.009),weathering);
 rgb*=mix(1.,light,pressure);float fog=clamp((cameraPosition.z-vWorld.z-1700.)/6500.,0.,.72);
 rgb=mix(rgb,srgbToLinear(vec3(.06,.17,.21)),fog);float a=sampleColor.a*alpha;surfaceCoverage(a);color=vec4(rgb*a,a);}
`;
