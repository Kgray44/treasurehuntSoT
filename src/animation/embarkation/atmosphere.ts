import {
  CUT,
  camera,
  composition,
  airTravel,
  fogPassage,
  poseAt,
  random,
  stormEnergy,
  smooth,
  type Actor,
  type Tier,
  type Vec3,
} from "./program";
import { fogBanksAt } from "./scene-space";
import { LENS_IMPACTS, LENS_LIFETIME, lensWaterState, lensWaterFragment } from "./lens-water";
import { eyePosition, rotateRoll, projectionGLSL, worldViewport } from "./projection";
import { bindFilmLens, filmLens, type LensSample } from "./exposure";
import { particleFrame, ParticleSampler } from "./particle-sampler";
import { allocateColor, colorGLSL, linearStorage, materialBlend } from "./color";
import { sceneColor } from "./scene-color";

const quadVertex = `#version 300 es
precision highp float;layout(location=0)in vec2 uv;out vec2 vUV;
void main(){vUV=uv;gl_Position=vec4(uv*2.-1.,0.,1.);}`;
const volumeFragment = `#version 300 es
precision highp float;precision highp sampler3D;
in vec2 vUV;out vec4 color;uniform sampler3D volumeNoise;uniform sampler2D surfaceDepth;
uniform vec4 clouds[16],fogBanks[28],fogShapes[28];uniform int count,bankCount,steps;uniform vec3 eye,moonPosition;
uniform vec2 viewport;uniform vec3 airAdvection;uniform float time,energy,nearPass,fogLevel,moonEnergy,roll;
uniform vec3 diagnosticMedium;
uniform sampler2D shutterFog,shutterDepth;
uniform vec3 shutterCamera;uniform vec4 shutterLens;uniform float shutterReuse,boundedDensity;
${projectionGLSL}
${colorGLSL}
float field(vec3 p){
 // World coordinates advect through the eye toward negative Z at all times.
 // The same broad vortex tubes shape the cloud field and physical material.
 vec3 q=p-airAdvection;
 float n=texture(volumeNoise,q*.000012).r*.54;
 n+=texture(volumeNoise,q*.000037+vec3(.17,.03,0.)).r*.29;
 n+=texture(volumeNoise,q*.00011).r*.12;
 n+=texture(volumeNoise,q*.00032).r*.05;
 return n;
}
float density(vec3 p,float n){
 float storm=0.;
 // The storm is exactly absent during the later advected-fog passage.
 // Avoid evaluating its Gaussian field only to multiply it by zero.
 if(energy>0.){
 float envelope=.018;for(int i=0;i<16;i++){if(i>=count)break;
  vec3 q=(p-clouds[i].xyz)/vec3(clouds[i].w,clouds[i].w*.62,clouds[i].w*1.15);
  envelope+=exp(-dot(q,q)*1.8);}
 storm=smoothstep(.48,.70,n)*min(envelope,2.8)*energy;
 storm*=nearPass>.5?.12:1.;
 // Authored open core in the storm volume. Once fog is integrated to actual
 // surfaces, the former near/far overlay split no longer artificially keeps
 // the title clear. A broad world-space low-density channel preserves the
 // contact composition while dense banks continue moving at its periphery.
 // This is density geometry, not a screen-space title mask or alpha bypass.
 float channelRadius=700.+sin((p.z-airAdvection.z)*.0003)*140.;
 vec2 channelCenter=vec2(100.,200.)+vec2(sin(p.z*.00017),cos(p.z*.00013))*90.;
 float channel=smoothstep(channelRadius*.55,channelRadius*1.45,length(p.xy-channelCenter));
 storm*=mix(.045,1.,channel);
 }
 float arriving=0.;
 for(int i=0;i<28;i++){if(i>=bankCount)break;
  vec3 q=(p-fogBanks[i].xyz)/vec3(fogBanks[i].w,fogShapes[i].x,fogShapes[i].y);
  // Bound before sampling expensive bank detail. The z warp is <= .31;
  // outside this box the Gaussian is < exp(-28.8). Even all 28 banks at
  // gain 10 contribute < 9e-11 density. Keep the unbounded reference path.
  if(boundedDensity>.5&&(abs(q.x)>4.||abs(q.y)>4.||abs(q.z)>4.31))continue;
  q.z+=sin(q.x*2.1+fogShapes[i].w)*.19+sin(q.y*3.4-fogShapes[i].w)*.12;
  float radiusSquared=dot(q,q);
  if(boundedDensity>.5&&radiusSquared>16.)continue;
  float shape=exp(-radiusSquared*1.8);
  float detail=texture(volumeNoise,(p-fogBanks[i].xyz)*.00024+vec3(fogShapes[i].w*.13)).r;
  arriving+=shape*fogShapes[i].z*smoothstep(.26,.72,mix(n,detail,.65)+sin(q.x*4.+q.y*2.+fogShapes[i].w)*.075);
 }
 return storm+arriving;
}
void main(){
 vec3 ray=filmRay(vUV,viewport,roll);
 vec3 lensEye=eye+filmRoll(vec3(filmAperture,0.),roll);
 float surface=FILM_NEAR/max(.0000001,1.-texture(surfaceDepth,vUV).r);
 float start=12.,finish=min(surface,12500.);
 if(diagnosticMedium.z>0.){start=max(start,diagnosticMedium.x);finish=min(finish,diagnosticMedium.y);}
 if(finish<=start){color=vec4(0.);return;}
 // Reuse only inside this 1/120-second exposure, never across displayed frames.
 // Reproject stationary surface/world rays; newly revealed or moving depth
 // edges retrace the volume. The reference path disables this approximation.
 if(shutterReuse>.5 && diagnosticMedium.z==0.){
  vec3 old=filmView(lensEye+ray*finish,shutterCamera,shutterLens.w);
  float d=FILM_FOCAL-old.z;
  vec2 p=(old.xy+shutterLens.xy*(d/shutterLens.z-1.))*FILM_FOCAL/d/viewport+.5;
  vec2 texel=1./vec2(textureSize(shutterFog,0));
  vec4 cached=texture(shutterFog,p);
  bool valid=all(greaterThan(p,texel*2.))&&all(lessThan(p,1.-texel*2.));
  for(int y=-1;y<=1;y+=2)for(int x=-1;x<=1;x+=2){
   vec2 neighbor=p+vec2(x,y)*texel*1.5;
   float prior=FILM_NEAR/max(.0000001,1.-texture(shutterDepth,neighbor).r);
   vec4 change=abs(texture(shutterFog,neighbor)-cached);
   bool sameLimit=(surface>=12500.&&prior>=12500.)||abs(prior-d)<max(.2,d*.00005);
   valid=valid&&sameLimit&&max(max(change.r,change.g),max(change.b,change.a))<.008;
  }
  if(valid){color=cached;return;}
 }
 float delta=(finish-start)/float(steps),transmission=1.;vec3 light=vec3(0.);
 float jitter=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
 vec3 moonDirection=normalize(moonPosition-lensEye);
 float angle=1.-dot(normalize(ray),moonDirection);
 float moonScatter=(exp(-angle*1800.)*.64+exp(-angle*180.)*.26+exp(-angle*18.)*.10)*moonEnergy;
 for(int i=0;i<40;i++){if(i>=steps)break;
  float distance=start+(float(i)+jitter)*delta;vec3 p=lensEye+ray*distance;
  float baseField=field(p);
  float d=diagnosticMedium.z>0.?diagnosticMedium.z:density(p,baseField),opacity=1.-exp(-d*delta*length(ray)*.00105);
  // Zero-opacity steps contribute neither radiance nor extinction. Keep
  // every ray step; omit only its otherwise invisible lighting evaluation.
  if(opacity==0.)continue;
  // Directional density gradients keep an opaque bank visibly volumetric.
  // The light pattern is evaluated in the same advected world field; it does
  // not become a flat tint when the landscape is completely occluded.
  vec3 towardMoon=normalize(moonPosition-p);
  float lightSide=field(p+towardMoon*800.);
  float silver=mix(.62+.22*lightSide,clamp(.56+(lightSide-baseField)*3.6,.22,1.25),fogLevel);
  vec3 tint=mix(srgbToLinear(vec3(.16,.29,.36)),srgbToLinear(vec3(.25,.34,.43)),fogLevel);
  // Light scatters inside attenuating banks. The disc remains behind them;
  // this is neither an overlay moon nor a separate screen-space light patch.
  vec3 lightPoint=p+towardMoon*900.;
  float moonTransmission=moonScatter>0.?exp(-density(lightPoint,field(lightPoint))*.32):1.;
  tint+=srgbToLinear(vec3(.48,.54,.63))*moonScatter*moonTransmission;
  if(diagnosticMedium.z>0.){tint=vec3(1.);silver=1.;}
  light+=transmission*opacity*tint*silver;
  transmission*=1.-opacity;if(transmission<.009)break;
 }
 color=vec4(light,1.-transmission);
}`;
const copyFragment = `#version 300 es
precision highp float;in vec2 vUV;out vec4 color;uniform sampler2D art,surfaceDepth;
${projectionGLSL}
float axial(vec2 p){return FILM_NEAR/max(.0000001,1.-texture(surfaceDepth,p).r);}
void main(){
 vec2 size=vec2(textureSize(art,0)),cell=vUV*size-.5,base=floor(cell),f=fract(cell);
 float target=axial(vUV),weight=0.,bestDifference=1e30;vec4 sum=vec4(0.),best=vec4(0.);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec2 p=(base+vec2(x,y)+.5)/size;
  float difference=abs(axial(p)-target);
  float w=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y)*exp(-difference/max(20.,target*.015));
  vec4 sampleColor=texture(art,p);sum+=sampleColor*w;weight+=w;
  if(difference<bestDifference){bestDifference=difference;best=sampleColor;}
 }
 color=weight>.00001?sum/weight:best;
}`;
const particleVertex = `#version 300 es
precision highp float;layout(location=0)in vec2 uv;
layout(location=1)in vec4 centerSize;layout(location=2)in vec4 driftAlphaPhase;
out vec2 vUV;out float vAlpha,vPhase;uniform vec3 cameraPosition;uniform vec2 viewport;
uniform float kind,roll;
${projectionGLSL}
void main(){
 vUV=uv;vAlpha=driftAlphaPhase.z;vPhase=driftAlphaPhase.w;
 vec3 p=filmView(centerSize.xyz,cameraPosition,roll);
 float angle=atan(driftAlphaPhase.y,driftAlphaPhase.x);
 // A slightly elongated droplet is material shape; temporal exposure supplies
 // its motion streak instead of stretching a 12-ms center displacement.
 float stretch=kind>1.5?1.12+.28*abs(sin(driftAlphaPhase.w)):1.;
 vec2 local=(uv-.5)*centerSize.w*vec2(stretch,1.);
 if(kind>1.5)local=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*local;
 p.xy+=local;
 gl_Position=filmClipView(p,viewport);
}`;
const particleFragment = `#version 300 es
precision highp float;in vec2 vUV;in float vAlpha,vPhase;out vec4 color;
uniform sampler2D art;uniform float kind,time;
${colorGLSL}
void main(){
 vec4 material;
 if(kind>1.5){
  vec2 q=(vUV-.5)*2.;float r=length(q);
  float edge=1.-smoothstep(.34,.8,r);
  float meniscus=exp(-pow((r-.49)*10.,2.));
  float highlight=exp(-dot(q-vec2(-.21,.25),q-vec2(-.21,.25))*19.);
  material=vec4(srgbToLinear(vec3(.29,.50,.60))+highlight*.4+meniscus*.12,edge*(.38+highlight*.48));
 }else{material=artwork(art,vUV);if(kind>.5)material.rgb=displayGrade(material.rgb,vec3(1.2,.66,.27),vec3(0.));}
 float a=material.a*vAlpha; if(a<.002)discard;
 color=vec4(material.rgb*a,a);
}`;
/** Owned GPU weather resources. Noise and particle paths are deterministic;
 * no DOM capture, streaming dependency, or persistent lens overlay is used. */
export class Atmosphere {
  private programs: WebGLProgram[] = [];
  private buffers: WebGLBuffer[] = [];
  private vaos: WebGLVertexArrayObject[] = [];
  private textures: WebGLTexture[] = [];
  private volume: WebGLProgram;
  private particles: WebGLProgram;
  private copy: WebGLProgram;
  private lens: WebGLProgram;
  private quad: WebGLVertexArrayObject;
  private instances: WebGLVertexArrayObject;
  private instanceBuffer: WebGLBuffer;
  private noise: WebGLTexture;
  private low: WebGLTexture;
  private scenery: WebGLTexture;
  private foreground: WebGLTexture;
  private shutterFog: WebGLTexture;
  private shutterSurface: WebGLTexture;
  private depthRead: WebGLFramebuffer;
  private depthWrite: WebGLFramebuffer;
  private shutter: {
    ready: boolean;
    camera?: ReturnType<typeof camera>;
    lens?: LensSample;
    depth?: WebGLTexture;
  } | null = null;
  beginExposure(reuse: boolean) {
    this.shutter = reuse ? { ready: false } : null;
  }
  endExposure() {
    this.shutter = null;
  }
  private framebuffer: WebGLFramebuffer;
  private w = 0;
  private h = 0;
  private lw = 0;
  private lh = 0;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private data = new Float32Array(4800 * 8);
  private particleGroups = new WeakMap<
    Actor[],
    Array<Array<{ actor: Actor; index: number; sampler: ParticleSampler }>>
  >();
  private moon: Vec3 = [0, 0, -16000];
  setMoon(position: Vec3) {
    this.moon = position;
  }
  constructor(
    private g: WebGL2RenderingContext,
    seed: number,
    private tier: Tier,
  ) {
    this.volume = this.program(quadVertex, volumeFragment);
    this.copy = this.program(quadVertex, copyFragment);
    this.particles = this.program(particleVertex, particleFragment);
    this.lens = this.program(quadVertex, lensWaterFragment);
    const q = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
    const setup = () => {
      const vao = g.createVertexArray()!;
      this.vaos.push(vao);
      g.bindVertexArray(vao);
      const b = g.createBuffer()!;
      this.buffers.push(b);
      g.bindBuffer(g.ARRAY_BUFFER, b);
      g.bufferData(g.ARRAY_BUFFER, q, g.STATIC_DRAW);
      g.enableVertexAttribArray(0);
      g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
      return vao;
    };
    this.quad = setup();
    this.instances = setup();
    this.instanceBuffer = g.createBuffer()!;
    this.buffers.push(this.instanceBuffer);
    g.bindBuffer(g.ARRAY_BUFFER, this.instanceBuffer);
    g.bufferData(g.ARRAY_BUFFER, this.data.byteLength, g.DYNAMIC_DRAW);
    for (let i = 1; i <= 2; i++) {
      g.enableVertexAttribArray(i);
      g.vertexAttribPointer(i, 4, g.FLOAT, false, 32, (i - 1) * 16);
      g.vertexAttribDivisor(i, 1);
    }
    this.noise = g.createTexture()!;
    this.textures.push(this.noise);
    g.bindTexture(g.TEXTURE_3D, this.noise);
    const rng = random(seed ^ 0x7a5c31),
      voxels = new Uint8Array(64 ** 3);
    for (let i = 0; i < voxels.length; i++) voxels[i] = Math.floor(rng() * 256);
    g.texImage3D(g.TEXTURE_3D, 0, g.R8, 64, 64, 64, 0, g.RED, g.UNSIGNED_BYTE, voxels);
    for (const p of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER]) g.texParameteri(g.TEXTURE_3D, p, g.LINEAR);
    for (const p of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T, g.TEXTURE_WRAP_R]) g.texParameteri(g.TEXTURE_3D, p, g.REPEAT);
    this.low = this.texture();
    this.scenery = this.texture();
    this.foreground = this.texture();
    this.shutterFog = this.texture();
    this.shutterSurface = this.texture();
    for (const filter of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER]) g.texParameteri(g.TEXTURE_2D, filter, g.NEAREST);
    this.depthRead = g.createFramebuffer()!;
    this.depthWrite = g.createFramebuffer()!;
    this.framebuffer = g.createFramebuffer()!;
  }
  private program(v: string, f: string) {
    const g = this.g,
      p = g.createProgram()!;
    for (const [type, text] of [
      [g.VERTEX_SHADER, v],
      [g.FRAGMENT_SHADER, f],
    ] as const) {
      const s = g.createShader(type)!;
      g.shaderSource(s, text);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) ?? "weather-shader");
      g.attachShader(p, s);
      g.deleteShader(s);
    }
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p) ?? "weather-link");
    this.programs.push(p);
    return p;
  }
  private u(p: WebGLProgram, n: string) {
    let map = this.uniforms.get(p);
    if (!map) {
      map = new Map();
      this.uniforms.set(p, map);
    }
    if (!map.has(n)) map.set(n, this.g.getUniformLocation(p, n));
    return map.get(n)!;
  }
  private texture() {
    const g = this.g,
      t = g.createTexture()!;
    this.textures.push(t);
    g.bindTexture(g.TEXTURE_2D, t);
    for (const p of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER]) g.texParameteri(g.TEXTURE_2D, p, g.LINEAR);
    for (const p of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T]) g.texParameteri(g.TEXTURE_2D, p, g.CLAMP_TO_EDGE);
    return t;
  }
  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    const g = this.g;
    this.w = w;
    this.h = h;
    const scale = this.tier === "CINEMATIC" ? 0.5 : this.tier === "BALANCED" ? 0.375 : 0.25;
    this.lw = Math.ceil(w * scale);
    this.lh = Math.ceil(h * scale);
    for (const t of [this.low, this.shutterFog, this.scenery, this.foreground]) {
      allocateColor(
        g,
        t,
        t === this.low || t === this.shutterFog ? this.lw : w,
        t === this.low || t === this.shutterFog ? this.lh : h,
        linearStorage(g),
      );
    }
    this.resizeShutterDepth();
  }
  private resizeShutterDepth() {
    const g = this.g;
    g.bindTexture(g.TEXTURE_2D, this.shutterSurface);
    g.texImage2D(g.TEXTURE_2D, 0, g.DEPTH_COMPONENT24, this.w, this.h, 0, g.DEPTH_COMPONENT, g.UNSIGNED_INT, null);
    g.bindFramebuffer(g.FRAMEBUFFER, this.depthWrite);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.TEXTURE_2D, this.shutterSurface, 0);
    g.drawBuffers([g.NONE]);
    g.readBuffer(g.NONE);
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
      throw new Error("shutter-depth-unavailable");
    g.bindFramebuffer(g.FRAMEBUFFER, null);
  }
  get bytes() {
    return (this.w * this.h * 2 + this.lw * this.lh * 2) * linearStorage(this.g).bytes + this.w * this.h * 4 + 64 ** 3;
  }
  mist(
    time: number,
    actors: Actor[],
    width: number,
    height: number,
    depthSource: WebGLTexture | (() => WebGLTexture),
    diagnosticMedium?: [number, number, number],
  ) {
    const energy = stormEnergy(time),
      fog = fogPassage(time);
    const banks = fogBanksAt(time);
    if (energy < 0.001 && banks.length === 0 && !diagnosticMedium) return;
    const depth = typeof depthSource === "function" ? depthSource() : depthSource;
    const g = this.g,
      p = this.volume;
    const framebuffer = g.getParameter(g.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const clouds = actors
      .filter((a) => a.material === "mist" && time >= a.birth && time < a.birth + 16)
      .sort((a, b) => b.birth - a.birth)
      .slice(0, 16);

    const fields = new Float32Array(64);
    clouds.forEach((a, i) => {
      const pose = poseAt(a, time, width, height);
      fields.set([...pose.position, pose.size * (1 + (time - a.birth) * 0.12)], i * 4);
    });
    g.bindFramebuffer(g.FRAMEBUFFER, this.framebuffer);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, this.low, 0);
    g.viewport(0, 0, this.lw, this.lh);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.disable(g.DEPTH_TEST);
    g.useProgram(p);
    bindFilmLens(g, p);
    const cached = this.shutter?.ready ? this.shutter : null;
    g.uniform1f(this.u(p, "shutterReuse"), cached ? 1 : 0);
    g.uniform1f(this.u(p, "boundedDensity"), this.shutter ? 1 : 0);
    g.activeTexture(g.TEXTURE12);
    g.bindTexture(g.TEXTURE_2D, this.shutterFog);
    g.uniform1i(this.u(p, "shutterFog"), 12);
    g.activeTexture(g.TEXTURE13);
    g.bindTexture(g.TEXTURE_2D, cached?.depth ?? depth);
    g.uniform1i(this.u(p, "shutterDepth"), 13);
    if (cached) {
      g.uniform3fv(this.u(p, "shutterCamera"), cached.camera!.position);
      g.uniform4f(this.u(p, "shutterLens"), ...cached.lens!.aperture, cached.lens!.focus, cached.camera!.roll);
    }
    g.uniform3fv(this.u(p, "diagnosticMedium"), diagnosticMedium ?? [0, 0, 0]);
    g.bindVertexArray(this.quad);
    g.activeTexture(g.TEXTURE10);
    g.bindTexture(g.TEXTURE_3D, this.noise);
    g.uniform1i(this.u(p, "volumeNoise"), 10);
    g.activeTexture(g.TEXTURE11);
    g.bindTexture(g.TEXTURE_2D, depth);
    g.uniform1i(this.u(p, "surfaceDepth"), 11);
    g.uniform4fv(this.u(p, "clouds[0]"), fields);
    const bankFields = new Float32Array(28 * 4),
      bankShapes = new Float32Array(28 * 4);
    banks.forEach((b, i) => {
      bankFields.set([...b.position, b.radiusX], i * 4);
      bankShapes.set([b.radiusY, b.radiusZ, b.gain, b.phase], i * 4);
    });
    g.uniform4fv(this.u(p, "fogBanks[0]"), bankFields);
    g.uniform4fv(this.u(p, "fogShapes[0]"), bankShapes);
    g.uniform1i(this.u(p, "bankCount"), banks.length);
    g.uniform1i(this.u(p, "count"), clouds.length);
    g.uniform1i(this.u(p, "steps"), this.tier === "CINEMATIC" ? 36 : this.tier === "BALANCED" ? 24 : 14);
    g.uniform3fv(this.u(p, "eye"), eyePosition(camera(time)));
    g.uniform1f(this.u(p, "roll"), camera(time).roll);
    g.uniform3fv(this.u(p, "airAdvection"), airTravel(time));
    g.uniform2fv(this.u(p, "viewport"), worldViewport({ width, height }));
    g.uniform1f(this.u(p, "time"), time);
    // Storm mass is left behind before the landscape hold; fog later comes
    // from its own continuously advected banks, not a lingering storm veil.
    const opening = 1 - 0.84 * Math.max(0, Math.min(1, (time - 15.4) / 3));
    g.uniform1f(this.u(p, "energy"), energy * 4.5 * opening);
    g.uniform1f(this.u(p, "nearPass"), 0);
    g.uniform1f(this.u(p, "fogLevel"), fog);
    g.uniform3fv(this.u(p, "moonPosition"), this.moon);
    g.uniform1f(this.u(p, "moonEnergy"), smooth(14.5, 16, time));
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.drawArrays(g.TRIANGLES, 0, 6);
    if (this.shutter && !this.shutter.ready) {
      g.activeTexture(g.TEXTURE12);
      g.bindTexture(g.TEXTURE_2D, this.shutterFog);
      g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, this.lw, this.lh);
      // SurfaceDepth reuses one attachment for every lens sample. Retaining
      // its reference compares old fog against NEW depth, rejecting valid
      // camera motion (and potentially accepting an incorrect moving edge).
      // Copy between owned DEPTH_COMPONENT24 attachments, never the platform's
      // implementation-defined default-framebuffer depth format.
      g.bindFramebuffer(g.READ_FRAMEBUFFER, this.depthRead);
      g.framebufferTexture2D(g.READ_FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.TEXTURE_2D, depth, 0);
      g.readBuffer(g.NONE);
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER, this.depthWrite);
      g.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, g.DEPTH_BUFFER_BIT, g.NEAREST);
      this.shutter = { ready: true, camera: camera(time), lens: filmLens(g), depth: this.shutterSurface };
    }
    g.bindFramebuffer(g.FRAMEBUFFER, framebuffer);
    g.viewport(0, 0, this.w, this.h);
    g.useProgram(this.copy);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, this.low);
    g.uniform1i(this.u(this.copy, "art"), 0);
    g.uniform1i(this.u(this.copy, "surfaceDepth"), 11);
    g.drawArrays(g.TRIANGLES, 0, 6);
  }
  particlesAt(
    time: number,
    actors: Actor[],
    width: number,
    height: number,
    texture: (key: string) => WebGLTexture | undefined,
    only?: string,
    layers?: Set<string>,
    reference = false,
  ) {
    const g = this.g,
      p = this.particles,
      cam = camera(time);
    if (time > CUT.threshold) return;
    let groups = this.particleGroups.get(actors);
    if (!groups) {
      groups = Array.from({ length: 9 }, () => []);
      actors.forEach((actor, index) => {
        if (actor.layer === "spray") groups![8].push({ actor, index, sampler: new ParticleSampler(actor) });
        else if (actor.layer === "particles") {
          const group = Number(actor.asset.at(-1)) + (actor.asset.includes("ember") ? 4 : 0);
          if (Number.isInteger(group) && group >= 0 && group < 8)
            groups![group].push({ actor, index, sampler: new ParticleSampler(actor) });
        }
      });
      this.particleGroups.set(actors, groups);
    }
    const spread = composition(width, height).spread;
    const frame = particleFrame(time, width, height);
    g.enable(g.DEPTH_TEST);
    g.depthFunc(g.LEQUAL);
    g.depthMask(false);
    g.useProgram(p);
    bindFilmLens(g, p);
    g.bindVertexArray(this.instances);
    g.uniform3fv(this.u(p, "cameraPosition"), cam.position);
    g.uniform1f(this.u(p, "roll"), cam.roll);
    g.uniform2fv(this.u(p, "viewport"), worldViewport({ width, height }));
    g.uniform1f(this.u(p, "time"), time);
    g.activeTexture(g.TEXTURE0);
    for (let group = 0; group < 9; group++) {
      const kind = group === 8 ? 2 : group >= 4 ? 1 : 0,
        key = `derived/${kind === 1 ? "ember" : "particle"}-${group % 4}`;
      let n = 0;
      for (const { actor: a, index: i, sampler } of groups[group]) {
        if (time < a.birth) continue;
        if ((only && a.layer !== only) || (layers && !layers.has(a.layer))) continue;
        if ((this.tier === "PERFORMANCE" && i % 3) || (this.tier === "BALANCED" && i % 2)) continue;
        if (!reference) {
          if (sampler.write(frame, this.data, n * 8)) n++;
          continue;
        }
        const pose = poseAt(a, time, width, height);
        if (pose.alpha < 0.001) continue;
        const d = 1150 + cam.position[2] - pose.position[2];
        if (d < -pose.size || d > 26000) continue;
        // Liquid shape follows physical velocity, not a camera-derived smear.
        // Photographic exposure already integrates the camera and silhouette.
        const velocity = kind === 2 && pose.velocity ? pose.velocity : [0, 0, 0];
        const [vx, vy] = rotateRoll([velocity[0] * spread, velocity[1], velocity[2]], -cam.roll);
        this.data.set([...pose.position, pose.size, vx, vy, pose.alpha, a.phase], n++ * 8);
      }
      if (!n) continue;
      g.bindTexture(g.TEXTURE_2D, texture(key) ?? this.low);
      g.uniform1i(this.u(p, "art"), 0);
      g.uniform1f(this.u(p, "kind"), kind);
      g.bindBuffer(g.ARRAY_BUFFER, this.instanceBuffer);
      g.bufferSubData(g.ARRAY_BUFFER, 0, this.data.subarray(0, n * 8));
      materialBlend(g, kind !== 2);
      g.drawArraysInstanced(g.TRIANGLES, 0, 6, n);
    }
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  }
  lensActive(t: number) {
    return LENS_IMPACTS.some((impact) => t >= impact.time && t <= impact.time + LENS_LIFETIME);
  }
  captureScenery(t: number) {
    if (!this.lensActive(t)) return;
    const g = this.g;
    const scene = sceneColor(g);
    if (scene) {
      scene.copyTo(this.scenery);
      return;
    }
    g.activeTexture(g.TEXTURE11);
    g.bindTexture(g.TEXTURE_2D, this.scenery);
    g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, this.w, this.h);
  }
  lensAt(t: number) {
    if (!this.lensActive(t)) return;
    const g = this.g,
      p = this.lens;
    g.disable(g.DEPTH_TEST);
    g.depthMask(false);
    g.activeTexture(g.TEXTURE12);
    const scene = sceneColor(g);
    if (scene) scene.copyTo(this.foreground);
    else {
      g.bindTexture(g.TEXTURE_2D, this.foreground);
      g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, this.w, this.h);
    }
    g.activeTexture(g.TEXTURE12);
    g.bindTexture(g.TEXTURE_2D, this.foreground);
    g.activeTexture(g.TEXTURE11);
    g.bindTexture(g.TEXTURE_2D, this.scenery);
    g.useProgram(p);
    g.bindVertexArray(this.quad);
    g.uniform1i(this.u(p, "scenery"), 11);
    g.uniform1i(this.u(p, "foreground"), 12);
    const water = lensWaterState(t, this.w, this.h);
    g.uniform1i(this.u(p, "bulbCount"), water.bulbs.length / 4);
    g.uniform1i(this.u(p, "trailCount"), water.trails.length / 4);
    if (water.bulbs.length) g.uniform4fv(this.u(p, "bulbs"), water.bulbs);
    if (water.trails.length) g.uniform4fv(this.u(p, "trails"), water.trails);
    g.uniform2f(this.u(p, "viewport"), this.w, this.h);
    g.disable(g.BLEND);
    g.drawArrays(g.TRIANGLES, 0, 6);
    g.enable(g.BLEND);
  }
  dispose() {
    const g = this.g;
    this.programs.forEach((p) => g.deleteProgram(p));
    this.buffers.forEach((b) => g.deleteBuffer(b));
    this.vaos.forEach((v) => g.deleteVertexArray(v));
    this.textures.forEach((t) => g.deleteTexture(t));
    g.deleteFramebuffer(this.framebuffer);
    g.deleteFramebuffer(this.depthRead);
    g.deleteFramebuffer(this.depthWrite);
  }
}
