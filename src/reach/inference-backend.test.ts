// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { expect, it } from "vitest";
import { BrowserHandAdapter } from "@/watchglass/hand-provider";
import { ObservationGate } from "./observation";
import { syntheticObservation } from "./synthetic";
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "private-test-camera",
  cameraFrameVersion: 1,
  mirrorTransform: "NONE" as const,
  orientation: 0 as const,
};
it("records the actual immutable model backend on every adapter observation", () => {
  for (const backend of ["CPU_WASM", "GPU_WEBGL"] as const) {
    const adapter = new BrowserHandAdapter(binding, "D0", backend);
    expect(adapter.envelope({ landmarks: [], handedness: [] }, 100, 120, 640, 480).inferenceBackend).toBe(backend);
    expect(adapter.envelope({ landmarks: [], handedness: [] }, 200, 220, 640, 480).inferenceBackend).toBe(backend);
  }
});
it("rejects a backend change within an established observation source", () => {
  const gate = new ObservationGate(binding);
  const observation = (sequence: number, backend?: "CPU_WASM" | "GPU_WEBGL") => ({
    ...syntheticObservation({ x: 0.5, y: 0.5 }, sequence, 100 + sequence * 30),
    ...binding,
    inferenceBackend: backend,
  });
  gate.accept(observation(0, "GPU_WEBGL"), 120);
  expect(() => gate.accept(observation(1, "CPU_WASM"), 150)).toThrow("OBSERVATION_BACKEND_CHANGED");
  expect(gate.accept(observation(1, "GPU_WEBGL"), 150).sequence).toBe(1);
});
it("keeps legacy missing-backend observations CPU scoped and rejects unknown backends", () => {
  const gate = new ObservationGate(binding);
  const first = { ...syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100), ...binding };
  gate.accept(first, 120);
  expect(() =>
    gate.accept(
      { ...first, sequence: 1, monotonicCaptureTime: 130, monotonicInferenceTime: 130, inferenceBackend: "GPU_WEBGL" },
      150,
    ),
  ).toThrow("OBSERVATION_BACKEND_CHANGED");
  expect(() => new ObservationGate(binding).accept({ ...first, inferenceBackend: "UNKNOWN" }, 120)).toThrow();
});
