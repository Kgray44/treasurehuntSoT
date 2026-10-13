import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type { Transform, SpatialEntity } from "@/parallax/contracts";
import type { Candidate } from "@/parallax/adaptive";
import { syntheticRoomGeometry, solidFaceRectangles } from "@/parallax/room-geometry";
import { resolveSurfaceSnap, surfaceFrameRotation } from "@/parallax/surface-placement";
import type { RoomFeature } from "@/parallax/environment-contracts";
import type { RoomFeatureTransform } from "@/parallax/room-feature-transform";
import type { EditingGroupMember } from "@/parallax/editing-group-contracts";
import { paperSheetGeometry, compassProp, footprintProp } from "./spatial-props";
import { createRoomMeshLibrary, instanceRoomFurniture, renderedRoomBounds } from "./room-meshes";
import { spatialPropStyle, spatialFootprintSide } from "@/parallax/prop-style";
import { applySpatialOpacity, disposeSpatialOpacity, spatialMaterialOpacities } from "./spatial-opacity";
export type ViewportObject = {
  entity: SpatialEntity;
  world: Transform;
  visible: boolean;
  locked: boolean;
  selectable: boolean;
  highlighted: boolean;
  opacity?: number;
};
export type ViewportState = {
  sceneVersion?: string;
  theme?: "light" | "dark";
  objects: ViewportObject[];
  candidates: Candidate[];
  selected: string | null;
  editingSelection?: {
    members: readonly EditingGroupMember[];
    effects: {
      kind: "ASSET" | "ROOM_FEATURE";
      id: string;
      scaleWithGroup: boolean;
      supportOrigin: Transform["position"] | null;
    }[];
  };
  environmentEditing?: boolean;
  selectedFeature?: string | null;
  environment: {
    id: string;
    width: number;
    depth: number;
    horizontal: boolean;
    vertical: boolean;
    light?: string;
    features?: RoomFeature[];
  };
  tool: "select" | "translate" | "rotate" | "scale";
  space: "world" | "local";
  snap: boolean;
  surfaceClamp: boolean;
  isolateSelected: boolean;
  hideEnvironment?: boolean;
  overlays: boolean;
  adaptive: boolean;
  editable: boolean;
  inspection: boolean;
};
export type RendererReceipt = {
  id: string;
  status: "IN_VIEW" | "HIDDEN" | "TRANSPARENT" | "NO_GEOMETRY" | "OUTSIDE_VIEW" | "OCCLUDED" | "TOO_SMALL";
  materialOpacities: number[];
  position: number[];
  rotation: number[];
  scale: number[];
  bounds: { min: number[]; max: number[] };
};
export type CameraSnapshot = {
  position: number[];
  target: number[];
  projection: "perspective" | "plan";
  extent: number;
};
export type DragPlacementPreview = { clamping: boolean; surfaceId: string | null; surface: string | null };
/** Creator-only synthetic scene. No camera, device observations, imported media or runtime authority. */
export function createWorkstation(
  host: HTMLElement,
  callbacks: {
    select: (id: string, modifiers?: { additive?: boolean; range?: boolean; individual?: boolean }) => void;
    selectFeature?: (id: string, modifiers?: { additive?: boolean; range?: boolean; individual?: boolean }) => void;
    transformSelection?: (delta: Transform, pivot: Transform["position"]) => void;
    transformFeature?: (id: string, pose: RoomFeatureTransform) => void;
    transform: (id: string, world: Transform) => void;
    candidate: (candidate: Candidate, position: Transform["position"]) => void;
    failure: () => void;
    rendered?: (receipts: RendererReceipt[], sceneVersion?: string) => void;
    placementPreview?: (preview: DragPlacementPreview | null) => void;
  },
) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x101722);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.domElement.setAttribute("aria-label", "Interactive synthetic 3D environment");
  renderer.domElement.setAttribute("tabindex", "0");
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  // Finite editable rooms stay visible at every framing distance.
  const perspective = new T.PerspectiveCamera(42, 1, 0.02, 70);
  const orthographic = new T.OrthographicCamera(-4, 4, 4, -4, 0.02, 70);
  let camera: T.PerspectiveCamera | T.OrthographicCamera = perspective;
  let controls: OrbitControls<T.PerspectiveCamera | T.OrthographicCamera> = new OrbitControls(
    camera,
    renderer.domElement,
  );
  controls.mouseButtons.MIDDLE = T.MOUSE.PAN;
  const transform = new TransformControls(camera, renderer.domElement);
  transform.setSize(0.7);
  transform.minY = 0;
  scene.add(transform.getHelper());
  const world = new T.Group(),
    objects = new T.Group(),
    surfaces = new T.Group(),
    highlights = new T.Group();
  scene.add(world, objects, surfaces, highlights);
  scene.add(new T.HemisphereLight(0xe3efff, 0x313238, 2));
  const sunlight = new T.DirectionalLight(0xffedd6, 4);
  sunlight.position.set(-3, 7, 4);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.camera.left = -8;
  sunlight.shadow.camera.right = 8;
  sunlight.shadow.camera.top = 8;
  sunlight.shadow.camera.bottom = -8;
  sunlight.shadow.normalBias = 0.03;
  scene.add(sunlight);
  const fill = new T.DirectionalLight(0x80b5ff, 2);
  fill.position.set(4, 3, -4);
  scene.add(fill);
  const selection = new T.BoxHelper(new T.Object3D(), 0x91ecdd);
  selection.visible = false;
  scene.add(selection);
  const groupProxy = new T.Object3D();
  groupProxy.userData.groupProxy = true;
  scene.add(groupProxy);
  const groupBox = new T.Box3Helper(new T.Box3(), 0x91baff);
  groupBox.visible = false;
  scene.add(groupBox);
  let groupGesture: {
    pivot: T.Vector3;
    inverse: T.Matrix4;
    items: {
      root: T.Object3D;
      world: T.Matrix4;
      local: T.Matrix4;
      scaleWithGroup: boolean;
      supportOrigin: T.Vector3 | null;
    }[];
  } | null = null;
  const groupRoot = (member: { kind: "ASSET" | "ROOM_FEATURE"; id: string }) =>
    member.kind === "ASSET"
      ? objects.children.find((object) => object.userData.entityId === member.id)
      : world.children.find((object) => object.userData.featureRoot && object.userData.featureId === member.id);
  const groupBounds = () => {
    const bounds = new T.Box3();
    for (const member of state?.editingSelection?.members ?? []) {
      const root = groupRoot(member);
      if (root) bounds.union(new T.Box3().setFromObject(root));
    }
    return bounds;
  };
  const applyGroupGesture = () => {
    if (!groupGesture) return;
    if (state?.tool === "scale") {
      const scale = [groupProxy.scale.x, groupProxy.scale.y, groupProxy.scale.z].sort(
        (a, b) => Math.abs(b - 1) - Math.abs(a - 1),
      )[0];
      groupProxy.scale.setScalar(Math.max(0.01, Math.min(10, scale)));
    }
    groupProxy.updateMatrixWorld(true);
    const delta = groupProxy.matrixWorld.clone().multiply(groupGesture.inverse);
    const shift = new T.Vector3(),
      rotation = new T.Quaternion(),
      size = new T.Vector3();
    delta.decompose(shift, rotation, size);
    for (const item of groupGesture.items) {
      let next = delta.clone().multiply(item.world);
      if (!item.scaleWithGroup && item.supportOrigin) {
        const position = new T.Vector3(),
          beforeRotation = new T.Quaternion(),
          beforeScale = new T.Vector3();
        item.world.decompose(position, beforeRotation, beforeScale);
        position.sub(item.supportOrigin).applyQuaternion(rotation).add(item.supportOrigin.clone().applyMatrix4(delta));
        next = new T.Matrix4().compose(position, rotation.clone().multiply(beforeRotation), beforeScale);
      }
      if (item.root.parent) next.premultiply(item.root.parent.matrixWorld.clone().invert());
      next.decompose(item.root.position, item.root.quaternion, item.root.scale);
      item.root.updateMatrixWorld(true);
    }
    groupBox.box.copy(groupBounds());
    dirty = true;
  };
  const previewPlane = new T.PlaneGeometry(1, 0.75);
  const placementOutline = new T.LineSegments(
    new T.EdgesGeometry(previewPlane),
    new T.LineBasicMaterial({ color: 0x75aaff, depthTest: false }),
  );
  previewPlane.dispose();
  placementOutline.visible = false;
  placementOutline.renderOrder = 10;
  scene.add(placementOutline);
  let dragTarget: ReturnType<typeof resolveSurfaceSnap> = null;
  let previewKey: string | null = null;
  const showDragPreview = (preview: DragPlacementPreview | null) => {
    const key = preview ? JSON.stringify(preview) : null;
    if (key !== previewKey) {
      previewKey = key;
      callbacks.placementPreview?.(preview);
    }
    if (preview) host.dataset.dragPlacement = key!;
    else delete host.dataset.dragPlacement;
    surfaces.visible = Boolean(state?.overlays || preview?.surfaceId);
    for (const mesh of surfaces.children as T.Mesh[]) {
      const target = mesh.userData.candidate.id === preview?.surfaceId;
      mesh.visible = Boolean(state?.overlays || target);
      const material = mesh.material as T.MeshBasicMaterial;
      material.color.setHex(target ? 0x629bff : mesh.userData.candidate.safe ? 0x57d8c5 : 0xe8847c);
      material.opacity = target ? 0.3 : 0.15;
    }
    dirty = true;
  };
  const raycaster = new T.Raycaster(),
    pointer = new T.Vector2();
  raycaster.params.Line.threshold = 0.02;
  let state: ViewportState | null = null,
    disposed = false,
    dirty = true,
    frame = 0;
  let environmentKey = "",
    objectKey = "",
    down: { x: number; y: number } | null = null;
  const roomMeshLibrary = createRoomMeshLibrary();
  const objectDefinitions = new Map<string, string>();
  let objectBuildCount = 0;
  const disposeGroup = (group: T.Object3D) => {
    disposeSpatialOpacity(group);
    group.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        if (o instanceof T.InstancedMesh) o.dispose();
        if (!o.geometry.userData.roomShared) o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) {
          if (!m.userData.roomShared) {
            if ("map" in m && m.map instanceof T.Texture) m.map.dispose();
            m.dispose();
          }
        }
      }
    });
    group.clear();
  };
  const buildRoom = (s: ViewportState) => {
    if (transform.object?.userData.featureId) transform.detach();
    disposeGroup(world);
    disposeGroup(surfaces);
    const { width: w, depth: d } = s.environment;
    const light = s.theme === "light";
    for (const g of syntheticRoomGeometry(s.environment)) {
      if (g.classification === "EXCLUSION_ZONE" && !s.environmentEditing) continue;
      const group = new T.Group();
      group.position.set(...g.position);
      if (g.rotation) group.quaternion.set(g.rotation.x, g.rotation.y, g.rotation.z, g.rotation.w);
      group.userData.featureId = g.featureId;
      group.userData.roomPartId = g.id;
      group.userData.classification = g.classification;
      world.add(group);
      const color = (light ? g.lightColor : g.color) ?? (g.surface === "FLOOR" ? 0x8797a8 : 0xc1cbd7);
      if (g.shape === "WINDOW") {
        const [width, height, depth] = g.size;
        const border = Math.min(width, height) * 0.055;
        const frameColor = light ? 0xe3e9ef : 0x748498;
        for (const side of [-1, 1]) {
          group.add(
            roomMeshLibrary.mesh(
              "BOX",
              [border, height, depth],
              [(side * (width - border)) / 2, 0, 0],
              frameColor,
              "WOOD",
            ),
          );
          group.add(
            roomMeshLibrary.mesh(
              "BOX",
              [width - border * 2, border, depth],
              [0, (side * (height - border)) / 2, 0],
              frameColor,
              "WOOD",
            ),
          );
        }
        group.add(
          roomMeshLibrary.glass([width - border * 2, height - border * 2, depth * 0.08], [0, 0, depth * 0.2], color),
        );
        group.add(
          roomMeshLibrary.mesh(
            "BOX",
            [border * 0.6, height - border * 2, depth * 0.25],
            [0, 0, depth * 0.3],
            frameColor,
          ),
        );
      } else if (g.openings?.length) {
        for (const rect of solidFaceRectangles(g.size[0], g.size[1], g.openings))
          group.add(roomMeshLibrary.mesh("BOX", [rect.width, rect.depth, g.size[2]], [rect.x, rect.y, 0], color));
      } else roomMeshLibrary.build(group, g, color);
    }
    if (s.environmentEditing) {
      // Keep complete feature assemblies under their semantic pivot while editing.
      // Normal viewing retains furnishing instancing and its lower draw-call cost.
      for (const feature of s.environment.features ?? []) {
        const root = new T.Group();
        root.userData.featureId = feature.id;
        root.userData.featureRoot = true;
        root.position.set(feature.position.x, feature.position.y, feature.position.z);
        root.rotation.y = (feature.yawDegrees * Math.PI) / 180;
        world.add(root);
        world.updateMatrixWorld(true);
        for (const part of [...world.children]) {
          if (part !== root && part.userData.featureId === feature.id) root.attach(part);
        }
      }
    } else instanceRoomFurniture(world);
    if (s.inspection) {
      const grid = new T.GridHelper(
        Math.max(w, d),
        Math.ceil(Math.max(w, d) * 2),
        light ? 0x6b8bae : 0x647487,
        light ? 0xabc0d6 : 0x344352,
      );
      grid.position.y = 0.012;
      world.add(grid);
    }
    sunlight.intensity = "light" in s.environment && s.environment.light === "LOW" ? 2.5 : 4;
    for (const c of s.candidates.filter((c) => c.surface !== "OPEN_SPACE" && c.id !== "unsafe-walkway")) {
      const face = new T.BufferGeometry();
      const vertices = solidFaceRectangles(c.widthMeters, c.depthMeters, c.exclusions ?? []).flatMap((rect) => {
        const x1 = rect.x - rect.width / 2,
          x2 = rect.x + rect.width / 2;
        const y1 = rect.y - rect.depth / 2,
          y2 = rect.y + rect.depth / 2;
        return [x1, y1, 0, x2, y1, 0, x2, y2, 0, x1, y1, 0, x2, y2, 0, x1, y2, 0];
      });
      face.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
      const mesh = new T.Mesh(
        face,
        new T.MeshBasicMaterial({
          color: c.safe ? 0x57d8c5 : 0xe8847c,
          transparent: true,
          opacity: 0.15,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.position.set(
        c.position.x + c.normal.x * 0.018,
        c.position.y + c.normal.y * 0.018,
        c.position.z + c.normal.z * 0.018,
      );
      const orientation = surfaceFrameRotation(c);
      mesh.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
      mesh.userData.candidate = c;
      const border = new T.LineSegments(
        new T.EdgesGeometry(mesh.geometry),
        new T.LineBasicMaterial({ color: c.safe ? 0x63dbc9 : 0xe8847c, transparent: true, opacity: 0.6 }),
      );
      mesh.add(border);
      surfaces.add(mesh);
    }
  };
  const paperTexture = (e: SpatialEntity) => {
    const canvas = document.createElement("canvas");
    const resolution = e.kind === "PARCHMENT" ? 2 : 1;
    canvas.width = 512 * resolution;
    canvas.height = 384 * resolution;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(resolution, resolution);
    ctx.fillStyle = e.kind === "TEXT" ? "#283644" : "#e4d6b5";
    ctx.fillRect(0, 0, 512, 384);
    // Paper remains physically shaded. Its ink needs enough headroom under
    // the room lights and filmic tone mapping to remain readable when framed.
    ctx.strokeStyle = e.kind === "TEXT" ? "#86ead9" : "#281b0f";
    ctx.lineWidth = e.kind === "TEXT" ? 2 : 3;
    ctx.strokeRect(18, 18, 476, 348);
    if (spatialPropStyle(e) === "MAP") {
      ctx.beginPath();
      ctx.moveTo(44, 200);
      ctx.bezierCurveTo(170, 20, 80, 220, 220, 90);
      ctx.bezierCurveTo(340, 5, 310, 320, 420, 230);
      ctx.bezierCurveTo(330, 370, 160, 270, 44, 200);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(30, 35 + i * 40);
        ctx.lineTo(480, 35 + i * 40);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(395, 95, 34, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(395, 95);
        ctx.lineTo(395 + Math.sin((i * Math.PI) / 4) * 30, 95 + Math.cos((i * Math.PI) / 4) * 30);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = e.kind === "TEXT" ? "#d7f7ef" : "#080504";
      ctx.font = e.kind === "TEXT" ? "24px serif" : "600 32px serif";
      const words = e.content.split(/\s+/);
      let line = "",
        y = 80;
      for (const word of words.slice(0, 75)) {
        if (ctx.measureText(line + word).width > 415) {
          ctx.fillText(line, 45, y);
          line = "";
          y += e.kind === "TEXT" ? 34 : 40;
        }
        line += word + " ";
      }
      ctx.fillText(line, 45, y);
    }
    ctx.fillStyle = e.kind === "TEXT" ? "#86ead9" : "#20150c";
    ctx.font = e.kind === "TEXT" ? "16px sans-serif" : "500 20px sans-serif";
    ctx.fillText(e.name.slice(0, 35), 35, 345);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  };
  const buildObjects = (s: ViewportState) => {
    const remove = (id: string) => {
      for (const collection of [objects, highlights]) {
        const existing = collection.children.find((object) => object.userData.entityId === id);
        if (existing) {
          if (transform.object === existing) transform.detach();
          collection.remove(existing);
          disposeGroup(existing);
        }
      }
      objectDefinitions.delete(id);
    };
    for (const id of objectDefinitions.keys()) if (!s.objects.some((object) => object.entity.id === id)) remove(id);
    for (const { entity: e } of s.objects) {
      const definition = JSON.stringify([e.kind, e.propStyle, e.footprintSide, e.name, e.widthMeters, e.content]);
      if (objectDefinitions.get(e.id) === definition) continue;
      remove(e.id);
      objectDefinitions.set(e.id, definition);
      host.dataset.objectBuildCount = String(++objectBuildCount);
      const group = new T.Group();
      group.userData.entityId = e.id;
      const w = e.widthMeters;
      if (e.kind === "MARKER") {
        if (spatialPropStyle(e) === "FOOTPRINT") {
          group.add(footprintProp(w, spatialFootprintSide(e) === "RIGHT"));
        } else {
          const dial = document.createElement("canvas");
          dial.width = dial.height = 512;
          const ctx = dial.getContext("2d")!;
          ctx.fillStyle = "#eee5cf";
          ctx.fillRect(0, 0, 512, 512);
          ctx.strokeStyle = "#514b3f";
          for (let i = 0; i < 60; i++) {
            const angle = (i * Math.PI) / 30,
              inner = i % 5 === 0 ? 185 : 202;
            ctx.lineWidth = i % 5 === 0 ? 3 : 1.5;
            ctx.beginPath();
            ctx.moveTo(256 + Math.sin(angle) * inner, 256 - Math.cos(angle) * inner);
            ctx.lineTo(256 + Math.sin(angle) * 220, 256 - Math.cos(angle) * 220);
            ctx.stroke();
          }
          ctx.font = "bold 42px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (const [label, x, y] of [
            ["N", 256, 100],
            ["E", 412, 256],
            ["S", 256, 412],
            ["W", 100, 256],
          ] as const) {
            ctx.fillStyle = label === "N" ? "#933f3e" : "#514b3f";
            ctx.fillText(label, x, y);
          }
          const texture = new T.CanvasTexture(dial);
          texture.colorSpace = T.SRGBColorSpace;
          group.add(compassProp(w, texture));
        }
      } else {
        const mat = new T.MeshStandardMaterial({
          color: 0xffffff,
          map: paperTexture(e),
          side: T.DoubleSide,
          roughness: 0.9,
        });
        const mesh =
          e.kind === "PARCHMENT"
            ? new T.Mesh(paperSheetGeometry(w, spatialPropStyle(e) === "LETTER"), [
                mat,
                new T.MeshStandardMaterial({ color: 0xcbb990, roughness: 0.95 }),
              ])
            : new T.Mesh(new T.PlaneGeometry(w, w * 0.75), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      objects.add(group);
      const highlight = new T.BoxHelper(group, 0xe8c3ff);
      highlight.userData.entityId = e.id;
      highlight.visible = false;
      highlights.add(highlight);
    }
  };
  const update = (s: ViewportState) => {
    const roomChanged = state?.environment.id !== s.environment.id;
    state = s;
    const light = s.theme === "light";
    const outdoor = ["trail", "plaza"].includes(s.environment.id);
    renderer.setClearColor(outdoor ? (light ? 0xcde4ed : 0x4b637b) : light ? 0xeaf1f9 : 0x101722);
    (selection.material as T.LineBasicMaterial).color.setHex(light ? 0x175cd3 : 0x91baff);
    host.dataset.appearance = light ? "light" : "dark";
    const nextEnvironment = JSON.stringify([s.environment, s.candidates, s.theme, s.inspection, s.environmentEditing]);
    if (nextEnvironment !== environmentKey) {
      environmentKey = nextEnvironment;
      buildRoom(s);
    }
    const nextObjects = JSON.stringify(
      s.objects.map((o) => [
        o.entity.id,
        o.entity.kind,
        o.entity.propStyle,
        o.entity.footprintSide,
        o.entity.name,
        o.entity.widthMeters,
        o.entity.content,
      ]),
    );
    if (nextObjects !== objectKey) {
      objectKey = nextObjects;
      buildObjects(s);
    }
    for (const obj of objects.children) {
      const o = s.objects.find((o) => o.entity.id === obj.userData.entityId)!;
      obj.visible = o.visible;
      applySpatialOpacity(obj, o.opacity);
      if (!transform.dragging) {
        obj.position.set(o.world.position.x, o.world.position.y, o.world.position.z);
        obj.quaternion.set(o.world.rotation.x, o.world.rotation.y, o.world.rotation.z, o.world.rotation.w);
        obj.scale.setScalar(o.world.scale);
      }
      const highlight = highlights.children.find((h) => h.userData.entityId === o.entity.id) as T.BoxHelper;
      highlight.visible = o.visible && o.highlighted;
      if (highlight.visible) highlight.setFromObject(obj);
    }
    if (roomChanged) resetView();
    showDragPreview(previewKey ? JSON.parse(previewKey) : null);
    world.visible = (s.environmentEditing || !s.isolateSelected) && !s.hideEnvironment;
    if (s.isolateSelected)
      for (const object of objects.children)
        object.visible =
          object.visible &&
          (s.editingSelection
            ? s.editingSelection.effects.some(
                (effect) => effect.kind === "ASSET" && effect.id === object.userData.entityId,
              )
            : object.userData.entityId === s.selected);
    const featureObject = s.environmentEditing
      ? world.children.find((o) => o.userData.featureRoot && o.userData.featureId === s.selectedFeature)
      : undefined;
    if (!transform.dragging) {
      for (const root of world.children.filter((object) => object.userData.featureRoot)) {
        const feature = s.environment.features?.find((entry) => entry.id === root.userData.featureId);
        if (!feature) continue;
        root.position.set(feature.position.x, feature.position.y, feature.position.z);
        root.rotation.set(0, (feature.yawDegrees * Math.PI) / 180, 0);
        root.scale.setScalar(1);
      }
    }
    const grouped = Boolean(s.editingSelection?.members.length);
    if (grouped && !transform.dragging) {
      const positions = s
        .editingSelection!.members.map((member) => groupRoot(member)?.getWorldPosition(new T.Vector3()))
        .filter((value): value is T.Vector3 => Boolean(value));
      const center = positions
        .reduce((sum, position) => sum.add(position), new T.Vector3())
        .multiplyScalar(1 / Math.max(1, positions.length));
      groupProxy.position.copy(center);
      groupProxy.quaternion.identity();
      groupProxy.scale.setScalar(1);
      groupProxy.updateMatrixWorld(true);
    }
    groupBox.visible = grouped;
    if (grouped) groupBox.box.copy(groupBounds());
    const selectedObject =
      (grouped ? groupProxy : undefined) ??
      featureObject ??
      (!s.environmentEditing ? objects.children.find((o) => o.userData.entityId === s.selected) : undefined);
    const selected = s.objects.find((o) => o.entity.id === s.selected);
    selection.visible = !grouped && !!selectedObject && (Boolean(featureObject) || !!selected?.visible);
    if (selectedObject && !grouped) selection.setFromObject(selectedObject);
    transform.setSpace(s.space);
    transform.setTranslationSnap(s.snap ? 0.05 : null);
    transform.setRotationSnap(s.snap ? Math.PI / 12 : null);
    transform.setScaleSnap(s.snap ? 0.05 : null);
    const upright =
      Boolean(featureObject) || Boolean(s.editingSelection?.members.some((member) => member.kind === "ROOM_FEATURE"));
    transform.showX = transform.showZ = !(upright && s.tool === "rotate");
    transform.showY = true;
    transform.minY = featureObject ? -20 : 0;
    if (
      selectedObject &&
      (grouped
        ? !s.editingSelection!.effects.some(
            (effect) =>
              effect.scaleWithGroup &&
              effect.kind === "ASSET" &&
              s.objects.some((object) => object.entity.id === effect.id && object.locked),
          )
        : featureObject || (selected?.visible && !selected.locked && selected.selectable)) &&
      s.editable &&
      s.tool !== "select" &&
      !(
        s.adaptive &&
        (grouped
          ? s.editingSelection!.members.some((member) => member.kind === "ASSET")
          : !featureObject && s.tool === "translate")
      )
    ) {
      transform.setMode(s.tool);
      transform.attach(selectedObject);
    } else transform.detach();
    dirty = true;
  };
  controls.enableDamping = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 0.4;
  controls.maxDistance = 25;
  const invalidate = () => {
    dirty = true;
  };
  controls.addEventListener("change", invalidate);
  transform.addEventListener("change", invalidate);
  transform.addEventListener("mouseDown", () => {
    if (transform.object !== groupProxy || !state?.editingSelection) return;
    scene.updateMatrixWorld(true);
    groupGesture = {
      pivot: groupProxy.position.clone(),
      inverse: groupProxy.matrixWorld.clone().invert(),
      items: state.editingSelection.effects.flatMap((effect) => {
        const root = groupRoot(effect);
        if (!root) return [];
        return [
          {
            root,
            world: root.matrixWorld.clone(),
            local: root.matrix.clone(),
            scaleWithGroup: effect.scaleWithGroup,
            supportOrigin: effect.supportOrigin
              ? new T.Vector3(effect.supportOrigin.x, effect.supportOrigin.y, effect.supportOrigin.z)
              : null,
          },
        ];
      }),
    };
  });
  transform.addEventListener("dragging-changed", (e) => {
    controls.enabled = !e.value;
    if (!e.value) {
      dragTarget = null;
      placementOutline.visible = false;
      showDragPreview(null);
    }
  });
  transform.addEventListener("objectChange", () => {
    const obj = transform.object;
    if (obj === groupProxy && transform.dragging) {
      applyGroupGesture();
      return;
    }
    if (!state || !obj || state.tool !== "translate" || !transform.dragging) return;
    if (obj.userData.featureRoot) return;
    const entity = state.objects.find((o) => o.entity.id === obj.userData.entityId)!;
    dragTarget =
      state.surfaceClamp && !state.adaptive
        ? resolveSurfaceSnap(
            {
              position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
              rotation: { x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w },
              scale: entity.world.scale,
            },
            state.candidates,
            entity.entity.widthMeters,
            dragTarget?.candidate.id,
          )
        : null;
    placementOutline.visible = Boolean(dragTarget);
    if (dragTarget) {
      const pose = dragTarget.transform;
      placementOutline.position.set(pose.position.x, pose.position.y, pose.position.z);
      placementOutline.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
      placementOutline.scale.setScalar(entity.entity.widthMeters * pose.scale);
    }
    showDragPreview({
      clamping: state.surfaceClamp,
      surfaceId: dragTarget?.candidate.id ?? null,
      surface: dragTarget?.candidate.surface ?? null,
    });
  });
  transform.addEventListener("mouseUp", () => {
    if (cameraGesture) return;
    const obj = transform.object;
    if (!obj || !state) return;
    if (obj === groupProxy && groupGesture) {
      const pivot = groupGesture.pivot;
      callbacks.transformSelection?.(
        {
          position: {
            x: groupProxy.position.x - pivot.x,
            y: groupProxy.position.y - pivot.y,
            z: groupProxy.position.z - pivot.z,
          },
          rotation: {
            x: groupProxy.quaternion.x,
            y: groupProxy.quaternion.y,
            z: groupProxy.quaternion.z,
            w: groupProxy.quaternion.w,
          },
          scale: groupProxy.scale.x,
        },
        { x: pivot.x, y: pivot.y, z: pivot.z },
      );
      groupGesture = null;
      return;
    }
    if (obj.userData.featureRoot) {
      callbacks.transformFeature?.(obj.userData.featureId, {
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        yawDegrees: (new T.Euler().setFromQuaternion(obj.quaternion, "YXZ").y * 180) / Math.PI,
        scale: [obj.scale.x, obj.scale.y, obj.scale.z].sort((a, b) => Math.abs(b - 1) - Math.abs(a - 1))[0],
      });
      dirty = true;
      return;
    }
    const old = state.objects.find((o) => o.entity.id === obj.userData.entityId)!;
    const changedScale = [obj.scale.x, obj.scale.y, obj.scale.z].sort(
      (a, b) => Math.abs(b - old.world.scale) - Math.abs(a - old.world.scale),
    )[0];
    const world = {
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w },
      scale: state.tool === "scale" ? Math.max(0.01, Math.min(10, changedScale)) : old.world.scale,
    };
    const snapped =
      state.surfaceClamp && state.tool === "translate" && !state.adaptive
        ? resolveSurfaceSnap(world, state.candidates, old.entity.widthMeters, dragTarget?.candidate.id)
        : null;
    if (snapped) {
      callbacks.candidate(snapped.candidate, snapped.transform.position);
      return;
    }
    callbacks.transform(obj.userData.entityId, world);
  });
  let cameraGesture = false;
  const pickRoomFeature = (): string | null => {
    const visible = (object: T.Object3D): boolean => object.visible && (!object.parent || visible(object.parent));
    for (const hit of raycaster.intersectObjects(world.children, true)) {
      if (!visible(hit.object)) continue;
      if (hit.object instanceof T.InstancedMesh && hit.instanceId !== undefined)
        return hit.object.userData.roomInstances?.[hit.instanceId]?.featureId ?? null;
      let root = hit.object;
      while (!root.userData.featureId && root.parent) root = root.parent;
      if (root.userData.featureId) return root.userData.featureId;
    }
    return null;
  };
  const pointDown = (e: PointerEvent) => {
    cameraGesture = e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey || e.shiftKey));
    if (cameraGesture) transform.enabled = false;
    down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
  };
  const pointUp = (e: PointerEvent) => {
    if (cameraGesture) {
      cameraGesture = false;
      transform.enabled = true;
    }
    if (!state || !down || transform.axis || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
      down = null;
      return;
    }
    down = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, (-(e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (
      state.environmentEditing &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      !e.altKey &&
      !state.editingSelection?.members.some((member) => member.kind === "ASSET")
    ) {
      const featureId = pickRoomFeature();
      if (featureId) callbacks.selectFeature?.(featureId);
      return;
    }
    const visible = (object: T.Object3D): boolean => object.visible && (!object.parent || visible(object.parent));
    const hit = raycaster.intersectObjects(objects.children, true).find((hit) => {
      if (!visible(hit.object)) return false;
      let root = hit.object;
      while (!root.userData.entityId && root.parent) root = root.parent;
      return state?.objects.find((object) => object.entity.id === root.userData.entityId)?.selectable;
    });
    if (hit) {
      let root: T.Object3D = hit.object;
      while (!root.userData.entityId && root.parent) root = root.parent;
      if (state.objects.find((o) => o.entity.id === root.userData.entityId)?.selectable)
        callbacks.select(root.userData.entityId, {
          additive: e.ctrlKey || e.metaKey,
          range: e.shiftKey,
          individual: e.altKey,
        });
      return;
    }
    if (state.environmentEditing) {
      const featureId = pickRoomFeature();
      if (featureId)
        callbacks.selectFeature?.(featureId, {
          additive: e.ctrlKey || e.metaKey,
          range: e.shiftKey,
          individual: e.altKey,
        });
      return;
    }
    if (state.editable && state.selected) {
      const surface = raycaster.intersectObjects(surfaces.children).find((hit) => {
        const candidate = hit.object.userData.candidate as Candidate | undefined;
        if (!candidate?.safe) return false;
        let part: T.Object3D | undefined;
        world.traverse((object) => {
          if (object.userData.roomPartId === candidate.id) part = object;
        });
        // Pick actual visible room faces, excluding camera-facing cutaway walls.
        return Boolean(part && visible(part));
      });
      if (surface)
        callbacks.candidate(surface.object.userData.candidate, {
          x: surface.point.x,
          y: surface.point.y,
          z: surface.point.z,
        });
    }
  };
  const cancelPointer = () => {
    if (transform.dragging) {
      if (groupGesture) {
        for (const item of groupGesture.items) {
          item.local.decompose(item.root.position, item.root.quaternion, item.root.scale);
          item.root.updateMatrixWorld(true);
        }
        groupProxy.position.copy(groupGesture.pivot);
        groupProxy.quaternion.identity();
        groupProxy.scale.setScalar(1);
        groupGesture = null;
      }
      const obj = transform.object;
      const original = state?.objects.find((o) => o.entity.id === obj?.userData.entityId)?.world;
      const feature = state?.environment.features?.find((entry) => entry.id === obj?.userData.featureId);
      if (obj?.userData.featureRoot && feature) {
        obj.position.set(feature.position.x, feature.position.y, feature.position.z);
        obj.rotation.set(0, (feature.yawDegrees * Math.PI) / 180, 0);
        obj.scale.setScalar(1);
      }
      if (obj && original) {
        obj.position.set(original.position.x, original.position.y, original.position.z);
        obj.quaternion.set(original.rotation.x, original.rotation.y, original.rotation.z, original.rotation.w);
        obj.scale.setScalar(original.scale);
      }
      transform.dragging = false;
      transform.axis = null;
    }
    dragTarget = null;
    placementOutline.visible = false;
    showDragPreview(null);
    cameraGesture = false;
    down = null;
    transform.enabled = true;
    controls.enabled = true;
    dirty = true;
  };
  renderer.domElement.addEventListener("pointerdown", pointDown, true);
  renderer.domElement.addEventListener("pointerup", pointUp);
  renderer.domElement.addEventListener("pointercancel", cancelPointer);
  renderer.domElement.addEventListener("lostpointercapture", cancelPointer);
  const cancelKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && transform.dragging) {
      event.preventDefault();
      event.stopPropagation();
      cancelPointer();
      dirty = true;
    }
  };
  window.addEventListener("keydown", cancelKey, true);
  let rendererFailed = false;
  const contextLost = (e: Event) => {
    e.preventDefault();
    rendererFailed = true;
    host.dataset.rendered = "false";
    delete host.dataset.sceneReceipt;
    delete host.dataset.roomReceipt;
    delete host.dataset.cutawayParts;
    callbacks.rendered?.([]);
    callbacks.failure();
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const resize = () => {
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h);
    perspective.aspect = w / h;
    perspective.updateProjectionMatrix();
    orthographic.left = (-orthographic.top * w) / h;
    orthographic.right = (orthographic.top * w) / h;
    orthographic.updateProjectionMatrix();
    dirty = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const resetView = (view = "perspective", sequence?: Transform[]) => {
    const chosen = state?.environmentEditing
      ? world.children.find((o) => o.userData.featureRoot && o.userData.featureId === state?.selectedFeature)
      : objects.children.find((o) => o.userData.entityId === state?.selected);
    const bounds = state?.editingSelection?.members.length
      ? groupBounds()
      : chosen
        ? new T.Box3().setFromObject(chosen)
        : null;
    if (chosen && bounds && sequence?.length) {
      const original = {
        position: chosen.position.clone(),
        quaternion: chosen.quaternion.clone(),
        scale: chosen.scale.clone(),
      };
      for (const pose of sequence) {
        chosen.position.set(pose.position.x, pose.position.y, pose.position.z);
        chosen.quaternion.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w);
        chosen.scale.setScalar(pose.scale);
        chosen.updateMatrixWorld(true);
        bounds.union(new T.Box3().setFromObject(chosen));
      }
      chosen.position.copy(original.position);
      chosen.quaternion.copy(original.quaternion);
      chosen.scale.copy(original.scale);
      chosen.updateMatrixWorld(true);
    }
    const sphere = bounds?.getBoundingSphere(new T.Sphere());
    const target = ["selection", "sequence"].includes(view) && sphere ? sphere.center : new T.Vector3(0, 0.65, 0);
    const span = Math.max(state?.environment.width ?? 4, state?.environment.depth ?? 4);
    const framing =
      ["selection", "sequence"].includes(view) && sphere
        ? Math.max(
            0.00001,
            (sphere.radius * 1.5) /
              (Math.sin((perspective.fov * Math.PI) / 360) * Math.min(1, perspective.aspect) * 6.49),
          )
        : Math.max(1, span / 4) * 1.3 * Math.max(1, 1 / perspective.aspect);
    orthographic.top = Math.max(4, span * 0.65);
    orthographic.bottom = -orthographic.top;
    orthographic.left = -orthographic.top * perspective.aspect;
    orthographic.right = orthographic.top * perspective.aspect;
    orthographic.updateProjectionMatrix();
    camera = view === "plan" ? orthographic : perspective;
    controls.dispose();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons.MIDDLE = T.MOUSE.PAN;
    controls.enableDamping = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.dampingFactor = 0.12;
    controls.minDistance =
      ["selection", "sequence"].includes(view) && sphere ? Math.max(0.00001, sphere.radius * 0.25) : 0.1;
    perspective.near =
      ["selection", "sequence"].includes(view) && sphere
        ? Math.max(0.000001, Math.min(0.02, sphere.radius / 10))
        : 0.02;
    controls.maxDistance = Math.max(25, span * 6, framing * 8);
    perspective.far = orthographic.far = controls.maxDistance + span * 2;
    perspective.updateProjectionMatrix();
    orthographic.updateProjectionMatrix();
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.copy(target);
    camera.position
      .copy(target)
      .add(
        view === "plan"
          ? new T.Vector3(0.01, Math.max(9, span * 1.4), 0.01)
          : view === "front"
            ? new T.Vector3(0, 2 * framing, 7 * framing)
            : new T.Vector3(3.8 * framing, 2.9 * framing, 4.4 * framing),
      );
    controls.update();
    controls.addEventListener("change", invalidate);
    transform.camera = camera;
    dirty = true;
  };
  resetView();
  let receiptKey = "";
  const reportRenderedObjects = () => {
    const frustum = new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    const receipts: RendererReceipt[] = objects.children.map((object) => {
      const bounds = new T.Box3().setFromObject(object);
      const materialOpacities = spatialMaterialOpacities(object);
      let status: RendererReceipt["status"] = !object.visible
        ? "HIDDEN"
        : materialOpacities.length && materialOpacities.every((value) => value === 0)
          ? "TRANSPARENT"
          : bounds.isEmpty()
            ? "NO_GEOMETRY"
            : !frustum.intersectsBox(bounds)
              ? "OUTSIDE_VIEW"
              : "IN_VIEW";
      if (status === "IN_VIEW") {
        const center = bounds.getCenter(new T.Vector3());
        const samples = [center, ...[bounds.min, bounds.max].map((p) => p.clone().lerp(center, 0.2))];
        const obstructed = samples.every((point) => {
          const direction = point.clone().sub(camera.position),
            distance = direction.length();
          const probe = new T.Raycaster(camera.position, direction.normalize(), 0, distance - 0.01);
          return probe
            .intersectObjects([...(world.visible ? world.children : []), ...objects.children], true)
            .some((hit) => {
              let root = hit.object;
              while (root.parent && root.parent !== objects && root.parent !== world) root = root.parent;
              if (root === object || !root.visible || !(hit.object instanceof T.Mesh)) return false;
              const materials = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material];
              return materials.some((m) => m.visible && m.opacity >= 0.5);
            });
        });
        if (obstructed) status = "OCCLUDED";
        else {
          const near = bounds.min.clone().project(camera),
            far = bounds.max.clone().project(camera);
          if (Math.max(Math.abs(near.x - far.x) * host.clientWidth, Math.abs(near.y - far.y) * host.clientHeight) < 6)
            status = "TOO_SMALL";
        }
      }
      return {
        id: object.userData.entityId,
        status,
        materialOpacities,
        position: object.position.toArray(),
        rotation: object.quaternion.toArray(),
        scale: object.scale.toArray(),
        bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      };
    });
    const serialized = JSON.stringify(receipts);
    const key = `${state?.sceneVersion ?? ""}:${serialized}`;
    host.dataset.sceneReceipt = serialized;
    if (key !== receiptKey) {
      receiptKey = key;
      callbacks.rendered?.(receipts, state?.sceneVersion);
    }
  };
  const animate = () => {
    if (disposed || rendererFailed) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden) return;
    controls.update();
    if (dirty) {
      // Display-only cutaway: retain every wall/ceiling and its placement surfaces
      // while opening the camera-facing shell so Creators can see inside.
      const cutawayParts: string[] = [];
      world.traverse((part) => {
        if (!part.userData.roomPartId) return;
        const classification = part.userData.classification;
        if (!["WALL", "CEILING", "DOOR", "WINDOW"].includes(classification)) return;
        const position = part.getWorldPosition(new T.Vector3());
        const inward = new T.Vector3(0, 0, 1).applyQuaternion(part.getWorldQuaternion(new T.Quaternion()));
        const outside =
          classification === "CEILING"
            ? camera.position.y > position.y
            : camera.position.clone().sub(position).dot(inward) < -0.01;
        part.visible =
          !outside || Boolean(state?.environmentEditing && part.userData.featureId === state.selectedFeature);
        if (outside) cutawayParts.push(part.userData.roomPartId);
      });
      host.dataset.cutawayParts = JSON.stringify(cutawayParts);
      if (groupBox.visible) groupBox.box.copy(groupBounds());
      if (selection.visible && state && (state.selected || state.selectedFeature)) {
        const obj = state.environmentEditing
          ? world.children.find((o) => o.userData.featureRoot && o.userData.featureId === state!.selectedFeature)
          : objects.children.find((o) => o.userData.entityId === state!.selected);
        if (obj) selection.setFromObject(obj);
      }
      const renderStart = performance.now();
      renderer.render(scene, camera);
      host.dataset.renderCosts = JSON.stringify({
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        cpuSubmitMs: performance.now() - renderStart,
        pixelRatio: renderer.getPixelRatio(),
        width: renderer.domElement.width,
        height: renderer.domElement.height,
      });
      reportRenderedObjects();
      host.dataset.roomReceipt = JSON.stringify(renderedRoomBounds(world));
      host.dataset.rendered = "true";
      // Read-only Engineering instruments describe this synthetic viewport, never native tracking.
      if (state?.inspection) {
        const project = (point: T.Vector3) => {
          const p = point.clone().project(camera);
          return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
        };
        const handles: Record<string, { x: number; y: number }> = {};
        const visible = (o: T.Object3D): boolean => o.visible && (!o.parent || visible(o.parent));
        transform.getHelper().traverse((o) => {
          if (o instanceof T.Mesh && ["X", "Y", "Z"].includes(o.name) && visible(o) && !handles[o.name])
            handles[o.name] = project(new T.Box3().setFromObject(o).getCenter(new T.Vector3()));
        });
        host.dataset.projectedScene = JSON.stringify({
          camera: camera.position.toArray(),
          handles,
          objects: objects.children.map((o) => ({ id: o.userData.entityId, ...project(o.position) })),
          features: world.children
            .filter((o) => o.userData.featureRoot)
            .map((o) => ({ id: o.userData.featureId, ...project(o.position) })),
          surfaces: state.candidates.map((candidate) => ({
            id: candidate.id,
            surface: candidate.surface,
            normal: candidate.normal,
            samples: [
              [-0.3, 0.2],
              [0.3, 0.2],
              [-0.3, -0.2],
              [0.3, -0.2],
            ].map(([x, y]) => {
              const rotation = surfaceFrameRotation(candidate);
              return project(
                new T.Vector3(x * candidate.widthMeters, y * candidate.depthMeters, 0)
                  .applyQuaternion(new T.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
                  .add(new T.Vector3(candidate.position.x, candidate.position.y, candidate.position.z)),
              );
            }),
            ...project(new T.Vector3(candidate.position.x, candidate.position.y, candidate.position.z)),
          })),
        });
      } else delete host.dataset.projectedScene;
      dirty = false;
    }
  };
  animate();
  return {
    update,
    pickFeature: (x: number, y: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return pickRoomFeature();
    },
    pickEntity: (x: number, y: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const visible = (object: T.Object3D): boolean => object.visible && (!object.parent || visible(object.parent));
      for (const hit of raycaster.intersectObjects(objects.children, true)) {
        if (!visible(hit.object)) continue;
        let root = hit.object;
        while (!root.userData.entityId && root.parent) root = root.parent;
        if (state?.objects.find((object) => object.entity.id === root.userData.entityId)?.selectable)
          return root.userData.entityId;
      }
      return null;
    },
    view: resetView,
    cameraPosition: () => camera.position.toArray(),
    cameraSnapshot: (): CameraSnapshot => ({
      position: camera.position.toArray(),
      target: controls.target.toArray(),
      projection: camera === orthographic ? "plan" : "perspective",
      extent: orthographic.top,
    }),
    restoreCamera: (snapshot: CameraSnapshot) => {
      resetView(snapshot.projection);
      camera.position.fromArray(snapshot.position);
      controls.target.fromArray(snapshot.target);
      if (camera === orthographic) {
        orthographic.top = snapshot.extent;
        orthographic.bottom = -snapshot.extent;
        orthographic.left = -snapshot.extent * perspective.aspect;
        orthographic.right = snapshot.extent * perspective.aspect;
        orthographic.updateProjectionMatrix();
      }
      controls.update();
      dirty = true;
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      transform.dispose();
      placementOutline.geometry.dispose();
      (placementOutline.material as T.Material).dispose();
      renderer.domElement.removeEventListener("pointerdown", pointDown, true);
      renderer.domElement.removeEventListener("pointerup", pointUp);
      renderer.domElement.removeEventListener("pointercancel", cancelPointer);
      renderer.domElement.removeEventListener("lostpointercapture", cancelPointer);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      disposeGroup(world);
      disposeGroup(objects);
      disposeGroup(surfaces);
      disposeGroup(highlights);
      selection.geometry.dispose();
      (selection.material as T.Material).dispose();
      groupBox.geometry.dispose();
      (groupBox.material as T.Material).dispose();
      window.removeEventListener("keydown", cancelKey, true);
      sunlight.shadow.map?.dispose();
      roomMeshLibrary.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
