import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useStudioContextMenu } from "./StudioContextMenu";

afterEach(cleanup);

function MenuFixture() {
  const context = useStudioContextMenu();
  return (
    <div tabIndex={-1} data-testid="page-wrapper">
      <main data-testid="studio-scrollport">
        <header onContextMenu={(event) => context.open(event, "Scene", [{ label: "Save draft", run: () => {} }])}>
          <h1>Parallax</h1>
          <button>Header control</button>
        </header>
      </main>
      {context.menu}
    </div>
  );
}

it("keeps the opener inside its context area when a focusable page wrapper surrounds it", () => {
  render(<MenuFixture />);
  const scrollport = screen.getByTestId("studio-scrollport");
  scrollport.scrollLeft = 1;
  fireEvent.contextMenu(screen.getByRole("heading", { name: "Parallax" }));
  expect(screen.getByRole("menuitem", { name: "Save draft" })).toBeVisible();
  // The browser can deliver an already-settled reveal scroll after opening.
  fireEvent.scroll(scrollport);
  expect(screen.getByRole("menuitem", { name: "Save draft" })).toBeVisible();
});

it("still dismisses the menu when the Studio scrollport actually moves", () => {
  render(<MenuFixture />);
  const scrollport = screen.getByTestId("studio-scrollport");
  fireEvent.contextMenu(screen.getByRole("heading", { name: "Parallax" }));
  scrollport.scrollLeft = 40;
  fireEvent.scroll(scrollport);
  expect(screen.queryByRole("menu")).toBeNull();
});

it("restores focus to a control inside the context area on Escape", () => {
  render(<MenuFixture />);
  const trigger = screen.getByRole("button", { name: "Header control" });
  fireEvent.contextMenu(trigger);
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(trigger).toHaveFocus();
});
