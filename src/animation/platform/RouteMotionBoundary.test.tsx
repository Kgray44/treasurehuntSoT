import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteMotionBoundary } from "./RouteMotionBoundary";

const motionState = vi.hoisted(() => ({ mode: "full" as "full" | "reduced" }));

vi.mock("../motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: motionState.mode }),
}));

function pending(label = "Preparing destination") {
  return (
    <main>
      <span data-async-state="pending-delay">{label}</span>
    </main>
  );
}

function ready(label: string) {
  return (
    <main>
      <h1>{label}</h1>
    </main>
  );
}

describe("RouteMotionBoundary", () => {
  afterEach(() => {
    cleanup();
    motionState.mode = "full";
    vi.useRealTimers();
  });

  it("settles to one destination layer after the exact 280 ms route token", () => {
    vi.useFakeTimers();
    const view = render(
      <RouteMotionBoundary pathname="/studio/library">{ready("Chronicle Library")}</RouteMotionBoundary>,
    );
    view.rerender(
      <RouteMotionBoundary pathname="/studio/tales/example">{ready("Chronicle Editor")}</RouteMotionBoundary>,
    );

    expect(view.container.querySelector('[data-route-role="outgoing"]')).toHaveTextContent("Chronicle Library");
    expect(view.container.querySelector('[data-route-role="outgoing"]')).toHaveStyle({ opacity: "1" });
    expect(view.container.querySelector('[data-route-role="outgoing"]')).toHaveAttribute(
      "data-route-interactive",
      "false",
    );
    expect(view.container.querySelector('[data-route-layer="/studio/tales/example"]')).toHaveTextContent(
      "Chronicle Editor",
    );
    act(() => vi.advanceTimersByTime(279));
    expect(view.container.querySelector('[data-route-role="outgoing"]')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelectorAll(".product-route-layer")).toHaveLength(1);
    expect(view.container.querySelector('[data-route-layer="/studio/library"]')).toBeNull();
  });

  it("keeps the outgoing visual snapshot inert and strips duplicated labels and ids", () => {
    vi.useFakeTimers();
    const view = render(
      <RouteMotionBoundary pathname="/register">
        <main>
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" />
        </main>
      </RouteMotionBoundary>,
    );
    view.rerender(
      <RouteMotionBoundary pathname="/verify-email">
        <main>
          <label htmlFor="code">Code</label>
          <input id="code" />
        </main>
      </RouteMotionBoundary>,
    );

    expect(view.getAllByLabelText("Code")).toHaveLength(1);
    expect(view.container.querySelector('[data-route-role="outgoing"] [id]')).toBeNull();
    expect(view.container.querySelector('[data-route-role="outgoing"] label')).toBeNull();
  });

  it("ready at 200 ms permanently suppresses loading through 800 ms", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/sign-in">{ready("Sign in")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/register">{pending("Preparing Sign Up")}</RouteMotionBoundary>);
    expect(view.container.querySelector('[data-route-layer="/register"] [data-route-content]')).toHaveAttribute(
      "data-route-content-hidden",
      "true",
    );
    expect(view.container.querySelector('[data-route-role="outgoing"]')).toHaveStyle({ opacity: "1" });
    act(() => vi.advanceTimersByTime(200));
    view.rerender(<RouteMotionBoundary pathname="/register">{ready("Create your account")}</RouteMotionBoundary>);
    expect(view.container.querySelector('[data-route-layer="/register"] [data-route-content]')).toHaveAttribute(
      "data-route-content-hidden",
      "false",
    );
    act(() => vi.advanceTimersByTime(279));
    expect(view.container.querySelector('[data-route-layer="/sign-in"]')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(320));

    expect(view.container).not.toHaveTextContent("Opening the next page");
    expect(view.container.querySelector('[data-route-state="settled"]')).toBeInTheDocument();
    expect(view.container.querySelector('[data-route-layer="/sign-in"]')).toBeNull();
  });

  it("ready at 499 ms never exposes the loading surface", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/sign-in">{ready("Sign in")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/forgot-password">{pending()}</RouteMotionBoundary>);
    act(() => vi.advanceTimersByTime(499));
    view.rerender(<RouteMotionBoundary pathname="/forgot-password">{ready("Forgot password")}</RouteMotionBoundary>);
    act(() => vi.advanceTimersByTime(400));

    expect(view.container).not.toHaveTextContent("Opening the next page");
    expect(view.container.querySelector('[data-route-loading-shown="true"]')).toBeNull();
  });

  it("ready at 501 ms dismisses the one eligible loading surface and never rearms it", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/tales">{ready("Chronicles")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/community">{pending("Preparing Community")}</RouteMotionBoundary>);
    act(() => vi.advanceTimersByTime(500));
    expect(view.container.querySelector('[data-route-state="loading"]')).toHaveTextContent("Opening Community Harbor");
    expect(view.container.querySelector('[data-route-loading-shown="true"]')).toBeInTheDocument();
    expect(view.container.querySelector('[data-route-layer="/community"] [data-route-content]')).toHaveAttribute(
      "data-route-content-hidden",
      "true",
    );

    act(() => vi.advanceTimersByTime(1));
    view.rerender(<RouteMotionBoundary pathname="/community">{ready("Community Harbor")}</RouteMotionBoundary>);
    expect(view.container.querySelector(".route-preparation-fallback")).toBeNull();
    act(() => vi.advanceTimersByTime(799));
    expect(view.container.querySelector(".route-preparation-fallback")).toBeNull();
    expect(view.container.querySelectorAll('[data-route-layer="/community"]')).toHaveLength(1);
    expect(view.container.querySelector('[data-route-layer="/tales"]')).toBeNull();
  });

  it("invalidates prior generation timers on a second navigation", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/sign-in">{ready("Sign in")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/register">{pending("Preparing Sign Up")}</RouteMotionBoundary>);
    const firstGeneration = view.container
      .querySelector("[data-route-active-generation]")
      ?.getAttribute("data-route-active-generation");
    act(() => vi.advanceTimersByTime(300));
    view.rerender(<RouteMotionBoundary pathname="/">{ready("Home")}</RouteMotionBoundary>);
    const secondGeneration = view.container
      .querySelector("[data-route-active-generation]")
      ?.getAttribute("data-route-active-generation");
    expect(Number(secondGeneration)).toBeGreaterThan(Number(firstGeneration));
    act(() => vi.advanceTimersByTime(800));

    expect(view.container).not.toHaveTextContent("Opening the next page");
    expect(view.container.querySelector('[data-route-layer="/sign-in"]')).toBeNull();
    expect(view.container.querySelector('[data-route-layer="/register"]')).toBeNull();
    expect(view.container.querySelector('[data-route-layer="/"]')).toHaveTextContent("Home");
  });

  it("rejects a stale readiness mutation from an invalidated generation", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/sign-in">{ready("Sign in")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/register">{pending("First pending route")}</RouteMotionBoundary>);
    const staleContent = view.container.querySelector<HTMLElement>(
      '[data-route-layer="/register"] [data-route-content]',
    );
    act(() => vi.advanceTimersByTime(100));
    view.rerender(
      <RouteMotionBoundary pathname="/forgot-password">{pending("Second pending route")}</RouteMotionBoundary>,
    );
    staleContent!.innerHTML = "<main><h1>Stale route became ready</h1></main>";
    act(() => vi.advanceTimersByTime(499));

    expect(view.container.querySelector('[data-route-layer="/register"]')).toBeNull();
    expect(view.container.querySelector('[data-route-state="preparing"]')).toBeInTheDocument();
    expect(view.container).not.toHaveTextContent("Opening the next page");
    act(() => vi.advanceTimersByTime(1));
    expect(view.container.querySelector('[data-route-state="loading"]')).toHaveTextContent("Opening the next page");
  });

  it("uses a fresh generation for browser-style Back navigation without duplicate layers", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/sign-in">{ready("Sign in")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/register">{ready("Create account")}</RouteMotionBoundary>);
    act(() => vi.advanceTimersByTime(280));
    const forwardGeneration = Number(
      view.container.querySelector("[data-route-active-generation]")?.getAttribute("data-route-active-generation"),
    );
    view.rerender(<RouteMotionBoundary pathname="/sign-in">{ready("Sign in")}</RouteMotionBoundary>);
    const backGeneration = Number(
      view.container.querySelector("[data-route-active-generation]")?.getAttribute("data-route-active-generation"),
    );
    expect(backGeneration).toBeGreaterThan(forwardGeneration);
    act(() => vi.advanceTimersByTime(280));
    expect(view.container.querySelectorAll(".product-route-layer")).toHaveLength(1);
    expect(view.container.querySelector('[data-route-layer="/sign-in"]')).toHaveTextContent("Sign in");
    expect(view.container.querySelector('[data-route-layer="/register"]')).toBeNull();
  });

  it("renders a real terminal failure as the settled destination instead of loading", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/account">{ready("Account")}</RouteMotionBoundary>);
    view.rerender(
      <RouteMotionBoundary pathname="/account/profile">
        <main data-async-state="terminal-error" role="alert">
          Profile is unavailable.
        </main>
      </RouteMotionBoundary>,
    );
    act(() => vi.advanceTimersByTime(800));
    expect(view.getByRole("alert")).toHaveTextContent("Profile is unavailable.");
    expect(view.container.querySelector(".route-preparation-fallback")).toBeNull();
  });

  it("cleans timers, observers, and snapshots on unmount", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/sign-in">{ready("Sign in")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/register">{pending()}</RouteMotionBoundary>);
    view.unmount();
    expect(() => act(() => vi.runAllTimers())).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renders one immediate destination layer with no spatial or loading lifecycle under reduced motion", () => {
    motionState.mode = "reduced";
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/account/roles">{ready("All Workspaces")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/account/security">{pending("Security")}</RouteMotionBoundary>);
    act(() => vi.advanceTimersByTime(800));

    expect(view.container.querySelectorAll(".product-route-layer")).toHaveLength(1);
    expect(view.container.querySelector('[data-route-layer="/account/roles"]')).toBeNull();
    expect(view.container.querySelector('[data-route-layer="/account/security"]')).toHaveTextContent("Security");
    expect(view.container.querySelector(".route-preparation-fallback")).toBeNull();
  });

  it("moves focus only after the ordinary destination has settled", () => {
    vi.useFakeTimers();
    const view = render(<RouteMotionBoundary pathname="/account">{ready("Overview")}</RouteMotionBoundary>);
    view.rerender(<RouteMotionBoundary pathname="/account/profile">{ready("Public Profile")}</RouteMotionBoundary>);
    act(() => vi.advanceTimersByTime(400));
    expect(view.getByRole("heading", { name: "Public Profile" })).toHaveFocus();
  });
});
