import { colorGLSL } from "./color";
/** Authored lens impacts, in film seconds and normalized viewport coordinates.
 * This bounded thin-film approximation is independent of display cadence. It
 * models adhesion, accelerating runoff and two independent beads coalescing;
 * it is deliberately not a general fluid solver. Event IDs are shared with
 * optical diagnostics and the sound director.
 */
export const LENS_IMPACTS = [
  { id: "first-gust-a", time: 6.05, x: 0.84, y: 0.66, radius: 0.022, pair: true },
  { id: "first-gust-b", time: 6.18, x: 0.23, y: 0.78, radius: 0.016, pair: false },
  { id: "crossing-a", time: 10.65, x: 0.71, y: 0.46, radius: 0.019, pair: true },
  { id: "crossing-b", time: 10.79, x: 0.13, y: 0.59, radius: 0.024, pair: false },
  { id: "crossing-c", time: 11.03, x: 0.91, y: 0.83, radius: 0.012, pair: false },
  { id: "chart-wake-a", time: 14.6, x: 0.62, y: 0.68, radius: 0.023, pair: true },
  { id: "chart-wake-b", time: 14.78, x: 0.34, y: 0.86, radius: 0.015, pair: false },
  { id: "chart-wake-c", time: 14.92, x: 0.87, y: 0.57, radius: 0.017, pair: false },
] as const;
export const LENS_LIFETIME = 5.4;
const RELEASE = 0.72,
  ACCELERATION = 0.11,
  SECOND_RELEASE = 0.32,
  SECOND_ACCELERATION = 0.13;
const SECOND_MASS = 0.28,
  SECOND_OFFSET = 0.055;
const ramp = (a: number, b: number, x: number) => {
  const q = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return q * q * (3 - 2 * q);
};
const travel = (age: number, release: number, acceleration: number) => acceleration * Math.max(0, age - release) ** 2;
// Contact of the two rounded profiles. Solve once in film time, not per frame.
let contactLow = RELEASE,
  contactHigh = 2;
for (let i = 0; i < 40; i++) {
  const t = (contactLow + contactHigh) / 2;
  if (SECOND_OFFSET + travel(t, RELEASE, ACCELERATION) - travel(t, SECOND_RELEASE, SECOND_ACCELERATION) > 0.014)
    contactLow = t;
  else contactHigh = t;
}
export const LENS_MERGE_AGE = (contactLow + contactHigh) / 2;
export function lensWaterState(time: number, width: number, height: number) {
  const bulbs: number[] = [],
    trails: number[] = [],
    events: { id: string; age: number; separation: number }[] = [];
  for (const impact of LENS_IMPACTS) {
    const age = time - impact.time;
    if (age < 0 || age > LENS_LIFETIME) continue;
    const run = travel(age, RELEASE, ACCELERATION),
      slide = Math.max(0, age - RELEASE);
    let firstY = impact.y - run,
      secondY = impact.y + SECOND_OFFSET - travel(age, SECOND_RELEASE, SECOND_ACCELERATION);
    if (impact.pair && age > LENS_MERGE_AGE) {
      const center = (firstY + secondY * SECOND_MASS) / (1 + SECOND_MASS);
      const separation = 0.014 * Math.exp(-(((age - LENS_MERGE_AGE) / 0.14) ** 2));
      firstY = center - (separation * SECOND_MASS) / (1 + SECOND_MASS);
      secondY = center + separation / (1 + SECOND_MASS);
    }
    // A compact bead keeps approximately constant footprint area as it
    // elongates. It never becomes the old indefinitely stretching wedge.
    const stretch = 1 + 0.18 * ramp(0, 1.4, slide);
    const impactResponse = 1 + Math.exp(-age * 22) * Math.sin(age * 48) * 0.18;
    const radius = impact.radius * impactResponse * ramp(0, 0.025, age);
    const rx = ((radius / Math.sqrt(stretch)) * height) / width,
      ry = radius * Math.sqrt(stretch);
    const x = impact.x + (Math.sin(slide * 1.3 + impact.x * 7) - Math.sin(impact.x * 7)) * 0.002;
    bulbs.push(x, firstY, rx, ry);
    if (impact.pair)
      bulbs.push(x + 0.004 * Math.exp(-Math.max(0, age - LENS_MERGE_AGE) * 15), secondY, rx * 0.65, ry * 0.65);
    trails.push(impact.x, impact.y, age, impact.radius);
    events.push({ id: impact.id, age, separation: impact.pair ? Math.abs(secondY - firstY) : 0 });
  }
  return { bulbs, trails, events };
}

export const lensWaterFragment = `#version 300 es
precision highp float;in vec2 vUV;out vec4 color;
uniform sampler2D scenery,foreground;uniform vec2 viewport;
uniform int bulbCount,trailCount;uniform vec4 bulbs[16],trails[8];
${colorGLSL}
vec4 combined(vec2 p){vec4 f=texture(foreground,p);return f+texture(scenery,p)*(1.-f.a);}
float waterHeight(vec2 p){
 float h=0.;
 for(int i=0;i<16;i++){if(i>=bulbCount)break;
  vec4 b=bulbs[i];vec2 q=(p-b.xy)/max(b.zw,vec2(.000001));
  float profile=max(0.,1.-dot(q,q));h+=profile*profile;
 }
 for(int i=0;i<8;i++){if(i>=trailCount)break;
  vec4 t=trails[i];float descent=t.y-p.y;
  if(descent<=0.)continue;
  float deposited=${RELEASE}+sqrt(descent/${ACCELERATION});
  float elapsed=t.z-deposited;
  if(elapsed<0.)continue;
  // The deposited film drains locally. Old material becomes optically
  // imperceptible while the bead continues moving, without a global fade.
  float thickness=exp(-elapsed/.43);
  float slide=max(0.,deposited-${RELEASE});
  float center=t.x+(sin(slide*1.3+t.x*7.)-sin(t.x*7.))*.002;
  float width=t.w*.24*viewport.y/viewport.x*sqrt(thickness);
  float q=(p.x-center)/max(width,.000001);
  float profile=max(0.,1.-q*q);
  float taper=smoothstep(0.,.012,descent)*smoothstep(0.,.04,elapsed);
  h+=.12*thickness*profile*profile*taper*(.9+.1*sin(descent*130.+elapsed*2.1));
 }
 return h;
}
void main(){
 vec4 original=texture(foreground,vUV);float h=waterHeight(vUV);
 if(h<.00005){color=original;return;}
 vec2 pixel=1./viewport;
 vec2 normal=vec2(waterHeight(vUV+vec2(pixel.x,0.))-waterHeight(vUV-vec2(pixel.x,0.)),waterHeight(vUV+vec2(0.,pixel.y))-waterHeight(vUV-vec2(0.,pixel.y)))*.5*viewport.y;
 // Bounded thin-lens displacement, including the trailing film's own normal.
 // A half-covered trail no longer reuses the bulb normal (which was zero).
 vec2 displacement=normal*vec2(viewport.y/viewport.x,1.)*.00012;
 float coverage=smoothstep(.00005,.008,h);
 vec4 refracted=combined(clamp(vUV+displacement,vec2(.001),vec2(.999)));
 float edge=min(.06,length(normal)*.00034), light=clamp(dot(normal,vec2(-.5,.7))*.0014,-.06,.06);
 refracted.rgb=refracted.rgb*(1.-edge)+srgbToLinear(vec3(.55,.67,.73))*(edge+light*.15);
 color=mix(original,refracted,coverage);
}`;
