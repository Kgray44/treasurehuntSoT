import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

// Asset-pipeline thumbnails from the real exported GLBs, not product-experience acceptance evidence.
const root = process.cwd(),
  out = path.join(root, "public/parallax/sc02");
const manifest = JSON.parse(await readFile(path.join(out, "manifest.json"), "utf8"));
const html = `<!doctype html><html><head><style>body{margin:0;background:#192330}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script></head><body><script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,320);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.setClearColor(0x192330);document.body.append(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1.5,.001,100);scene.add(new T.HemisphereLight(0xe6edff,0x3a2b20,2.2));const key=new T.DirectionalLight(0xffe4bb,4.5);key.position.set(-3,5,4);scene.add(key);const fill=new T.DirectionalLight(0x80bbff,2);fill.position.set(3,2,-3);scene.add(fill);
let current;const loader=new GLTFLoader();
window.inspectAsset=async(id,mode="THUMBNAIL")=>{renderer.setSize(mode==="THUMBNAIL"?480:960,mode==="THUMBNAIL"?320:640);if(current){scene.remove(current);current.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value instanceof T.Texture)value.dispose();m.dispose();}}});}const start=performance.now();const gltf=await loader.loadAsync('/assets/models/'+id+'.glb');current=gltf.scene;const joint=current.getObjectByName("articulation");if(joint&&mode==="OPEN"){if(id==="opening-drawer")joint.position.z=.3;else if(id==="hinged-door")joint.rotation.y=-Math.PI*.55;else if(id==="articulated-chest")joint.rotation.x=-Math.PI*.6;else if(id==="wall-sign")joint.rotation.x=.25;}scene.add(current);current.updateMatrixWorld(true);const box=new T.Box3().setFromObject(current),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());if(!size.toArray().every(Number.isFinite))throw new Error("SC02_NONFINITE_RENDER_BOUNDS:"+id);const max=Math.max(size.x,size.y,size.z);camera.position.copy(center).add((mode==="SIDE"?new T.Vector3(-2,1,1.6):new T.Vector3(1.6,1.15,2.3)).multiplyScalar(max*.9));camera.near=max/1000;camera.far=max*100;camera.updateProjectionMatrix();camera.lookAt(center);renderer.render(scene,camera);const gl=renderer.getContext(),pixels=new Uint8Array(renderer.domElement.width*renderer.domElement.height*4);gl.readPixels(0,0,renderer.domElement.width,renderer.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let coverage=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>12)coverage++;if(coverage<200)throw new Error("SC02_EMPTY_RENDER:"+id);return {id,view:mode,visiblePixelCount:coverage,loadAndRenderMs:performance.now()-start,dimensions:size.toArray(),minimum:box.min.toArray(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};};
window.pipelineReady=true;
</script></body></html>`;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
      return;
    }
    let file, base;
    if (url.pathname.startsWith("/three/")) {
      base = path.join(root, "node_modules/three");
      file = path.resolve(base, url.pathname.slice(7));
    } else if (url.pathname.startsWith("/assets/")) {
      base = out;
      file = path.resolve(base, url.pathname.slice(8));
    } else {
      res.writeHead(404).end();
      return;
    }
    if (!file.startsWith(base + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".glb")
          ? "model/gltf-binary"
          : "application/json",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-webgl", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.pipelineReady);
  await mkdir(path.join(out, "thumbnails"), { recursive: true });
  const metrics = [];
  for (const asset of manifest.assets) {
    metrics.push(await page.evaluate((id) => window.inspectAsset(id), asset.id));
    await page.screenshot({ path: path.join(out, "thumbnails", `${asset.id}.png`) });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const evidence = path.join(root, "Development_Docs/Projects/Project_Parallax/evidence/sc02");
  await mkdir(evidence, { recursive: true });
  await mkdir(path.join(evidence, "details"), { recursive: true });
  await page.setViewportSize({ width: 960, height: 640 });
  for (const asset of manifest.assets) {
    metrics.push(await page.evaluate((id) => window.inspectAsset(id, "SIDE"), asset.id));
    await page.screenshot({ path: path.join(evidence, "details", `${asset.id}-side.png`) });
    if (["HINGE", "SLIDE"].includes(asset.articulation)) {
      metrics.push(await page.evaluate((id) => window.inspectAsset(id, "OPEN"), asset.id));
      await page.screenshot({ path: path.join(evidence, "details", `${asset.id}-open.png`) });
    }
  }
  await writeFile(
    path.join(evidence, "asset-render-metrics.json"),
    JSON.stringify(
      {
        kind: "EXPORTED_GLB_PIPELINE_RENDER",
        renderer: "Chromium software WebGL / SwiftShader",
        productExperienceAcceptance: false,
        metrics,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      rendered: metrics.length,
      maximumCalls: Math.max(...metrics.map((m) => m.calls)),
      maximumLoadAndRenderMs: Math.max(...metrics.map((m) => m.loadAndRenderMs)),
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
