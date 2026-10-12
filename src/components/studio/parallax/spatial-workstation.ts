import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type { Transform, SpatialEntity } from "@/parallax/contracts";
import type { Candidate } from "@/parallax/adaptive";
import { syntheticRoomGeometry } from "@/parallax/room-geometry";
import { snapToNearestSurface, placeOnSurface } from "@/parallax/surface-placement";
export type ViewportObject = {
  entity: SpatialEntity;
  world: Transform;
  visible: boolean;
  locked: boolean;
  selectable: boolean;
  highlighted: boolean;
};
export type ViewportState = {
  theme?: "light" | "dark";
  objects: ViewportObject[];
  candidates: Candidate[];
  selected: string | null;
  environment: { id: string; width: number; depth: number; horizontal: boolean; vertical: boolean; light?: string };
  tool: "select" | "translate" | "rotate" | "scale";
  space: "world" | "local";
  snap: boolean;
  overlays: boolean;
  adaptive: boolean;
  editable: boolean;
  inspection: boolean;
};
/** Creator-only synthetic scene. No camera, device observations, imported media or runtime authority. */
export function createWorkstation(
  host: HTMLElement,
  callbacks: {
    select: (id: string) => void;
    transform: (id: string, world: Transform) => void;
    candidate: (candidate: Candidate, position: Transform["position"]) => void;
    failure: () => void;
  },
) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x101722);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
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
  const material = (color: number, roughness = 0.7) => new T.MeshStandardMaterial({ color, roughness, metalness: 0.1 });
  const box = (group: T.Group, size: number[], position: number[], color: number) => {
    const mesh = new T.Mesh(new T.BoxGeometry(...(size as [number, number, number])), material(color));
    mesh.position.set(...(position as [number, number, number]));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const disposeGroup = (group: T.Group) => {
    group.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) {
          if ("map" in m && m.map instanceof T.Texture) m.map.dispose();
          m.dispose();
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
      const color = (light ? g.lightColor : g.color) ?? (g.surface === "FLOOR" ? 0x8797a8 : 0xc1cbd7);
      if (g.shape === "TREE") {
        const trunk = new T.Mesh(new T.CylinderGeometry(0.055, 0.09, g.size[1] * 0.6, 8), material(0x766047));
        trunk.position.set(g.position[0], g.size[1] * 0.3, g.position[2]);
        world.add(trunk);
        for (let i = 0; i < 3; i++) {
          const foliage = new T.Mesh(
            new T.ConeGeometry(g.size[0] * (0.7 - i * 0.12), g.size[1] * 0.45, 10),
            material(color),
          );
          foliage.position.set(g.position[0], g.size[1] * (0.52 + i * 0.16), g.position[2]);
          foliage.castShadow = true;
          world.add(foliage);
        }
      } else if (g.shape === "WINDOW") {
        box(world, [g.size[0] + 0.1, g.size[1] + 0.1, 0.08], g.position, light ? 0xe3e9ef : 0x748498);
        const glass = box(world, g.size, [g.position[0], g.position[1], g.position[2] + 0.05], color);
        (glass.material as T.MeshStandardMaterial).emissive.setHex(0x738fa1);
        (glass.material as T.MeshStandardMaterial).emissiveIntensity = 0.3;
        box(world, [0.035, g.size[1], 0.02], [g.position[0], g.position[1], g.position[2] + 0.08], 0x93a3b4);
      } else box(world, g.size, g.position, color);
    }
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
      const mesh = new T.Mesh(
        new T.PlaneGeometry(c.widthMeters, c.depthMeters),
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
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(c.normal.x, c.normal.y, c.normal.z));
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
          const ring = new T.Mesh(new T.TorusGeometry(w * 0.43, w * 0.055, 8, 40), material(0xc3ad76, 0.25));
          group.add(ring);
          const face = new T.Mesh(new T.CircleGeometry(w * 0.42, 40), material(0x263e4c));
          group.add(face);
          const needle = new T.Mesh(new T.ConeGeometry(w * 0.09, w * 0.64, 4), material(0x8ce8d8, 0.2));
          needle.position.z = w * 0.05;
          group.add(needle);
          for (let i = 0; i < 12; i++) {
            const tick = box(
              group,
              [w * 0.015, w * 0.06, 0.008],
              [Math.sin((i * Math.PI) / 6) * w * 0.36, Math.cos((i * Math.PI) / 6) * w * 0.36, 0.01],
              0x9bb7bd,
            );
            tick.rotation.z = (-i * Math.PI) / 6;
          }
        }
      } else {
        const mat = new T.MeshStandardMaterial({
          color: 0xffffff,
          map: paperTexture(e),
          side: T.DoubleSide,
          roughness: 0.9,
        });
        const mesh = new T.Mesh(new T.PlaneGeometry(w, w * 0.75, 8, 2), mat);
        const position = mesh.geometry.attributes.position;
        if (e.kind === "PARCHMENT")
          for (let i = 0; i < position.count; i++)
            position.setZ(
              i,
              Math.abs(position.getX(i)) * 0.015 + Math.sin((position.getX(i) / w) * Math.PI * 4) * w * 0.012,
            );
        mesh.geometry.computeVertexNormals();
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
      state.snap && state.tool === "translate" && !state.adaptive
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
  const pointDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const pointUp = (e: PointerEvent) => {
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
  renderer.domElement.addEventListener("pointerdown", pointDown);
  renderer.domElement.addEventListener("pointerup", pointUp);
  const contextLost = (e: Event) => {
    e.preventDefault();
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
  const resetView = (view = "perspective") => {
    const chosen = objects.children.find((o) => o.userData.entityId === state?.selected);
    const target = view === "selection" && chosen ? chosen.position : new T.Vector3(0, 0.65, 0);
    const span = Math.max(state?.environment.width ?? 4, state?.environment.depth ?? 4);
    const framing = view === "selection" ? 0.55 : Math.max(1, span / 4) * 1.3 * Math.max(1, 1 / perspective.aspect);
    orthographic.top = Math.max(4, span * 0.65);
    orthographic.bottom = -orthographic.top;
    orthographic.left = -orthographic.top * perspective.aspect;
    orthographic.right = orthographic.top * perspective.aspect;
    orthographic.updateProjectionMatrix();
    camera = view === "plan" ? orthographic : perspective;
    controls.dispose();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.dampingFactor = 0.12;
    controls.minDistance = 0.4;
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
  const animate = () => {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden) return;
    controls.update();
    if (dirty) {
      if (selection.visible && state?.selected) {
        const obj = objects.children.find((o) => o.userData.entityId === state!.selected);
        if (obj) selection.setFromObject(obj);
      }
      renderer.render(scene, camera);
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
    view: resetView,
    cameraPosition: () => camera.position.toArray(),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      transform.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointDown);
      renderer.domElement.removeEventListener("pointerup", pointUp);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      disposeGroup(world);
      disposeGroup(objects);
      disposeGroup(surfaces);
      disposeGroup(highlights);
      selection.geometry.dispose();
      (selection.material as T.Material).dispose();
      sunlight.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
