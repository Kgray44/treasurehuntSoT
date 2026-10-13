import * as T from "three";

/** Closed paper volume in the existing XY face / +Z support-normal frame.
 * Fold stations describe a readable opened letter; maps retain a shallow curl.
 * The support underside stays at or above zero, including every folded edge.
 */
export function paperSheetGeometry(width: number, folded: boolean) {
  const height = width * 0.75,
    thickness = width * 0.003;
  const xs = [-0.5, -1 / 3, -1 / 6, 0, 1 / 6, 1 / 3, 0.5];
  const ys = [-0.5, -0.25, 0, 0.25, 0.5];
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const elevation = (x: number, y: number) =>
    folded
      ? Math.max(0, Math.abs(x) - 1 / 6) * width * 0.22 + Math.abs(y) * width * 0.005
      : (Math.pow(Math.abs(x) * 2, 4) * 0.02 + Math.pow(Math.abs(y) * 2, 4) * 0.006) * width;
  for (const front of [true, false])
    for (const y of ys)
      for (const x of xs) {
        positions.push(x * width, y * height, elevation(x, y) + (front ? thickness : 0));
        uv.push(x + 0.5, y + 0.5);
      }
  const layerSize = xs.length * ys.length;
  for (let y = 0; y < ys.length - 1; y++)
    for (let x = 0; x < xs.length - 1; x++) {
      const a = y * xs.length + x,
        b = a + 1,
        c = a + xs.length,
        d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  const frontCount = indices.length;
  for (let i = 0; i < frontCount; i += 3)
    indices.push(indices[i] + layerSize, indices[i + 2] + layerSize, indices[i + 1] + layerSize);
  // Border follows the front counterclockwise; reversed side faces close it.
  const border: number[] = [];
  for (let x = 0; x < xs.length; x++) border.push(x);
  for (let y = 1; y < ys.length; y++) border.push(y * xs.length + xs.length - 1);
  for (let x = xs.length - 2; x >= 0; x--) border.push((ys.length - 1) * xs.length + x);
  for (let y = ys.length - 2; y > 0; y--) border.push(y * xs.length);
  for (let i = 0; i < border.length; i++) {
    const a = border[i],
      b = border[(i + 1) % border.length];
    indices.push(a, a + layerSize, b + layerSize, a, b + layerSize, b);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.addGroup(0, frontCount, 0);
  geometry.addGroup(frontCount, indices.length - frontCount, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

/** Authored compass housing, dial and two-part needle, all real selectable volume. */
export function compassProp(width: number, dial: T.Texture) {
  const group = new T.Group();
  const brass = new T.MeshStandardMaterial({ color: 0xbca06b, metalness: 0.85, roughness: 0.3 });
  const housing = new T.Mesh(
    new T.LatheGeometry(
      [
        [0, 0],
        [0.39, 0],
        [0.44, 0.015],
        [0.46, 0.065],
        [0.445, 0.08],
        [0.4, 0.08],
        [0.39, 0.07],
        [0.39, 0.025],
        [0, 0.025],
      ].map(([radius, height]) => new T.Vector2(radius * width, height * width)),
      48,
    ),
    brass,
  );
  housing.rotation.x = Math.PI / 2;
  housing.castShadow = housing.receiveShadow = true;
  group.add(housing);
  const face = new T.Mesh(
    new T.CircleGeometry(width * 0.385, 48),
    new T.MeshStandardMaterial({
      color: 0xffffff,
      map: dial,
      roughness: 0.85,
    }),
  );
  face.position.z = width * 0.071;
  face.receiveShadow = true;
  group.add(face);
  for (const [direction, color] of [
    [1, 0x933f3e],
    [-1, 0xc5cbd0],
  ]) {
    const shape = new T.Shape();
    shape.moveTo(0, direction * width * 0.3);
    shape.lineTo(-width * 0.04, 0);
    shape.lineTo(width * 0.04, 0);
    shape.closePath();
    const needle = new T.Mesh(
      new T.ExtrudeGeometry(shape, {
        depth: width * 0.008,
        bevelEnabled: false,
      }),
      new T.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 }),
    );
    needle.position.z = width * 0.078;
    needle.castShadow = true;
    group.add(needle);
  }
  const pivot = new T.Mesh(new T.SphereGeometry(width * 0.026, 12, 8), brass.clone());
  pivot.position.z = width * 0.085;
  pivot.scale.z = 0.5;
  group.add(pivot);
  const glass = new T.Mesh(
    new T.CircleGeometry(width * 0.389, 48),
    new T.MeshPhysicalMaterial({
      color: 0xc3e0eb,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      side: T.DoubleSide,
    }),
  );
  glass.position.z = width * 0.105;
  group.add(glass);
  return group;
}

/** Authored boot-print volume with a curved heel, instep and cut-out tread.
 * Fits the existing width by 3/4-width placement envelope and +Z support frame.
 * One mesh, no texture, and all thickness remains above the receiving surface.
 */
export function footprintProp(width: number, mirrored = false) {
  const sole = new T.Shape();
  sole.moveTo(-0.1, -0.37);
  sole.bezierCurveTo(-0.19, -0.37, -0.18, -0.27, -0.155, -0.19);
  sole.bezierCurveTo(-0.12, -0.09, -0.15, -0.03, -0.18, 0.08);
  sole.bezierCurveTo(-0.23, 0.24, -0.15, 0.375, -0.04, 0.375);
  sole.bezierCurveTo(0.16, 0.375, 0.21, 0.3, 0.205, 0.18);
  sole.bezierCurveTo(0.2, 0.08, 0.12, 0.02, 0.105, -0.1);
  sole.bezierCurveTo(0.09, -0.18, 0.16, -0.28, 0.1, -0.35);
  sole.bezierCurveTo(0.05, -0.385, -0.05, -0.38, -0.1, -0.37);
  sole.closePath();
  for (const y of [0.05, 0.15, 0.25]) {
    const tread = new T.Path();
    tread.moveTo(-0.12, y + 0.008);
    tread.lineTo(0, y - 0.025);
    tread.lineTo(0.15, y + 0.015);
    tread.lineTo(0.15, y + 0.036);
    tread.lineTo(0, y - 0.006);
    tread.lineTo(-0.12, y + 0.03);
    tread.closePath();
    sole.holes.push(tread);
  }
  for (const y of [-0.3, -0.245]) {
    const tread = new T.Path();
    tread.moveTo(-0.075, y);
    tread.lineTo(0.075, y);
    tread.lineTo(0.075, y + 0.025);
    tread.lineTo(-0.075, y + 0.025);
    tread.closePath();
    sole.holes.push(tread);
  }
  const geometry = new T.ExtrudeGeometry(sole, {
    curveSegments: 8,
    steps: 1,
    depth: 0.006,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.002,
    bevelThickness: 0.001,
  });
  geometry.translate(0, 0, 0.001);
  geometry.scale(width, width * 0.98, width);
  geometry.computeBoundingBox();
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      color: 0x7dcedf,
      emissive: 0x164e68,
      emissiveIntensity: 0.35,
      roughness: 0.65,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  if (mirrored) mesh.scale.x = -1;
  return mesh;
}
