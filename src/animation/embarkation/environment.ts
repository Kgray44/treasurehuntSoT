import { livingMaterial } from "./living-material";
import { projectionGLSL } from "./projection";
import { HARBOR_ENVIRONMENT } from "./environment-set";
import { surfaceDepthGLSL } from "./depth-compositor";
import { EXTERIOR } from "./scene-space";
import { NEAR_ROOM_LANTERN_Z, roomExtensionGLSL } from "./room-extension";
import { SHELL_REVEAL } from "./program";
import { colorGLSL } from "./color";
/** Matte-projected room with a true exterior aperture. The camera backs into
 * stationary architecture; there is no expanding room rectangle or portal. */
export const environmentVertex = `#version 300 es
precision highp float;
in vec2 uv; out vec2 vUV; out vec3 vWorld; out float vDistance;out vec2 vExterior;
uniform vec2 stageCalibration;uniform vec4 stageDepths;
uniform vec3 cameraPosition; uniform vec2 worldViewport,viewport,artSize; uniform vec4 roomUV;
uniform float mode,time,roll,post,moonRadius,exteriorPierZ;uniform vec3 moonPosition;
${projectionGLSL}
mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
void main(){
 vUV=uv;vExterior=uv;vec2 q=(uv-.5)*2.;vec3 world;
 if(mode<.5){gl_Position=vec4(q,0.,1.);vWorld=vec3(0.);vDistance=16000.;return;}
 if(mode<1.5){
  if(post>.5&&post<1.5){gl_Position=vec4(q,0.,1.);vWorld=vec3(0.);vDistance=1.;return;}
  vec2 localUV=(uv-.5)*2.8+.5;vUV=localUV;q=(localUV-.5)*2.;
  vExterior=localUV*roomUV.xy+roomUV.zw;
  float finalZ=post>1.5?exteriorPierZ:-12500.;
  world=vec3(q*worldViewport*.5*(1150.-finalZ)/1150.,finalZ);
 }else if(mode<2.5){
  float r=length(q),a=atan(q.y,q.x);float ripple=sin(a*6.+r*11.-time*.32)*.024;
  // The residual cloud column is carried forward by the same rear-origin
  // wind after the viewer leaves it; backing inside cannot regrow the storm.
  float wake=smoothstep(18.5,21.5,time);
  world=vec3(q*(1.+ripple)*(1.+wake*80.)*vec2(1420.,1030.),-2390.+pow(r,.87)*2220.-wake*7000.);
 }else if(mode<3.5){
  // Full source geometry is overscanned. Only the hand-cut material pixels
  // survive the fragment stage. Final projection exactly matches live CSS.
  vec2 localUV=(uv-.5)*2.4+.5;q=(localUV-.5)*2.;vUV=localUV*roomUV.xy+roomUV.zw;
  float y=1.-vUV.y,z=-1650.;
  if(post<-.5)z=mix(-1650.,500.,smoothstep(.72,1.,y));
  else if(post<.5)z=-1650.;
  else if(post<1.5)z=mix(480.,-1650.,clamp(y/.11,0.,1.));
  else if(post<2.5)z=vUV.x>.38?-1650.:-660.;
  else if(post<3.5)z=-1650.;
  else if(post<4.5)z=-1650.;
  else if(post<5.5)z=mix(-140.,430.,clamp((y-.46)/.48,0.,1.));
  else if(post<6.5)z=mix(180.,690.,clamp((y-.58)/.42,0.,1.));
  else if(post<7.5)z=${NEAR_ROOM_LANTERN_Z}.;
  else if(post<8.5)z=-12500.;
  else z=0.;
  if(z<0.&&post<7.5)z*=1.65;
  float reference=1150.-z;world=vec3(q*worldViewport*.5*reference/1150.,z);
 }
 if(mode>3.5 && mode<4.5){
  vec2 local=(uv-.5)*vec2(180.,180.*artSize.y/artSize.x);float a=sin(time*1.7)*.025;
  // Register the landmark to the same source-space timber as the room. This
  // preserves its final occlusion when mobile crops change the room projection.
  vec2 anchor=(vec2(667./1536.,1.-270./1024.)-roomUV.zw)/roomUV.xy;
  vec2 pivot=(anchor-.5)*worldViewport*2350./1150.;
  world=vec3(pivot+vec2(local.x*cos(a),local.y),-1200.+local.x*sin(a));
 }
 if(mode>4.5 && mode<5.5){
  // Registered matte planes. Only water is a horizontal receding surface;
  // islands retain their silhouette and never bend with camera travel.
  vec2 plane=worldViewport;float aspect=stageCalibration.x;
  if(plane.x/plane.y>aspect)plane.y=plane.x/aspect;else plane.x=plane.y*aspect;
  vec2 sourceUV=uv;float z=stageDepths.x;
  if(post<.5||post>3.5){
   // The fragment stage intersects the fixed sky/water geometry. A screen
   // quad avoids finite tessellation at the water horizon, not perspective.
   gl_Position=vec4(q,0.,1.);vWorld=vec3(0.);vDistance=1.;return;
  }
  else if(post<1.5)z=stageDepths.y;else if(post<2.5)z=stageDepths.z;else z=stageDepths.w;
  float distance=1150.-z+stageCalibration.y;
  // Near shore continues beyond the frame throughout the lateral exploration.
  // Its painted source boundary is never brought into the visible frustum.
  float overscan=post>2.5?1.22:1.;
  world=vec3((sourceUV-.5)*plane*distance*overscan/1150.,z);
 }
 if(mode>5.5){
  world=moonPosition+vec3((uv-.5)*moonRadius,0.);
 }
 vWorld=world;vec3 view=filmView(world,cameraPosition,roll);
 float distance=1150.-view.z;vDistance=distance;
 gl_Position=filmClipView(view,worldViewport);
}`;
export const environmentFragment = `#version 300 es
precision highp float;
in vec2 vUV;in vec3 vWorld;in float vDistance;in vec2 vExterior;out vec4 color;
uniform sampler2D reconciliationMask;uniform float apertureDebug;
uniform vec2 stagePlaneSize,stageWater;
uniform vec4 stageBackingBounds;uniform float stageEyeZ,stageSkyZ;
uniform sampler2D art,apertureMap,matte0,matte1,matte2,backingAperture,roomOverscan,exterior,exteriorOverscan;
uniform vec3 cameraPosition;uniform vec2 viewport,worldViewport,artSize;
uniform vec4 roomRect,roomUV;uniform float mode,time,windLevel,roll,post,projectionGrid,moonReflectionSourceX;
${projectionGLSL}
vec2 cover(vec2 p){float s=max(viewport.x/artSize.x,viewport.y/artSize.y);return(p-.5)*viewport/(artSize*s)+.5;}
${colorGLSL}
${livingMaterial}
${surfaceDepthGLSL}
float noise(vec2 p){return sin(p.x*3.3+sin(p.y*4.3))*sin(p.y*2.7+sin(p.x*2.1));}
float cloudNoise(vec2 p){float value=0.,weight=.55;for(int i=0;i<5;i++){value+=weight*(.5+.5*noise(p));p=mat2(.8,-.6,.6,.8)*p*2.07+vec2(7.3,13.1);weight*=.48;}return value;}
${roomExtensionGLSL}
vec3 extension(vec2 p){return artwork(roomOverscan,roomExtensionUV(p)).rgb;}
float roomReconciliation(vec2 p){
 float settle=smoothstep(30.45,30.98,time);
 float materialPhase=sin(p.x*17.+sin(p.y*11.))*sin(p.y*19.)*.13;
 float exteriorOnly=texture(reconciliationMask,p).r,hole=texture(apertureMap,p).r;
 return mix(exteriorOnly,hole,smoothstep(30.3,30.95,time))*smoothstep(0.,1.,clamp(settle+materialPhase*sin(settle*3.14159),0.,1.));
}
void main(){
 gl_FragDepth=gl_FragCoord.z;
 vec3 rgb;float a=1.;
 if(mode<.5){rgb=displayGrade(artwork(art,vec2(vUV.x*.82+.09,.83+vUV.y*.16)).rgb,vec3(.70,.82,.93),vec3(0.));}
 else if(mode<1.5){
  vec2 p=vExterior;float water=0.;
  if(post>.5&&post<1.5){
   vec3 eye=filmEye(cameraPosition,roll);
   vec3 ray=filmRay(vUV,worldViewport,roll);
   float horizon=((1.-326./1024.-roomUV.w)/roomUV.y-.5)*worldViewport.y+1100.*1150./13650.;
   float d=(horizon-1100.-eye.y-horizon*eye.z/1150.)/(ray.y-horizon/1150.);
   if(d<=0.)discard;
   gl_FragDepth=1.-FILM_NEAR/d;
   vec3 point=eye+ray*d;
   // Ocean is outside the rear wall/opening. Its infinite supporting plane
   // cannot extend through the floor and furniture as the camera backs inside.
   if(point.z>${EXTERIOR.openingZ})discard;
   p=(point.xy*1150./(1150.-point.z)/worldViewport+.5)*roomUV.xy+roomUV.zw;
   a=1.-smoothstep(1.-327./1024.,1.-325./1024.,p.y);
   if(a<.001)discard;water=1.;
  }
  vec2 source=p;
  p.x+=sin(p.y*190.+time*.73)*.00035*water*livingEnabled;
  vec2 extended=p*vec2(1536./1598.,1024./1157.)+vec2(31./1598.,20./1157.);
  if(post>1.5){vec4 pier=artwork(art,p);rgb=pier.rgb;a=pier.a;if(min(p.x,p.y)<0.||max(p.x,p.y)>1.)discard;}
  else if(water>.5){
   rgb=artwork(exteriorOverscan,extended).rgb;
   float within=smoothstep(-.004,.004,min(min(p.x,p.y),min(1.-p.x,1.-p.y)));
   rgb=mix(rgb,artwork(exterior,clamp(p,.001,.999)).rgb,within);
  }else rgb=artwork(exteriorOverscan,extended).rgb;
  float silver=smoothstep(.27,.70,dot(linearToSrgb(rgb),vec3(.21,.72,.07)));
  float reflection=exp(-pow((p.x-moonReflectionSourceX)/.19,2.));
  float glitter=pow(max(0.,sin(p.x*650.+time*.33)*sin(p.y*390.-time*.21)),12.);
  rgb*=1.+water*silver*(sin(p.y*213.-time*.72)*.10+glitter*.24)*livingEnabled*(.22+.78*reflection);
  // Restore the original aperture painting ON its existing sky, water and pier
  // geometry. A far-plane correction was blocked by nearer opaque water/pier
  // holdouts, so those pixels changed only when the whole room flattened.
  // Registration and physical depth stay unchanged; only the late, masked
  // residual inside the already-established opening converges.
  if(time>30.3){float restore=roomReconciliation(source);if(restore>.001)rgb=mix(rgb,livingRoom(source,artwork(roomOriginal,source).rgb),restore);}
  if(projectionGrid>.5){
   vec2 edge=abs(fract(source*10.-.5)-.5)/max(fwidth(source)*10.,vec2(.0001));
   float line=1.-smoothstep(.6,1.4,min(edge.x,edge.y));
   rgb=mix(rgb,water>.5?vec3(.1,1.,.6):vec3(1.,.65,.15),line*.8);
   if(min(extended.x,extended.y)<0.||max(extended.x,extended.y)>1.)rgb=vec3(1.,0.,.3);
  }
 }else if(mode<2.5){
  vec2 q=(vUV-.5)*2.;float r=length(q);vec2 p=vUV+vec2(noise(q*7.+time*.05),noise(q.yx*8.-time*.07))*.005*windLevel;
  rgb=displayGrade(artwork(art,p).rgb,mix(vec3(.37,.61,.73),vec3(.57,.75,.89),smoothstep(12.,16.,time)),vec3(0.));
  float opening=smoothstep(15.3,18.6,time);
  a=mix(1.,smoothstep(.10,.21,r+noise(q*18.)*.009),opening);
 }else if(mode<3.5){
  vec2 p=(vWorld.xy*1150./(1150.-vWorld.z)/worldViewport+.5)*roomUV.xy+roomUV.zw;
  if(min(p.x,p.y)<0.||max(p.x,p.y)>1.){
   // Keep the already-present continuation behind the restoring application
   // shell. Dropping it at room time exposed a black header-sized strip.
   bool settledContinuation=post>8.5&&time<${SHELL_REVEAL.end};
   bool roof=((post>.5&&post<1.5)||settledContinuation)&&p.y>1.;
   bool leftWall=((post>1.5&&post<2.5)||settledContinuation)&&p.x<0.;
   bool rightWall=((post>2.5&&post<3.5)||settledContinuation)&&p.x>1.;
   if(!(roof||leftWall||rightWall))discard;
   float coverage=settledContinuation?1.-smoothstep(${SHELL_REVEAL.start}.,${SHELL_REVEAL.end},time):1.;
   surfaceCoverage(coverage);vec3 extended=extension(p);
   if(projectionGrid>.5){vec2 mapped=roomExtensionUV(p);if(min(mapped.x,mapped.y)<0.||max(mapped.x,mapped.y)>1.)extended=vec3(1.,0.,.3);}
   color=vec4(extended*coverage,coverage);return;
  }
  float hole=texture(apertureMap,p).r;
  if(apertureDebug>.5){surfaceCoverage(1.);color=vec4(srgbToLinear(vec3(texture(reconciliationMask,p).r)),1.);return;}
  if(post>8.5){a=1.;}
  else if(post<-.5){
   // Inpainted floor/wall is only backing behind disoccluded furniture.
   // No duplicate ceiling lanterns or foreground objects live on this plane.
   a=(1.-texture(backingAperture,p).r)*(1.-texture(matte2,p).g);
  }else{
   int index=int(post+.1);vec3 mask=index<3?texture(matte0,p).rgb:index<6?texture(matte1,p).rgb:texture(matte2,p).rgb;
   a=(1.-hole)*mask[index%3];
   if(index==0 && (1.-p.y)*1024.>=174.-p.x*1536.*.058)
    a=max(a,(1.-hole)*texture(matte2,p).g);
   // Continue the ceiling behind its separated hanging lantern. The clean
   // backing follows the ceiling surface, rather than leaving a sky-shaped cut.
   if(index==1 && (1.-p.y)*1024.<174.-p.x*1536.*.058)
    a=max(a,texture(matte2,p).g);
   // The rear wall continues below the rail. Its original-pixel material
   // closes the room aperture while nearer furniture separates by parallax.
  }
  if(a<.002)discard;rgb=artwork(art,p).rgb;
  if(post>=0.)rgb=livingRoom(p,rgb);
  if(post>.5 && post<1.5)rgb=mix(rgb,artwork(liveBacking,p).rgb,texture(matte2,p).g);
  if(post>.5 && post<1.5)rgb=mix(rgb,extension(p),smoothstep(.984,1.,p.y));
  if(post>8.5)rgb=mix(rgb,extension(p),smoothstep(.984,1.,p.y)*(1.-texture(matte2,p).g)*(1.-smoothstep(${SHELL_REVEAL.start}.,${SHELL_REVEAL.end},time)));
  if(post>=0. && post<.5)rgb=mix(rgb,artwork(liveBacking,p).rgb,texture(matte2,p).g);
  if(post<-.5){float visibleFloor=texture(matte0,p).r*smoothstep(.45,.49,1.-p.y);rgb=mix(rgb,livingRoom(p,artwork(roomOriginal,p).rgb),visibleFloor*smoothstep(30.,31.,time));}
  float y=1.-gl_FragCoord.y/viewport.y;float local=(y*viewport.y-roomRect.y)/roomRect.w;
  // This painted vignette matches the canonical CSS background gradient.
  rgb=srgbToLinear(mix(linearToSrgb(rgb),vec3(5.,9.,9.)/255.,clamp((local-.62)/.38,0.,1.)/3.));
 }
 else if(mode<4.5){vec4 lamp=artwork(art,vUV);a=lamp.a;rgb=displayGrade(lamp.rgb,vec3(1.12,.92,.68),vec3(0.));if(a<.002)discard;}
 else if(mode<5.5){
  vec2 p=vUV;float surfaceDistance=vDistance;
  float water=post>3.5?1.:0.;bool backing=post<.5||post>3.5;
  if(backing){
   vec3 eye=filmEye(cameraPosition,roll);
   vec3 ray=filmRay(vUV,worldViewport,roll);
   float distance=eye.z-stageSkyZ;
   if(water>.5){
    float denominator=ray.y+stageWater.x*ray.z;
    if(denominator>=-.00000001)discard;
    distance=-(eye.y+stageWater.x*(eye.z-stageEyeZ)+stageWater.y)/denominator;
    if(distance<=FILM_NEAR)discard;
   }
   vec3 point=eye+ray*distance;
   if(water>.5&&point.z<stageSkyZ)discard;
   float referenceDistance=stageEyeZ-point.z;
   if(referenceDistance<=0.)discard;
   p=point.xy*FILM_FOCAL/referenceDistance/stagePlaneSize+.5;
   surfaceDistance=distance;gl_FragDepth=1.-FILM_NEAR/distance;
  }
  vec2 source=p;
  p.x+=sin(p.y*213.+time*.81)*.00045*water*livingEnabled;
  vec2 sampleUV=backing?(p-stageBackingBounds.xy)/(stageBackingBounds.zw-stageBackingBounds.xy):p;
  vec4 material=artwork(art,sampleUV);rgb=material.rgb;a=material.a;
  if(!backing&&(min(p.x,p.y)<0.||max(p.x,p.y)>1.))discard;
  if(water>.5){
    float silver=smoothstep(.32,.75,dot(linearToSrgb(rgb),vec3(.21,.72,.07)));
    float reflection=exp(-pow((p.x-moonReflectionSourceX)/.16,2.));
    rgb*=1.+water*silver*(sin(p.y*193.-time*.67)*.10+pow(max(0.,sin(p.x*740.+time*.31)*sin(p.y*390.-time*.23)),16.)*.24)*(.22+.78*reflection)*livingEnabled;
  }
  float distantFog=clamp((surfaceDistance-6000.)/35000.,0.,.22);
  rgb=mix(rgb,srgbToLinear(vec3(.09,.15,.24)),distantFog);
  if(projectionGrid>.5){
   vec2 grid=abs(fract(source*10.-.5)-.5)/max(fwidth(source)*10.,vec2(.0001));
   float line=1.-smoothstep(.6,1.4,min(grid.x,grid.y));
   rgb=mix(rgb,water>.5?vec3(.1,1.,.6):vec3(1.,.65,.15),line*.8);
   if(backing&&(min(sampleUV.x,sampleUV.y)<0.||max(sampleUV.x,sampleUV.y)>1.))rgb=vec3(1.,0.,.3);
  }
  // The material transition lies wholly behind the overlapping dense banks.
  // Volume transport does not restart, fade to a plate, or change velocity.
  a*=1.-smoothstep(24.05,24.65,time);
 }
 else {
  // This emissive sky detail is coplanar with the painted sky. Ray-intersected
  // and rasterized depth differ by rounding; without a decal bias individual
  // shutter samples alternately lose the moon to its own sky. Four 24-bit
  // depth units resolve that tie while nearer scenery still occludes it.
  gl_FragDepth=max(0.,gl_FragCoord.z-4./16777215.);
  vec2 q=(vUV-.5)*2.;float r=length(q);
  vec2 sampleUV=vec2(1167./1536.,1.-240./1024.)+q*vec2(${EXTERIOR.moonDiameterPixels / 2}./1536.,${EXTERIOR.moonDiameterPixels / 2}./1024.);
  rgb=artwork(art,sampleUV).rgb;
  // Optical transmission belongs to the actual fog in front of this body.
  // Never independently switch the moon off at the fog cue.
  a=1.-smoothstep(.85,1.,r);
  // Its matching painted disc is restored on the sky geometry at arrival.
  // Transfer ownership of that same disc, without drawing both on top.
  a*=1.-roomReconciliation(vec2(1167./1536.,1.-240./1024.));
  rgb+=srgbToLinear(vec3(.045,.06,.08))*(1.-r)*smoothstep(15.,18.,time);
 }
 if(time<10.)rgb=mix(srgbToLinear(vec3(.014,.085,.097)),rgb,smoothstep(3.3,9.7,time));
 surfaceCoverage(a);color=vec4(rgb*a,a);
}`;
/** Compile the same material equations with an immutable scene class. This
 * lets the driver remove the room's flame/water/lantern branches from storm
 * and landscape programs. The unspecialized program remains a pixel oracle. */
export function specializeEnvironment(source: string, mode: number) {
  if (!Number.isInteger(mode) || mode < 0 || mode > 6) throw new Error("Unknown environment class");
  return source.replace("uniform float mode,", `const float mode=${mode}.;uniform float `);
}
export const environmentPlanes = [
  { name: "Stage B sky", z: -16000 },
  { name: "Final exterior sky", z: -12500 },
  { name: "Stage B far island", z: HARBOR_ENVIRONMENT.calibration.depths[1] },
  { name: "Stage B middle island", z: HARBOR_ENVIRONMENT.calibration.depths[2] },
  { name: "Stage B near shore", z: HARBOR_ENVIRONMENT.calibration.depths[3] },
  { name: "Balcony structure", z: -2722.5 },
  { name: "Ceiling lantern", z: NEAR_ROOM_LANTERN_Z },
  { name: "Threshold lantern", z: -1200 },
  { name: "Near timber posts", z: -1089 },
  { name: "Couch", z: 200 },
  { name: "Table / lens foreground", z: 690 },
] as const;
