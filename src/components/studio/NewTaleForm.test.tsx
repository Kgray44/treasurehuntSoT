import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewTaleForm } from "./NewTaleForm";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/animation/motion/useMotionMode", () => ({ useMotionMode: () => ({ mode: "reduced" }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const reply = (body: unknown, ok = true) => ({ ok, json: async () => body });

describe("Chronicle creation choices", () => {
  it("recovers the same owned draft when the creation response is lost", async () => {
    let slug = "";
    const fetch = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        slug = JSON.parse(options.body as string).slug;
        throw new Error("Response lost");
      }
      return reply(slug ? { tales: [{ id: "recovered-draft", slug }] } : { csrfToken: "csrf" });
    });
    vi.stubGlobal("fetch", fetch);
    render(<NewTaleForm authenticated />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Create Manually/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Create Manually/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/studio/tales/recovered-draft"));
    expect(fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });
  it("does not create on view and opens exactly one real manual draft without metadata", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply({ csrfToken: "csrf" }))
      .mockResolvedValue(reply({ id: "draft-identity" }));
    vi.stubGlobal("fetch", fetch);
    render(<NewTaleForm authenticated />);
    const manual = screen.getByRole("button", { name: /Create Manually/ });
    await waitFor(() => expect(manual).toBeEnabled());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    for (const name of ["Create with AI", "Adapt a Story", "Start from a Template"]) {
      const choice = screen.getByRole("button", { name: new RegExp(name) });
      expect(choice).toBeDisabled();
      expect(choice).toHaveTextContent("Coming soon");
      fireEvent.click(choice);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(manual);
    fireEvent.click(manual);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/studio/tales/draft-identity"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      title: "Untitled Chronicle",
      slug: expect.stringMatching(/^chronicle-[a-f0-9-]{36}$/),
    });
    expect(fetch.mock.calls[1][1].headers["x-csrf-token"]).toBe("csrf");
  });
  it("recovers secure preparation after a network failure", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockResolvedValue(reply({ csrfToken: "recovered" }));
    vi.stubGlobal("fetch", fetch);
    render(<NewTaleForm authenticated />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Create Manually/ })).toBeEnabled());
    expect(push).not.toHaveBeenCalled();
  });
  it("requires ordinary account sign-in without requesting or creating drafts", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<NewTaleForm authenticated={false} />);
    expect(screen.getByRole("link", { name: "Continue to account sign-in" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Fstudio%2Ftales%2Fnew",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
