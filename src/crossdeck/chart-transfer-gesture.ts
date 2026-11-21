import type { HandObservation } from "@/reach/observation";

type Hand = HandObservation["hands"][number];
type Point = Hand["landmarks"][number];
export type TransferPosture = "OPEN" | "FIST" | "NEUTRAL";
export type GestureEvent = "ACQUIRING" | "READY" | "GRASP_ARMED" | "HELD" | "RELEASED" | "INTERRUPTED";

function posture(hand: Hand, aspect: number): TransferPosture {
  const points = hand.landmarks;
  if (hand.occluded || !points.every((point) => point.valid)) return "NEUTRAL";
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, (a.y - b.y) / aspect, a.z - b.z);
  const palm = Math.max(distance(points[5], points[17]), 0.8 * distance(points[0], points[9]));
  if (palm < 0.035 || palm > 0.65) return "NEUTRAL";
  const fingers = [5, 9, 13, 17].map((base) => {
    const [a, b, c, tip] = points.slice(base, base + 4);
    const length = distance(a, b) + distance(b, c) + distance(c, tip);
    return { extension: length > palm * 0.35 ? distance(a, tip) / length : -1, reach: distance(a, tip) / palm };
  });
  const extended = fingers.filter(({ extension, reach }) => extension >= 0.83 && reach >= 0.48).length;
  const curled = fingers.filter(({ extension, reach }) => extension >= 0 && extension <= 0.72 && reach <= 0.72).length;
  if (extended >= 3 && curled === 0 && distance(points[4], points[8]) >= palm * 0.48) return "OPEN";
  if (curled >= 3 && extended === 0) return "FIST";
  return "NEUTRAL";
}

/** One visible hand and three consecutive samples per deliberate posture. */
export class ChartTransferGesture {
  private state: GestureEvent = "ACQUIRING";
  private track = "";
  private last = -Infinity;
  private dwell: { posture: TransferPosture; at: number; samples: number } | null = null;

  constructor(private readonly allowClosedAcquisition = false) {}

  observe(observation: HandObservation): GestureEvent | null {
    if (this.state === "RELEASED" || this.state === "INTERRUPTED") return null;
    const at = observation.monotonicCaptureTime;
    const hand = observation.hands.length === 1 ? observation.hands[0] : undefined;
    const track =
      hand && !hand.occluded && hand.continuity !== "AMBIGUOUS" && observation.quality === "USABLE"
        ? [observation.providerGeneration, observation.cameraLeaseId, hand.trackId, hand.trackGeneration].join(":")
        : "";
    if (!track || track !== this.track || at <= this.last || at - this.last > 220 || hand?.continuity === "ACQUIRED") {
      if (this.state !== "ACQUIRING") return (this.state = "INTERRUPTED");
      this.dwell = null;
    }
    this.track = track;
    this.last = at;
    if (!hand || !track) return this.state;
    const current = posture(hand, observation.frameWidth / observation.frameHeight);
    if (this.dwell?.posture !== current) this.dwell = { posture: current, at, samples: 0 };
    this.dwell.samples++;
    const stable = (ms: number) => this.dwell!.samples >= 3 && at - this.dwell!.at >= ms;
    if (this.state === "ACQUIRING") {
      if (current === "OPEN" && stable(200)) this.state = "READY";
      if (this.allowClosedAcquisition && current === "FIST" && stable(200)) this.state = "HELD";
    } else if (this.state === "HELD") {
      if (current === "OPEN" && stable(130)) this.state = "RELEASED";
    } else {
      this.state = current !== "FIST" ? "READY" : stable(130) ? "HELD" : "GRASP_ARMED";
    }
    return this.state;
  }
}
