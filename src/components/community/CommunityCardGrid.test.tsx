import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomeportCardVariant, HomeportCommunityCard } from "@/community/homeport";

vi.mock("@/components/auth/CurrentUserProvider", () => ({
  useCurrentUser: () => ({ state: { status: "anonymous", authenticated: false } }),
}));

import { CommunityCardGrid } from "./CommunityCardGrid";

const variants: readonly HomeportCardVariant[] = [
  "CHRONICLE",
  "ARTIFACT",
  "TEMPLATE",
  "MAP_OR_LOCATION_PACK",
  "AUDIO_OR_REVEAL",
  "CREATOR",
  "COLLECTION",
  "GUIDE",
  "VOYAGE_LOG",
];

function card(variant: HomeportCardVariant, social = false): HomeportCommunityCard {
  const id = variant.toLocaleLowerCase();
  return {
    id,
    variant,
    itemType: variant,
    contentType: variant.replaceAll("_", " "),
    destination: `/community/${id}`,
    artwork: {
      kind: "GOVERNED_FALLBACK",
      state: "MISSING",
      motif: variant,
      label: `${variant} artwork unavailable`,
    },
    imageState: "FALLBACK",
    title: `${variant} title`,
    summary: `Safe ${variant} summary`,
    ...(social ? { socialSubject: { subjectType: variant === "CREATOR" ? "CREATOR" : "LISTING", subjectId: id } } : {}),
    primaryAction: { label: "Open", href: `/community/${id}` },
  };
}

describe("CommunityCardGrid", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders all governed variants with labelled fallback art and valid destinations", () => {
    render(<CommunityCardGrid cards={variants.map((variant) => card(variant))} label="Variant contract" />);
    const grid = screen.getByLabelText("Variant contract");
    expect(grid.querySelectorAll("article")).toHaveLength(9);
    expect(grid.querySelectorAll("[data-card-variant]")).toHaveLength(9);
    expect(grid.querySelectorAll('[role="img"]')).toHaveLength(9);
    expect(grid.querySelector("a a, a button, button a, button button")).toBeNull();
    for (const variant of variants) {
      expect(screen.getByRole("img", { name: `${variant} artwork unavailable` })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: `${variant} title` })).toHaveAttribute(
        "href",
        `/community/${variant.toLocaleLowerCase()}`,
      );
    }
  }, 15_000);

  it("loads relationship state once for the visible card batch", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ states: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(
      <CommunityCardGrid cards={[card("CHRONICLE", true), card("CREATOR", true)]} label="Social projection contract" />,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const url = String(fetch.mock.calls[0]?.[0]);
    expect(url).toContain("/api/community/social/state?subjects=");
    expect(decodeURIComponent(url)).toContain('"subjectType":"LISTING"');
    expect(decodeURIComponent(url)).toContain('"subjectType":"CREATOR"');
    expect(screen.getByRole("link", { name: "Sign in to save" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to follow" })).toBeInTheDocument();
  });
});
