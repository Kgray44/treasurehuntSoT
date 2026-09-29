import { projectionGLSL } from "./projection";
import { surfaceDepthGLSL } from "./depth-compositor";
import { colorGLSL } from "./color";

/** The unprinted center is sampled in place; the supplied parchment is never
 * changed. Rivets, outer border and baked edge shadows lie outside this crop. */
export const PAPER_BACK = {
  url: "/images/muster/parchment.png",
  crop: [0.22, 0.18, 0.56, 0.64],
} as const;
export function propMaterial(asset: string) {
  // An ink glyph has no paper support. Classification by Actor.material alone
  // would incorrectly give it a parchment-colored reverse.
  if (asset === "P2-compass") return { backing: 3, thicknessRatio: 0.02 };
  if (asset === "P7-sailcloth") return { backing: 2, thicknessRatio: 0 };
  if (asset === "P1-map-fragment") return { backing: 1, thicknessRatio: 0.00085 };
  if (asset === "P4-journal-page" || asset.startsWith("derived/scrap-")) return { backing: 1, thicknessRatio: 0 };
  return { backing: 0, thicknessRatio: 0 };
}

const parameters = `
uniform vec4 objectData[5];
#define position objectData[0].xyz
#define alpha objectData[0].w
#define rotation objectData[1].xyz
#define bend objectData[1].w
#define size objectData[2].xy
#define adhesion objectData[2].z
#define phase objectData[2].w
#define focusImpact objectData[3].x
#define contactLight objectData[3].y
#define emissive objectData[3].z
#define atmosphere objectData[3].w
#define physical objectData[4].x
#define diagnosticMaterial objectData[4].y
#define backingKind objectData[4].z
#define thickness objectData[4].w
`;
export const propVertex = `#version 300 es
precision highp float;
layout(location=0)in vec2 uv;layout(location=1)in vec3 deformed;
layout(location=2)in vec2 shell;
out vec2 vUV;out vec3 vWorld;out float vBend;out vec2 vShell;
uniform vec3 cameraPosition;uniform vec2 viewport;uniform float time,roll;
${parameters}
${projectionGLSL}
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
float heightAt(vec2 q){
 float edge=pow(abs(q.x-.46)*1.9,1.5);
 float wave=sin(q.x*7.0+q.y*2.2-time*14.2+phase)*.055*size.x;
 float corner=sin(q.y*5.0-time*9.7+phase)*.035*size.x*edge;
 float curl=pow(max(0.,q.x-.63),2.)*size.x*.9;
 float z=(wave*edge+corner+curl)*bend;
 z-=exp(-length((q-vec2(.59,.43))*vec2(13.,8.)))*focusImpact*18.;
 float pin=1.-smoothstep(.06,.37,length(q-vec2(.5,.5)));
 return mix(z,-(1.-pin)*size.x*(.35+sin(q.x*19.-time*18.)*.12+sin(q.y*23.+time*21.)*.07),adhesion);
}
void main(){
 vUV=uv;vShell=shell;
 if(physical>.5){vWorld=deformed;vBend=0.;gl_Position=filmClip(vWorld,cameraPosition,roll,viewport);return;}
 float z=heightAt(uv);vBend=z/max(size.x,1.);
 vec3 local=vec3((uv-.5)*size,z);
 if(thickness>0.){
  vec3 n=normalize(vec3(-(heightAt(uv+vec2(.0005,0.))-heightAt(uv-vec2(.0005,0.)))/(.001*size.x),
   -(heightAt(uv+vec2(0.,.0005))-heightAt(uv-vec2(0.,.0005)))/(.001*size.y),1.));
  local+=n*shell.x*thickness;
 }
 vWorld=rz(rotation.z)*ry(rotation.y)*rx(rotation.x)*local+position;
 gl_Position=filmClip(vWorld,cameraPosition,roll,viewport);
}`;
export const propFragment = `#version 300 es
precision highp float;
in vec2 vUV;in vec3 vWorld;in float vBend;in vec2 vShell;out vec4 color;
uniform sampler2D art,paperBack;uniform vec3 eye;uniform float time,backingAvailable;
uniform vec3 coolLight,warmLight,depthTint,emissionTint;
${parameters}
${surfaceDepthGLSL}
${colorGLSL}
vec3 reverseMaterial(vec2 p){
 vec3 paper=artwork(paperBack,vec2(${PAPER_BACK.crop[0]},${PAPER_BACK.crop[1]})+p*vec2(${PAPER_BACK.crop[2]},${PAPER_BACK.crop[3]})).rgb;
 if(backingAvailable<.5)paper=srgbToLinear(vec3(.75,.64,.44));
 if(backingKind<1.5)return paper;
 if(backingKind<2.5){
  // Woven fibers remain in material coordinates and lose contrast below a
  // pixel, instead of producing aliasing as the cloth recedes.
  vec2 weave=p*vec2(350.,240.);vec2 footprint=fwidth(weave);
  float threads=(sin(weave.x*6.283)*exp(-footprint.x*footprint.x)+sin(weave.y*6.283)*exp(-footprint.y*footprint.y))*.018;
  return paper*vec3(.81,.83,.84)+threads;
 }
 float rings=sin(length((p-vec2(.53,.4))*vec2(1.,.9))*340.);
 return srgbToLinear(vec3(.53,.365,.16))*(1.+rings*.004)+paper*.035;
}
void main(){
 bool edge=vShell.y>.5;
 // An extruded shell contains both faces. Reject inward faces even though
 // ordinary paper remains two-sided; otherwise transparent contour coverage
 // would composite the same face twice.
 if(thickness>0. && !edge && ((vShell.x>0. && !gl_FrontFacing)||(vShell.x<0. && gl_FrontFacing)))discard;
 vec2 flow=vec2(sin(vUV.y*12.+time*.43),cos(vUV.x*9.-time*.37))*.018*atmosphere;
 vec2 p=vUV+flow;
 vec4 sampleColor=artwork(art,p);
 float a=(edge?1.:sampleColor.a)*alpha;
 surfaceCoverage(a);
 bool back=thickness>0.?vShell.x<0.:!gl_FrontFacing;
 if(backingKind>.5){
  vec3 reverse=reverseMaterial(p);
  if(back || edge)sampleColor.rgb=reverse;
  // The cut fiber rim follows the actual alpha silhouette, including holes.
  // It is not a rectangular UV border and has no transmitted front printing.
  vec2 texel=1./vec2(textureSize(art,0));
  float inner=min(min(texture(art,p+vec2(texel.x,0)).a,texture(art,p-vec2(texel.x,0)).a),
    min(texture(art,p+vec2(0,texel.y)).a,texture(art,p-vec2(0,texel.y)).a));
  // A little oxidized fiber extends inward from tears on the reverse. Mip
  // alpha supplies a coverage-distance approximation without importing ink.
  float wear=back && backingKind<1.5?1.-textureLod(art,p,3.).a:0.;
  if(back)sampleColor.rgb*=1.-wear*.18;
  float rim=edge?1.:(1.-smoothstep(.3,.95,inner))*.65;
  sampleColor.rgb=mix(sampleColor.rgb,reverse*.78,rim);
 }
 if(diagnosticMaterial>.5)sampleColor.rgb=edge?vec3(.9,.15,.06):
   mix(back?vec3(.15,.32,.6):vec3(.2,.35,.42),vec3(.88,.81,.65),mod(floor(vUV.x*12.)+floor(vUV.y*12.),2.));
 vec3 dx=dFdx(vWorld),dy=dFdy(vWorld);vec3 normal=normalize(cross(dx,dy));
 vec3 view=normalize(eye+vec3(0.,0.,1150.)-vWorld);
 if(dot(normal,view)<0.)normal=-normal;
 vec3 key=normalize(vec3(-.25,.45,1.));
 float warm=smoothstep(26.,30.,time)*exp(-length((vWorld.xy-vec2(490.,190.))/vec2(1000.,850.)));
 float diffuse=.68+.30*max(0.,dot(normal,key));
 vec3 light=mix(coolLight,warmLight,warm*.76)*diffuse;
 light+=vec3(.5,.24,.07)*warm*pow(abs(vBend)*5.,1.3);
 if(backingKind>2.5)light+=vec3(.55,.38,.16)*pow(max(0.,dot(normal,normalize(key+view))),42.)*.7;
 float depth=clamp((eye.z-vWorld.z-500.)/4800.,0.,.85);
 vec3 lit=mix(sampleColor.rgb*(light+vec3(.32,.24,.12)*contactLight),srgbToLinear(depthTint),depth*.65*(1.-contactLight*.7));
 lit=mix(lit,sampleColor.rgb*emissionTint,emissive);
 color=vec4(lit*a,a);
}`;
