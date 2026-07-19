import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { riveAssets } from "@/animation/assets/rive-contracts";
import { resetAnimationMetrics } from "@/animation/core/metrics";
import { RiveRuntime } from "./RiveRuntime";
import { RiveStatefulObject } from "./RiveStatefulObject";

const runtime = vi.hoisted(() => {
  const trigger = vi.fn();
  const inputs = [
    { name: "amount", type: 56, value: 2 },
    { name: "submit", type: 58, fire: trigger },
    { name: "enabled", type: 59, value: true },
  ];
  const rive = {
    stateMachineInputs: vi.fn(() => inputs),
    pause: vi.fn(),
    play: vi.fn(),
    drawFrame: vi.fn(),
    cleanup: vi.fn(),
  };
  return { options: null as Record<string, unknown> | null, loadCalls: 0, trigger, inputs, rive };
});

vi.mock("@rive-app/react-webgl2", async () => {
  const React = await import("react");
  const MockRiveComponent = (props: Record<string, unknown>) => <canvas data-testid="rive-canvas" {...props} />;
  return {
    Alignment: { Center: "center" },
    Fit: { Contain: "contain" },
    Layout: class {
      constructor(public options: unknown) {}
    },
    StateMachineInputType: { Number: 56, Trigger: 58, Boolean: 59 },
    useRive: vi.fn((options: Record<string, unknown>) => {
      runtime.options = options;
      runtime.loadCalls += 1;
      React.useEffect(
        () => () => {
          runtime.rive.cleanup();
        },
        [],
      );
      return {
        rive: runtime.rive,
        RiveComponent: MockRiveComponent,
      };
    }),
  };
});

describe("Rive runtime", () => {
  afterEach(() => {
    cleanup();
    runtime.options = null;
    runtime.loadCalls = 0;
    runtime.inputs[0].value = 2;
    runtime.inputs[2].value = true;
    vi.clearAllMocks();
    resetAnimationMetrics();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("settles reduced motion into a declared stable pose and suppresses state-travel signals", async () => {
    const onInputs = vi.fn();
    const onStatus = vi.fn();
    const { rerender, unmount } = render(
      <RiveRuntime
        asset={riveAssets.developmentRating}
        mode="reduced"
        label="Rive development proof"
        className=""
        signal={{ name: "submit", nonce: 1 }}
        reducedMotion={{ stablePose: { amount: 4, enabled: false }, allowedSemanticSignals: ["amount"] }}
        onInputs={onInputs}
        onStatus={onStatus}
      />,
    );

    await waitFor(() => expect(onInputs).toHaveBeenCalled());
    expect(runtime.options).toMatchObject({
      src: "/animations/rive/rating-animation.riv",
      stateMachines: "State Machine 1",
      autoplay: false,
      useOffscreenRenderer: true,
      shouldDisableRiveListeners: true,
      enableRiveAssetCDN: false,
      automaticallyHandleEvents: false,
    });
    expect(onInputs).toHaveBeenLastCalledWith([
      { name: "amount", type: "number", value: 4 },
      { name: "submit", type: "trigger", value: undefined },
      { name: "enabled", type: "boolean", value: false },
    ]);
    expect(runtime.rive.pause).toHaveBeenCalled();
    expect(runtime.rive.drawFrame).toHaveBeenCalled();
    expect(runtime.trigger).not.toHaveBeenCalled();
    expect(runtime.rive.play).not.toHaveBeenCalled();

    act(() => (runtime.options?.onLoad as (() => void) | undefined)?.());
    expect(onStatus).toHaveBeenLastCalledWith("ready");
    rerender(
      <RiveRuntime
        asset={riveAssets.developmentRating}
        mode="full"
        label="Rive development proof"
        className=""
        signal={{ name: "amount", value: 7, nonce: 2 }}
        motionPolicy={{ level: "reduced", allowRiveStateTravel: false }}
        reducedMotion={{ stablePose: { amount: 4, enabled: false }, allowedSemanticSignals: ["amount"] }}
        onInputs={onInputs}
        onStatus={onStatus}
      />,
    );
    await waitFor(() => expect(runtime.inputs[0].value).toBe(7));
    expect(runtime.trigger).not.toHaveBeenCalled();
    expect(runtime.rive.play).not.toHaveBeenCalled();
    unmount();
    expect(runtime.rive.cleanup).toHaveBeenCalledOnce();
  });

  it("keeps one live runtime across mode changes and lets the hook clean it up once", async () => {
    const { rerender, unmount } = render(
      <RiveRuntime
        asset={riveAssets.developmentRating}
        mode="full"
        label="Rive development proof"
        className=""
        signal={{ name: "submit", nonce: 1 }}
      />,
    );
    await waitFor(() => expect(runtime.trigger).toHaveBeenCalledOnce());
    const canvas = screen.getByTestId("rive-canvas");
    expect(runtime.options).toMatchObject({ autoplay: false });
    expect(runtime.rive.play).toHaveBeenCalled();
    expect(runtime.rive.cleanup).not.toHaveBeenCalled();

    rerender(
      <RiveRuntime
        asset={riveAssets.developmentRating}
        mode="reduced"
        label="Rive development proof"
        className=""
        signal={{ name: "submit", nonce: 2 }}
      />,
    );
    expect(screen.getByTestId("rive-canvas")).toBe(canvas);
    expect(runtime.trigger).toHaveBeenCalledOnce();
    expect(runtime.rive.pause).toHaveBeenCalled();
    expect(runtime.rive.cleanup).not.toHaveBeenCalled();

    unmount();
    expect(runtime.rive.cleanup).toHaveBeenCalledOnce();
  });

  it("survives WebGL load failure with an accessible static fallback", async () => {
    const status = vi.fn();
    render(
      <RiveRuntime
        asset={riveAssets.developmentRating}
        mode="full"
        label="Rive development proof"
        className="proof"
        onStatus={status}
      />,
    );
    act(() => (runtime.options?.onLoadError as (() => void) | undefined)?.());
    expect(status).toHaveBeenLastCalledWith("failed");
    expect(status).not.toHaveBeenCalledWith("ready");
    expect(
      screen.getByRole("img", { name: "Rive development proof fallback after WebGL or asset failure" }),
    ).toBeVisible();
    expect(screen.queryByTestId("rive-canvas")).not.toBeInTheDocument();
    expect(runtime.rive.cleanup).toHaveBeenCalledOnce();
  });

  it("identifies unavailable production artwork honestly and never attempts a remote runtime load", async () => {
    const status = vi.fn();
    const before = runtime.loadCalls;
    render(
      <RiveStatefulObject asset={riveAssets.invitationSeal} mode="full" label="Invitation seal" onStatus={status} />,
    );
    expect(
      screen.getByRole("img", {
        name: /Original Rive artwork is not yet supplied; showing the production fallback/,
      }),
    ).toBeVisible();
    await waitFor(() => expect(status).toHaveBeenCalledWith("fallback"));
    expect(status).not.toHaveBeenCalledWith("ready");
    expect(runtime.loadCalls).toBe(before);
    expect(screen.queryByTestId("rive-canvas")).not.toBeInTheDocument();
  });
});
