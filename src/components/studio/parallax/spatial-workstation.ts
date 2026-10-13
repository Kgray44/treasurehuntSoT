import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type { Transform, SpatialEntity } from "@/parallax/contracts";
import type { Candidate } from "@/parallax/adaptive";
import { syntheticRoomGeometry, solidFaceRectangles } from "@/parallax/room-geometry";
import { snapToNearestSurface, placeOnSurface, surfaceFrameRotation } from "@/parallax/surface-placement";
import type { RoomFeature } from "@/parallax/environment-contracts";
import { paperSheetGeometry, compassProp } from "./spatial-props";
import { createRoomMeshLibrary, instanceRoomFurniture, renderedRoomBounds } from "./room-meshes";
export type ViewportObject = {
  entity: SpatialEntity;
  world: Transform;
  visible: boolean;
  locked: boolean;
  selectable: boolean;
  highlighted: boolean;
};
export type ViewportState = {
  sceneVersion?: string;
  theme?: "light" | "dark";
  objects: ViewportObject[];
  candidates: Candidate[];
  selected: string | null;
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
  status: "IN_VIEW" | "HIDDEN" | "NO_GEOMETRY" | "OUTSIDE_VIEW" | "OCCLUDED" | "TOO_SMALL";
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
/** Creator-only synthetic scene. No camera, device observations, imported media or runtime authority. */
export function createWorkstation(
  host: HTMLElement,
  callbacks: {
    select: (id: string) => void;
    transform: (id: string, world: Transform) => void;
    candidate: (candidate: Candidate, position: Transform["position"]) => void;
    failure: () => void;
    rendered?: (receipts: RendererReceipt[], sceneVersion?: string) => void;
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
  const raycaster = new T.Raycaster(),
    pointer = new T.Vector2();
  let state: ViewportState | null = null,
    disposed = false,
    dirty = true,
    frame = 0;
  let environmentKey = "",
    objectKey = "",
    down: { x: number; y: number } | null = null;
  const roomMeshLibrary = createRoomMeshLibrary();
  const disposeGroup = (group: T.Group) => {
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
    disposeGroup(world);
    disposeGroup(surfaces);
    const { width: w, depth: d } = s.environment;
    const light = s.theme === "light";
    for (const g of syntheticRoomGeometry(s.environment)) {
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
    instanceRoomFurniture(world);
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
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = e.kind === "TEXT" ? "#283644" : "#e4d6b5";
    ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = e.kind === "TEXT" ? "#86ead9" : "#7c745d";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, 476, 348);
    if (e.name.toLowerCase().includes("map")) {
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
      ctx.fillStyle = e.kind === "TEXT" ? "#d7f7ef" : "#4d504b";
      ctx.font = "24px serif";
      const words = e.content.split(/\s+/);
      let line = "",
        y = 80;
      for (const word of words.slice(0, 75)) {
        if (ctx.measureText(line + word).width > 415) {
          ctx.fillText(line, 45, y);
          line = "";
          y += 34;
        }
        line += word + " ";
      }
      ctx.fillText(line, 45, y);
    }
    ctx.fillStyle = e.kind === "TEXT" ? "#86ead9" : "#665b47";
    ctx.font = "16px sans-serif";
    ctx.fillText(e.name.slice(0, 35), 35, 345);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  };
  const buildObjects = (s: ViewportState) => {
    transform.detach();
    disposeGroup(objects);
    disposeGroup(highlights);
    for (const { entity: e } of s.objects) {
      const group = new T.Group();
      group.userData.entityId = e.id;
      const w = e.widthMeters;
      if (e.kind === "MARKER") {
        if (e.name.toLowerCase().includes("footprint")) {
          for (const [x, y, r] of [
            [0, 0, 0.32],
            [0, 0.32, 0.23],
            [-0.12, 0.5, 0.1],
            [0.1, 0.5, 0.1],
          ]) {
            const mesh = new T.Mesh(
              new T.SphereGeometry(w * r, 12, 8),
              new T.MeshStandardMaterial({
                color: 0x7ce8d5,
                emissive: 0x2e877d,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.8,
              }),
            );
            mesh.scale.z = 0.08;
            mesh.position.set(x * w, y * w, 0);
            group.add(mesh);
          }
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
            ? new T.Mesh(paperSheetGeometry(w, /letter|note/i.test(e.name)), [
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
    const nextEnvironment = JSON.stringify([s.environment, s.candidates, s.theme, s.inspection]);
    if (nextEnvironment !== environmentKey) {
      environmentKey = nextEnvironment;
      buildRoom(s);
    }
    const nextObjects = JSON.stringify(
      s.objects.map((o) => [o.entity.id, o.entity.kind, o.entity.name, o.entity.widthMeters, o.entity.content]),
    );
    if (nextObjects !== objectKey) {
      objectKey = nextObjects;
      buildObjects(s);
    }
    for (const obj of objects.children) {
      const o = s.objects.find((o) => o.entity.id === obj.userData.entityId)!;
      obj.visible = o.visible;
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
    surfaces.visible = s.overlays;
    world.visible = !s.isolateSelected && !s.hideEnvironment;
    if (s.isolateSelected)
      for (const object of objects.children) object.visible = object.visible && object.userData.entityId === s.selected;
    const selectedObject = objects.children.find((o) => o.userData.entityId === s.selected);
    const selected = s.objects.find((o) => o.entity.id === s.selected);
    selection.visible = !!selectedObject && !!selected?.visible;
    if (selectedObject) selection.setFromObject(selectedObject);
    transform.setSpace(s.space);
    transform.setTranslationSnap(s.snap ? 0.05 : null);
    transform.setRotationSnap(s.snap ? Math.PI / 12 : null);
    transform.setScaleSnap(s.snap ? 0.05 : null);
    if (
      selectedObject &&
      selected?.visible &&
      !selected.locked &&
      selected.selectable &&
      s.editable &&
      s.tool !== "select" &&
      !(s.adaptive && s.tool === "translate")
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
  transform.addEventListener("dragging-changed", (e) => {
    controls.enabled = !e.value;
  });
  transform.addEventListener("mouseUp", () => {
    if (cameraGesture) return;
    const obj = transform.object;
    if (!obj || !state) return;
    const old = state.objects.find((o) => o.entity.id === obj.userData.entityId)!;
    const changedScale = [obj.scale.x, obj.scale.y, obj.scale.z].sort(
      (a, b) => Math.abs(b - old.world.scale) - Math.abs(a - old.world.scale),
    )[0];
    const world = {
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w },
      scale: Math.max(0.1, Math.min(5, changedScale)),
    };
    const snapped =
      state.surfaceClamp && state.tool === "translate" && !state.adaptive
        ? snapToNearestSurface(world, state.candidates, old.entity.widthMeters)
        : world;
    if (snapped !== world) {
      const match = state.candidates.find((c) => {
        const placed = placeOnSurface(world, c, old.entity.widthMeters, 0.18);
        return (
          placed &&
          Math.hypot(
            placed.position.x - snapped.position.x,
            placed.position.y - snapped.position.y,
            placed.position.z - snapped.position.z,
          ) < 0.00001
        );
      });
      if (match) {
        callbacks.candidate(match, snapped.position);
        return;
      }
    }
    callbacks.transform(obj.userData.entityId, world);
  });
  let cameraGesture = false;
  const pointDown = (e: PointerEvent) => {
    cameraGesture = e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey || e.shiftKey));
    if (cameraGesture) transform.enabled = false;
    down = cameraGesture ? null : { x: e.clientX, y: e.clientY };
  };
  const pointUp = (e: PointerEvent) => {
    if (cameraGesture) {
      cameraGesture = false;
      transform.enabled = true;
      down = null;
      return;
    }
    if (!state || !down || transform.axis || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
      down = null;
      return;
    }
    down = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, (-(e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(objects.children, true).find((h) => h.object.parent?.visible);
    if (hit) {
      let root: T.Object3D = hit.object;
      while (!root.userData.entityId && root.parent) root = root.parent;
      if (state.objects.find((o) => o.entity.id === root.userData.entityId)?.selectable)
        callbacks.select(root.userData.entityId);
      return;
    }
    if (state.overlays && state.editable && state.selected && (state.tool === "translate" || state.tool === "select")) {
      const surface = raycaster.intersectObjects(surfaces.children).find((h) => h.object.userData.candidate?.safe);
      if (surface)
        callbacks.candidate(surface.object.userData.candidate, {
          x: surface.point.x,
          y: surface.point.y,
          z: surface.point.z,
        });
    }
  };
  const cancelPointer = () => {
    cameraGesture = false;
    down = null;
    transform.enabled = true;
    controls.enabled = true;
  };
  renderer.domElement.addEventListener("pointerdown", pointDown, true);
  renderer.domElement.addEventListener("pointerup", pointUp);
  renderer.domElement.addEventListener("pointercancel", cancelPointer);
  renderer.domElement.addEventListener("lostpointercapture", cancelPointer);
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
    const chosen = objects.children.find((o) => o.userData.entityId === state?.selected);
    const bounds = chosen ? new T.Box3().setFromObject(chosen) : null;
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
            0.04,
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
    controls.minDistance = 0.1;
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
      let status: RendererReceipt["status"] = !object.visible
        ? "HIDDEN"
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
      for (const part of world.children) {
        const classification = part.userData.classification;
        if (!["WALL", "CEILING", "DOOR", "WINDOW"].includes(classification)) continue;
        const inward = new T.Vector3(0, 0, 1).applyQuaternion(part.quaternion);
        const outside =
          classification === "CEILING"
            ? camera.position.y > part.position.y
            : camera.position.clone().sub(part.position).dot(inward) < -0.01;
        part.visible = !outside;
        if (outside) cutawayParts.push(part.userData.roomPartId);
      }
      host.dataset.cutawayParts = JSON.stringify(cutawayParts);
      if (selection.visible && state?.selected) {
        const obj = objects.children.find((o) => o.userData.entityId === state!.selected);
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
        });
      } else delete host.dataset.projectedScene;
      dirty = false;
    }
  };
  animate();
  return {
    update,
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
      sunlight.shadow.map?.dispose();
      roomMeshLibrary.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
