import {
  CUT,
  camera,
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

const quadVertex = `#version 300 es
precision highp float;layout(location=0)in vec2 uv;out vec2 vUV;
void main(){vUV=uv;gl_Position=vec4(uv*2.-1.,0.,1.);}`;
const volumeFragment = `#version 300 es
precision highp float;precision highp sampler3D;
in vec2 vUV;out vec4 color;uniform sampler3D volumeNoise;
uniform vec4 clouds[16],fogBanks[28],fogShapes[28];uniform int count,bankCount,steps;uniform vec3 eye,moonPosition;
uniform vec2 viewport;uniform float time,energy,nearPass,fogLevel,moonEnergy;
float field(vec3 p){
 // World coordinates advect through the eye toward negative Z at all times.
 // The same broad vortex tubes shape the cloud field and physical material.
 vec3 q=p;q.z+=time*1900.;
 for(int i=0;i<2;i++){
  float f=float(i),cx=(i==0?380.:-480.)+sin(p.z*.0009+time*.45+f)*180.;
  float cy=(i==0?-100.:170.)+cos(p.z*.0007-time*.53+f)*110.;
  vec2 d=p.xy-vec2(cx,cy);float swirl=exp(-dot(d,d)/420000.)*(i==0?1.65:-1.25);
  q.xy+=vec2(-d.y,d.x)*swirl*.28;
 }
 float n=texture(volumeNoise,q*.000012).r*.54;
 n+=texture(volumeNoise,q*.000037+vec3(.17,.03,0.)).r*.29;
 n+=texture(volumeNoise,q*.00011).r*.12;
 n+=texture(volumeNoise,q*.00032).r*.05;
 return n;
}
float density(vec3 p){
 float envelope=.018;for(int i=0;i<16;i++){if(i>=count)break;
  vec3 q=(p-clouds[i].xyz)/vec3(clouds[i].w,clouds[i].w*.62,clouds[i].w*1.15);
  envelope+=exp(-dot(q,q)*1.8);}
 float n=field(p);
 float storm=smoothstep(.48,.70,n)*min(envelope,2.8)*energy;
 storm*=nearPass>.5?.12:1.;
 float arriving=0.;
 for(int i=0;i<28;i++){if(i>=bankCount)break;
  vec3 q=(p-fogBanks[i].xyz)/vec3(fogBanks[i].w,fogShapes[i].x,fogShapes[i].y);
  q.z+=sin(q.x*2.1+fogShapes[i].w)*.19+sin(q.y*3.4-fogShapes[i].w)*.12;
  float shape=exp(-dot(q,q)*1.8);
  float detail=texture(volumeNoise,(p-fogBanks[i].xyz)*.00024+vec3(fogShapes[i].w*.13)).r;
  arriving+=shape*fogShapes[i].z*smoothstep(.26,.72,mix(n,detail,.65)+sin(q.x*4.+q.y*2.+fogShapes[i].w)*.075);
 }
 return storm+arriving;
}
void main(){
 vec3 ray=vec3((vUV-.5)*viewport/1150.,-1.);
 float start=nearPass>.5?12.:780.,finish=nearPass>.5?780.:12500.;
 float delta=(finish-start)/float(steps),transmission=1.;vec3 light=vec3(0.);
 float jitter=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
 vec3 moonDirection=normalize(moonPosition-eye);
 float angle=1.-dot(normalize(ray),moonDirection);
 float moonScatter=(exp(-angle*1800.)*.64+exp(-angle*180.)*.26+exp(-angle*18.)*.10)*moonEnergy;
 for(int i=0;i<40;i++){if(i>=steps)break;
  float distance=start+(float(i)+jitter)*delta;vec3 p=eye+ray*distance;
  float d=density(p),opacity=1.-exp(-d*delta*.00105);
  // Directional density gradients keep an opaque bank visibly volumetric.
  // The light pattern is evaluated in the same advected world field; it does
  // not become a flat tint when the landscape is completely occluded.
  vec3 towardMoon=normalize(moonPosition-p);
  float lightSide=field(p+towardMoon*800.);
  float silver=mix(.62+.22*lightSide,clamp(.56+(lightSide-field(p))*3.6,.22,1.25),fogLevel);
  vec3 tint=mix(vec3(.16,.29,.36),vec3(.25,.34,.43),fogLevel);
  // Light scatters inside attenuating banks. The disc remains behind them;
  // this is neither an overlay moon nor a separate screen-space light patch.
  float moonTransmission=exp(-density(p+towardMoon*900.)*.32);
  tint+=vec3(.48,.54,.63)*moonScatter*moonTransmission;
  light+=transmission*opacity*tint*silver;
  transmission*=1.-opacity;if(transmission<.009)break;
 }
 color=vec4(light,1.-transmission);
}`;
const copyFragment = `#version 300 es
precision highp float;in vec2 vUV;out vec4 color;uniform sampler2D art;
void main(){color=texture(art,vUV);}`;
const particleVertex = `#version 300 es
precision highp float;layout(location=0)in vec2 uv;
layout(location=1)in vec4 centerSize;layout(location=2)in vec4 driftAlphaPhase;
out vec2 vUV;out float vAlpha,vPhase,vBlur;uniform vec3 cameraPosition;uniform vec2 viewport;
uniform float kind;
void main(){
 vUV=uv;vAlpha=driftAlphaPhase.z;vPhase=driftAlphaPhase.w;
 vec3 p=centerSize.xyz-cameraPosition;float distance=1150.-p.z;
 float angle=atan(driftAlphaPhase.y,driftAlphaPhase.x);
 float stretch=kind>1.5?1.+min(7.,length(driftAlphaPhase.xy)*.12)*(.4+.6*abs(sin(driftAlphaPhase.w))):1.;
 vec2 local=(uv-.5)*centerSize.w*vec2(stretch,1.);
 if(kind>1.5)local=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*local;
 p.xy+=local;vBlur=clamp(abs(distance-1550.)/4800.,0.,1.);
 gl_Position=vec4(p.xy*1150./(viewport*.5),distance-8.,distance);
}`;
const particleFragment = `#version 300 es
precision highp float;in vec2 vUV;in float vAlpha,vPhase,vBlur;out vec4 color;
uniform sampler2D art;uniform float kind,time;
void main(){
 vec4 material;
 if(kind>1.5){
  vec2 q=(vUV-.5)*2.;float r=length(q);
  float edge=1.-smoothstep(.34-vBlur*.15,.8+vBlur*.2,r);
  float meniscus=exp(-pow((r-.49)*10.,2.));
  float highlight=exp(-dot(q-vec2(-.21,.25),q-vec2(-.21,.25))*19.);
  material=vec4(vec3(.29,.50,.60)+highlight*.4+meniscus*.12,edge*(.38+highlight*.48));
 }else{material=texture(art,vUV);if(kind>.5)material.rgb*=vec3(1.2,.66,.27);}
 float a=material.a*vAlpha; if(a<.002)discard;
 color=vec4(material.rgb*a,a);
}`;
const lensFragment = `#version 300 es
precision highp float;in vec2 vUV;out vec4 color;uniform sampler2D scenery,foreground;
uniform float time;uniform vec2 viewport;
vec4 combined(vec2 p){vec4 f=texture(foreground,p);return f+texture(scenery,p)*(1.-f.a);}
void main(){
 vec4 original=texture(foreground,vUV);vec2 gradient=vec2(0.);float coverage=0.,rim=0.,glint=0.,shade=0.;
 for(int i=0;i<12;i++){
  float index=float(i),birth=i<4?6.05:(i<8?10.65:14.6),age=time-birth;
  if(age<0.||age>4.7)continue;
  float phase=index*2.399963;
  vec2 origin=vec2(.5+cos(phase)*.37,.63+sin(phase)*.23);
  float slide=max(0.,age-.78),run=slide*slide*.069;
  vec2 center=origin+vec2(sin(age*.9+phase)*.004,-run);
  vec2 radius=vec2(.013+mod(index,4.)*.005,.018+mod(index,3.)*.008);
  float impact=1.+exp(-age*13.)*sin(age*44.)*.38;
  radius*=impact;radius.y*=1.+slide*.7;radius.x*=1.-min(.4,slide*.13);
  vec2 q=(vUV-center)/radius; q.x*=viewport.x/viewport.y*.68;
  // Bulb deforms under gravity; a smaller adhered satellite joins its lower
  // edge, while the thin film left behind drains in the same direction.
  float r=length(q),satellite=length((q-vec2(.23,.88))/vec2(.53,.66));
  float liquid=min(r,satellite);
  float a=(1.-smoothstep(.82,1.04,liquid))*smoothstep(0.,.045,age);
  float tailY=(vUV.y-center.y)/max(.001,run);
  float trail=(1.-smoothstep(radius.x*.08,radius.x*.21,abs(vUV.x-center.x)))*smoothstep(0.,.12,tailY)*(1.-smoothstep(.8,1.,tailY))*.19;
  a=max(a,trail*smoothstep(.2,.8,slide));
  float belly=sqrt(max(0.,1.-min(1.,liquid*liquid)));
  gradient+=q*belly*radius*.72*a;
  coverage=max(coverage,a);rim+=exp(-pow((liquid-.9)*23.,2.))*.22*a;
  glint+=exp(-dot(q-vec2(-.34,.49),q-vec2(-.34,.49))*105.)*.18*a;
  shade+=exp(-pow((liquid-.82)*19.,2.))*max(0.,q.y)*.16*a;
 }
 if(coverage<.001){color=original;return;}
 vec4 refracted=combined(clamp(vUV-gradient,vec2(.001),vec2(.999)));
 refracted.rgb=refracted.rgb*(1.-shade)+vec3(.32,.40,.46)*rim+vec3(.74,.85,.91)*glint;
 color=mix(original,refracted,coverage);
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
  private framebuffer: WebGLFramebuffer;
  private w = 0;
  private h = 0;
  private lw = 0;
  private lh = 0;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private data = new Float32Array(4800 * 8);
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
    this.lens = this.program(quadVertex, lensFragment);
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
    for (const t of [this.low, this.scenery, this.foreground]) {
      g.bindTexture(g.TEXTURE_2D, t);
      g.texImage2D(
        g.TEXTURE_2D,
        0,
        g.RGBA,
        t === this.low ? this.lw : w,
        t === this.low ? this.lh : h,
        0,
        g.RGBA,
        g.UNSIGNED_BYTE,
        null,
      );
    }
  }
  get bytes() {
    return (this.w * this.h * 2 + this.lw * this.lh) * 4 + 64 ** 3;
  }
  mist(time: number, actors: Actor[], width: number, height: number, near = false) {
    const energy = stormEnergy(time),
      fog = fogPassage(time);
    const banks = fogBanksAt(time);
    if (energy < 0.001 && banks.length === 0) return;
    const g = this.g,
      p = this.volume,
      cam = camera(time).position;
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
    g.bindVertexArray(this.quad);
    g.activeTexture(g.TEXTURE10);
    g.bindTexture(g.TEXTURE_3D, this.noise);
    g.uniform1i(this.u(p, "volumeNoise"), 10);
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
    g.uniform3fv(this.u(p, "eye"), [cam[0], cam[1], cam[2] + 1150]);
    g.uniform2f(this.u(p, "viewport"), (1100 * width) / height, 1100);
    g.uniform1f(this.u(p, "time"), time);
    // Storm mass is left behind before the landscape hold; fog later comes
    // from its own continuously advected banks, not a lingering storm veil.
    const opening = 1 - 0.84 * Math.max(0, Math.min(1, (time - 15.4) / 3));
    g.uniform1f(this.u(p, "energy"), energy * 4.5 * opening);
    g.uniform1f(this.u(p, "nearPass"), near ? 1 : 0);
    g.uniform1f(this.u(p, "fogLevel"), fog);
    g.uniform3fv(this.u(p, "moonPosition"), this.moon);
    g.uniform1f(this.u(p, "moonEnergy"), smooth(14.5, 16, time));
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.drawArrays(g.TRIANGLES, 0, 6);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, this.w, this.h);
    g.useProgram(this.copy);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, this.low);
    g.uniform1i(this.u(this.copy, "art"), 0);
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
  ) {
    const g = this.g,
      p = this.particles,
      cam = camera(time).position;
    g.useProgram(p);
    g.bindVertexArray(this.instances);
    g.uniform3fv(this.u(p, "cameraPosition"), cam);
    g.uniform2f(this.u(p, "viewport"), (1100 * width) / height, 1100);
    g.uniform1f(this.u(p, "time"), time);
    g.activeTexture(g.TEXTURE0);
    for (let group = 0; group < 9; group++) {
      const kind = group === 8 ? 2 : group >= 4 ? 1 : 0,
        key = `derived/${kind === 1 ? "ember" : "particle"}-${group % 4}`;
      let n = 0;
      for (let i = 0; i < actors.length; i++) {
        const a = actors[i];
        if (time < a.birth || time > CUT.threshold || (a.layer !== "particles" && a.layer !== "spray")) continue;
        if ((only && a.layer !== only) || (layers && !layers.has(a.layer))) continue;
        if ((this.tier === "PERFORMANCE" && i % 3) || (this.tier === "BALANCED" && i % 2)) continue;
        if (kind === 2 ? a.layer !== "spray" : a.asset !== key) continue;
        const pose = poseAt(a, time, width, height);
        if (pose.alpha < 0.001) continue;
        const previous = poseAt(a, time - 0.012, width, height),
          d = 1150 - pose.position[2] + cam[2],
          pd = 1150 - previous.position[2] + cam[2];
        if (d < -pose.size || d > 26000) continue;
        const vx =
          ((pose.position[0] - cam[0]) * 1150) / Math.max(8, d) -
          ((previous.position[0] - cam[0]) * 1150) / Math.max(8, pd);
        const vy =
          ((pose.position[1] - cam[1]) * 1150) / Math.max(8, d) -
          ((previous.position[1] - cam[1]) * 1150) / Math.max(8, pd);
        this.data.set([...pose.position, pose.size, vx, vy, pose.alpha, a.phase], n++ * 8);
      }
      if (!n) continue;
      g.bindTexture(g.TEXTURE_2D, texture(key) ?? this.low);
      g.uniform1i(this.u(p, "art"), 0);
      g.uniform1f(this.u(p, "kind"), kind);
      g.bindBuffer(g.ARRAY_BUFFER, this.instanceBuffer);
      g.bufferSubData(g.ARRAY_BUFFER, 0, this.data.subarray(0, n * 8));
      g.blendFunc(g.ONE, kind === 2 ? g.ONE_MINUS_SRC_ALPHA : g.ONE);
      g.drawArraysInstanced(g.TRIANGLES, 0, 6, n);
    }
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  }
  lensActive(t: number) {
    return t >= 6.05 && t < 19.3;
  }
  captureScenery(t: number) {
    if (!this.lensActive(t)) return;
    const g = this.g;
    g.activeTexture(g.TEXTURE11);
    g.bindTexture(g.TEXTURE_2D, this.scenery);
    g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, this.w, this.h);
  }
  lensAt(t: number) {
    if (!this.lensActive(t)) return;
    const g = this.g,
      p = this.lens;
    g.activeTexture(g.TEXTURE12);
    g.bindTexture(g.TEXTURE_2D, this.foreground);
    g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, this.w, this.h);
    g.activeTexture(g.TEXTURE11);
    g.bindTexture(g.TEXTURE_2D, this.scenery);
    g.useProgram(p);
    g.bindVertexArray(this.quad);
    g.uniform1i(this.u(p, "scenery"), 11);
    g.uniform1i(this.u(p, "foreground"), 12);
    g.uniform1f(this.u(p, "time"), t);
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
  }
}
