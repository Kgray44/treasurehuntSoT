import { livingMaterial } from "./living-material";
/** Matte-projected room with a true exterior aperture. The camera backs into
 * stationary architecture; there is no expanding room rectangle or portal. */
export const environmentVertex = `#version 300 es
precision highp float;
in vec2 uv; out vec2 vUV; out vec3 vWorld; out float vDistance;out vec2 vExterior;
uniform vec3 cameraPosition; uniform vec2 worldViewport,viewport,artSize; uniform vec4 roomUV;
uniform float mode,time,roll,post,moonRadius;uniform vec3 moonPosition;
mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
void main(){
 vUV=uv;vExterior=uv;vec2 q=(uv-.5)*2.;vec3 world;
 if(mode<.5){gl_Position=vec4(q,0.,1.);vWorld=vec3(0.);vDistance=16000.;return;}
 if(mode<1.5){
  if(post>.5&&post<1.5){gl_Position=vec4(q,0.,1.);vWorld=vec3(0.);vDistance=1.;return;}
  vec2 localUV=(uv-.5)*2.8+.5;vUV=localUV;q=(localUV-.5)*2.;
  vExterior=localUV*roomUV.xy+roomUV.zw;
  float finalZ=post>1.5?-9000.:-12500.;
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
  else if(post<7.5)z=-1080.;
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
  vec2 plane=worldViewport;float aspect=1672./941.;
  if(plane.x/plane.y>aspect)plane.y=plane.x/aspect;else plane.x=plane.y*aspect;
  vec2 sourceUV=uv;float z=-16000.;
  if(post<.5){sourceUV=(uv-.15)/.7;z=mix(-4400.,-16000.,smoothstep(0.,.39,sourceUV.y));}
  else if(post<1.5)z=-8500.;else if(post<2.5)z=-6400.;else z=-4700.;
  float distance=1150.-z-3100.;
  // Near shore continues beyond the frame throughout the lateral exploration.
  // Its painted source boundary is never brought into the visible frustum.
  float overscan=post>2.5?1.22:1.;
  world=vec3((sourceUV-.5)*plane*distance*overscan/1150.,z);
 }
 if(mode>5.5){
  world=moonPosition+vec3((uv-.5)*moonRadius,0.);
 }
 vWorld=world;vec3 view=world-cameraPosition;view.xy=turn(-roll)*view.xy;
 float distance=1150.-view.z;vDistance=distance;
 gl_Position=vec4(view.xy*1150./(worldViewport*.5),distance-8.,distance);
}`;
export const environmentFragment = `#version 300 es
precision highp float;
in vec2 vUV;in vec3 vWorld;in float vDistance;in vec2 vExterior;out vec4 color;
uniform sampler2D art,apertureMap,matte0,matte1,matte2,backingAperture,roomOverscan,exterior,exteriorOverscan;
uniform vec3 cameraPosition;uniform vec2 viewport,worldViewport,artSize;
uniform vec4 roomRect,roomUV;uniform float mode,time,windLevel,roll,post,projectionGrid,moonReflectionSourceX;
vec2 cover(vec2 p){float s=max(viewport.x/artSize.x,viewport.y/artSize.y);return(p-.5)*viewport/(artSize*s)+.5;}
${livingMaterial}
float noise(vec2 p){return sin(p.x*3.3+sin(p.y*4.3))*sin(p.y*2.7+sin(p.x*2.1));}
float cloudNoise(vec2 p){float value=0.,weight=.55;for(int i=0;i<5;i++){value+=weight*(.5+.5*noise(p));p=mat2(.8,-.6,.6,.8)*p*2.07+vec2(7.3,13.1);weight*=.48;}return value;}
vec3 extension(vec2 p){return texture(roomOverscan,vec2(p.x*.79+.11,1.-((1.-p.y)*.82+.055))).rgb;}
void main(){
 vec3 rgb;float a=1.;
 if(mode<.5){rgb=texture(art,vec2(vUV.x*.82+.09,.83+vUV.y*.16)).rgb*vec3(.70,.82,.93);}
 else if(mode<1.5){
  vec2 p=vExterior;float water=0.;
  if(post>.5&&post<1.5){
   vec3 eye=cameraPosition+vec3(0.,0.,1150.);
   vec3 ray=vec3((vUV-.5)*worldViewport/1150.,-1.);
   float horizon=((1.-326./1024.-roomUV.w)/roomUV.y-.5)*worldViewport.y+1100.*1150./13650.;
   float d=(horizon-1100.-eye.y-horizon*eye.z/1150.)/(ray.y-horizon/1150.);
   if(d<=0.)discard;
   vec3 point=eye+ray*d;
   p=(point.xy*1150./(1150.-point.z)/worldViewport+.5)*roomUV.xy+roomUV.zw;
   a=1.-smoothstep(1.-327./1024.,1.-325./1024.,p.y);
   if(a<.001)discard;water=1.;
  }
  vec2 source=p;
  p.x+=sin(p.y*190.+time*.73)*.00035*water*livingEnabled;
  vec2 extended=p*vec2(1536./1598.,1024./1157.)+vec2(31./1598.,20./1157.);
  if(post>1.5){vec4 pier=texture(art,p);rgb=pier.rgb;a=pier.a;if(min(p.x,p.y)<0.||max(p.x,p.y)>1.)discard;}
  else if(water>.5){
   rgb=texture(exteriorOverscan,extended).rgb;
   float within=smoothstep(-.004,.004,min(min(p.x,p.y),min(1.-p.x,1.-p.y)));
   rgb=mix(rgb,texture(exterior,clamp(p,.001,.999)).rgb,within);
  }else rgb=texture(exteriorOverscan,extended).rgb;
  float silver=smoothstep(.27,.70,dot(rgb,vec3(.21,.72,.07)));
  float reflection=exp(-pow((p.x-moonReflectionSourceX)/.19,2.));
  float glitter=pow(max(0.,sin(p.x*650.+time*.33)*sin(p.y*390.-time*.21)),12.);
  rgb*=1.+water*silver*(sin(p.y*213.-time*.72)*.10+glitter*.24)*livingEnabled*(.22+.78*reflection);
  if(projectionGrid>.5){
   vec2 edge=abs(fract(source*10.-.5)-.5)/max(fwidth(source)*10.,vec2(.0001));
   float line=1.-smoothstep(.6,1.4,min(edge.x,edge.y));
   rgb=mix(rgb,water>.5?vec3(.1,1.,.6):vec3(1.,.65,.15),line*.8);
   if(min(extended.x,extended.y)<0.||max(extended.x,extended.y)>1.)rgb=vec3(1.,0.,.3);
  }
 }else if(mode<2.5){
  vec2 q=(vUV-.5)*2.;float r=length(q);vec2 p=vUV+vec2(noise(q*7.+time*.05),noise(q.yx*8.-time*.07))*.005*windLevel;
  rgb=texture(art,p).rgb*mix(vec3(.37,.61,.73),vec3(.57,.75,.89),smoothstep(12.,16.,time));
  float opening=smoothstep(15.3,18.6,time);
  a=mix(1.,smoothstep(.10,.21,r+noise(q*18.)*.009),opening);
 }else if(mode<3.5){
  vec2 p=(vWorld.xy*1150./(1150.-vWorld.z)/worldViewport+.5)*roomUV.xy+roomUV.zw;
  if(min(p.x,p.y)<0.||max(p.x,p.y)>1.){
   bool roof=post>.5&&post<1.5&&p.y>1.;
   bool leftWall=post>1.5&&post<2.5&&p.x<0.;
   bool rightWall=post>2.5&&post<3.5&&p.x>1.;
   if(!(roof||leftWall||rightWall))discard;
   color=vec4(extension(p),1.);return;
  }
  float hole=texture(apertureMap,p).r;
  if(post>8.5){a=1.;}
  else if(post<-.5){
   // Inpainted floor/wall is only backing behind disoccluded furniture.
   // No duplicate ceiling lanterns or foreground objects live on this plane.
   a=(1.-texture(backingAperture,p).r)*(1.-texture(matte2,p).g);
  }else if(post>7.5){
   // Correct only the small original-painting residual inside the physical
   // aperture, under entering timber. The continuous exterior already carries
   // the same moon, peaks, harbor and perspective throughout this shot.
   float settle=smoothstep(30.45,30.98,time);
   float materialPhase=sin(p.x*17.+sin(p.y*11.))*sin(p.y*19.)*.13;
   vec3 exteriorPaint=texture(art,p).rgb;
   float moon=1.-smoothstep(.028,.035,length((p-vec2(1167./1536.,1.-240./1024.))*vec2(1.5,1.)));
   float shore=1.-smoothstep(.006,.014,abs((1.-p.y)-.315));
   float exteriorOnly=max(smoothstep(1.,14.,exteriorPaint.b-exteriorPaint.r),max(moon,shore));
   a=hole*mix(exteriorOnly,1.,smoothstep(30.3,30.95,time))*smoothstep(0.,1.,clamp(settle+materialPhase*sin(settle*3.14159),0.,1.));
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
  if(a<.002)discard;rgb=texture(art,p).rgb;
  if(post>=0.)rgb=livingRoom(p,rgb);
  if(post>.5 && post<1.5)rgb=mix(rgb,texture(liveBacking,p).rgb,texture(matte2,p).g);
  if(post>.5 && post<1.5)rgb=mix(rgb,extension(p),smoothstep(.984,1.,p.y));
  if(post>=0. && post<.5)rgb=mix(rgb,texture(liveBacking,p).rgb,texture(matte2,p).g);
  if(post<-.5){float visibleFloor=texture(matte0,p).r*smoothstep(.45,.49,1.-p.y);rgb=mix(rgb,livingRoom(p,texture(roomOriginal,p).rgb),visibleFloor*smoothstep(30.,31.,time));}
  if(vDistance<600.){vec2 d=vec2(1.)/artSize*(1.-clamp(vDistance/600.,0.,1.))*2.;rgb=(rgb*4.+texture(art,p+d).rgb+texture(art,p-d).rgb+texture(art,p+vec2(d.x,-d.y)).rgb+texture(art,p+vec2(-d.x,d.y)).rgb)/8.;}
  float y=1.-gl_FragCoord.y/viewport.y;float local=(y*viewport.y-roomRect.y)/roomRect.w;
  rgb=mix(rgb,vec3(5.,9.,9.)/255.,clamp((local-.62)/.38,0.,1.)/3.);
 }
 else if(mode<4.5){vec4 lamp=texture(art,vUV);a=lamp.a;rgb=lamp.rgb*vec3(1.12,.92,.68);if(a<.002)discard;}
 else if(mode<5.5){
  vec2 p=vUV;
  float water=post<.5?1.-smoothstep(.53,.59,p.y):0.;
  p.x+=sin(p.y*213.+time*.81)*.00045*water;
  vec4 material=texture(art,p);rgb=material.rgb;a=material.a;
  if(post<.5){
    float silver=smoothstep(.32,.75,dot(rgb,vec3(.21,.72,.07)));
    float reflection=exp(-pow((p.x-moonReflectionSourceX)/.16,2.));
    rgb*=1.+water*silver*(sin(p.y*193.-time*.67)*.10+pow(max(0.,sin(p.x*740.+time*.31)*sin(p.y*390.-time*.23)),16.)*.24)*(.22+.78*reflection)*livingEnabled;
  }
  float distantFog=clamp((vDistance-6000.)/35000.,0.,.22);
  rgb=mix(rgb,vec3(.09,.15,.24),distantFog);
  // The material transition lies wholly behind the overlapping dense banks.
  // Volume transport does not restart, fade to a plate, or change velocity.
  a*=1.-smoothstep(24.05,24.65,time);
 }
 else {
  vec2 q=(vUV-.5)*2.;float r=length(q);
  vec2 sampleUV=vec2(1167./1536.,1.-240./1024.)+q*vec2(12./1536.,12./1024.);
  rgb=texture(art,sampleUV).rgb;
  // Optical transmission belongs to the actual fog in front of this body.
  // Never independently switch the moon off at the fog cue.
  a=1.-smoothstep(.85,1.,r);
  rgb+=vec3(.045,.06,.08)*(1.-r)*smoothstep(15.,18.,time);
 }
 if(time<10.)rgb=mix(vec3(.014,.085,.097),rgb,smoothstep(3.3,9.7,time));
 color=vec4(rgb*a,a);
}`;
export const environmentPlanes = [
  { name: "Stage B sky", z: -16000 },
  { name: "Final exterior sky", z: -12500 },
  { name: "Stage B far island", z: -8500 },
  { name: "Stage B middle island", z: -6400 },
  { name: "Stage B near shore", z: -4700 },
  { name: "Balcony structure", z: -2722.5 },
  { name: "Ceiling lantern", z: -1782 },
  { name: "Threshold lantern", z: -1200 },
  { name: "Near timber posts", z: -1089 },
  { name: "Couch", z: 200 },
  { name: "Table / lens foreground", z: 690 },
] as const;
