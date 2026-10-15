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
    onEditTrack: vi.fn(),
    onEditEvent: vi.fn(),
    onTime: vi.fn(),
    onChange,
  };
  render(<BehaviorTracks {...props} />);
  fireEvent.change(screen.getByLabelText("Timeline visible duration"), { target: { value: "60000" } });
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
      onEditTrack={vi.fn()}
      onEditEvent={vi.fn()}
      onChange={onChange}
    />,
  );
  const label = screen.getByRole("button", { name: /Desk Map · position/ });
  fireEvent.keyDown(label, { key: "F10", shiftKey: true });
  expect(screen.getByRole("menuitem", { name: "Animate linearly" })).toBeDisabled();
  expect(screen.getByRole("menuitem", { name: "Remove animation" })).toBeDisabled();
  expect(onChange).not.toHaveBeenCalled();
});

it("scrubs the visible window live, clamps captured drags and leaves authored tracks untouched", () => {
  const draft = createMotionTrack(createSpatialDraft("scrub"), "scrub:entity-0", "POSITION", 0);
  const onTime = vi.fn(),
    onChange = vi.fn();
  render(
    <BehaviorTracks
      draft={draft}
      timeMs={2500}
      selected={null}
      onSelect={vi.fn()}
      onEditTrack={vi.fn()}
      onEditEvent={vi.fn()}
      onTime={onTime}
      onChange={onChange}
    />,
  );
  fireEvent.change(screen.getByLabelText("Timeline window start"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Show current time" }));
  fireEvent.change(screen.getByLabelText("Timeline window start"), { target: { value: "10" } });
  const lane = screen.getByRole("button", { name: "Seek to 10 seconds" }).parentElement!;
  vi.spyOn(lane, "getBoundingClientRect").mockReturnValue({ left: 100, width: 400 } as DOMRect);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.stubGlobal("PointerEvent", MouseEvent);
  fireEvent.pointerDown(lane, { button: 0, clientX: 180, pointerId: 1 });
  expect(onTime).toHaveBeenLastCalledWith(12000);
  fireEvent.pointerMove(lane, { clientX: 300, pointerId: 1 });
  expect(onTime).toHaveBeenLastCalledWith(15000);
  fireEvent.pointerMove(lane, { clientX: -20, pointerId: 1 });
  expect(onTime).toHaveBeenLastCalledWith(10000);
  fireEvent.pointerUp(lane, { clientX: 700, pointerId: 1 });
  expect(onTime).toHaveBeenLastCalledWith(20000);
  const count = onTime.mock.calls.length;
  fireEvent.pointerMove(lane, { clientX: 300, pointerId: 1 });
  expect(onTime).toHaveBeenCalledTimes(count);
  expect(onChange).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("exposes one keyboard-accessible scanner and retains exact seek buttons", () => {
  const draft = createSpatialDraft("seek");
  const onTime = vi.fn();
  render(
    <BehaviorTracks
      draft={draft}
      timeMs={2500}
      selected={null}
      onSelect={vi.fn()}
      onEditTrack={vi.fn()}
      onEditEvent={vi.fn()}
      onTime={onTime}
      onChange={vi.fn()}
    />,
  );
  const scanner = screen.getByRole("slider", { name: "Scene timeline playhead" });
  expect(scanner).toHaveAttribute("aria-valuetext", "2.50 seconds");
  fireEvent.keyDown(scanner, { key: "ArrowRight", shiftKey: true });
  expect(onTime).toHaveBeenLastCalledWith(3500);
  fireEvent.keyDown(scanner, { key: "Home" });
  expect(onTime).toHaveBeenLastCalledWith(0);
  fireEvent.keyDown(scanner, { key: "End" });
  expect(onTime).toHaveBeenLastCalledWith(10000);
  fireEvent.click(screen.getByRole("button", { name: "Seek to 5 seconds" }));
  expect(onTime).toHaveBeenLastCalledWith(5000);
});
