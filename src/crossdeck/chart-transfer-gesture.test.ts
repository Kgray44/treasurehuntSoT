// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { describe, expect, it } from "vitest";
import { BrowserHandAdapter } from "@/watchglass/hand-provider";
import { ChartTransferGesture } from "./chart-transfer-gesture";

type Posture = "open" | "fist" | "soft-open" | "soft-fist" | "middle" | "lost" | "two" | "changed";
function stream(receiver = false) {
  const adapter = new BrowserHandAdapter({
    providerGeneration: 1,
    cameraLeaseId: "camera",
    cameraFrameVersion: 1,
    mirrorTransform: "NONE",
  });
  const gesture = new ChartTransferGesture(receiver);
  const point = (x: number, y: number) => ({ x, y, z: 0 });
  const hand = (closed: number) => [
    point(0.5, 0.66),
    point(0.44, 0.57),
    point(0.39, 0.52),
    point(0.37, 0.47),
    point(0.24, 0.33),
    ...[0.4, 0.46, 0.53, 0.6].flatMap((x, i) => [
      point(x, 0.5),
      point(x, 0.43),
      point(x, 0.38),
      point(x, closed > i ? 0.49 : 0.33),
    ]),
  ];
  const sample = (at: number, posture: Posture) => {
    const points = hand(posture === "fist" ? 4 : posture === "soft-fist" ? 3 : posture === "middle" ? 2 : 0);
    if (posture === "soft-open" || posture === "soft-fist") points[20].y = 0.395;
    const landmarks = posture === "lost" ? [] : posture === "two" ? [points, hand(0)] : [points];
    const observation = adapter.envelope({ landmarks, handedness: [] }, at, at, 640, 480);
    if (posture === "changed") observation.hands[0].trackGeneration++;
    return gesture.observe(observation);
  };
  return {
    sample,
    ready() {
      for (const at of [10, 80, 150]) expect(sample(at, "open")).toBe("ACQUIRING");
      expect(sample(220, "open")).toBe("READY");
    },
    grasp() {
      expect(sample(290, "fist")).toBe("GRASP_ARMED");
      expect(sample(360, "fist")).toBe("GRASP_ARMED");
      expect(sample(430, "fist")).toBe("HELD");
    },
  };
}

describe("Chart transfer gesture", () => {
  it("requires a deliberate fist followed by a continuous open hand, then consumes the release once", () => {
    const s = stream();
    s.ready();
    s.grasp();
    expect(s.sample(500, "open")).toBe("HELD");
    expect(s.sample(570, "open")).toBe("HELD");
    expect(s.sample(640, "open")).toBe("RELEASED");
    expect(s.sample(710, "open")).toBeNull();
  });

  it("lets a receiver acquire a closed hand but requires a fresh open hand on the source", () => {
    const source = stream();
    const receiver = stream(true);
    for (const at of [10, 80, 150, 220]) source.sample(at, "fist");
    expect(source.sample(280, "fist")).toBe("ACQUIRING");
    for (const at of [10, 80, 150]) expect(receiver.sample(at, "fist")).toBe("ACQUIRING");
    expect(receiver.sample(220, "fist")).toBe("HELD");
  });

  it("rejects momentary fist and open-palm noise", () => {
    const s = stream();
    s.ready();
    expect(s.sample(290, "fist")).toBe("GRASP_ARMED");
    expect(s.sample(360, "middle")).toBe("READY");
    for (const at of [430, 500, 570]) s.sample(at, "fist");
    expect(s.sample(640, "open")).toBe("HELD");
    expect(s.sample(710, "middle")).toBe("HELD");
    expect(s.sample(780, "open")).toBe("HELD");
    expect(s.sample(850, "open")).toBe("HELD");
    expect(s.sample(920, "open")).toBe("RELEASED");
  });

  it("recognizes relaxed palm and fist shapes with one partially bent finger", () => {
    const s = stream();
    for (const at of [10, 80, 150]) s.sample(at, "soft-open");
    expect(s.sample(220, "soft-open")).toBe("READY");
    for (const at of [290, 360]) s.sample(at, "soft-fist");
    expect(s.sample(430, "soft-fist")).toBe("HELD");
    for (const at of [500, 570]) s.sample(at, "soft-open");
    expect(s.sample(640, "soft-open")).toBe("RELEASED");
  });

  it.each(["lost", "two", "changed", "gap"] as const)("interrupts a gesture on %s", (condition) => {
    const s = stream();
    s.ready();
    s.grasp();
    expect(condition === "gap" ? s.sample(700, "open") : s.sample(500, condition)).toBe("INTERRUPTED");
    expect(s.sample(770, "open")).toBeNull();
  });
});
