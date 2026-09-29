/** Source-art classification in encoded 8-bit values, never lit/display RGB.
 * Calibrated samples: exterior sky/water/land B-R=81..104; near-neutral room
 * paint B-R=2; warm wood/light B-R<0. The 8..32 transition retains soft cool
 * edges. The approved geometric aperture remains the ultimate holdout.
 */
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v-a)/(b-a))); return t*t*(3-2*t);
};
export function apertureResidualMask(r: number, b: number, x: number, y: number, aperture: number) {
  const cool = smooth(8, 32, b-r);
  const moon = 1-smooth(.028,.035,Math.hypot((x-1167/1536)*1.5,y-240/1024));
  const shore = 1-smooth(.006,.014,Math.abs(y-.315));
  return Math.max(cool, moon, shore)*Math.max(0,Math.min(1,aperture));
}
