import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { StudioTextField } from "./StudioTextField";
afterEach(cleanup);
function Editor({ save }: { save: (text: string) => void }) {
  const [value, setValue] = useState("Old note");
  return (
    <StudioTextField
      value={value}
      label="Message"
      multiline
      maxLength={2000}
      onCommit={(text) => {
        save(text);
        setValue(text.trim());
      }}
    />
  );
}
it("retains trailing spaces and line breaks during typing while saving meaningful internal whitespace", () => {
  const save = vi.fn();
  render(<Editor save={save} />);
  const field = screen.getByRole("textbox");
  fireEvent.change(field, { target: { value: "Old note " } });
  expect(field).toHaveValue("Old note ");
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: "Old note aboard" } });
  expect(save).toHaveBeenLastCalledWith("Old note aboard");
  fireEvent.change(field, { target: { value: "Old note aboard\n" } });
  expect(field).toHaveValue("Old note aboard\n");
  fireEvent.change(field, { target: { value: "Old note aboard\nNext clue" } });
  expect(save).toHaveBeenLastCalledWith("Old note aboard\nNext clue");
  fireEvent.blur(field);
  expect(field).toHaveValue("Old note aboard\nNext clue");
});
it("permits temporary empty input and replacing the complete message without saving an invalid blank", () => {
  const save = vi.fn();
  render(<Editor save={save} />);
  const field = screen.getByRole("textbox");
  fireEvent.change(field, { target: { value: "" } });
  expect(field).toHaveValue("");
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: "New clue" } });
  expect(save).toHaveBeenLastCalledWith("New clue");
  fireEvent.change(field, { target: { value: "  \n" } });
  fireEvent.blur(field);
  expect(field).toHaveValue("New clue");
  expect(screen.getByRole("status")).toHaveTextContent("previous text is unchanged");
});
it("shows authoritative external changes rather than retaining a stale local field", () => {
  const save = vi.fn();
  const view = render(<StudioTextField value="Old note" label="Message" maxLength={2000} onCommit={save} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Old note " } });
  view.rerender(<StudioTextField value="Reviewed new note" label="Message" maxLength={2000} onCommit={save} />);
  expect(screen.getByRole("textbox")).toHaveValue("Reviewed new note");
});
