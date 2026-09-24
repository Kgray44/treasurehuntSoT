import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const root=".runtime/embarkation/motion-fog-correction";
const docs="Development_Docs/Projects/Voyagewright_Refit_V1/embarkation";
const manifest=JSON.parse(await readFile(`${docs}/asset-manifest.json`,"utf8"));
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const masters=[];
for(const asset of manifest.assets) {
  const bytes=await readFile(`${manifest.masters}/${asset.source}`);
  masters.push({source:asset.source,unchanged:hash(bytes)===asset.sha256});
}
if(masters.some(m=>!m.unchanged)) throw Error("Supplied master changed");
await writeFile(`${root}/masters-verified.json`,JSON.stringify(masters,null,2));
const room=manifest.assets.find(a=>a.source==="Voyagewright_Waiting_Room_Background.png");
const files=["stage-c-pier.png","stage-c-water.webp","stage-c-extended.webp"];
const derivatives=[];
for(const name of files) {
  const path=`public/images/embarkation/derived/${name}`,bytes=await readFile(path),meta=await sharp(bytes).metadata();
  derivatives.push({file:`derived/${name}`,width:meta.width,height:meta.height,bytes:bytes.length,sha256:hash(bytes)});
}
room.runtimeDerivativeFiles=room.runtimeDerivativeFiles.filter(p=>!['derived/exterior-nomoon.webp','derived/exterior-overscan.webp','derived/room-exterior-continuous.png'].includes(p));
for(const derivative of derivatives) if(!room.runtimeDerivativeFiles.includes(derivative.file)) room.runtimeDerivativeFiles.push(derivative.file);
room.derivativeFiles=[...new Set([...room.derivativeFiles,...derivatives.map(d=>d.file)])];
room.derivatives=[...room.derivatives.filter(d=>!derivatives.some(next=>next.file===d.file)),...derivatives];
room.stageCCorrection={
  sourceClass:"MULTI_ELEMENT",usableRegions:["distant sky/coast","rigid pier, rocks and boats","level water surface"],
  activeRuntime:derivatives,formerRuntime:["exterior-nomoon.webp","exterior-overscan.webp"],
  blendMode:"premultiplied-normal",depthBands:["sky/coast: -12500","pier/boats: -9000","ray/plane water"],
  deformationAllowed:false,lightingResponse:true,nearCameraAllowed:false,emitterSystem:false,
  maximumDisplayPixels:2560,scaleLimit:"Authored camera path only; five measured responsive compositions",
  alphaCleanup:"Source-colored silhouette refinement and subpixel feather; reviewed over dark teal and warm parchment. No opaque sheet is used for pier/boat material.",
  provenance:"correction-art.json",coverage:"correction-coverage.json",
};
await writeFile(`${docs}/asset-manifest.json`,JSON.stringify(manifest,null,2)+"\n");
const provenance=JSON.parse(await readFile(`${root}/stage-c-provenance.json`,"utf8"));
const prompt=JSON.parse(await readFile(`${root}/backing-prompt.json`,"utf8"));
await copyFile(`${root}/stage-c-fill-master.png`,".runtime/embarkation/masters/stage-c-fill-correction.png");
await writeFile(`${docs}/correction-art.json`,JSON.stringify({classification:"engineering-evidence",...provenance,prompt,
  supportingMaster:".runtime/embarkation/masters/stage-c-fill-correction.png",
  supportingSha256:hash(await readFile(`${root}/stage-c-fill-master.png`)),
  boats:"Original silhouette on rigid shore plane; adjacent original water continues behind its small footprint.",derivatives},null,2)+"\n");
await copyFile(`${root}/coverage.json`,`${docs}/correction-coverage.json`);
const overlays=[];
for(const [i,background] of ["#082c33","#f5d398"].entries()) {
  const board=await sharp({create:{width:1536,height:1024,channels:4,background}}).composite([{input:"public/images/embarkation/derived/stage-c-pier.png"}]).png().toBuffer();
  overlays.push({input:await sharp(board).extract({left:740,top:235,width:796,height:235}).png().toBuffer(),left:0,top:i*235});
}
await sharp({create:{width:796,height:470,channels:4,background:"#082c33"}}).composite(overlays).png().toFile(`${root}/pier-alpha-final.png`);
console.log(`${masters.length} supplied masters unchanged; registered derivatives and alpha review written.`);
