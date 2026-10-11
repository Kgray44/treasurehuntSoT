// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase4.native-context
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WebSextantRuntime } from "./web-runtime";
import { emulatedWebSensors } from "./web-fixture";
import { DeviceCapabilitiesPanel } from "./DeviceCapabilitiesPanel";
const selected = vi.hoisted(() => ({ runtime: null as WebSextantRuntime | null }));
vi.mock("./web-runtime", async (original) => ({
  ...(await original<typeof import("./web-runtime")>()),
  webSextantRuntime: () => selected.runtime,
}));
let reduced = false;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(async () => {
  cleanup();
  await selected.runtime?.dispose();
  selected.runtime = null;
  reduced = false;
  vi.unstubAllGlobals();
});
it("discovers on the ordinary surface without prompting or acquiring, and always exposes screen controls", async () => {
  const fixture = emulatedWebSensors(),
    prompt = vi.fn(async () => "denied");
  fixture.target.DeviceMotionEvent = { requestPermission: prompt };
  const runtime = (selected.runtime = new WebSextantRuntime(fixture.target, null, fixture.now, {
    emulationIdentity: "unit-browser-api",
  }));
  const acquire = vi.spyOn(runtime, "acquire");
  render(<DeviceCapabilitiesPanel />);
  expect(screen.getByRole("heading", { name: "Optional device input" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Enable device input" })).toBeDisabled();
  expect(prompt).not.toHaveBeenCalled();
  expect(acquire).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow device motion for this interaction" }));
  fireEvent.click(screen.getByRole("button", { name: "Enable device input" }));
  await waitFor(() => expect(screen.getByText(/Device input is unavailable/)).toBeVisible());
  expect(acquire).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continue with screen controls" }));
  await waitFor(() => expect(screen.getByText("Screen controls are ready. Device input is optional.")).toBeVisible());
});
it("keeps the operating system sensory preference effective and offers a non-haptic confirmation", async () => {
  reduced = true;
  const fixture = emulatedWebSensors(),
    vibrate = vi.fn<(pattern: number | Iterable<number>) => boolean>(() => true);
  selected.runtime = new WebSextantRuntime(fixture.target, { vibrate }, fixture.now, {
    emulationIdentity: "unit-browser-api",
  });
  render(<DeviceCapabilitiesPanel />);
  expect(screen.getByRole("checkbox", { name: "Reduce sensory feedback" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Reduce sensory feedback" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Try a short vibration" })).toBeDisabled();
  expect(vibrate.mock.calls.every(([pattern]) => pattern === 0)).toBe(true);
  expect(screen.getByRole("button", { name: "Continue with screen controls" })).toBeEnabled();
});
it("aborts the preview scope when the page leaves while native acquisition is pending", async () => {
  const fixture = emulatedWebSensors();
  const runtime = (selected.runtime = new WebSextantRuntime(fixture.target, null, fixture.now, {
    emulationIdentity: "unit-browser-api",
  }));
  vi.spyOn(runtime, "enable").mockResolvedValue("GRANTED");
  let scope: AbortSignal | undefined;
  vi.spyOn(runtime, "acquire").mockImplementation(async (_request, _callback, options) => {
    scope = options?.signal;
    return { leaseId: "synthetic-preview", release: async () => {} };
  });
  const view = render(<DeviceCapabilitiesPanel />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow device motion for this interaction" }));
  fireEvent.click(screen.getByRole("button", { name: "Enable device input" }));
  await waitFor(() => expect(scope).toBeDefined());
  view.unmount();
  expect(scope!.aborted).toBe(true);
});
