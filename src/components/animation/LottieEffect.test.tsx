import { act, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lottieAssets } from "@/animation/assets/lottie-contracts";
import { readAnimationMetrics, resetAnimationMetrics } from "@/animation/core/metrics";
import { LottieEffect, type LottieEffectHandle } from "./LottieEffect";

const lottie = vi.hoisted(() => {
  const listeners = new Map<string, () => void>();
  const item = {
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    goToAndStop: vi.fn(),
    playSegments: vi.fn(),
    setSpeed: vi.fn(),
    setDirection: vi.fn(),
    addEventListener: vi.fn((name: string, callback: () => void) => listeners.set(name, callback)),
    removeEventListener: vi.fn((name: string) => listeners.delete(name)),
  };
  const loadAnimation = vi.fn((options: Record<string, unknown>) => {
    void options;
    return item;
  });
  return { listeners, item, loadAnimation };
});

vi.mock("lottie-web", () => ({ default: { loadAnimation: lottie.loadAnimation } }));

describe("LottieEffect", () => {
  afterEach(() => {
    vi.clearAllMocks();
    lottie.listeners.clear();
    resetAnimationMetrics();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("loads the local contract, reports ready, follows visibility, exposes controls, and destroys cleanly", async () => {
    const status = vi.fn();
    const ref = createRef<LottieEffectHandle>();
    const { rerender, unmount } = render(
      <LottieEffect ref={ref} asset={lottieAssets.inkBloom} mode="full" label="Ink bloom" onStatus={status} />,
    );
    await waitFor(() => expect(lottie.loadAnimation).toHaveBeenCalledOnce());
    expect(lottie.loadAnimation.mock.calls[0][0]).toMatchObject({
      renderer: "svg",
      loop: false,
      autoplay: true,
      path: "/animations/lottie/ink-bloom.json",
    });

    act(() => lottie.listeners.get("data_ready")?.());
    expect(status).toHaveBeenLastCalledWith("ready");
    expect(lottie.item.setSpeed).toHaveBeenCalledWith(1);

    ref.current?.playSegment([12, 24]);
    ref.current?.setSpeed(1.5);
    ref.current?.setDirection(-1);
    ref.current?.goToFrame(8);
    expect(lottie.item.playSegments).toHaveBeenCalledWith([12, 24], true);
    expect(lottie.item.setSpeed).toHaveBeenLastCalledWith(1.5);
    expect(lottie.item.setDirection).toHaveBeenCalledWith(-1);
    expect(lottie.item.goToAndStop).toHaveBeenCalledWith(8, true);

    rerender(
      <LottieEffect ref={ref} asset={lottieAssets.inkBloom} mode="full" label="Ink bloom" onStatus={() => undefined} />,
    );
    expect(lottie.loadAnimation).toHaveBeenCalledOnce();
    expect(lottie.item.destroy).not.toHaveBeenCalled();

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(lottie.item.pause).toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(lottie.item.play).toHaveBeenCalled();

    expect(readAnimationMetrics().lottie).toBe(1);
    ref.current?.destroy();
    expect(readAnimationMetrics().lottie).toBe(0);
    expect(lottie.item.destroy).toHaveBeenCalledOnce();

    unmount();
    expect(lottie.item.destroy).toHaveBeenCalledOnce();
    expect(lottie.item.removeEventListener).toHaveBeenCalledWith("data_ready", expect.any(Function));
  });

  it("does not autoplay in reduced mode and renders an accessible local fallback on data failure", async () => {
    const status = vi.fn();
    render(<LottieEffect asset={lottieAssets.moonlitWaves} mode="reduced" label="Moonlit waves" onStatus={status} />);
    await waitFor(() => expect(lottie.loadAnimation).toHaveBeenCalledOnce());
    expect(lottie.loadAnimation.mock.calls[0][0]).toMatchObject({ autoplay: false, loop: true });
    act(() => lottie.listeners.get("data_ready")?.());
    expect(lottie.item.goToAndStop).toHaveBeenCalledWith(0, true);
    act(() => lottie.listeners.get("data_failed")?.());
    expect(status).toHaveBeenLastCalledWith("failed");
    expect(screen.getByRole("img", { name: "Moonlit waves static fallback" })).toBeVisible();
  });
});
