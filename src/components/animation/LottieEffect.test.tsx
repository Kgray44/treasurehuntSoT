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

  it("loads an ambient runtime once, applies mode changes in place, follows visibility, and destroys exactly once", async () => {
    const status = vi.fn();
    const ref = createRef<LottieEffectHandle>();
    const { rerender, unmount } = render(
      <LottieEffect
        ref={ref}
        asset={lottieAssets.moonlitWaves}
        mode="full"
        label="Moonlit waves"
        playback="ambient"
        reducedFrame={7}
        onStatus={status}
      />,
    );
    await waitFor(() => expect(lottie.loadAnimation).toHaveBeenCalledOnce());
    expect(lottie.loadAnimation.mock.calls[0][0]).toMatchObject({
      renderer: "svg",
      loop: true,
      autoplay: false,
      path: "/animations/lottie/moonlit-waves.json",
    });

    act(() => lottie.listeners.get("data_ready")?.());
    expect(status).toHaveBeenLastCalledWith("ready");
    expect(lottie.item.setSpeed).toHaveBeenLastCalledWith(1);
    expect(lottie.item.play).toHaveBeenCalledOnce();

    rerender(
      <LottieEffect
        ref={ref}
        asset={lottieAssets.moonlitWaves}
        mode="gentle"
        label="Moonlit waves"
        playback="ambient"
        reducedFrame={7}
        onStatus={() => undefined}
      />,
    );
    expect(lottie.loadAnimation).toHaveBeenCalledOnce();
    expect(lottie.item.destroy).not.toHaveBeenCalled();
    expect(lottie.item.setSpeed).toHaveBeenLastCalledWith(0.65);

    rerender(
      <LottieEffect
        ref={ref}
        asset={lottieAssets.moonlitWaves}
        mode="reduced"
        label="Moonlit waves"
        playback="ambient"
        reducedFrame={7}
      />,
    );
    expect(lottie.loadAnimation).toHaveBeenCalledOnce();
    expect(lottie.item.pause).toHaveBeenCalled();
    expect(lottie.item.goToAndStop).toHaveBeenLastCalledWith(7, true);

    rerender(
      <LottieEffect
        ref={ref}
        asset={lottieAssets.moonlitWaves}
        mode="full"
        label="Moonlit waves"
        playback="ambient"
        reducedFrame={7}
      />,
    );
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(lottie.item.pause).toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(lottie.item.play).toHaveBeenCalled();

    expect(readAnimationMetrics().lottie).toBe(1);
    ref.current?.destroy();
    ref.current?.destroy();
    expect(readAnimationMetrics().lottie).toBe(0);
    expect(lottie.item.destroy).toHaveBeenCalledOnce();

    unmount();
    expect(lottie.item.destroy).toHaveBeenCalledOnce();
    expect(lottie.item.removeEventListener).toHaveBeenCalledWith("data_ready", expect.any(Function));
  });

  it("keeps a one-shot command-gated across full and gentle modes and never resumes it after reduced mode", async () => {
    const ref = createRef<LottieEffectHandle>();
    const { rerender } = render(
      <LottieEffect ref={ref} asset={lottieAssets.inkBloom} mode="full" label="Ink bloom" reducedFrame={11} />,
    );
    await waitFor(() => expect(lottie.loadAnimation).toHaveBeenCalledOnce());
    expect(lottie.loadAnimation.mock.calls[0][0]).toMatchObject({ loop: false, autoplay: false });

    act(() => lottie.listeners.get("data_ready")?.());
    expect(lottie.item.play).not.toHaveBeenCalled();
    expect(lottie.item.playSegments).not.toHaveBeenCalled();
    expect(lottie.item.pause).toHaveBeenCalled();

    rerender(
      <LottieEffect ref={ref} asset={lottieAssets.inkBloom} mode="gentle" label="Ink bloom" reducedFrame={11} />,
    );
    expect(lottie.loadAnimation).toHaveBeenCalledOnce();
    expect(lottie.item.destroy).not.toHaveBeenCalled();
    expect(lottie.item.setSpeed).toHaveBeenLastCalledWith(0.65);
    expect(lottie.item.play).not.toHaveBeenCalled();

    ref.current?.playSegment([12, 24]);
    expect(lottie.item.playSegments).toHaveBeenCalledOnce();
    expect(lottie.item.playSegments).toHaveBeenCalledWith([12, 24], true);
    act(() => lottie.listeners.get("complete")?.());
    const playCountAfterCompletion = lottie.item.play.mock.calls.length;
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(lottie.item.play).toHaveBeenCalledTimes(playCountAfterCompletion);

    rerender(
      <LottieEffect ref={ref} asset={lottieAssets.inkBloom} mode="reduced" label="Ink bloom" reducedFrame={11} />,
    );
    expect(lottie.item.goToAndStop).toHaveBeenLastCalledWith(11, true);
    const playCount = lottie.item.play.mock.calls.length;
    rerender(<LottieEffect ref={ref} asset={lottieAssets.inkBloom} mode="full" label="Ink bloom" reducedFrame={11} />);
    expect(lottie.item.play).toHaveBeenCalledTimes(playCount);
    expect(lottie.loadAnimation).toHaveBeenCalledOnce();

    ref.current?.play();
    ref.current?.setSpeed(1.5);
    ref.current?.setDirection(-1);
    ref.current?.goToFrame(8);
    expect(lottie.item.play).toHaveBeenCalledTimes(playCount + 1);
    expect(lottie.item.setSpeed).toHaveBeenLastCalledWith(1.5);
    expect(lottie.item.setDirection).toHaveBeenCalledWith(-1);
    expect(lottie.item.goToAndStop).toHaveBeenLastCalledWith(8, true);
  });

  it("retains a semantic segment command issued while the asset is still loading", async () => {
    const ref = createRef<LottieEffectHandle>();
    render(<LottieEffect ref={ref} asset={lottieAssets.inkBloom} mode="full" label="Ink bloom" />);
    ref.current?.playSegment([4, 18]);
    await waitFor(() => expect(lottie.loadAnimation).toHaveBeenCalledOnce());
    expect(lottie.item.playSegments).not.toHaveBeenCalled();
    act(() => lottie.listeners.get("data_ready")?.());
    expect(lottie.item.playSegments).toHaveBeenCalledOnce();
    expect(lottie.item.playSegments).toHaveBeenCalledWith([4, 18], true);
  });

  it("renders the readable fallback and tears down the runtime on a data error", async () => {
    const status = vi.fn();
    const { unmount } = render(
      <LottieEffect asset={lottieAssets.moonlitWaves} mode="reduced" label="Moonlit waves" onStatus={status} />,
    );
    await waitFor(() => expect(lottie.loadAnimation).toHaveBeenCalledOnce());
    expect(readAnimationMetrics().lottie).toBe(1);

    act(() => lottie.listeners.get("data_failed")?.());
    expect(status).toHaveBeenLastCalledWith("failed");
    expect(screen.getByRole("img", { name: "Moonlit waves static fallback" })).toBeVisible();
    expect(lottie.item.destroy).toHaveBeenCalledOnce();
    expect(readAnimationMetrics().lottie).toBe(0);

    unmount();
    expect(lottie.item.destroy).toHaveBeenCalledOnce();
  });

  it("fails a stalled load within the configured bound and cleans up once", async () => {
    const { unmount } = render(
      <LottieEffect
        asset={lottieAssets.rollingFog}
        mode="full"
        label="Rolling fog"
        playback="ambient"
        loadTimeoutMs={100}
      />,
    );
    await waitFor(() => expect(lottie.loadAnimation).toHaveBeenCalledOnce());
    expect(readAnimationMetrics().lottie).toBe(1);
    await waitFor(() => expect(screen.getByRole("img", { name: "Rolling fog static fallback" })).toBeVisible(), {
      timeout: 500,
    });
    expect(lottie.item.destroy).toHaveBeenCalledOnce();
    expect(readAnimationMetrics().lottie).toBe(0);

    unmount();
    expect(lottie.item.destroy).toHaveBeenCalledOnce();
  });
});
