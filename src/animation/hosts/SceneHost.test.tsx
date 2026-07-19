import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { motion } from "motion/react";
import { StrictMode, useMemo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationProvider } from "../director/AnimationProvider";
import { AnimationOwnershipRegistry } from "../core/ownership";
import { SceneHost, useRuntimeOwnedSceneTarget, useSceneTargetRegistration } from "./SceneHost";
import { useAnimationAuthority, useOptionalSceneHost } from "./SceneHostContext";
import { SceneHostRegistry } from "./scene-host-registry";

function HostProbe({ name }: { name: string }) {
  const host = useOptionalSceneHost();
  const authority = useAnimationAuthority();
  return (
    <output
      data-testid={`host-${name}`}
      data-host-id={host?.hostId ?? "pending"}
      data-provider-id={authority.providerId}
      data-host-count={authority.hosts.snapshot().registeredHostCount}
    />
  );
}

function TargetProbe() {
  const input = useMemo(
    () => ({ targetKey: "route-a", part: "route-path", allowedProperties: ["transform" as const] }),
    [],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(input);
  return <div ref={bindTarget} data-testid="target" data-target-id={handle?.targetId ?? "pending"} />;
}

function RuntimeTargetProbe({ onRender }: { onRender?: (ready: boolean) => void }) {
  const input = useMemo(
    () => ({
      targetKey: "motion-layout",
      part: "motion-layout",
      runtime: "motion" as const,
      allowedProperties: ["layout", "opacity"] as const,
      properties: ["layout", "opacity"] as const,
    }),
    [],
  );
  const { bindTarget, handle, ownershipReady } = useRuntimeOwnedSceneTarget(input);
  onRender?.(ownershipReady);
  return (
    <motion.div
      ref={bindTarget}
      data-testid="runtime-target"
      data-ready={ownershipReady ? "yes" : "no"}
      data-target-id={handle?.targetId ?? "pending"}
      {...(ownershipReady ? { layout: true, animate: { opacity: 1 } } : {})}
    />
  );
}

function RegistryCapture({ capture }: { capture: (registry: SceneHostRegistry) => void }) {
  capture(useAnimationAuthority().hosts);
  return null;
}

describe("SceneHost React boundary", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion-level");
    vi.restoreAllMocks();
  });

  it("registers one connected boundary and binds target refs to the nearest host", async () => {
    render(
      <AnimationProvider>
        <SceneHost kind="player-progression" hostKey="player-one" data-testid="boundary">
          <HostProbe name="one" />
          <TargetProbe />
        </SceneHost>
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("host-one").dataset.hostId).not.toBe("pending"));
    await waitFor(() => expect(screen.getByTestId("target").dataset.targetId).not.toBe("pending"));
    expect(screen.getByTestId("boundary")).toHaveAttribute("data-scene-host-kind", "player-progression");
    expect(screen.getByTestId("target").dataset.targetId).toContain(screen.getByTestId("host-one").dataset.hostId);
  });

  it("isolates identical host keys and IDs across providers", async () => {
    render(
      <>
        <AnimationProvider>
          <SceneHost kind="access" hostKey="access-shell">
            <HostProbe name="a" />
          </SceneHost>
        </AnimationProvider>
        <AnimationProvider>
          <SceneHost kind="access" hostKey="access-shell">
            <HostProbe name="b" />
          </SceneHost>
        </AnimationProvider>
      </>,
    );

    await waitFor(() => expect(screen.getByTestId("host-a").dataset.hostId).not.toBe("pending"));
    await waitFor(() => expect(screen.getByTestId("host-b").dataset.hostId).not.toBe("pending"));
    expect(screen.getByTestId("host-a").dataset.providerId).not.toBe(screen.getByTestId("host-b").dataset.providerId);
    expect(screen.getByTestId("host-a").dataset.hostId).not.toBe(screen.getByTestId("host-b").dataset.hostId);
  });

  it("tears down provider authority and host registrations idempotently", async () => {
    const destroy = vi.spyOn(SceneHostRegistry.prototype, "destroy");
    const view = render(
      <AnimationProvider>
        <SceneHost kind="development-showcase">
          <HostProbe name="showcase" />
        </SceneHost>
      </AnimationProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("host-showcase").dataset.hostId).not.toBe("pending"));
    view.unmount();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("keeps Motion props disabled initially, then claims during the host-availability layout boundary", async () => {
    const readiness: boolean[] = [];
    render(
      <AnimationProvider>
        <SceneHost kind="player-section-enhancement">
          <RuntimeTargetProbe onRender={(ready) => readiness.push(ready)} />
        </SceneHost>
      </AnimationProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("runtime-target")).toHaveAttribute("data-ready", "yes"));
    expect(readiness[0]).toBe(false);
    expect(readiness).toContain(true);
    expect(screen.getByTestId("runtime-target").dataset.targetId).not.toBe("pending");
    expect(screen.getByTestId("runtime-target")).toHaveAttribute("data-animation-owner", "motion");
  });

  it("remains static when authority is absent or the synchronous runtime claim conflicts", async () => {
    const absent = render(<RuntimeTargetProbe />);
    expect(screen.getByTestId("runtime-target")).toHaveAttribute("data-ready", "no");
    absent.unmount();

    vi.spyOn(AnimationOwnershipRegistry.prototype, "claim").mockReturnValue({
      status: "rejected",
      reason: "property-conflict",
    } as never);
    render(
      <AnimationProvider>
        <SceneHost kind="player-section-enhancement">
          <RuntimeTargetProbe />
        </SceneHost>
      </AnimationProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("runtime-target")).toHaveAttribute("data-ready", "no"));
    expect(screen.getByTestId("runtime-target")).not.toHaveAttribute("data-animation-owner");
    expect(screen.getByTestId("runtime-target")).not.toHaveAttribute("data-scene-target-id");
  });

  it("releases runtime ownership before target teardown across Strict Mode cleanup", async () => {
    let registry: SceneHostRegistry | undefined;
    const view = render(
      <AnimationProvider>
        <RegistryCapture capture={(value) => (registry = value)} />
        <StrictMode>
          <SceneHost kind="player-section-enhancement">
            <RuntimeTargetProbe />
          </SceneHost>
        </StrictMode>
      </AnimationProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("runtime-target")).toHaveAttribute("data-ready", "yes"));
    expect(registry?.snapshot().activeClaimCount).toBe(1);
    view.unmount();
    expect(registry?.snapshot()).toMatchObject({
      registeredHostCount: 0,
      registeredTargetCount: 0,
      activeClaimCount: 0,
    });
  });
});
