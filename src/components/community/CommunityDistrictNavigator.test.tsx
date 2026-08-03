import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/community";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { CommunityDistrictNavigator } from "./CommunityDistrictNavigator";

describe("CommunityDistrictNavigator", () => {
  afterEach(cleanup);

  it("renders the complete visible registry and marks Harbor Home exactly", () => {
    pathname = "/community";
    render(<CommunityDistrictNavigator />);
    const navigation = screen.getByRole("navigation", { name: "Community Harbor districts" });
    expect(navigation.querySelectorAll("a")).toHaveLength(11);
    expect(screen.getByRole("link", { name: "Community Harbor" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps a district current on its eligible detail routes", () => {
    pathname = "/community/creators/captain-rowan";
    render(<CommunityDistrictNavigator />);
    expect(screen.getByRole("link", { name: "Creators" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Community Harbor" })).not.toHaveAttribute("aria-current");
  });
});
