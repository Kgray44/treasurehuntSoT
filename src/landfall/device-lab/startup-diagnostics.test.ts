import { expect, it } from "vitest";
import { deviceLabStartupStageSchema } from "./startup-diagnostics";

it("rejects arbitrary logs, native payloads and session data from startup diagnostics", () => {
  expect(deviceLabStartupStageSchema.parse({ stage: "WAITING_WORKER" })).toEqual({ stage: "WAITING_WORKER" });
  expect(() => deviceLabStartupStageSchema.parse({ stage: "private failure message" })).toThrow();
  expect(() => deviceLabStartupStageSchema.parse({ stage: "ENTRY", latitude: 44 })).toThrow();
  expect(() => deviceLabStartupStageSchema.parse({ stage: "ENTRY", csrfToken: "private" })).toThrow();
});
