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

/**
 * Analytic D0 movement: end-on near the bottom, then side-on near the top.
 * The palm never rotates. Raw out-of-image wrist coordinates are intentional;
 * a browser replay must pass these through normal provider validity handling.
 */
export function pointingTransitionPose(progress: number, noisePhase?: number): Landmark[] {
  if (
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1 ||
    (noisePhase !== undefined && !Number.isFinite(noisePhase))
  )
    throw new Error("POINTING_TRANSITION_FIXTURE_INVALID");
  const aspect = 0.75;
  const points = pointingPose();
  const bodyY = 0.86 - progress * 0.61;
  for (const point of points) point.y += bodyY - 0.5;
  const angle = ((1 - progress) * Math.PI) / 2;
  for (const [offset, index] of [6, 7, 8].entries()) {
    const prior = points[index - 1];
    const bend = angle + ([0, 12, 25][offset] * Math.PI) / 180;
    const length = [0.035, 0.025, 0.02][offset];
    points[index] = {
      x: prior.x,
      y: prior.y - (Math.cos(bend) * length) / aspect,
      z: prior.z - Math.sin(bend) * length,
      valid: true,
    };
  }
  return points.map((point, index) => {
    const x = point.x + (noisePhase === undefined ? 0 : Math.sin(noisePhase + index * 0.37) * 0.0007);
    const y = point.y + (noisePhase === undefined ? 0 : Math.cos(noisePhase * 0.7 + index * 0.27) * 0.0006);
    const z = point.z + (noisePhase === undefined ? 0 : Math.sin(noisePhase * 0.9 + index * 0.31) * 0.0008);
    return { x, y, z, valid: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
  });
}
