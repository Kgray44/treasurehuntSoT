import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useSceneGraphOrder, type GraphCategory } from "./useSceneGraphOrder";

afterEach(cleanup);
const ids = ["a", "b", "c", "d", "e"];
function Graph({
  commit,
  disabled = false,
}: {
  commit: (category: GraphCategory, ids: string[]) => void;
  disabled?: boolean;
}) {
  const order = useSceneGraphOrder(disabled, commit);
  return (
    <>
      <ul>
        {order
          .rows(
            "ASSET",
            ids.map((id) => ({ id })),
          )
          .map(({ id }) => (
            <li key={id}>
              <button {...order.bind("ASSET", id, id, ids)} data-graph-entity={id}>
                {id}
              </button>
            </li>
          ))}
      </ul>
      {order.ghost}
    </>
  );
}
function pointer(target: Window | HTMLElement, type: string, y: number, pointerId = 1) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientY: y });
  Object.defineProperties(event, { pointerId: { value: pointerId }, pointerType: { value: "mouse" } });
  fireEvent(target, event);
}
function prepare() {
  const commit = vi.fn();
  const view = render(<Graph commit={commit} />);
  screen.getAllByRole("button").forEach((button, index) => {
    button.getBoundingClientRect = () => ({
      x: 0,
      y: index * 60,
      top: index * 60,
      bottom: index * 60 + 50,
      left: 0,
      right: 200,
      width: 200,
      height: 50,
      toJSON() {},
    });
    button.setPointerCapture = vi.fn();
    button.hasPointerCapture = () => false;
  });
  return { commit, view };
}
it("continues a live drag after the reordered row loses DOM pointer capture, and commits once on drop", () => {
  const { commit } = prepare();
  pointer(screen.getByRole("button", { name: "a" }), "pointerdown", 25);
  pointer(window, "pointermove", 150);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["b", "c", "a", "d", "e"]);
  // The original row has moved; the next event may target an entirely different node.
  pointer(screen.getByRole("button", { name: "d" }), "pointermove", 228);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["b", "c", "d", "a", "e"]);
  expect(commit).not.toHaveBeenCalled();
  pointer(window, "pointerup", 228);
  expect(commit).toHaveBeenCalledExactlyOnceWith("ASSET", ["b", "c", "d", "a", "e"]);
});
it("ignores another pointer and cancels without persisting an order", () => {
  const { commit } = prepare();
  pointer(screen.getByRole("button", { name: "a" }), "pointerdown", 25);
  pointer(window, "pointermove", 228, 2);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(ids);
  pointer(window, "pointermove", 228);
  fireEvent.keyDown(window, { key: "Escape" });
  pointer(window, "pointerup", 228);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(ids);
  expect(commit).not.toHaveBeenCalled();
});
it("removes the active window listeners on unmount", () => {
  const { commit, view } = prepare();
  pointer(screen.getByRole("button", { name: "a" }), "pointerdown", 25);
  pointer(window, "pointermove", 228);
  view.unmount();
  pointer(window, "pointerup", 228);
  expect(commit).not.toHaveBeenCalled();
});
it("leaves name clicks uncaptured until a real drag starts", () => {
  const { commit } = prepare();
  const row = screen.getByRole("button", { name: "a" });
  pointer(row, "pointerdown", 25);
  expect(row.setPointerCapture).not.toHaveBeenCalled();
  pointer(window, "pointermove", 28);
  expect(row.setPointerCapture).not.toHaveBeenCalled();
  pointer(window, "pointerup", 28);
  expect(commit).not.toHaveBeenCalled();
  pointer(row, "pointerdown", 25);
  pointer(window, "pointermove", 65);
  expect(row.setPointerCapture).toHaveBeenCalledExactlyOnceWith(1);
});
