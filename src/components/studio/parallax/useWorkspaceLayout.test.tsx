import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { workspacePreset } from "@/parallax/workspace-layout";
import { useWorkspaceLayout } from "./useWorkspaceLayout";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("innerWidth", 1920);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      expect(query).toBe("(max-width: 1099px)");
      return { matches: innerWidth < 1100, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it("preserves an early Library action while restoring account preferences", async () => {
  const scope = "synthetic-layout-hydration";
  localStorage.setItem(
    `parallax.workspace.v1:${scope}`,
    JSON.stringify({ ...workspacePreset("SPATIAL"), libraryOpen: false, libraryWidth: 333 }),
  );
  const { result } = renderHook(() => useWorkspaceLayout(scope));
  expect(result.current.layout.libraryWidth).toBe(252);
  expect(result.current.layout.libraryOpen).toBe(false);
  act(() => result.current.setLayout((previous) => ({ ...previous, libraryOpen: true })));
  expect(result.current.layout.libraryOpen).toBe(true);
  expect(result.current.layout.libraryWidth).toBe(252);
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  expect(result.current.layout.libraryOpen).toBe(true);
});

it("keeps rapid actions including a return to the initial value", async () => {
  const scope = "synthetic-layout-rapid";
  localStorage.setItem(
    `parallax.workspace.v1:${scope}`,
    JSON.stringify({
      ...workspacePreset("CONSTRUCTION"),
      libraryWidth: 333,
      inspectorWidth: 350,
    }),
  );
  const { result } = renderHook(() => useWorkspaceLayout(scope));
  expect(result.current.layout.libraryWidth).toBe(252);
  act(() => {
    result.current.setLayout((previous) => ({ ...previous, libraryOpen: true }));
    result.current.setLayout((previous) => ({ ...previous, libraryOpen: false, assistantDocked: true }));
  });
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  expect(result.current.layout.libraryOpen).toBe(false);
  expect(result.current.layout.assistantDocked).toBe(true);
  expect(result.current.layout.inspectorWidth).toBe(350);
});

it("restores untouched account preferences", async () => {
  const scope = "synthetic-layout-untouched";
  const saved = { ...workspacePreset("CONSTRUCTION"), libraryWidth: 333, assistantDocked: true };
  localStorage.setItem(`parallax.workspace.v1:${scope}`, JSON.stringify(saved));
  const { result } = renderHook(() => useWorkspaceLayout(scope));
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  expect(result.current.layout).toEqual(saved);
});

it("cancels the previous account hydration and keeps only the new account's early action", async () => {
  const first = "synthetic-layout-first";
  const second = "synthetic-layout-second";
  localStorage.setItem(
    `parallax.workspace.v1:${first}`,
    JSON.stringify({
      ...workspacePreset("SPATIAL"),
      libraryWidth: 333,
    }),
  );
  localStorage.setItem(
    `parallax.workspace.v1:${second}`,
    JSON.stringify({
      ...workspacePreset("CONSTRUCTION"),
      libraryWidth: 377,
      assistantDocked: false,
    }),
  );
  const { result, rerender } = renderHook(({ scope }) => useWorkspaceLayout(scope), { initialProps: { scope: first } });
  act(() => result.current.setLayout((previous) => ({ ...previous, libraryOpen: true, assistantDocked: true })));
  rerender({ scope: second });
  act(() => result.current.setLayout((previous) => ({ ...previous, libraryOpen: false })));
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(377));
  expect(result.current.layout.libraryOpen).toBe(false);
  expect(result.current.layout.assistantDocked).toBe(false);
  expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${first}`)!).libraryWidth).toBe(333);
});

it("retains automatic narrow-screen collapse when there is no early action", async () => {
  vi.stubGlobal("innerWidth", 390);
  const scope = "synthetic-layout-narrow";
  localStorage.setItem(
    `parallax.workspace.v1:${scope}`,
    JSON.stringify({
      ...workspacePreset("CONSTRUCTION"),
      libraryWidth: 333,
      bottomOpen: true,
    }),
  );
  const { result } = renderHook(() => useWorkspaceLayout(scope));
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  expect(result.current.layout.libraryOpen).toBe(false);
  expect(result.current.layout.inspectorOpen).toBe(false);
  expect(result.current.layout.bottomOpen).toBe(false);
});

it("restores a hydrated account when returning from another account's pending load", async () => {
  const first = "synthetic-layout-return-first";
  const second = "synthetic-layout-return-second";
  localStorage.setItem(
    `parallax.workspace.v1:${first}`,
    JSON.stringify({
      ...workspacePreset("SPATIAL"),
      libraryWidth: 333,
      libraryOpen: false,
    }),
  );
  localStorage.setItem(
    `parallax.workspace.v1:${second}`,
    JSON.stringify({
      ...workspacePreset("SPATIAL"),
      libraryWidth: 389,
      libraryOpen: false,
    }),
  );
  const { result, rerender } = renderHook(({ scope }) => useWorkspaceLayout(scope), { initialProps: { scope: first } });
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  rerender({ scope: second });
  expect(result.current.layout.libraryWidth).toBe(333);
  act(() => result.current.setLayout((previous) => ({ ...previous, libraryOpen: true, libraryWidth: 377 })));
  expect(result.current.layout.libraryWidth).toBe(377);
  rerender({ scope: first });
  expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${first}`)!).libraryOpen).toBe(false);
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  expect(result.current.layout.libraryOpen).toBe(false);
  expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${second}`)!).libraryWidth).toBe(389);
});

it("honors an early explicit reset including removal of the saved floating window", async () => {
  const scope = "synthetic-layout-reset";
  localStorage.setItem(
    `parallax.workspace.v1:${scope}`,
    JSON.stringify({
      ...workspacePreset("CONSTRUCTION"),
      libraryWidth: 333,
      assistantWindow: { x: 10, y: 20, width: 430, height: 600 },
    }),
  );
  const { result } = renderHook(() => useWorkspaceLayout(scope));
  act(() => result.current.reset());
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${scope}`)!).libraryWidth).toBe(252),
  );
  expect(result.current.layout).toEqual(workspacePreset("SPATIAL"));
  expect(result.current.layout.assistantWindow).toBeUndefined();
});

it("preserves early intent through Strict Mode effect cleanup and replay", async () => {
  const scope = "synthetic-layout-strict";
  localStorage.setItem(
    `parallax.workspace.v1:${scope}`,
    JSON.stringify({
      ...workspacePreset("SPATIAL"),
      libraryWidth: 333,
    }),
  );
  const { result } = renderHook(() => useWorkspaceLayout(scope), { wrapper: StrictMode });
  expect(result.current.layout.libraryWidth).toBe(252);
  act(() => result.current.setLayout((previous) => ({ ...previous, libraryOpen: true })));
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  expect(result.current.layout.libraryOpen).toBe(true);
});

it("does not restart a bootstrap consumer when its account scope is learned", async () => {
  const first = "synthetic-bootstrap-first";
  const second = "synthetic-bootstrap-second";
  const bootstrap = vi.fn();
  for (const [scope, libraryWidth] of [
    [first, 333],
    [second, 389],
  ] as const)
    localStorage.setItem(
      `parallax.workspace.v1:${scope}`,
      JSON.stringify({ ...workspacePreset("SPATIAL"), libraryWidth, libraryOpen: false }),
    );
  const { result, rerender } = renderHook(
    ({ scope }) => {
      const workspace = useWorkspaceLayout(scope);
      useEffect(() => {
        bootstrap();
      }, [workspace.setLayout]);
      return workspace;
    },
    { initialProps: { scope: undefined as string | undefined } },
  );
  const retainedSetter = result.current.setLayout;
  expect(bootstrap).toHaveBeenCalledTimes(1);
  rerender({ scope: first });
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  expect(bootstrap).toHaveBeenCalledTimes(1);

  rerender({ scope: second });
  act(() => retainedSetter((previous) => ({ ...previous, libraryOpen: true })));
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(389));
  expect(result.current.layout.libraryOpen).toBe(true);
  expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${first}`)!).libraryOpen).toBe(false);
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${second}`)!).libraryOpen).toBe(true),
  );

  rerender({ scope: first });
  act(() => retainedSetter((previous) => ({ ...previous, assistantDocked: true })));
  await waitFor(() => expect(result.current.layout.libraryWidth).toBe(333));
  expect(result.current.layout.libraryOpen).toBe(false);
  expect(result.current.layout.assistantDocked).toBe(true);
  expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${second}`)!).libraryWidth).toBe(389);
  expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${second}`)!).libraryOpen).toBe(true);
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem(`parallax.workspace.v1:${first}`)!).assistantDocked).toBe(true),
  );
  expect(bootstrap).toHaveBeenCalledTimes(1);
});
