import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { physicalAssets, type ModelId } from "../asset-catalog";
import { surfacePixels, type SurfaceFamily } from "./surfaces";

/** Original mesh recipes, in meters. No downloaded meshes, textures, fonts, or external resources. */
export function createPremiumModel(id: ModelId, includeTextures = true): T.Group {
  const root = new T.Group();
  root.name = id;
  const mat = (color: number, roughness = 0.65, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  const wood = mat(0x593723),
    edge = mat(0x8f623d),
    dark = mat(0x211a17),
    brass = mat(0xb39b58, 0.3, 0.82),
    iron = mat(0x282b2e, 0.48, 0.75),
    leather = mat(0x394b46, 0.85),
    fabric = mat(0x465d69, 0.95),
    paper = mat(0xd9c391, 0.93),
    ink = mat(0x39483f),
    red = mat(0x762e37, 0.5),
    blue = mat(0x1c4265, 0.3),
    ivory = mat(0xdad7c8, 0.48),
    gold = mat(0x9b743e, 0.38, 0.72);
  const rugMaterial = mat(0xffffff, 0.98),
    porcelain = mat(0xffffff, 0.28);
  const surfaces: [T.MeshStandardMaterial, SurfaceFamily][] = [
    [wood, "wood"],
    [edge, "wood"],
    [leather, "leather"],
    [fabric, "fabric"],
    [paper, "paper"],
    [rugMaterial, "rug"],
    [porcelain, "porcelain"],
  ];
  for (const [material, family] of surfaces) {
    material.name = `sc02-${family}`;
    if (includeTextures) {
      const p = surfacePixels(family),
        map = new T.DataTexture(p.color, p.size, p.size, T.RGBAFormat),
        normal = new T.DataTexture(p.normal, p.size, p.size, T.RGBAFormat);
      map.colorSpace = T.SRGBColorSpace;
      map.needsUpdate = normal.needsUpdate = true;
      material.map = map;
      material.normalMap = normal;
      material.normalScale.setScalar(family === "wood" ? 0.28 : 0.2);
    }
  }
  const mesh = (g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent = root) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const block = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: T.Material = wood,
    parent = root,
    r = 0.008,
  ) =>
    mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.000001, h / 2 - 0.000001, d / 2 - 0.000001)),
      m,
      x,
      y,
      z,
      parent,
    );
  const lathe = (profile: number[][], x = 0, y = 0, z = 0, m: T.Material = brass, parent = root) =>
    mesh(
      new T.LatheGeometry(
        profile.map(([r, h]) => new T.Vector2(r, h)),
        24,
      ),
      m,
      x,
      y,
      z,
      parent,
    );
  const cyl = (r: number, h: number, x: number, y: number, z: number, m: T.Material = brass, parent = root, r2 = r) =>
    mesh(new T.CylinderGeometry(r, r2, h, 24), m, x, y, z, parent);
  const ball = (r: number, x: number, y: number, z: number, m: T.Material = brass, parent = root) =>
    mesh(new T.SphereGeometry(r, 16, 10), m, x, y, z, parent);
  const ring = (r: number, t: number, x: number, y: number, z: number, m: T.Material = brass, parent = root) =>
    mesh(new T.TorusGeometry(r, t, 6, 32), m, x, y, z, parent);
  const curve = (pts: number[][], radius: number, m: T.Material = brass, parent = root) =>
    mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...(p as [number, number, number])))),
        24,
        radius,
        6,
        false,
      ),
      m,
      0,
      0,
      0,
      parent,
    );
  const flat = (points: number[][], depth: number, m: T.Material, x = 0, y = 0, z = 0, parent = root) => {
    const s = new T.Shape(points.map((p) => new T.Vector2(p[0], p[1])));
    return mesh(
      new T.ExtrudeGeometry(s, {
        depth,
        steps: 1,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.001,
        bevelThickness: 0.001,
      }),
      m,
      x,
      y,
      z,
      parent,
    );
  };
  const trim = (
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material = brass,
    parent = root,
    t = 0.012,
  ) => {
    block(w, t, t, x, y - h / 2, z, m, parent);
    block(w, t, t, x, y + h / 2, z, m, parent);
    block(t, h, t, x - w / 2, y, z, m, parent);
    block(t, h, t, x + w / 2, y, z, m, parent);
  };
  const pull = (x: number, y: number, z: number, parent = root) => {
    for (const dx of [-0.034, 0.034]) ball(0.012, x + dx, y, z, brass, parent);
    curve(
      [
        [x - 0.034, y, z],
        [x - 0.03, y - 0.022, z + 0.022],
        [x + 0.03, y - 0.022, z + 0.022],
        [x + 0.034, y, z],
      ],
      0.006,
      brass,
      parent,
    );
  };
  const turnedLeg = (x: number, z: number, height = 0.69, parent = root) =>
    lathe(
      [
        [0.025, 0],
        [0.032, 0.018],
        [0.022, 0.055],
        [0.018, height * 0.42],
        [0.035, height * 0.55],
        [0.03, height * 0.63],
        [0.018, height * 0.7],
        [0.035, height * 0.82],
        [0.035, height],
      ],
      x,
      0,
      z,
      wood,
      parent,
    );
  const feet = (w: number, d: number, h = 0.08) => {
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06])
      for (const z of [-d / 2 + 0.06, d / 2 - 0.06])
        lathe(
          [
            [0.03, 0],
            [0.045, 0.015],
            [0.03, h],
            [0.04, h],
          ],
          x,
          0,
          z,
          wood,
        );
  };
  const drawer = (w: number, h: number, x: number, y: number, z: number, parent = root) => {
    block(w, h, 0.025, x, y, z, edge, parent);
    trim(w - 0.035, h - 0.035, x, y, z + 0.018, wood, parent, 0.008);
    pull(x, y, z + 0.025, parent);
  };
  const panel = (w: number, h: number, x: number, y: number, z: number, parent = root) => {
    block(w, h, 0.022, x, y, z, edge, parent);
    block(w - 0.055, h - 0.055, 0.028, x, y, z + 0.01, wood, parent);
    trim(w - 0.035, h - 0.035, x, y, z + 0.025, gold, parent, 0.006);
  };
  const grain = (w: number, y: number, z: number, parent = root) => {
    for (let i = 0; i < 4; i++)
      curve(
        [
          [-w * 0.43, y, z + i * 0.014],
          [-w * 0.1, y + 0.0004, z + 0.003 + i * 0.014],
          [w * 0.42, y, z + i * 0.014],
        ],
        0.0008,
        edge,
        parent,
      );
  };
  const chestBody = (w: number, h: number, d: number) => {
    feet(w, d, 0.05);
    block(w, 0.045, d, 0, 0.07, 0);
    for (const x of [-1, 1]) block(0.035, h, d, x * (w / 2 - 0.018), h / 2 + 0.08, 0);
    for (const z of [-1, 1])
      for (let i = 0; i < 4; i++)
        block(w - 0.06, h / 4 - 0.004, 0.025, 0, 0.08 + ((i + 0.5) * h) / 4, z * (d / 2 - 0.013), i % 2 ? wood : edge);
    for (const x of [-w * 0.34, w * 0.34]) {
      for (const z of [-d / 2, d / 2]) block(0.034, h, 0.012, x, h / 2 + 0.08, z, iron);
      for (let i = 0; i < 5; i++)
        for (const z of [-d / 2 - 0.008, d / 2 + 0.008]) ball(0.005, x, 0.1 + (i * h) / 5, z, brass);
    }
    block(0.055, 0.085, 0.012, 0, h + 0.02, d / 2 + 0.012, iron);
    pull(0, h / 2 + 0.04, d / 2 + 0.025);
  };
  const cloth = (
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    m: T.Material,
    parent = root,
    notched = false,
  ) => {
    const g = new T.PlaneGeometry(w, h, 32, 24),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i),
        py = p.getY(i);
      p.setZ(
        i,
        notched
          ? (Math.sin((px / w) * Math.PI * 8) * 0.009 + Math.sin((py / h) * 3 + px) * 0.004) *
              Math.sin(((py + h / 2) / h) * Math.PI)
          : Math.sin((px / w) * Math.PI * 14) * 0.035 + Math.sin((py / h) * 4 + px * 2) * 0.008,
      );
      if (notched) p.setY(i, py + Math.max(0, 1 - (py + h / 2) / (h * 0.2)) * (1 - Math.abs(px) / (w / 2)) * 0.19);
    }
    g.computeVertexNormals();
    const material = (m as T.MeshStandardMaterial).clone();
    material.side = T.DoubleSide;
    return mesh(g, material, x, y, z, parent);
  };

  switch (id) {
    case "writing-desk": {
      for (const x of [-0.59, 0.59]) for (const z of [-0.26, 0.26]) turnedLeg(x, z);
      block(1.4, 0.065, 0.72, 0, 0.745, 0, edge);
      block(1.18, 0.006, 0.5, 0, 0.781, 0, leather);
      for (const x of [-0.62, 0.62]) block(0.012, 0.008, 0.56, x, 0.787, 0, brass);
      for (const z of [-0.28, 0.28]) block(1.25, 0.008, 0.012, 0, 0.787, z, brass);
      for (const x of [-0.44, 0, 0.44]) drawer(0.41, 0.13, x, 0.65, 0.31);
      block(1.25, 0.1, 0.028, 0, 0.66, -0.28);
      grain(1.2, 0.784, -0.34);
      break;
    }
    case "dining-table": {
      lathe(
        [
          [0.2, 0],
          [0.27, 0.045],
          [0.12, 0.1],
          [0.065, 0.25],
          [0.13, 0.36],
          [0.08, 0.47],
          [0.17, 0.68],
        ],
        0,
        0,
        0,
        wood,
      );
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        curve(
          [
            [0, 0.23, 0],
            [Math.cos(a) * 0.13, 0.21, Math.sin(a) * 0.13],
            [Math.cos(a) * 0.31, 0.07, Math.sin(a) * 0.31],
            [Math.cos(a) * 0.54, 0.045, Math.sin(a) * 0.54],
          ],
          0.035,
          wood,
        );
        const toe = ball(0.045, Math.cos(a) * 0.54, 0.045, Math.sin(a) * 0.54, brass);
        toe.scale.y = 0.65;
      }
      const skirt = cyl(0.46, 0.08, 0, 0.67, 0, wood);
      skirt.scale.x = 1.6;
      const top = cyl(0.5, 0.055, 0, 0.73, 0, edge);
      top.scale.x = 1.7;
      for (let i = -3; i <= 3; i++) {
        const x = i * 0.18;
        const len = 0.94 * Math.sqrt(1 - (x / 0.85) ** 2);
        block(0.004, 0.001, len, x, 0.759, 0, dark);
      }
      const rim = ring(0.5, 0.014, 0, 0.712, 0, gold);
      rim.rotation.x = Math.PI / 2;
      rim.scale.x = 1.7;
      break;
    }
    case "upholstered-chair": {
      for (const x of [-0.21, 0.21]) for (const z of [-0.21, 0.21]) turnedLeg(x, z, 0.43);
      block(0.54, 0.07, 0.55, 0, 0.45, 0, wood);
      block(0.48, 0.1, 0.49, 0, 0.51, 0.015, fabric, root, 0.049);
      for (const x of [-0.23, 0.23])
        curve(
          [
            [x, 0.42, -0.22],
            [x, 0.75, -0.25],
            [x * 0.85, 0.94, -0.2],
          ],
          0.025,
          wood,
        );
      const back = mesh(new RoundedBoxGeometry(0.44, 0.42, 0.08, 4, 0.039), fabric, 0, 0.75, -0.23);
      back.rotation.x = -0.13;
      const bp = back.geometry.attributes.position;
      for (let i = 0; i < bp.count; i++)
        if (bp.getZ(i) > 0) {
          let dent = 0;
          for (const x of [-0.1, 0.1])
            for (const y of [-0.08, 0.07])
              dent += Math.exp(-((bp.getX(i) - x) ** 2 + (bp.getY(i) - y) ** 2) / 0.0008) * 0.008;
          bp.setZ(i, bp.getZ(i) - dent);
        }
      back.geometry.computeVertexNormals();
      curve(
        [
          [-0.2, 0.55, 0.23],
          [0.2, 0.55, 0.23],
          [0.224, 0.55, 0.19],
          [0.224, 0.55, -0.18],
          [-0.224, 0.55, -0.18],
          [-0.224, 0.55, 0.19],
          [-0.2, 0.55, 0.23],
        ],
        0.002,
        leather,
      );
      for (let i = 0; i < 9; i++) ball(0.006, -0.19 + i * 0.047, 0.94, -0.176, brass);
      for (const x of [-0.1, 0.1]) for (const y of [0.67, 0.82]) ball(0.011, x, y, -0.177, leather);
      break;
    }
    case "sofa": {
      feet(1.8, 0.74, 0.14);
      block(1.84, 0.18, 0.78, 0, 0.25, 0, leather, root, 0.055);
      block(1.76, 0.5, 0.18, 0, 0.61, -0.32, fabric, root, 0.065);
      for (const x of [-0.59, 0, 0.59]) {
        block(0.56, 0.15, 0.65, x, 0.4, 0.02, fabric, root, 0.065);
        curve(
          [
            [x - 0.22, 0.435, 0.32],
            [x + 0.22, 0.435, 0.32],
            [x + 0.255, 0.435, 0.27],
            [x + 0.255, 0.435, -0.24],
            [x + 0.22, 0.435, -0.28],
            [x - 0.22, 0.435, -0.28],
            [x - 0.255, 0.435, -0.24],
            [x - 0.255, 0.435, 0.27],
            [x - 0.22, 0.435, 0.32],
          ],
          0.003,
          leather,
        );
      }
      for (const x of [-0.91, 0.91]) {
        block(0.17, 0.38, 0.72, x, 0.48, 0, leather, root, 0.075);
        const a = lathe(
          [
            [0, -0.4],
            [0.07, -0.4],
            [0.1, -0.37],
            [0.11, -0.28],
            [0.11, 0.28],
            [0.1, 0.37],
            [0.07, 0.4],
            [0, 0.4],
          ],
          x,
          0.66,
          0,
          fabric,
        );
        a.rotation.x = Math.PI / 2;
        for (const z of [-0.385, 0.385]) ring(0.08, 0.003, x, 0.66, z, leather);
      }
      for (let i = 0; i < 8; i++) for (const y of [0.58, 0.73]) ball(0.012, -0.7 + i * 0.2, y, -0.213, leather);
      break;
    }
    case "bookshelf": {
      block(1.05, 0.1, 0.34, 0, 0.06, 0, edge);
      block(1.11, 0.07, 0.39, 0, 1.82, 0, edge);
      block(1.05, 1.7, 0.02, 0, 0.92, -0.15, dark);
      for (const x of [-0.49, 0.49]) {
        block(0.07, 1.72, 0.34, x, 0.92, 0);
        trim(0.04, 1.55, x, 0.92, 0.18, gold, root, 0.006);
      }
      for (let level = 0; level < 5; level++) {
        const y = 0.16 + level * 0.33;
        block(0.95, 0.032, 0.33, 0, y, 0, edge);
        for (let i = 0; i < 8; i++) {
          const x = -0.4 + i * 0.109,
            h = 0.19 + ((i * 7 + level * 3) % 6) * 0.017;
          block(0.065, h, 0.2, x, y + h / 2 + 0.018, -0.01, [leather, red, blue, wood][(i + level) % 4]);
          for (const dy of [-h * 0.32, h * 0.32]) block(0.066, 0.006, 0.006, x, y + h / 2 + 0.018 + dy, 0.095, gold);
        }
      }
      break;
    }
    case "wardrobe": {
      feet(1.1, 0.56);
      block(1.1, 1.7, 0.56, 0, 0.95, 0);
      block(1.17, 0.1, 0.62, 0, 1.86, 0, edge);
      block(1.2, 0.045, 0.65, 0, 1.94, 0, wood);
      for (const x of [-0.265, 0.265]) {
        panel(0.5, 1.65, x, 0.96, 0.29);
        panel(0.4, 0.91, x, 1.2, 0.325);
        panel(0.4, 0.48, x, 0.45, 0.325);
        pull(x < 0 ? -0.07 : 0.07, 1, 0.35);
      }
      break;
    }
    case "dresser": {
      feet(1, 0.45);
      block(1, 0.73, 0.44, 0, 0.46, 0);
      block(1.06, 0.05, 0.49, 0, 0.86, 0, edge);
      for (let i = 0; i < 3; i++) {
        const y = 0.23 + i * 0.235;
        drawer(0.91, 0.21, 0, y, 0.235);
        pull(-0.28, y, 0.27);
        pull(0.28, y, 0.27);
      }
      grain(0.95, 0.887, -0.18);
      break;
    }
    case "cabinet": {
      feet(0.76, 0.36);
      block(0.8, 0.08, 0.4, 0, 0.13, 0, edge);
      block(0.8, 0.075, 0.4, 0, 1.3, 0, edge);
      for (const x of [-0.36, 0.36]) block(0.055, 1.12, 0.38, x, 0.72, 0);
      block(0.72, 1.12, 0.02, 0, 0.72, -0.18, dark);
      for (const y of [0.45, 0.83]) block(0.72, 0.025, 0.36, 0, y, 0, edge);
      for (const x of [-0.19, 0.19]) {
        trim(0.33, 1.03, x, 0.73, 0.2, wood);
        block(0.012, 1, 0.018, x, 0.73, 0.2, brass);
        pull(x < 0 ? -0.04 : 0.04, 0.72, 0.23);
      }
      const glass = new T.MeshPhysicalMaterial({
        color: 0xa8c1bf,
        roughness: 0.13,
        metalness: 0.1,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      block(0.7, 1.02, 0.005, 0, 0.73, 0.203, glass);
      for (const x of [-0.2, 0.2])
        lathe(
          [
            [0.045, 0],
            [0.07, 0.04],
            [0.055, 0.15],
            [0.025, 0.19],
            [0.035, 0.21],
          ],
          x,
          0.85,
          0,
          ivory,
        );
      break;
    }
    case "travel-trunk": {
      block(0.85, 0.43, 0.48, 0, 0.24, 0, leather, root, 0.025);
      block(0.87, 0.055, 0.5, 0, 0.47, 0, wood);
      for (const x of [-0.27, 0.27]) {
        for (const z of [-0.245, 0.245]) block(0.055, 0.45, 0.012, x, 0.24, z, edge);
        block(0.055, 0.012, 0.5, x, 0.504, 0, edge);
        block(0.07, 0.06, 0.015, x, 0.34, 0.26, brass);
        for (const y of [0.07, 0.15, 0.24, 0.42]) ball(0.005, x, y, 0.257, brass);
      }
      for (const x of [-0.42, 0.42])
        for (const z of [-0.24, 0.24]) for (const y of [0.045, 0.45]) block(0.06, 0.06, 0.04, x, y, z, brass);
      for (const x of [-0.437, 0.437]) {
        const r = ring(0.05, 0.009, x, 0.28, 0, iron);
        r.rotation.y = Math.PI / 2;
      }
      break;
    }
    case "treasure-chest": {
      chestBody(0.8, 0.31, 0.5);
      const lid = new T.Group();
      root.add(lid);
      lid.position.set(0, 0.39, 0);
      for (let i = 0; i < 12; i++) {
        const a = ((i + 0.5) * Math.PI) / 12;
        const p = block(0.76, 0.025, 0.071, 0, Math.sin(a) * 0.23, Math.cos(a) * 0.25, i % 2 ? wood : edge, lid);
        p.rotation.x = Math.PI / 2 - a;
      }
      for (const x of [-0.28, 0.28]) {
        const arc = mesh(new T.TorusGeometry(0.255, 0.016, 6, 28, Math.PI), iron, x, 0, 0, lid);
        arc.rotation.y = Math.PI / 2;
      }
      for (const x of [-0.385, 0.385]) {
        const cap = mesh(new T.CircleGeometry(0.24, 24, 0, Math.PI), wood, x, 0, 0, lid);
        cap.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      break;
    }
    case "brass-compass": {
      lathe(
        [
          [0.06, 0],
          [0.073, 0.006],
          [0.075, 0.014],
          [0.068, 0.018],
          [0.068, 0.025],
          [0.074, 0.028],
          [0.07, 0.034],
          [0.06, 0.034],
        ],
        0,
        0,
        0,
        brass,
      );
      cyl(0.062, 0.004, 0, 0.025, 0, ivory);
      for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16;
        const tick = block(
          0.0015,
          0.001,
          0.008 + (i % 4 === 0 ? 0.008 : 0),
          Math.sin(a) * 0.052,
          0.029,
          Math.cos(a) * 0.052,
          ink,
        );
        tick.rotation.y = a;
      }
      const needle = flat(
        [
          [0, 0.051],
          [0.009, 0],
          [0, -0.046],
          [-0.009, 0],
        ],
        0.002,
        red,
      );
      needle.rotation.x = -Math.PI / 2;
      needle.position.y = 0.031;
      ball(0.006, 0, 0.035, 0, brass);
      const r = ring(0.015, 0.003, 0, 0.018, -0.085, brass);
      r.rotation.x = Math.PI / 2;
      break;
    }
    case "lantern": {
      lathe(
        [
          [0.075, 0],
          [0.1, 0.018],
          [0.07, 0.035],
          [0.055, 0.06],
          [0.07, 0.075],
        ],
        0,
        0,
        0,
        iron,
      );
      const glass = new T.MeshPhysicalMaterial({
        color: 0xa9c5bc,
        roughness: 0.13,
        transparent: true,
        opacity: 0.21,
        depthWrite: false,
        side: T.DoubleSide,
      });
      mesh(new T.CylinderGeometry(0.075, 0.09, 0.22, 6, 1, true), glass, 0, 0.18, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        curve(
          [
            [Math.cos(a) * 0.09, 0.06, Math.sin(a) * 0.09],
            [Math.cos(a) * 0.075, 0.29, Math.sin(a) * 0.075],
          ],
          0.006,
          brass,
        );
      }
      lathe(
        [
          [0.09, 0],
          [0.09, 0.013],
          [0.06, 0.045],
          [0.025, 0.07],
          [0.03, 0.08],
        ],
        0,
        0.29,
        0,
        iron,
      );
      cyl(0.042, 0.04, 0, 0.09, 0, brass);
      cyl(0.007, 0.06, 0, 0.135, 0, dark);
      const flame = ball(
        0.018,
        0,
        0.17,
        0,
        new T.MeshStandardMaterial({ color: 0xffc566, emissive: 0xff7e22, emissiveIntensity: 2 }),
      );
      flame.scale.set(0.6, 2, 0.6);
      curve(
        [
          [-0.025, 0.35, 0],
          [-0.06, 0.41, 0],
          [0, 0.47, 0],
          [0.06, 0.41, 0],
          [0.025, 0.35, 0],
        ],
        0.006,
        iron,
      );
      for (const x of [-0.025, 0.025]) cyl(0.006, 0.025, x, 0.357, 0, iron);
      break;
    }
    case "treasure-map":
    case "nautical-chart":
    case "parchment-note": {
      const w = id === "treasure-map" ? 0.55 : id === "nautical-chart" ? 0.46 : 0.19,
        d = id === "parchment-note" ? 0.14 : 0.32;
      const g = new T.PlaneGeometry(w, d, 32, 20),
        p = g.attributes.position;
      g.rotateX(-Math.PI / 2);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = p.getZ(i);
        p.setY(i, 0.006 + Math.pow(Math.abs(x) / (w / 2), 8) * 0.012 + Math.sin(z * 45) * 0.0015);
      }
      g.computeVertexNormals();
      const m = paper.clone();
      m.side = T.DoubleSide;
      mesh(g, m);
      if (id === "parchment-note") {
        // The upper half folds back over the lower half with a visible crease and triangular lifted corner.
        const fold = flat(
          [
            [-0.093, 0],
            [0.093, 0],
            [0.083, 0.066],
            [-0.088, 0.064],
          ],
          0.0015,
          paper,
        );
        fold.rotation.x = -Math.PI / 2;
        fold.position.set(0, 0.012, 0.005);
        const corner = flat(
          [
            [0.068, 0],
            [0.091, 0],
            [0.088, 0.022],
          ],
          0.001,
          paper,
        );
        corner.rotation.x = -Math.PI / 2 + 0.12;
        corner.position.set(0, 0.013, -0.06);
        curve(
          [
            [-w / 2, 0.013, 0.004],
            [0, 0.015, 0.004],
            [w / 2, 0.013, 0.004],
          ],
          0.0007,
          edge,
        );
        for (let i = 0; i < 4; i++) block(w * 0.59, 0.0007, 0.001, -0.006, 0.008, -0.048 + i * 0.009, ink);
      } else {
        curve(
          [
            [-w * 0.35, 0.009, -0.09],
            [-0.07, 0.009, -0.12],
            [0.02, 0.009, -0.06],
            [-0.02, 0.009, 0.01],
            [0.08, 0.009, 0.05],
            [0.06, 0.009, 0.12],
            [-w * 0.34, 0.009, 0.1],
          ],
          0.0014,
          ink,
        );
        for (let i = 0; i < 6; i++) block(w * 0.83, 0.0006, 0.0007, 0, 0.009, -0.12 + i * 0.048, edge);
        if (id === "treasure-map") {
          for (let island = 0; island < 5; island++) {
            const x = -0.16 + island * 0.065,
              z = 0.08 - Math.sin(island * 1.4) * 0.055;
            curve(
              [
                [x, 0.01, z],
                [x + 0.012, 0.01, z - 0.017],
                [x + 0.025, 0.01, z - 0.011],
                [x + 0.033, 0.01, z + 0.009],
                [x + 0.014, 0.01, z + 0.016],
                [x, 0.01, z],
              ],
              0.001,
              ink,
            );
          }
          for (let i = 0; i < 8; i++)
            curve(
              [
                [-0.22 + i * 0.055, 0.01, -0.13],
                [-0.15 + i * 0.045, 0.01, 0.12],
              ],
              0.0004,
              edge,
            );
          curve(
            [
              [0.12, 0.011, 0.085],
              [0.14, 0.011, 0.11],
            ],
            0.002,
            red,
          );
          curve(
            [
              [0.14, 0.011, 0.085],
              [0.12, 0.011, 0.11],
            ],
            0.002,
            red,
          );
        } else {
          for (let i = 0; i < 14; i++) {
            const x = -0.19 + i * 0.028;
            curve(
              [
                [x, 0.01, -0.13],
                [x, 0.01, 0.13],
              ],
              0.00045,
              edge,
            );
          }
          for (let i = 0; i < 6; i++)
            curve(
              [
                [-0.19, 0.01, -0.1 + i * 0.04],
                [0.19, 0.01, -0.1 + i * 0.04],
              ],
              0.0005,
              blue,
            );
          for (let i = 0; i < 7; i++) {
            const r = ring(0.015 + i * 0.006, 0.0006, 0.08, 0.011, 0.01, blue);
            r.rotation.x = Math.PI / 2;
          }
        }
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          curve(
            [
              [w * 0.28, 0.01, -0.08],
              [w * 0.28 + Math.sin(a) * 0.035, 0.01, -0.08 + Math.cos(a) * 0.035],
            ],
            0.0008,
            ink,
          );
        }
        for (let i = 0; i < 7; i++) ball(0.002, -0.05 + i * 0.02, 0.01, 0.07 - Math.sin(i) * 0.02, red);
      }
      if (id === "nautical-chart")
        for (const x of [-0.22, 0.22]) {
          const roll = mesh(new T.CylinderGeometry(0.025, 0.025, d, 24, 1, true), paper, x, 0.026, 0);
          roll.rotation.x = Math.PI / 2;
          const band = block(0.055, 0.006, 0.025, x, 0.052, 0.01, red);
          band.rotation.z = 0.04;
        }
      break;
    }
    case "spyglass": {
      const b = new T.Group();
      root.add(b);
      b.rotation.z = Math.PI / 2;
      b.position.y = 0.045;
      for (let i = 0; i < 4; i++) {
        const y = -0.14 + i * 0.08,
          r = 0.039 - i * 0.006;
        cyl(r, 0.1, 0, y, 0, i === 0 ? leather : brass, b);
        cyl(r + 0.003, 0.009, 0, y - 0.04, 0, brass, b);
      }
      cyl(0.017, 0.003, 0, 0.151, 0, blue, b);
      cyl(0.034, 0.003, 0, -0.194, 0, blue, b);
      break;
    }
    case "sealed-letter": {
      block(0.22, 0.006, 0.15, 0, 0.004, 0, paper);
      const flap = flat(
        [
          [-0.105, 0],
          [0.105, 0],
          [0, 0.085],
        ],
        0.002,
        ivory,
      );
      flap.rotation.x = Math.PI / 2;
      flap.position.set(0, 0.009, -0.068);
      const seal = cyl(0.018, 0.006, 0, 0.015, 0.015, red);
      seal.rotation.y = 0.1;
      const stamp = ring(0.011, 0.001, 0, 0.019, 0.015, gold);
      stamp.rotation.x = Math.PI / 2;
      for (const x of [-0.003, 0.003]) block(0.001, 0.001, 0.012, x, 0.02, 0.015, brass);
      break;
    }
    case "antique-book": {
      block(0.18, 0.048, 0.245, 0, 0.032, 0, paper);
      for (const y of [0.005, 0.063]) block(0.19, 0.009, 0.26, 0, y, 0, red);
      const spine = block(0.022, 0.06, 0.26, -0.09, 0.033, 0, red, root, 0.012);
      for (const z of [-0.1, -0.07, 0.07, 0.1]) block(0.025, 0.063, 0.007, -0.09, 0.033, z, gold);
      for (let i = 0; i < 10; i++) block(0.16, 0.0005, 0.001, 0.01, 0.013 + i * 0.004, 0.124, edge);
      for (const x of [-0.071, 0.071]) for (const z of [-0.11, 0.11]) block(0.023, 0.002, 0.023, x, 0.069, z, gold);
      const crest = ring(0.035, 0.002, 0, 0.069, 0, gold);
      crest.rotation.x = Math.PI / 2;
      spine.name = "leather-spine";
      break;
    }
    case "ornate-key": {
      for (const x of [-0.017, 0.017]) {
        const b = ring(0.021, 0.004, x, 0.007, -0.055, brass);
        b.rotation.x = Math.PI / 2;
      }
      const crown = ring(0.018, 0.003, 0, 0.007, -0.08, brass);
      crown.rotation.x = Math.PI / 2;
      const shaft = cyl(0.005, 0.11, 0, 0.007, 0.01, brass);
      shaft.rotation.x = Math.PI / 2;
      for (const z of [0.047, 0.065]) {
        block(0.035, 0.012, 0.01, 0.012, 0.007, z, brass);
        block(0.009, 0.012, 0.013, 0.026, 0.007, z + 0.005, brass);
      }
      for (const z of [-0.025, -0.015]) {
        const c = ring(0.007, 0.002, 0, 0.007, z, brass);
        c.rotation.x = 0;
      }
      break;
    }
    case "puzzle-box": {
      block(0.23, 0.14, 0.2, 0, 0.075, 0, wood);
      block(0.24, 0.015, 0.21, 0, 0.154, 0, edge);
      block(0.218, 0.003, 0.188, 0, 0.163, 0, dark);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          if (i === 2 && j === 0) {
            for (const x of [0.056, 0.09]) block(0.002, 0.002, 0.05, x, 0.165, -0.063, brass);
            continue;
          }
          block(0.066, 0.006, 0.056, -0.073 + i * 0.073, 0.168, -0.063 + j * 0.063, (i + j) % 2 ? leather : edge);
          const rhombus = block(0.018, 0.001, 0.018, -0.073 + i * 0.073, 0.172, -0.063 + j * 0.063, brass);
          rhombus.rotation.y = Math.PI / 4;
          block(0.024, 0.002, 0.005, -0.073 + i * 0.073, 0.173, -0.063 + j * 0.063 + 0.018, wood);
        }
      for (const x of [-0.08, 0, 0.08]) {
        block(0.002, 0.105, 0.001, x, 0.08, 0.102, dark);
        block(0.014, 0.012, 0.004, x, 0.11, 0.106, brass);
      }
      for (const x of [-0.1, 0.1]) for (const z of [-0.085, 0.085]) ball(0.008, x, 0.156, z, brass);
      trim(0.2, 0.11, 0, 0.08, 0.103, gold, root, 0.005);
      break;
    }
    case "candelabra": {
      lathe(
        [
          [0.08, 0],
          [0.085, 0.018],
          [0.035, 0.035],
          [0.022, 0.06],
          [0.018, 0.25],
          [0.03, 0.28],
        ],
        0,
        0,
        0,
        brass,
      );
      for (const x of [-0.16, -0.08, 0, 0.08, 0.16]) {
        const y = 0.32 - Math.abs(x) * 0.35;
        curve(
          [
            [0, 0.16, 0],
            [x * 0.65, 0.18, 0],
            [x, y, 0],
          ],
          0.009,
          brass,
        );
        lathe(
          [
            [0.035, 0],
            [0.035, 0.008],
            [0.017, 0.014],
            [0.018, 0.028],
          ],
          x,
          y,
          0,
          brass,
        );
        cyl(0.013, 0.14, x, y + 0.09, 0, ivory);
        cyl(0.0015, 0.01, x, y + 0.165, 0, dark);
        for (let i = 0; i < 3; i++)
          curve(
            [
              [x + 0.012, y + 0.15 - i * 0.02, 0],
              [x + 0.016, y + 0.12 - i * 0.02, 0],
            ],
            0.002,
            ivory,
          );
      }
      break;
    }
    case "framed-painting": {
      block(0.72, 0.52, 0.035, 0, 0.26, 0, dark);
      for (const [w, h, z, m, t] of [
        [0.69, 0.49, 0.023, gold, 0.025],
        [0.63, 0.43, 0.04, edge, 0.012],
        [0.59, 0.39, 0.047, brass, 0.008],
      ] as const)
        trim(w, h, 0, 0.26, z, m, root, t);
      block(0.56, 0.36, 0.003, 0, 0.26, 0.04, blue);
      mesh(new T.CircleGeometry(0.037, 32), ivory, 0.14, 0.36, 0.043);
      flat(
        [
          [-0.28, 0],
          [-0.19, 0.04],
          [-0.1, 0.015],
          [0, 0.05],
          [0.17, 0.01],
          [0.28, 0.045],
          [0.28, -0.06],
          [-0.28, -0.06],
        ],
        0.001,
        leather,
        0,
        0.19,
        0.043,
      );
      flat(
        [
          [-0.08, 0],
          [0.075, 0],
          [0.04, -0.027],
          [-0.045, -0.025],
        ],
        0.002,
        wood,
        0,
        0.19,
        0.047,
      );
      flat(
        [
          [0, 0],
          [0, 0.14],
          [-0.07, 0.025],
        ],
        0.001,
        paper,
        0,
        0.19,
        0.049,
      );
      block(0.004, 0.16, 0.003, 0, 0.265, 0.05, wood);
      for (let i = 0; i < 9; i++)
        block(0.055, 0.0015, 0.001, -0.2 + (i % 4) * 0.12, 0.12 + Math.floor(i / 4) * 0.02, 0.048, ivory);
      break;
    }
    case "rug": {
      block(1.5, 0.008, 1, 0, 0.005, 0, rugMaterial, root, 0.002);
      for (const x of [-0.69, 0.69]) block(0.035, 0.001, 0.91, x, 0.01, 0, paper);
      for (const z of [-0.44, 0.44]) block(1.38, 0.001, 0.035, 0, 0.01, z, paper);
      // The woven medallion lives in the original textile map rather than raised solid ornaments.
      for (const x of [-1, 1])
        for (let i = 0; i < 36; i++)
          curve(
            [
              [x * 0.74, 0.006, -0.45 + i * 0.026],
              [x * 0.79, 0.004, -0.447 + i * 0.026],
            ],
            0.0015,
            paper,
          );
      break;
    }
    case "curtains": {
      const rod = cyl(0.012, 1.55, 0, 1.78, 0, brass);
      rod.rotation.z = Math.PI / 2;
      for (const x of [-0.79, 0.79]) ball(0.025, x, 1.78, 0, brass);
      for (const x of [-0.49, 0.49]) {
        const drape = cloth(0.48, 1.7, x, 0.87, 0, red),
          p = drape.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i) + 0.87,
            gather = Math.exp(-(((y - 0.59) / 0.28) ** 2));
          p.setX(i, p.getX(i) * (1 - gather * 0.45) + Math.sign(x) * gather * 0.08);
          p.setZ(i, p.getZ(i) * (1 - gather * 0.4));
        }
        drape.geometry.computeVertexNormals();
        const cx = x + Math.sign(x) * 0.08;
        curve(
          [
            [cx - 0.14, 0.6, 0.04],
            [cx, 0.56, 0.09],
            [cx + 0.14, 0.6, 0.04],
          ],
          0.009,
          brass,
        );
      }
      cloth(1.48, 0.22, 0, 1.63, 0.04, red);
      for (let i = 0; i < 18; i++) {
        const r = ring(0.018, 0.003, -0.7 + i * 0.082, 1.74, 0, brass);
        r.rotation.y = Math.PI / 2;
      }
      break;
    }
    case "decorative-vase": {
      const profile = [
        [0.065, 0],
        [0.07, 0.015],
        [0.055, 0.035],
        [0.09, 0.09],
        [0.11, 0.16],
        [0.095, 0.23],
        [0.046, 0.3],
        [0.044, 0.34],
        [0.065, 0.365],
        [0.064, 0.38],
        [0.053, 0.38],
        [0.035, 0.34],
        [0.038, 0.3],
        [0.08, 0.22],
        [0.095, 0.16],
        [0.073, 0.09],
        [0.04, 0.04],
        [0, 0.04],
      ];
      const smooth = new T.SplineCurve(profile.map((p) => new T.Vector2(p[0], p[1])))
        .getPoints(112)
        .map((p) => [Math.max(0, p.x), Math.max(0, Math.min(0.38, p.y))]);
      lathe(smooth, 0, 0, 0, porcelain);
      for (const [r, y] of [
        [0.069, 0.014],
        [0.107, 0.155],
        [0.095, 0.222],
        [0.06, 0.371],
      ]) {
        const r1 = ring(r, 0.003, 0, y, 0, blue);
        r1.rotation.x = Math.PI / 2;
      }
      break;
    }
    case "hinged-door": {
      for (const x of [-0.47, 0.47]) block(0.065, 2.1, 0.16, x, 1.05, 0, edge);
      block(0.98, 0.07, 0.16, 0, 2.065, 0, edge);
      const hinge = new T.Group();
      hinge.name = "articulation";
      hinge.position.set(-0.42, 0, 0);
      root.add(hinge);
      block(0.84, 2, 0.045, 0.42, 1, 0, wood, hinge);
      for (const x of [0.23, 0.61]) for (const y of [0.48, 1.47]) panel(0.32, 0.82, x, y, 0.032, hinge);
      for (const y of [0.3, 1.05, 1.8]) {
        cyl(0.012, 0.09, 0, y, 0.035, brass, hinge);
        block(0.06, 0.08, 0.006, 0.025, y, 0.027, brass, hinge);
      }
      ball(0.025, 0.74, 1, 0.085, brass, hinge);
      block(0.045, 0.13, 0.008, 0.74, 1, 0.036, brass, hinge);
      break;
    }
    case "opening-drawer": {
      for (const x of [-0.287, 0.287]) block(0.026, 0.32, 0.48, x, 0.16, 0);
      block(0.6, 0.025, 0.48, 0, 0.307, 0, edge);
      block(0.6, 0.025, 0.48, 0, 0.012, 0, edge);
      block(0.55, 0.27, 0.02, 0, 0.16, -0.23, dark);
      const slide = new T.Group();
      slide.name = "articulation";
      root.add(slide);
      block(0.53, 0.02, 0.42, 0, 0.04, 0.015, edge, slide);
      for (const x of [-0.26, 0.26]) block(0.015, 0.2, 0.42, x, 0.14, 0.015, wood, slide);
      block(0.53, 0.2, 0.015, 0, 0.14, -0.19, wood, slide);
      drawer(0.57, 0.265, 0, 0.16, 0.245, slide);
      for (const x of [-0.267, 0.267])
        for (let i = 0; i < 5; i++) block(0.007, 0.014, 0.015, x, 0.06 + i * 0.035, 0.218, edge, slide);
      break;
    }
    case "articulated-chest": {
      chestBody(0.65, 0.31, 0.42);
      const lid = new T.Group();
      lid.name = "articulation";
      lid.position.set(0, 0.405, -0.21);
      root.add(lid);
      block(0.67, 0.045, 0.44, 0, 0.01, 0.21, wood, lid);
      block(0.6, 0.01, 0.37, 0, 0.038, 0.21, edge, lid);
      for (const x of [-0.23, 0.23]) {
        block(0.025, 0.012, 0.43, x, 0.047, 0.21, iron, lid);
        cyl(0.012, 0.07, x, -0.005, 0, brass, lid).rotation.z = Math.PI / 2;
      }
      trim(0.53, 0.22, 0, 0.25, 0.225, gold, root, 0.005);
      block(0.55, 0.015, 0.32, 0, 0.19, 0, leather);
      break;
    }
    case "hanging-banner": {
      const bar = cyl(0.009, 0.59, 0, 1.02, 0, brass);
      bar.rotation.z = Math.PI / 2;
      for (const x of [-0.3, 0.3]) ball(0.018, x, 1.02, 0, brass);
      cloth(0.52, 0.95, 0, 0.51, 0, blue, root, true);
      for (const x of [-0.235, 0.235])
        curve(
          [
            [x, 0.07, 0.008],
            [x, 0.53, 0.008],
            [x, 0.97, 0.008],
          ],
          0.003,
          gold,
        );
      const crest = ring(0.12, 0.003, 0, 0.56, 0.014, brass);
      crest.scale.y = 1.25;
      flat(
        [
          [0, 0.12],
          [0.07, -0.05],
          [0, -0.01],
          [-0.07, -0.05],
        ],
        0.002,
        paper,
        0,
        0.55,
        0.016,
      );
      curve(
        [
          [-0.19, 1, 0],
          [0, 1.11, 0],
          [0.19, 1, 0],
        ],
        0.004,
        leather,
      );
      break;
    }
    case "wall-sign": {
      block(0.65, 0.035, 0.05, 0, 0.425, -0.03, iron);
      for (const x of [-0.23, 0.23])
        for (let j = 0; j < 4; j++) {
          const r = ring(0.016, 0.003, x, 0.41 - j * 0.023, 0, iron);
          r.rotation.y = ((j % 2) * Math.PI) / 2;
        }
      const sign = new T.Group();
      sign.name = "articulation";
      sign.position.set(0, 0.32, 0);
      root.add(sign);
      flat(
        [
          [-0.31, -0.02],
          [-0.26, 0.025],
          [0.26, 0.025],
          [0.31, -0.02],
          [0.31, -0.25],
          [0.25, -0.28],
          [-0.25, -0.28],
          [-0.31, -0.25],
        ],
        0.025,
        wood,
        0,
        0,
        0,
        sign,
      );
      trim(0.53, 0.21, 0, -0.127, 0.03, brass, sign, 0.005);
      const r = ring(0.067, 0.003, 0, -0.12, 0.032, gold, sign);
      flat(
        [
          [0, 0.06],
          [0.018, 0],
          [0, -0.06],
          [-0.018, 0],
        ],
        0.003,
        paper,
        0,
        -0.12,
        0.034,
        sign,
      );
      r.name = "raised-compass";
      for (const x of [-0.26, 0.26]) for (const y of [-0.03, -0.23]) ball(0.006, x, y, 0.03, brass, sign);
      break;
    }
  }
  consolidate(root);
  root.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(root, true),
    size = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3());
  const descriptor = physicalAssets.find((a) => a.id === id)!;
  const normalized = new T.Group();
  normalized.name = id;
  normalized.add(root);
  root.position.set(-center.x, -bounds.min.y, -center.z);
  normalized.scale.set(
    descriptor.dimensions[0] / size.x,
    descriptor.dimensions[1] / size.y,
    descriptor.dimensions[2] / size.z,
  );
  normalized.userData = {
    modelId: id,
    provenance: "AI_ASSISTED",
    metersPerUnit: 1,
    pivotConvention: "BOTTOM_CENTER",
    articulation: descriptor.articulation ?? null,
  };
  return normalized;
}

/** Merge static material batches, retaining named articulation pivots. The same meshes feed the GLB export and Studio. */
function consolidate(group: T.Group) {
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  for (const child of [...group.children]) {
    if (child instanceof T.Group) {
      consolidate(child);
      continue;
    }
    if (!(child instanceof T.Mesh) || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const g = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()).applyMatrix4(
      child.matrix,
    );
    const key = child.material;
    const list = buckets.get(key) ?? [];
    list.push(g);
    buckets.set(key, list);
    child.geometry.dispose();
    group.remove(child);
  }
  for (const [material, geometries] of buckets) {
    const geometry = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    if (!geometry) throw new Error("SC02_GEOMETRY_BATCH_FAILED");
    const indexed = mergeVertices(geometry, 1e-5);
    geometry.dispose();
    const mesh = new T.Mesh(indexed, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

export function setModelArticulation(group: T.Object3D, id: ModelId, amount: number) {
  const pivot = group.getObjectByName("articulation");
  if (!pivot) return;
  if (id === "opening-drawer") pivot.position.z = amount * 0.3;
  else if (id === "hinged-door") pivot.rotation.y = -amount * Math.PI * 0.55;
  else if (id === "articulated-chest") pivot.rotation.x = -amount * Math.PI * 0.6;
  else if (id === "wall-sign") pivot.rotation.x = amount * 0.25;
}
