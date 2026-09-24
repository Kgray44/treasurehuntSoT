import { chromium } from "@playwright/test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";

const root = process.env.EMBARKATION_SCREENING_OUTPUT ?? ".runtime/embarkation/motion-fog-correction/candidate";
await mkdir(root, { recursive: true });
async function tree(dir) {
  const out=[];
  for(const e of await readdir(dir,{withFileTypes:true})) {
    const path=`${dir}/${e.name}`;
    if(e.isDirectory()) out.push(...await tree(path));
    else out.push(path);
  }
  return out;
}
const files=[...await tree("src/animation/embarkation"),...await tree("public/images/embarkation/derived"),
  "src/components/muster/MusterRoom.tsx","src/components/muster/muster.css"];
const revisions=[];
for(const path of files.sort()) revisions.push({path,sha256:createHash("sha256").update(await readFile(path)).digest("hex")});
const candidate=createHash("sha256").update(JSON.stringify(revisions)).digest("hex");
await writeFile(`${root}/candidate.json`,JSON.stringify({candidate,revisions},null,2));
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=d3d11"]});
const errors=[];
async function enter(width=1536,height=1024) {
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:3138/dev/embarkation/enter?role=captain&arrival=first&quality=CINEMATIC&inspector=1");
  await page.waitForFunction(()=>window.__embarkation&&!document.querySelector(".embarkation-begin button")?.disabled,null,{timeout:60000});
  await page.getByRole("button",{name:"Collapse",exact:true}).click();
  return page;
}
try {
  const page=await enter(), histories=[];
  for(let i=0;i<=155;i++) {
    const time=i/5;
    const frame=await page.evaluate(time=>{window.__embarkation.seek(time);return window.__embarkation.diagnostics();},time);
    histories.push({time,rate:frame.playbackRate,page:frame.pageSurfaces,scene:frame.scene});
  }
  const final=await page.evaluate(()=>window.__embarkation.diagnostics());
  const noDebris=histories.filter(f=>f.time>=24).every(f=>f.scene.stormActors.filter(a=>!a.id.startsWith("light-")).every(a=>a.transmission<.002)&&f.page.filter(a=>a.source!=="focus-title").every(a=>a.alpha<.002));
  assert(noDebris,"Opening debris survives dense fog / camera reversal");
  const firstAbsent=histories.find(f=>f.time>=18&&histories.filter(next=>next.time>=f.time).every(next=>next.scene.stormActors.filter(a=>!a.id.startsWith("light-")).every(a=>a.transmission<.002)))?.time;
  await writeFile(`${root}/motion-histories.json`,JSON.stringify({candidate,firstOrdinaryDebrisAbsent:firstAbsent,histories},null,2));
  await writeFile(`${root}/runtime-textures.json`,JSON.stringify({candidate,diagnostics:final},null,2));
  for(const time of [21.5,22,22.5,23,23.25,23.5,23.75,24,24.25,24.5,24.75,25,25.5,26,26.5,27]) {
    await page.evaluate(time=>window.__embarkation.seek(time),time);
    await page.screenshot({path:`${root}/fog-${time}.png`});
  }
  for(const time of [23.25,24.25,25.25]) {
    await page.evaluate(time=>{window.__embarkation.seek(time);window.__embarkation.debug(true);},time);
    await page.screenshot({path:`${root}/moon-diagnostic-${time}.png`});
  }
  await page.close();
  const projection=[];
  for(const [width,height] of [[1536,1024],[1280,720],[1024,768],[390,844],[2560,1080]]) {
    const p=await enter(width,height);
    await p.evaluate(()=>{window.__embarkation.layer("environment");window.__embarkation.freezeLiving(true);});
    for(const time of [24.5,26,27,27.5,28,28.5,29,29.5,30,30.5,30.9,31]) {
      await p.evaluate(time=>window.__embarkation.seek(time),time);
      const name=`exterior-${width}-${time}`;
      await p.screenshot({path:`${root}/${name}.png`});
      // Keep the entire lower third as well as the contextual full frame.
      await sharp(`${root}/${name}.png`).extract({left:0,top:Math.floor(height*2/3),width,height:height-Math.floor(height*2/3)}).png().toFile(`${root}/${name}-lower.png`);
    }
    await p.evaluate(()=>window.__embarkation.projection(true));
    for(const time of [27,28,29,30]) {
      await p.evaluate(time=>window.__embarkation.seek(time),time);
      await p.screenshot({path:`${root}/grid-${width}-${time}.png`});
    }
    projection.push({width,height,diagnostics:await p.evaluate(()=>window.__embarkation.diagnostics())});
    // Isolation never persists into a user preview or arrival.
    await p.evaluate(()=>{window.__embarkation.layer("");window.__embarkation.freezeLiving(false);window.__embarkation.projection(false);window.__embarkation.seek(27);});
    await p.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${root}/correction-checks.json`,JSON.stringify({candidate,noOpeningDebrisFrom24:true,firstOrdinaryDebrisAbsent:firstAbsent,projection,errors},null,2));
  console.log(`Correction evidence captured for ${candidate}; ordinary debris absent from ${firstAbsent}s.`);
} finally {await browser.close();}
