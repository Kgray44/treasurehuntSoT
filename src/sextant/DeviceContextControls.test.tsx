// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase2.web-context
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { DeviceContextControls } from "./DeviceContextControls";
import { WebSextantRuntime } from "./web-runtime";
import { emulatedWebSensors } from "./web-fixture";
afterEach(cleanup);
it("presents contextual consent before prompting, with a usable accessible alternative", async () => {
  const f = emulatedWebSensors();
  const prompt = vi.fn(async () => "granted");
  f.target.DeviceMotionEvent = { requestPermission: prompt };
  const runtime = new WebSextantRuntime(f.target, null, f.now, { emulationIdentity: "unit-browser-api" }),
    ready = vi.fn(),
    alternative = vi.fn();
  render(
    <DeviceContextControls
      runtime={runtime}
      capabilityId="sextant.orientation.relative"
      purpose={{ consumerId: "lens", surfaceId: "phone", purpose: "Tilt to inspect the artifact" }}
      fallbackLabel="Use screen controls"
      onReady={ready}
      onAlternative={alternative}
    />,
  );
  expect(screen.getByRole("button", { name: "Enable device input" })).toBeDisabled();
  expect(prompt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Enable device input" }));
  await waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
  expect(prompt).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Use screen controls" }));
  await waitFor(() => expect(alternative).toHaveBeenCalledTimes(1));
  expect(runtime.status("sextant.orientation.relative").paused).toBe(true);
  await runtime.dispose();
});
it("keeps the alternative available when the browser is unsupported", async () => {
  const f = emulatedWebSensors();
  f.target.DeviceOrientationEvent = undefined;
  const runtime = new WebSextantRuntime(f.target, null, f.now, { emulationIdentity: "unit-browser-api" }),
    alternative = vi.fn();
  render(
    <DeviceContextControls
      runtime={runtime}
      capabilityId="sextant.orientation.relative"
      purpose={{ consumerId: "lens", surfaceId: "desktop", purpose: "Inspect artifact" }}
      fallbackLabel="Use buttons"
      onReady={() => {}}
      onAlternative={alternative}
    />,
  );
  expect(screen.getByRole("button", { name: "Enable device input" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Use buttons" }));
  await waitFor(() => expect(alternative).toHaveBeenCalledTimes(1));
  await runtime.dispose();
});
