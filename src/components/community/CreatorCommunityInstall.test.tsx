import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CreatorCommunityInstall } from "./CreatorCommunityInstall";

const release = {
  title: "Harbor opening",
  creator: "Synthetic Creator",
  itemType: "STORY_BLOCK_PRESET",
  semanticVersion: "1.0.0",
  releaseId: "release-id",
  packageChecksum: "checksum",
  license: { key: "SYNTHETIC_REUSE", allowsModification: true, requiresAttribution: true },
  attribution: [],
  included: { name: "Harbor opening", description: "Opening passage" },
  alreadyInstalled: false,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([false, true])("handles install completion when focus has moved: %s", async (movesFocus) => {
  const installation = Promise.withResolvers<Response>();
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith("/install/commit")) return installation.promise;
    if (path === "/api/player/session") return Promise.resolve(Response.json({ csrfToken: "synthetic-token" }));
    return Promise.resolve(Response.json(release));
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <>
      <a href="/community">Community home</a>
      <CreatorCommunityInstall listingId="listing-id" itemType="STORY_BLOCK_PRESET" returnTo="/community/harbor" />
    </>,
  );

  const action = await screen.findByRole("button", { name: "Install to my reusable Library" });
  action.focus();
  fireEvent.click(action);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(action).toHaveAttribute("aria-disabled", "true");
  expect(action).toHaveFocus();
  fireEvent.click(action);
  expect(fetcher).toHaveBeenCalledTimes(3);

  const outside = screen.getByRole("link", { name: "Community home" });
  if (movesFocus) outside.focus();
  await act(async () => {
    installation.resolve(Response.json({ studioUrl: "/studio/exchange#installed-community" }));
  });

  const destination = screen.getByRole("link", { name: "View my installed item" });
  expect(destination).toHaveAttribute("href", "/studio/exchange#installed-community");
  expect(movesFocus ? outside : destination).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("Installed in your private Studio library.");
});
