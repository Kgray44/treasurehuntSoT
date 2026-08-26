import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePersonalHarbor } from "@/components/homeport/PersonalHarborLayout";
import { PassportLayout } from "./PassportLayout";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/passport",
  useRouter: () => ({ push, replace }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function DraftProbe() {
  const { setDirty } = usePersonalHarbor();
  return (
    <button type="button" onClick={() => setDirty(true)}>
      Change draft
    </button>
  );
}

function renderLayout() {
  return render(
    <PassportLayout
      activeSection="passport-home"
      eyebrow="The Living Journey Archive"
      title="Chronicle Passport"
      description="A private journey archive."
      csrfToken="synthetic-csrf"
    >
      <DraftProbe />
    </PassportLayout>,
  );
}

describe("PassportLayout", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    window.history.replaceState({}, "", "/passport");
  });
  afterEach(cleanup);

  it("wakebook.a1.passport-shell provides a full Passport destination with its own section navigation and Harbor gateway", () => {
    renderLayout();
    expect(screen.getByRole("main")).toHaveAttribute("data-passport-section", "passport-home");
    expect(screen.getByRole("link", { name: /personal harbor/i })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("navigation", { name: "Chronicle Passport sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Passport" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Your Voyages" })).toHaveAttribute("href", "/passport/history");
    expect(screen.getByRole("link", { name: "Memories" })).toHaveAttribute("href", "/passport/memories");
    expect(screen.getByRole("link", { name: "Artifacts" })).toHaveAttribute("href", "/passport/artifacts");
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/passport/saved");
  });

  it("wakebook.a1.passport-shell protects an in-progress reflection before local or Harbor navigation", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Change draft" }));
    fireEvent.click(screen.getByRole("link", { name: "Your Voyages" }));
    expect(screen.getByRole("dialog", { name: "Leave this section?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(push).toHaveBeenCalledWith("/passport/history");
  });

  it("wakebook.a1.passport-shell keeps the unsaved-changes dialog keyboard-operable", async () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Change draft" }));
    const voyagesLink = screen.getByRole("link", { name: "Your Voyages" });
    fireEvent.click(voyagesLink);
    await waitFor(() => expect(screen.getByRole("button", { name: "Stay" })).toHaveFocus());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(voyagesLink).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "Leave this section?" })).not.toBeInTheDocument();
  });

  it("wakebook.a1.passport-shell preserves the historical hash route adapter", async () => {
    window.history.replaceState({}, "", "/passport#history");
    renderLayout();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/passport/history"));
  });
});
