// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase3.field-context
import { it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MagneticHuntControls } from "./MagneticHuntControls";
import { WebSextantRuntime } from "./web-runtime";
const config = {
  version: 1,
  thresholdMicrotesla: 10,
  dwellMs: 800,
  timeoutMs: 10000,
  fallback: "Read the screen clue",
  safeProp: "WEAK_ENCLOSED_DISTANT",
  safetyAcknowledged: true,
};
it("renders safety and a usable alternative before consent, then reports unavailable hardware", async () => {
  const runtime = new WebSextantRuntime(null),
    alternative = vi.fn(),
    reached = vi.fn();
  const view = render(
    <MagneticHuntControls
      runtime={runtime}
      config={config}
      purpose={{ consumerId: "clue", surfaceId: "screen", purpose: "Find the reference prop" }}
      onAlternative={alternative}
      onReferenceReached={reached}
    />,
  );
  expect(screen.getByText(/Never place strong magnets/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Try magnetic guidance" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: config.fallback }));
  expect(alternative).toHaveBeenCalledTimes(1);
  expect(runtime.leases.diagnostics().activeLeases).toBe(0);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Try magnetic guidance" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("unavailable or uncertain"));
  expect(reached).not.toHaveBeenCalled();
  view.unmount();
  await runtime.dispose();
});
