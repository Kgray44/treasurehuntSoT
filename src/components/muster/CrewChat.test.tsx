import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CrewChat } from "./CrewChat";
import { response } from "./test-support";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps a failed draft and retries the same message once without losing the sending state", async () => {
  let settle!: (value: Response) => void;
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection interrupted."))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          settle = resolve;
        }),
    );
  vi.stubGlobal("fetch", fetchMock);
  const onSent = vi.fn(async () => {});
  render(<CrewChat voyageId="voyage-1" csrfToken="csrf-token" messages={[]} connected="Live" onSent={onSent} />);
  const input = screen.getByRole("textbox", { name: "Message the crew" });
  fireEvent.change(input, { target: { value: "Ready to sail." } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted.");
  expect(input).toHaveValue("Ready to sail.");
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.getByRole("button", { name: "Sending message" })).toBeDisabled();
  expect(input).toBeDisabled();
  expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
  await act(async () => settle(response(200, { id: "message-1" })));
  await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
  expect(input).toHaveValue("");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
