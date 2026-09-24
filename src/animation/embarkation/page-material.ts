import { camera, gust, hash, smooth, wind, flowRotation, atmosphericDepth, type Vec3 } from "./program";
import { adhesionGLSL, attachments, type Attachment } from "./adhesion";
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
    const release =
      material === "button"
        ? 8.25
        : material === "cloth"
          ? 8.6 + (index % 3) * 0.29
          : material === "paper"
            ? 5.65 + (index % 3) * 0.34
            : 6.6 + (index % 4) * 0.49;
    const holds: [number, number, number, number] = [release - 1.05, release - 0.6, release, release - 0.32];
    if (index % 2) holds.reverse();
    surfaces.push({
      id: `page-${index}`,
      node,
      image,
      rect,
      material,
      release,
      phase,
      anchors: holds,
      attachment: attachments[index % attachments.length],
    });
  }
  return surfaces;
}
export function pageState(
  s: Pick<PageSurface, "material" | "release" | "phase" | "anchors" | "rect">,
  time: number,
  width: number,
  height: number,
) {
  const factor = 1100 / height,
    c = camera(time),
    released = Math.max(0, time - s.release),
    k = 1 - Math.exp(-released * 4);
  const anchorCamera = camera(s.release),
    mass = s.material === "cloth" ? 1.8 : s.material === "card" ? 3.3 : s.material === "button" ? 6 : 0.6;
  const acceleration = 6 / Math.sqrt(mass);
  const travel = 9600 * (released - (1 - Math.exp(-released * acceleration)) / acceleration);
  const center: Vec3 = [
    (s.rect.x + s.rect.width / 2 - width / 2) * factor,
    (height / 2 - s.rect.y - s.rect.height / 2) * factor,
    0,
  ];
  const field = wind(time, center, s.phase);
  const position: Vec3 = [
    center[0] + (released ? anchorCamera.position[0] : c.position[0]) + field[0] * released * 0.24,
    center[1] + (released ? anchorCamera.position[1] : c.position[1]) + field[1] * released * 0.2,
    (released ? anchorCamera.position[2] : c.position[2]) - travel,
  ];
  const stiffness = s.material === "cloth" ? 1 : s.material === "paper" ? 0.7 : s.material === "card" ? 0.58 : 0.11;
  return {
    position,
    rotation: flowRotation(time, released, position, s.phase, mass * 1.2).map((v) => v * k) as Vec3,
    alpha: travel > 48000 ? 0 : atmosphericDepth(Math.max(0, c.position[2] - position[2])),
    pressure: gust(time) * stiffness * smooth(0.7, 4.2, time),
    anchors: s.anchors.map((t) => 1 - smooth(t - 0.15, t + 0.05, time)),
    released,
    stiffness,
    weathering: smooth(0, 2200, travel) * 0.62,
  };
}
export const pageVertex = `#version 300 es
precision highp float;
in vec2 uv;out vec2 vUV;out vec3 vWorld;out float vBend;
uniform vec3 position,rotation,cameraPosition;uniform vec2 size,viewport;
uniform float time,pressure,phase,roll,released,stiffness,support;
${adhesionGLSL}
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
void main(){
 vUV=uv;vec2 p=(uv-.5)*size;
 vec4 deformation=membrane(uv,time,phase,pressure)*(1.-support);
 float z=deformation.z*size.x;
 p+=deformation.xy*size;
 vBend=z/max(size.x,1.);vWorld=rz(rotation.z)*ry(rotation.y)*rx(rotation.x)*vec3(p,z)+position;
 vec3 view=rz(-roll)*(vWorld-cameraPosition);float d=1150.-view.z;
 gl_Position=vec4(view.xy*1150./(viewport*.5),d-8.,d);
}`;
export const pageFragment = `#version 300 es
precision highp float;
in vec2 vUV;in vec3 vWorld;in float vBend;out vec4 color;
uniform sampler2D art;uniform float alpha,time,weathering,pressure,support;uniform vec3 cameraPosition;
void main(){vec4 sampleColor=texture(art,vUV);if(sampleColor.a<.002)discard;
 vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));float light=.72+.28*abs(dot(n,normalize(vec3(-.2,.3,1.))));
 vec3 rgb=sampleColor.rgb;float grain=sin(vUV.x*1703.)*sin(vUV.y*1229.);
 if(support>.5){float edge=smoothstep(.0,.025,min(min(vUV.x,1.-vUV.x),min(vUV.y,1.-vUV.y)));
   float a=sampleColor.a*alpha*.34*edge;color=vec4(vec3(.028,.082,.086)*a,a);return;}
 rgb=mix(rgb,rgb*vec3(1.13,1.03,.83)+vec3(.08,.07,.035)+grain*.009,weathering);
 rgb*=mix(1.,light,pressure);float fog=clamp((cameraPosition.z-vWorld.z-1700.)/6500.,0.,.72);
 rgb=mix(rgb,vec3(.06,.17,.21),fog);float a=sampleColor.a*alpha;color=vec4(rgb*a,a);}
`;
