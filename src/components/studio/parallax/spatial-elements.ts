import * as T from "three";
import { createPremiumModel, setModelArticulation } from "@/parallax/assets/models";
import { physicalAssets } from "@/parallax/asset-catalog";
import type { SpatialEntity } from "@/parallax/contracts";
import type { SpatialElement } from "@/parallax/element-contracts";

function glowTexture() {
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4,
        r = Math.hypot(x - 31.5, y - 31.5) / 31.5;
      pixels.set([255, 255, 255, Math.round(Math.pow(Math.max(0, 1 - r), 2) * 255)], i);
    }
  const t = new T.DataTexture(pixels, 64, 64, T.RGBAFormat);
  t.needsUpdate = true;
  return t;
}
const random = (seed: number, index: number) => {
  let x = (seed + index * 374761393) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
export function createElementObject(entity: SpatialEntity): T.Group {
  const e = entity.element!;
  const group = new T.Group();
  group.userData.elementKind = e.kind;
  const marker = (color: string) => {
    const g = new T.Group();
    g.name = "editor-marker";
    g.add(
      new T.Mesh(
        new T.IcosahedronGeometry(0.055, 0),
        new T.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.8 }),
      ),
    );
    group.add(g);
  };
  switch (e.kind) {
    case "PHYSICAL_ASSET": {
      const model = createPremiumModel(e.modelId);
      model.name = "physical-model";
      const scale = entity.widthMeters / physicalAssets.find((a) => a.id === e.modelId)!.dimensions[0];
      const holder = new T.Group();
      holder.scale.setScalar(scale);
      holder.add(model);
      group.add(holder);
      setModelArticulation(model, e.modelId, e.articulation);
      break;
    }
    case "LIGHT": {
      const light =
        e.type === "AMBIENT"
          ? new T.AmbientLight(e.color, e.intensity)
          : e.type === "SPOT"
            ? new T.SpotLight(e.color, e.intensity, e.range, e.angle, e.penumbra, e.decay)
            : new T.PointLight(e.color, e.intensity, e.range, e.decay);
      light.name = "authored-light";
      group.add(light);
      if (light instanceof T.SpotLight) {
        light.target.position.set(0, 0, -1);
        group.add(light.target);
      }
      marker(e.color);
      break;
    }
    case "ATMOSPHERE": {
      const texture = glowTexture();
      for (let i = 0; i < 6; i++) {
        const mist = new T.Mesh(
          new T.PlaneGeometry(e.radius * 2, e.radius * 2),
          new T.MeshBasicMaterial({
            color: e.color,
            map: texture,
            transparent: true,
            opacity: e.density * 3,
            depthWrite: false,
            side: T.DoubleSide,
          }),
        );
        mist.rotation.x = -Math.PI / 2;
        mist.position.y = 0.025 + i * 0.065;
        mist.rotation.z = i * 0.7;
        group.add(mist);
      }
      marker(e.color);
      break;
    }
    case "PARTICLES": {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(e.count * 3), 3));
      const points = new T.Points(
        geometry,
        new T.PointsMaterial({
          color: e.color,
          size: e.size,
          map: glowTexture(),
          transparent: true,
          depthWrite: false,
          blending: e.style === "DUST" ? T.NormalBlending : T.AdditiveBlending,
        }),
      );
      points.name = "particles";
      group.add(points);
      marker(e.color);
      break;
    }
    case "PROJECTED_EFFECT": {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const c = canvas.getContext("2d")!;
      c.strokeStyle = "#ffffff";
      c.fillStyle = "#ffffff";
      c.lineWidth = 5;
      if (e.pattern === "SYMBOL") {
        c.beginPath();
        c.arc(256, 256, 180, 0, Math.PI * 2);
        c.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          c.beginPath();
          c.moveTo(256 + Math.sin(a) * 70, 256 + Math.cos(a) * 70);
          c.lineTo(256 + Math.sin(a) * 210, 256 + Math.cos(a) * 210);
          c.stroke();
        }
        c.strokeRect(200, 200, 112, 112);
      } else if (e.pattern === "FOOTPRINTS") {
        for (let i = 0; i < 4; i++) {
          c.save();
          c.translate(i % 2 ? 310 : 200, 70 + i * 106);
          c.rotate(i % 2 ? 0.15 : -0.15);
          c.beginPath();
          c.ellipse(0, 0, 23, 38, 0, 0, Math.PI * 2);
          c.fill();
          for (let j = 0; j < 4; j++) {
            c.beginPath();
            c.arc(-22 + j * 14, -48, 6, 0, Math.PI * 2);
            c.fill();
          }
          c.restore();
        }
      } else {
        c.font = "italic 38px serif";
        c.textAlign = "center";
        const words = entity.content.split(/\s+/);
        let line = "",
          y = 130;
        for (const word of words.slice(0, 36)) {
          if (c.measureText(`${line} ${word}`).width > 440) {
            c.fillText(line, 256, y);
            line = "";
            y += 54;
          }
          line += `${word} `;
        }
        c.fillText(line, 256, y);
      }
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      const overlay = new T.Mesh(
        new T.PlaneGeometry(entity.widthMeters, entity.widthMeters),
        new T.MeshBasicMaterial({
          color: e.color,
          map: texture,
          transparent: true,
          opacity: e.opacity,
          side: T.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      overlay.rotation.x = e.pattern === "FOOTPRINTS" ? -Math.PI / 2 : 0;
      group.add(overlay);
      break;
    }
    case "SPATIAL_PHENOMENON": {
      const texture = glowTexture();
      for (let i = 0; i < 3; i++) {
        const ring = new T.Mesh(
          new T.TorusGeometry(entity.widthMeters * (0.36 + i * 0.04), 0.006, 6, 64),
          new T.MeshBasicMaterial({
            color: e.color,
            transparent: true,
            opacity: 0.75 - i * 0.15,
            blending: T.AdditiveBlending,
            depthWrite: false,
          }),
        );
        ring.name = `phenomenon-${i}`;
        group.add(ring);
      }
      const pane = new T.Mesh(
        new T.PlaneGeometry(entity.widthMeters, entity.widthMeters),
        new T.MeshBasicMaterial({
          color: e.color,
          map: texture,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      group.add(pane);
      break;
    }
    case "SPATIAL_AUDIO":
      marker("#cbb6ef");
      break;
    case "INTERACTION_VOLUME": {
      const geometry =
        e.shape === "BOX"
          ? new T.BoxGeometry(e.radius * 2, e.radius * 2, e.radius * 2)
          : new T.SphereGeometry(e.radius, 16, 12);
      const volume = new T.Mesh(
        geometry,
        new T.MeshBasicMaterial({
          color: 0x93c1e2,
          wireframe: true,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
      volume.name = "editor-marker";
      volume.position.y = e.radius;
      group.add(volume);
      break;
    }
  }
  group.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Points) {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) if ("opacity" in m) m.userData.baseOpacity = m.opacity;
    }
  });
  return group;
}

export function updateElementObject(
  group: T.Object3D,
  e: SpatialElement,
  timeMs: number,
  envelope: number,
  editor: boolean,
  reducedMotion: boolean,
) {
  const t = reducedMotion ? 0 : timeMs / 1000;
  const marker = group.getObjectByName("editor-marker");
  if (marker) marker.visible = editor;
  if (e.kind === "PHYSICAL_ASSET") {
    setModelArticulation(group, e.modelId, e.articulation * (editor || reducedMotion ? 1 : envelope));
  } else if (e.kind === "LIGHT") {
    const light = group.getObjectByName("authored-light") as T.Light;
    light.intensity =
      e.intensity * envelope * (e.pulseHz && !reducedMotion ? 0.8 + 0.2 * Math.sin(t * Math.PI * 2 * e.pulseHz) : 1);
  } else if (e.kind === "PARTICLES") {
    const points = group.getObjectByName("particles") as T.Points,
      position = points.geometry.attributes.position;
    for (let i = 0; i < e.count; i++) {
      const a = random(e.seed, i * 4) * Math.PI * 2,
        r = Math.sqrt(random(e.seed, i * 4 + 1)) * e.radius;
      const rise = (random(e.seed, i * 4 + 2) + t * e.speed * 0.2) % 1;
      position.setXYZ(
        i,
        Math.cos(a + t * 0.07) * r,
        (e.style === "DUST" ? 1 - rise : rise) * e.radius * 1.5,
        Math.sin(a + t * 0.07) * r,
      );
    }
    position.needsUpdate = true;
  } else if (e.kind === "SPATIAL_PHENOMENON") {
    for (let i = 0; i < 3; i++) {
      const ring = group.getObjectByName(`phenomenon-${i}`)!;
      ring.rotation.z = (i % 2 ? -1 : 1) * t * e.speed;
      const s = e.style === "REVEAL" ? 0.7 + ((t * e.speed + i / 3) % 1) * 0.5 : 1;
      ring.scale.setScalar(s);
    }
  }
  group.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Points) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const base = m.userData.baseOpacity as number;
        if (base !== undefined) {
          m.opacity = base * envelope;
          if (envelope < 1) m.transparent = true;
          else if (base === 1) m.transparent = false;
        }
      }
    }
  });
}
