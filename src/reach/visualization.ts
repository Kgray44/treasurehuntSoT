import type { HandObservation } from "./observation";
import type { Point } from "./coordinates";
export const handConnections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
export type ReachVisualFrame = {
  observation: HandObservation | null;
  activeTrack: string | null;
  raw: Point | null;
  filtered: Point | null;
  uncertainty: number | null;
  previewEstimate: boolean;
};
/** CSS contain transform shared by the video and overlay, independent of device pixel ratio. */
export function containedFrame(width: number, height: number, frameWidth: number, frameHeight: number) {
  const scale = Math.min(width / frameWidth, height / frameHeight);
  return {
    width: frameWidth * scale,
    height: frameHeight * scale,
    x: (width - frameWidth * scale) / 2,
    y: (height - frameHeight * scale) / 2,
  };
}
export class ReachTiming {
  captureIntervals: number[] = [];
  inference: number[] = [];
  submissionAge: number[] = [];
  visualizationIntervals: number[] = [];
  acquisition: number[] = [];
  private lastCapture: number | null = null;
  private lastFrame: number | null = null;
  push(values: number[], value: number) {
    if (Number.isFinite(value) && value >= 0) {
      values.push(value);
      if (values.length > 400) values.shift();
    }
  }
  observe(o: HandObservation) {
    if (this.lastCapture !== null) this.push(this.captureIntervals, o.monotonicCaptureTime - this.lastCapture);
    this.lastCapture = o.monotonicCaptureTime;
    this.push(this.inference, o.monotonicInferenceTime - o.monotonicCaptureTime);
  }
  render(at: number, capture: number | null) {
    if (this.lastFrame !== null) this.push(this.visualizationIntervals, at - this.lastFrame);
    this.lastFrame = at;
    if (capture !== null && at - capture <= 150) this.push(this.submissionAge, at - capture);
  }
  reset() {
    this.captureIntervals = [];
    this.inference = [];
    this.submissionAge = [];
    this.visualizationIntervals = [];
    this.acquisition = [];
    this.lastCapture = null;
    this.lastFrame = null;
  }
}
