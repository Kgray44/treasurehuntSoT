import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useActionDialog } from "./ActionDialog";

function Harness() {
  const { requestAction, dialog } = useActionDialog();
  const [result, setResult] = useState("none");
  return (
    <>
      <main>
        <button
          onClick={async () => {
            const value = await requestAction({
              title: "Archive Chronicle?",
              detail: "Published Versions remain intact.",
              confirmLabel: "Archive Chronicle",
              destructive: true,
              fields: [{ id: "reason", label: "Reason", required: true }],
            });
            setResult(value?.reason ?? "cancelled");
          }}
        >
          Open confirmation
        </button>
        <output>{result}</output>
      </main>
      {dialog}
    </>
  );
}

describe("ActionDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("traps a destructive action behind an accessible required-field confirmation", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open confirmation" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Archive Chronicle?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.querySelector("main")).toHaveProperty("inert", true);
    const confirm = within(dialog).getByRole("button", { name: "Archive Chronicle" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason" }), {
      target: { value: "Superseded draft" },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(await screen.findByText("Superseded draft")).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.querySelector("main")?.inert).not.toBe(true);
  });

  it("cancels on Escape, unlocks scrolling, and restores the initiating control", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open confirmation" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(await screen.findByText("cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
