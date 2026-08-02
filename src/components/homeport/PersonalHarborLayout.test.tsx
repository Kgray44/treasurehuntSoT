import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalHarborLayout, usePersonalHarbor } from "@/components/homeport/PersonalHarborLayout";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/account/profile",
  useRouter: () => ({ push, replace }),
}));

function DraftProbe() {
  const { setDirty } = usePersonalHarbor();
  return <button type="button" onClick={() => setDirty(true)}>Change draft</button>;
}

function renderLayout() {
  return render(
    <PersonalHarborLayout
      activeSection="public-profile-editor"
      eyebrow="Personal Harbor"
      title="Public Profile"
      description="Test surface"
      csrfToken="synthetic-csrf"
    >
      <DraftProbe />
    </PersonalHarborLayout>,
  );
}

describe("PersonalHarborLayout", () => {
  beforeEach(() => { push.mockReset(); replace.mockReset(); window.history.replaceState({}, "", "/account/profile"); });
  afterEach(cleanup);

  it("homeport.personal-harbor.mobile-parity projects the same section links in desktop and mobile navigation", () => {
    renderLayout();
    expect(screen.getAllByRole("link", { name: "Preferences" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Saved" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Sessions & Devices" })).toHaveLength(2);
  });

  it("homeport.personal-harbor.unsaved-changes keeps or discards an in-progress draft explicitly", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Change draft" }));
    fireEvent.click(screen.getAllByRole("link", { name: "Preferences" })[0]);
    expect(screen.getByRole("dialog", { name: "Leave this section?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("link", { name: "Preferences" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(push).toHaveBeenCalledWith("/account/preferences");
  });
});
