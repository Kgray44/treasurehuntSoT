/** Analytic D0 poses only. No live-person or physical accuracy evidence. */
type Landmark = { x: number; y: number; z: number; valid: boolean };
type Pose = {
  indexBends?: number[];
  otherBends?: number[];
  depthAngle?: number;
  palmTurn?: number;
  aspect?: number;
};
export function pointingPose({
  indexBends = [0, 35, 65],
  otherBends = [0, 65, 110],
  depthAngle = 0,
  palmTurn = 0,
  aspect = 0.75,
}: Pose = {}): Landmark[] {
  const rad = (angle: number) => (angle * Math.PI) / 180;
  // Construct in width-normalized 3D coordinates; y is normalized by the image
  // height only after rotating, matching the existing observation contract.
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0, valid: true }));
  points[0] = { x: 0.025, y: 0.11, z: 0, valid: true };
  for (const [i, x, y] of [
    [1, -0.02, 0.08],
    [2, -0.035, 0.05],
    [3, -0.035, 0.025],
    [4, -0.025, 0.015],
    [5, 0, 0],
    [9, 0.03, 0.01],
    [13, 0.06, 0.02],
    [17, 0.09, 0.03],
  ])
    points[i] = { x, y, z: 0, valid: true };
  for (const base of [5, 9, 13, 17]) {
    const bends = base === 5 ? indexBends : otherBends;
    const lengths = base === 5 ? [0.035, 0.025, 0.02] : [0.035, 0.028, 0.022];
    for (let i = 0; i < 3; i++) {
      const prior = points[base + i];
      points[base + i + 1] = {
        x: prior.x,
        y: prior.y - Math.cos(rad(bends[i])) * lengths[i],
        z: prior.z - Math.sin(rad(bends[i])) * lengths[i],
        valid: true,
      };
    }
  }
  return points.map((point) => {
    const y = point.y * Math.cos(rad(depthAngle)) - point.z * Math.sin(rad(depthAngle));
    const z = point.y * Math.sin(rad(depthAngle)) + point.z * Math.cos(rad(depthAngle));
    return {
      x: 0.45 + point.x * Math.cos(rad(palmTurn)) + z * Math.sin(rad(palmTurn)),
      y: 0.5 + y / aspect,
      z: -point.x * Math.sin(rad(palmTurn)) + z * Math.cos(rad(palmTurn)),
      valid: true,
    };
  });
}
