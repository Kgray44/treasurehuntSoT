/** Deterministic metre-valued rolling trail banks. The walking strip stays level.
 * The semantic floor is one continuous terrain feature; its nonplanar banks
 * cannot be advertised as planar attachment faces.
 */
export function trailElevation(x: number, z: number, width: number, depth: number) {
  const bank = Math.min(1, Math.max(0, (Math.abs(x) - 0.55) / Math.max(0.05, width / 2 - 0.55)));
  return -0.065 * bank * bank * (0.75 + 0.25 * Math.cos((z / depth) * Math.PI * 6));
}
