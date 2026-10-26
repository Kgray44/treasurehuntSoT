import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioHome } from "./StudioHome";

vi.mock("@/animation/motion/useMotionMode", () => ({ useMotionMode: () => ({ mode: "reduced" }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Studio library creation entry", () => {
  it("keeps the standard creation action unambiguous when the first-Chronicle shortcut appears", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tales: [] }) }));
    render(<StudioHome authenticated />);

    await screen.findByRole("heading", { name: "No Chronicles yet" });
    const standard = screen.getByRole("link", { name: "Create Chronicle" });
    expect(
      within(screen.getByRole("navigation", { name: "Studio destinations" })).getByRole("link", {
        name: "Create Chronicle",
      }),
    ).toBe(standard);
    expect(standard).toHaveAttribute("href", "/studio/tales/new");
    expect(screen.getByRole("link", { name: "Create your first Chronicle" })).toHaveAttribute(
      "href",
      "/studio/tales/new",
    );
  });

  it("retains the same standard creation action in a populated library", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tales: [
            {
              id: "synthetic-library-chronicle",
              slug: "synthetic-library-chronicle",
              title: "Synthetic library Chronicle",
              subtitle: null,
              shortDescription: null,
              status: "DRAFT",
              visibility: "PRIVATE",
              savedAt: "2026-10-24T00:00:00Z",
              validationState: "NOT_VALIDATED",
              latestVersion: null,
              sessionCount: 0,
              assetCount: 0,
            },
          ],
        }),
      }),
    );
    render(<StudioHome authenticated />);

    await screen.findByRole("heading", { name: "Synthetic library Chronicle" });
    expect(screen.getByRole("link", { name: "Create Chronicle" })).toHaveAttribute("href", "/studio/tales/new");
    expect(screen.queryByRole("link", { name: "Create your first Chronicle" })).not.toBeInTheDocument();
  });
});
