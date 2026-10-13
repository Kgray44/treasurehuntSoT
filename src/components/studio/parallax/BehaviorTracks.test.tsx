import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createSpatialDraft } from "@/parallax/authoring";
import { createMotionTrack } from "@/parallax/animation-authoring";
import { BehaviorTracks } from "./BehaviorTracks";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("follows pointer motion locally and commits one resized keyframe sequence on release", () => {
  const draft = createMotionTrack(createSpatialDraft("gesture"), "gesture:entity-0", "POSITION", 0);
  const onChange = vi.fn();
  const props = {
    draft,
    timeMs: 0,
    selected: draft.content.entities[0].id,
    onSelect: vi.fn(),
    onTime: vi.fn(),
    onChange,
  };
  render(<BehaviorTracks {...props} />);
  const handle = screen.getByRole("button", { name: "Resize Desk Map position animation end" });
  Object.defineProperty(handle.parentElement!.parentElement!, "clientWidth", { value: 600 });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  // JSDOM does not expose PointerEvent; give the test real pointer coordinates.
  vi.stubGlobal("PointerEvent", MouseEvent);
  fireEvent.pointerDown(handle, { button: 0, clientX: 20, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 40, pointerId: 1 });
  expect(screen.getByRole("button", { name: "Move Desk Map position animation" })).toHaveTextContent("4.0s");
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.pointerUp(handle, { clientX: 40, pointerId: 1 });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(
    onChange.mock.calls[0][0].content.studio.animationTracks[0].keyframes.map((frame: { atMs: number }) => frame.atMs),
  ).toEqual([0, 4000]);
  vi.unstubAllGlobals();
});

it("offers keyboard context commands and preserves locked track protection", () => {
  const draft = createMotionTrack(createSpatialDraft("menu"), "menu:entity-0", "POSITION", 0);
  draft.content.studio!.layers[0].locked = true;
  const onChange = vi.fn();
  render(
    <BehaviorTracks
      draft={draft}
      timeMs={0}
      selected={draft.content.entities[0].id}
      onSelect={vi.fn()}
      onTime={vi.fn()}
      onChange={onChange}
    />,
  );
  const label = screen.getByRole("button", { name: /Desk Map · position/ });
  fireEvent.keyDown(label, { key: "F10", shiftKey: true });
  expect(screen.getByRole("menuitem", { name: "Animate linearly" })).toBeDisabled();
  expect(screen.getByRole("menuitem", { name: "Remove animation" })).toBeDisabled();
  expect(onChange).not.toHaveBeenCalled();
});
