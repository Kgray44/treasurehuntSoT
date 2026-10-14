import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialDraft } from "@/parallax/authoring";
import { RoomPhotoPanel, type RoomPhotoPanelProps } from "./RoomPhotoPanel";

const draft = createSpatialDraft("photo-feedback-test");
const props = (): RoomPhotoPanelProps => ({
  draft,
  csrfToken: () => "synthetic-csrf",
  prepare: async () => ({ draft, revision: 1, editorGeneration: 0 }),
  isCurrent: () => true,
  apply: vi.fn(),
  onPreview: vi.fn(),
  wizard: true,
});
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL() {
        return "blob:synthetic-photo";
      }
      static revokeObjectURL() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockRequests(reconstruction: (signal: AbortSignal) => Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options?: RequestInit) => {
      if (!options?.method) return reply({ available: true, message: "Development photo import is ready." });
      if (options.body instanceof FormData)
        return reply({ mediaId: "synthetic-photo", permissionExpiresAt: "2026-10-15T00:00:00Z" }, 201);
      return reconstruction(options.signal as AbortSignal);
    }),
  );
}
async function send() {
  const upload = await screen.findByLabelText("Room photograph");
  await waitFor(() => expect(upload).toBeEnabled());
  fireEvent.change(upload, { target: { files: [new File(["synthetic"], "room.png", { type: "image/png" })] } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Reconstruct room from photograph" }));
}

it("shows and focuses a persistent recovery card for an upstream timeout instead of returning silently to upload", async () => {
  mockRequests(async () => reply({ error: "Spatial Assistant took too long. Your scene is unchanged." }, 503));
  render(<RoomPhotoPanel {...props()} />);
  await send();
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByRole("heading", { name: "I couldn’t finish this room" })).toBeVisible();
  expect(alert).toHaveFocus();
  fireEvent.click(within(alert).getByText("What happened"));
  expect(within(alert).getByText("Spatial Assistant took too long. Your scene is unchanged.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Reconstruct room from photograph" })).toBeEnabled();
  expect(screen.queryByText("I’m building your room")).not.toBeInTheDocument();
});

it("renders a geometric clarification as a visible outcome with details and a recovery action", async () => {
  mockRequests(async () => reply({ status: "CLARIFICATION", message: "A wall panel overlaps another feature." }));
  render(<RoomPhotoPanel {...props()} />);
  await send();
  const heading = await screen.findByRole("heading", { name: "I need a clearer view" });
  const card = heading.closest('[role="status"]')! as HTMLElement;
  expect(heading).toBeVisible();
  expect(card).toHaveFocus();
  fireEvent.click(within(card).getByText("What happened"));
  expect(within(card).getByText("A wall panel overlaps another feature.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Reconstruct room from photograph" })).toBeEnabled();
});

it("does not abort active processing when the parent supplies a new preview callback", async () => {
  let finish!: (response: Response) => void;
  let signal!: AbortSignal;
  mockRequests(async (current) => {
    signal = current;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const initial = props();
  const view = render(<RoomPhotoPanel {...initial} />);
  await send();
  await waitFor(() => expect(finish).toBeDefined());
  view.rerender(<RoomPhotoPanel {...initial} onPreview={vi.fn()} />);
  expect(signal.aborted).toBe(false);
  expect(screen.getByRole("heading", { name: "I’m building your room" })).toBeVisible();
  finish(reply({ status: "CLARIFICATION", message: "Try another room angle." }));
  expect(await screen.findByRole("heading", { name: "I need a clearer view" })).toBeVisible();
});

it("keeps cancellation visible and requires a new explicit click to run again", async () => {
  mockRequests(
    async (signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true }),
      ),
  );
  render(<RoomPhotoPanel {...props()} />);
  await send();
  await screen.findByRole("heading", { name: "I’m building your room" });
  await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3));
  fireEvent.click(screen.getByRole("button", { name: "Cancel photo processing" }));
  expect(await screen.findByRole("heading", { name: "Reconstruction cancelled" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Reconstruct room from photograph" })).toBeEnabled();
  expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
});

it("reports a network failure without losing selected photos or silently starting another call", async () => {
  mockRequests(async () => {
    throw new TypeError("Failed to fetch");
  });
  render(<RoomPhotoPanel {...props()} />);
  await send();
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("img", { name: "Selected room view 1" })).toBeVisible();
  expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
});
