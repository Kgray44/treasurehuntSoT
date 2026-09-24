import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { camera } from "../../src/animation/embarkation/program.ts";
const root=".runtime/embarkation/motion-fog-correction", current=`${root}/owner-preview`;
const docs="Development_Docs/Projects/Voyagewright_Refit_V1/embarkation";
const json=async p=>JSON.parse(await readFile(p,"utf8"));
const candidate=await json(`${current}/candidate.json`);
for(const entry of candidate.revisions) assert.equal(createHash("sha256").update(await readFile(entry.path)).digest("hex"),entry.sha256,`Capture revision changed: ${entry.path}`);
const normal=await json(`${current}/normal-playback.json`), trajectory=await json(`${current}/motion-histories.json`);
const checks=await json(`${current}/correction-checks.json`), handoff=await json(`${current}/handoff-proof.json`);
const browser=await json(`${root}/verification/results.json`), living=await json(`${root}/verification/living-results.json`), replay=await json(`${root}/verification/replay-results.json`);
const slow=[];
for(const rate of [1,.5,.25]) slow.push(await json(`${current}/threshold-motion/${rate}x.json`));
assert(browser.every(c=>c.status==="passed"));assert(living.every(c=>c.status==="passed"));assert(replay.every(c=>c.status==="passed"));
assert.equal(normal.errors.length,0);assert(normal.filmElapsedMs<37000);
assert.equal(handoff.livingHandoff.max,0);assert.equal(checks.errors.length,0);
const clock=normal.clockSamples,first=clock[0],last=clock.at(-1);
assert(clock.length>250);assert(clock.every(c=>!c.hidden));
const ratio=(last.time-first.time)/(last.wallMs-first.wallMs)*1000;
assert(Math.abs(1-ratio)<.01);
const representativeIds=["recede-2","recede-4","recede-1","hero-chart","focus-catch","eddy-0"];
const representatives=representativeIds.map(id=>({id,samples:trajectory.histories.flatMap((frame,index)=>{
  const p=frame.scene.stormActors.find(a=>a.id===id);
  if(!p||p.age>14||index%2)return [];
  const before=trajectory.histories[index-1]?.scene.stormActors.find(a=>a.id===id);
  return [{time:frame.time,...p,relativeForwardVelocity:before?(p.distance-before.distance)/.2:null}];
})}));
const pageIds=["page-4","page-8"];
const pageMaterial=pageIds.map(id=>({id,samples:trajectory.histories.flatMap((frame,index)=>{
  const p=frame.page.find(a=>a.id===id);if(!p||frame.time<p.release||index%2)return [];
  const distance=1150+camera(frame.time).position[2]-p.position[2];
  const previous=trajectory.histories[index-1]?.page.find(a=>a.id===id);
  const previousDistance=previous?1150+camera(frame.time-.2).position[2]-previous.position[2]:null;
  return [{time:frame.time,release:p.release,age:p.released,position:p.position,rotation:p.rotation,transmission:p.alpha,width:p.width,height:p.height,distance,screenPixels:p.width*1150/distance,relativeForwardVelocity:previousDistance===null?null:(distance-previousDistance)/.2}];
})}));
await writeFile(`${docs}/correction-trajectories.json`,JSON.stringify({classification:"engineering-evidence",candidate:candidate.candidate,representatives,pageMaterial,
  absence:{firstOpticallyAbsent:trajectory.firstOrdinaryDebrisAbsent,rendererThreshold:.002,source:"Actual renderer diagnostics, 0.2-second sweep; world paths continue beyond optical exit",noResurrection:checks.noOpeningDebrisFrom24}},null,2)+"\n");
const proof={classification:"engineering-evidence",status:"SELF_REVIEWED_OWNER_SCREENING_PENDING",ownerAccepted:false,merged:false,
  objective:"Owner correction: motion energy, spatial fog arrival, moon continuity and planar Stage C coverage",
  authoredRuntimeSeconds:35.8,candidate:candidate.candidate,candidateFile:`${current}/candidate.json`,
  historicalProof:"delta2-proof.json",historicalEvidencePreserved:`${root}/baseline/candidate.zip`,ownerSupersedesPriorVisualConclusions:true,
  rejectedOutcomes:[
    {id:"motion",status:"corrected-and-self-reviewed",cause:"Weak physical speeds and long extinction caused the observed lingering. Playback clock itself was correct. Terminal cache clamping was an additional latent risk, not the observed opening slowdown.",fix:"Event-age acceleration/rotation, fixed physical cache with continuation, depth-only extinction before world-space retirement.",ordinaryDebrisAbsentBy:trajectory.firstOrdinaryDebrisAbsent},
    {id:"fog",status:"corrected-and-self-reviewed",cause:"Global density envelope activated an already populated viewing volume.",fix:"Staggered rear-origin banks, irregular leading profiles, growing then dwindling upstream supply and continued downstream dispersal.",screenedTimes:[21.5,22,22.5,23,23.25,23.5,23.75,24,24.25,24.5,24.75,25,25.5,26,26.5,27]},
    {id:"moon",status:"corrected-and-self-reviewed",cause:"Disc fade and independent screen-space scattering position broke the visible cue.",fix:"Shared celestial projection/light/reflection state; attenuated disc plus volumetric glow; registered adjustment hidden in traveling banks.",registration:[23.85,24.75],visibleCue:"Disc before fog; softened blue-white light in thinner banks; harbor moon emerging through gaps. No second drawn moon."},
    {id:"stage-c",status:"corrected-and-self-reviewed",cause:"A varying image-row depth bent scenery; water horizon needed registration to the finite shoreline.",fix:"Separate distant matte, rigid pier/boats, and ray-intersected level sea meeting the coastline plane; measured support and exact original-coordinate compositing.",activeTextures:["stage-c-water.webp","stage-c-pier.png","stage-c-extended.webp"],coverage:"correction-coverage.json",art:"correction-art.json"}
  ],
  clock:{rate:1,measuredRatio:ratio,samples:clock.length,hidden:false,wallRuntimeMs:normal.filmElapsedMs},
  performance:{frameP50:normal.performance.frameP50,frameP95:normal.performance.frameP95,frameP99:normal.performance.frameP99,renderP95:normal.performance.renderP95,preloadMs:normal.performance.preloadMs,qualification:"Local 1536x1024 DPR1 CINEMATIC development browser with video capture; not locked 60 FPS or broad-device qualification"},
  evidence:{normal:`${current}/normal.webm`,ambientSeconds:8,slow,fullMotionHistories:`${current}/motion-histories.json`,trajectories:"correction-trajectories.json",runtimeTextures:`${current}/runtime-textures.json`,projectionViewports:checks.projection.map(v=>[v.width,v.height]),lowerThirdAndGrid:`${current}/exterior-* and grid-*`,moonDiagnostics:`${current}/moon-diagnostic-*`,alphaReview:`${root}/pier-alpha-final.png`},
  validation:{focusedTests:28,browserScenarios:browser.map(c=>({name:c.name,status:c.status})),living,replay,handoff,masters:await json(`${root}/masters-verified.json`),typecheck:"passed",scopedLint:"passed",functionalChecks:"Unchanged behavior code; final visual/asset revision separately captured and final environment handoff repeated."},
  remainingKnownDefects:[],limitations:["Authored 2.5D path only; arbitrary replacement scenery requires new registered mattes.","Screened local render has long frames; reference quality retained.","Silent recordings do not establish auditory quality."],
  reviewBoundary:"Focused self-review only. Owner perceptual acceptance remains pending; no merge.",preview:"http://127.0.0.1:3138/dev/embarkation"
};
await writeFile(`${docs}/correction-proof.json`,JSON.stringify(proof,null,2)+"\n");
let preview=await readFile(`${docs}/preview.md`,"utf8");
const start=preview.indexOf("## Historical Delta 2 evidence"),end=preview.indexOf("## Asset preservation and reproduction",start);
preview=preview.slice(0,start)+`## Historical Delta 2 evidence\n\n[Delta 2 proof](delta2-proof.json) preserves its prior measurements and visual\nconclusions as history. The four owner-rejected outcomes are superseded by the\ncurrent correction record. Earlier Delta 1 and initial evidence remain intact.\n\n`+preview.slice(end);
preview=preview.replace("Current results and performance are in the correction proof.",`The current normal film completed in ${(normal.filmElapsedMs/1000).toFixed(3)} seconds;\n${clock.length} presentation-clock samples measured ${ratio.toFixed(5)}×. Frame time\nwas ${normal.performance.frameP50.toFixed(1)} ms median / ${normal.performance.frameP95.toFixed(1)} ms p95 / ${normal.performance.frameP99.toFixed(1)} ms p99,\nwith ${normal.performance.renderP95.toFixed(1)} ms CPU render p95. All 28 focused tests and\n11 browser scenarios passed, together with living/replay checks and the final\nenvironment handoff. Typechecking and scoped lint passed.`);
await writeFile(`${docs}/preview.md`,preview);
for(const file of ["docs/product/features.md","docs/product/current-status.md","docs/reference/feature-status.md"]){
  let content=await readFile(file,"utf8");
  const tail="Owner Screening Delta 2 extends the authored journey with readable support-plane strain, coherent rear-origin weather, spatial landscape exploration, continuous fog, independent living-light layers and staggered real DOM anchor catches.";
  content=content.replace(tail,tail+" The subsequent owner correction restores fast event-age flight, spatially arriving fog banks, a shared moonlight cue, and registered planar exterior water. Screening evidence is current; owner acceptance remains pending.");
  await writeFile(file,content);
}
let changelog=await readFile("CHANGELOG.md","utf8");
changelog=changelog.replace("This Refit area remains unaccepted and unmerged.","The subsequent owner correction restores fast physical flight, removes lingering storm debris, replaces global fog activation with arriving banks, restores the moonlight cue and uses registered planar exterior water. This Refit area remains unaccepted and unmerged.");
await writeFile("CHANGELOG.md",changelog);
const registry=await json("Development_Docs/Projects/Voyagewright_Refit_V1/refit-registry.json");
// Preserve the repository's registry topology and all unrelated areas.
const patchArea=value=>{if(!value||typeof value!=="object")return;if(value.id==="embarkation"){value.screeningDelta="Owner Screening Delta 2 - motion/fog/exterior correction";value.currentProof="embarkation/correction-proof.json";}else for(const next of Object.values(value))patchArea(next);};
patchArea(registry);
await writeFile("Development_Docs/Projects/Voyagewright_Refit_V1/refit-registry.json",JSON.stringify(registry,null,2)+"\n");
console.log(JSON.stringify({candidate:candidate.candidate,clockRatio:ratio,wallRuntimeMs:normal.filmElapsedMs,focusedTests:28,browserScenarios:browser.length,ownerAccepted:false}));
