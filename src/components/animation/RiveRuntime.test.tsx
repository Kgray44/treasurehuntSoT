import { act, render, screen, waitFor } from "@testing-library/react";
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
    cleanup: vi.fn(),
  };
  return { options: null as Record<string, unknown> | null, trigger, inputs, rive };
});

vi.mock("@rive-app/react-webgl2", () => ({
  RuntimeLoader: {
    setWasmUrl: vi.fn(),
    setWasmFallbackUrl: vi.fn(),
  },
  Alignment: { Center: "center" },
  Fit: { Contain: "contain" },
  Layout: class {
    constructor(public options: unknown) {}
  },
  StateMachineInputType: { Number: 56, Trigger: 58, Boolean: 59 },
  useRive: vi.fn((options: Record<string, unknown>) => {
    runtime.options = options;
    return {
      rive: runtime.rive,
      RiveComponent: (props: Record<string, unknown>) => <canvas data-testid="rive-canvas" {...props} />,
    };
  }),
}));

describe("Rive runtime", () => {
  afterEach(() => {
    runtime.options = null;
    vi.clearAllMocks();
    resetAnimationMetrics();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("uses the local file and validated state-machine inputs, disables idle in reduced mode, and cleans up", async () => {
    const onInputs = vi.fn();
    const onStatus = vi.fn();
    const { rerender, unmount } = render(
      <RiveRuntime
        asset={riveAssets.developmentRating}
        mode="reduced"
        label="Rive development proof"
        className=""
        signal={{ name: "submit", nonce: 1 }}
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
    expect(onInputs).toHaveBeenCalledWith([
      { name: "amount", type: "number", value: 2 },
      { name: "submit", type: "trigger", value: undefined },
      { name: "enabled", type: "boolean", value: true },
    ]);
    expect(runtime.rive.pause).toHaveBeenCalled();
    expect(runtime.trigger).toHaveBeenCalledOnce();

    act(() => (runtime.options?.onLoad as (() => void) | undefined)?.());
    expect(onStatus).toHaveBeenLastCalledWith("ready");
    rerender(
      <RiveRuntime
        asset={riveAssets.developmentRating}
        mode="full"
        label="Rive development proof"
        className=""
        signal={{ name: "amount", value: 7, nonce: 2 }}
        onInputs={onInputs}
        onStatus={onStatus}
      />,
    );
    await waitFor(() => expect(runtime.inputs[0].value).toBe(7));
    unmount();
    expect(runtime.rive.cleanup).toHaveBeenCalled();
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
    expect(
      screen.getByRole("img", { name: "Rive development proof fallback after WebGL or asset failure" }),
    ).toBeVisible();
  });

  it("identifies unavailable production artwork honestly and never attempts a remote runtime load", async () => {
    const status = vi.fn();
    render(
      <RiveStatefulObject asset={riveAssets.invitationSeal} mode="full" label="Invitation seal" onStatus={status} />,
    );
    expect(
      screen.getByRole("img", {
        name: /Original Rive artwork is not yet supplied; showing the production fallback/,
      }),
    ).toBeVisible();
    await waitFor(() => expect(status).toHaveBeenCalledWith("fallback"));
  });
});
