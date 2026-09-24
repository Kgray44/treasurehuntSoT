/** The same membrane law describes a page losing its anchors and a room finding them.
 * Coordinates are material UVs; held regions remain on the rigid support plane. */
export type Attachment = "center" | "edge" | "corner" | "multi";
export const attachments: Attachment[] = ["center", "edge", "corner", "multi"];
export function anchorPoints(kind: Attachment): [number, number][] {
  if (kind === "center")
    return [
      [0.5, 0.5],
      [0.38, 0.5],
      [0.61, 0.5],
      [0.5, 0.62],
    ];
  if (kind === "edge")
    return [
      [0.06, 0.12],
      [0.06, 0.36],
      [0.06, 0.64],
      [0.06, 0.88],
    ];
  if (kind === "corner")
    return [
      [0.08, 0.86],
      [0.15, 0.86],
      [0.08, 0.75],
      [0.2, 0.72],
    ];
  return [
    [0.18, 0.2],
    [0.78, 0.2],
    [0.25, 0.8],
    [0.8, 0.78],
  ];
}
const step = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
export function membrane(
  u: number,
  v: number,
  time: number,
  phase: number,
  pressure: number,
  holds: number[],
  points: [number, number][],
) {
  let pin = 0;
  for (let i = 0; i < 4; i++)
    pin = Math.max(pin, holds[i] * (1 - step(0.14, 0.46, Math.hypot(u - points[i][0], v - points[i][1]))));
  const free = Math.pow(1 - pin, 2.1),
    edge = step(0.18, 0.49, Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)));
  const flutter =
    Math.sin(v * 23 - time * 17 + phase + u * 6) * 0.105 + Math.sin(u * 31 + time * 23 + phase * 0.7) * 0.055;
  const tension = pressure * free;
  const z = -tension * (0.16 + edge * 0.86 + flutter * edge);
  return {
    z,
    x: -(u - 0.5) * tension * 0.16 + flutter * tension * edge * 0.025,
    y: -(v - 0.5) * tension * 0.08 + flutter * tension * edge * 0.065,
    pin,
  };
}
export const adhesionGLSL = `
uniform vec4 anchorHold;uniform vec2 anchorPoints[4];
vec4 membrane(vec2 q,float t,float ph,float load){
 float pin=0.;for(int i=0;i<4;i++)pin=max(pin,anchorHold[i]*(1.-smoothstep(.14,.46,length(q-anchorPoints[i]))));
 float free=pow(1.-pin,2.1),edge=smoothstep(.18,.49,max(abs(q.x-.5),abs(q.y-.5)));
 float flutter=sin(q.y*23.-t*17.+ph+q.x*6.)*.105+sin(q.x*31.+t*23.+ph*.7)*.055;
 float tension=load*free;
 return vec4(-(q.x-.5)*tension*.16+flutter*tension*edge*.025,
 -(q.y-.5)*tension*.08+flutter*tension*edge*.065,-tension*(.16+edge*.86+flutter*edge),pin);
}`;
