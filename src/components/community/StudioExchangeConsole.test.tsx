import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioExchangeConsole } from "./StudioExchangeConsole";

const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;

describe("Studio Exchange Console", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("requires Creator access without presenting a publication control", () => {
    render(<StudioExchangeConsole authenticated={false} />);
    expect(screen.getByRole("heading", { name: "Creator access is required." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in and return to the Exchange" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Fstudio%2Fexchange",
    );
    expect(screen.queryByRole("button", { name: "Review exact package" })).not.toBeInTheDocument();
  });

  it("reviews the server package before sending the exact digest for moderation", async () => {
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}) });
        if (url.endsWith("/options"))
          return response({
            sources: [
              { type: "CHRONICLE", id: "version-123", title: "Harbor Tale · 1.0", sourceChecksum: "a".repeat(64) },
            ],
            licenses: [
              {
                key: "REMIX_WITH_ATTRIBUTION",
                displayName: "Remix with attribution",
                requiresAttribution: true,
                shareAlike: false,
              },
            ],
          });
        if (url.endsWith("/preflight"))
          return response({
            reviewDigest: "b".repeat(64),
            sourceChecksum: "a".repeat(64),
            included: { chapters: [{ title: "Opening" }] },
            license: { key: "REMIX_WITH_ATTRIBUTION", name: "Remix with attribution", allowsModification: true },
            attribution: [{ displayName: "Synthetic Creator", contributionType: "Creator" }],
          });
        if (url === "/api/player/session") return response({ csrfToken: "synthetic-csrf" });
        if (url.endsWith("/publish"))
          return response(
            {
              listingId: "listing-123",
              releaseId: "release-123",
              publicationStatus: "READY_FOR_REVIEW",
              listingUrl: "/community/harbor-tale",
            },
            201,
          );
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    render(<StudioExchangeConsole authenticated />);
    fireEvent.change(await screen.findByLabelText("Saved source"), { target: { value: "CHRONICLE:version-123" } });
    fireEvent.change(screen.getByLabelText("Preview-safe description"), { target: { value: "A fictional harbor." } });
    fireEvent.change(screen.getByLabelText("License"), { target: { value: "REMIX_WITH_ATTRIBUTION" } });
    fireEvent.click(screen.getByLabelText("I own or have permission to distribute every included item."));
    fireEvent.click(screen.getByLabelText(/I reviewed the full Chronicle for spoilers/));
    fireEvent.click(screen.getByRole("button", { name: "Review exact package" }));
    expect(await screen.findByRole("heading", { name: "Review before submitting" })).toBeInTheDocument();
    expect(screen.getByText(/Synthetic Creator/)).toBeInTheDocument();
    expect(calls.some((call) => call.url.endsWith("/publish"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Submit for moderation" }));
    await waitFor(() => expect(screen.getByText(/Submitted for independent moderation/)).toBeInTheDocument());
    const publication = calls.find((call) => call.url.endsWith("/publish"))?.body;
    expect(publication?.reviewDigest).toBe("b".repeat(64));
    expect((publication?.publication as { publishedVersionId: string }).publishedVersionId).toBe("version-123");
  });
});
