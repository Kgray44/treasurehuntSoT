import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { PlayerSignIn } from "./PlayerSignIn";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/animation/motion/useMotionMode", () => ({ useMotionMode: () => ({ mode: "reduced" }) }));

function TestAuthority({ children }: { children: React.ReactNode }) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  useEffect(() => () => hosts.destroy(), [hosts]);
  const authority = useMemo(() => ({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }), [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

function renderPlayer(onRouteHandoff?: (destination: string, signal: AbortSignal) => void | Promise<void>) {
  return render(
    <TestAuthority>
      <PlayerSignIn
        authenticated={false}
        canonicalSignInHref="/sign-in?returnTo=%2Fplayer%2Flibrary"
        onRouteHandoff={onRouteHandoff}
      />
    </TestAuthority>,
  );
}

describe("Player entry adapter", () => {
  afterEach(() => {
    cleanup();
    history.replaceState(null, "", "/player/sign-in");
    vi.unstubAllGlobals();
  });

  it("homeport.auth.single-product exposes no second Player password form", () => {
    renderPlayer();
    expect(screen.getByRole("link", { name: "Continue to account sign-in" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Fplayer%2Flibrary",
    );
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("homeport.invitation.account-handoff preserves bounded invitation-code entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ next: "/player/invitation" }) }),
    );
    const handoff = vi.fn();
    renderPlayer(handoff);
    fireEvent.click(screen.getByRole("tab", { name: "Invitation code" }));
    await waitFor(() => expect(screen.getByLabelText("Short code")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Short code"), { target: { value: "ABCD-EFGH" } });
    fireEvent.click(screen.getByRole("button", { name: "Find my invitation" }));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/invitation", expect.any(AbortSignal)));
  });

  it("keeps semantic entry controls outside the pointer-inert cinematic host", () => {
    renderPlayer();
    const host = document.querySelector<HTMLElement>('[data-scene-host-boundary="platform-ceremony"]');
    expect(host).toHaveAttribute("aria-hidden", "true");
    expect(host).toHaveStyle({ pointerEvents: "none" });
    expect(host?.querySelector("input, button, form, [role]")).toBeNull();
  });
});
