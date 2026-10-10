import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockCurrentUserState =
  | { status: "authenticated"; authenticated: true; user: { accountId: string; displayName: string; initials: string } }
  | { status: "anonymous"; authenticated: false };

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  currentUser: {
    status: "authenticated",
    authenticated: true,
    user: { accountId: "account-1", displayName: "Synthetic Owner", initials: "SO" },
  } as MockCurrentUserState,
}));

vi.mock("@/components/auth/CurrentUserProvider", () => ({
  useCurrentUser: () => ({ state: mocks.currentUser }),
}));
vi.mock("@/homeport/preference-runtime", () => ({
  accountPreferenceCacheKey: (accountId: string) => `voyagewright-preferences:${accountId}`,
  applyRuntimePreferences: mocks.apply,
  defaultRuntimePreferences: {
    experience: { motion: "SYSTEM", textScale: 1, theme: "SYSTEM", contrast: "SYSTEM" },
  },
  preferenceRuntimeChannel: "voyagewright-preferences",
  preferenceRuntimeUpdatedEvent: "voyagewright-preferences-updated",
}));

import { PreferenceRuntimeBridge } from "./PreferenceRuntimeBridge";

const nextPreferences = {
  experience: { motion: "REDUCED", textScale: 1.25, theme: "DARK", contrast: "HIGH" },
} as const;

describe("Project Homeport preference reconciliation", () => {
  let messageListener: ((event: MessageEvent) => void) | undefined;
  let systemPreferenceListener: ((event: Event) => void) | undefined;
  const close = vi.fn();

  beforeEach(() => {
    mocks.apply.mockReset();
    mocks.currentUser = {
      status: "authenticated",
      authenticated: true,
      user: { accountId: "account-1", displayName: "Synthetic Owner", initials: "SO" },
    };
    close.mockReset();
    systemPreferenceListener = undefined;
    localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: false,
            media: query,
            addEventListener: vi.fn((event: string, listener: (event: Event) => void) => {
              if (event === "change") systemPreferenceListener = listener;
            }),
            removeEventListener: vi.fn(),
          }) as unknown as MediaQueryList,
      ),
    );
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        addEventListener(_: string, listener: (event: MessageEvent) => void) {
          messageListener = listener;
        }
        close() {
          close();
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            preferences: {
              experience: { motion: "SYSTEM", textScale: 1, theme: "LIGHT", contrast: "STANDARD" },
            },
          }),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("homeport.owner-correction.round1.preference-multi-tab applies account-scoped BroadcastChannel and storage updates", async () => {
    const view = render(<PreferenceRuntimeBridge />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/passport/preferences", expect.any(Object)));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    mocks.apply.mockClear();

    messageListener?.(
      new MessageEvent("message", {
        data: { type: "preferences-updated", accountId: "account-1", preferences: nextPreferences },
      }),
    );
    expect(mocks.apply).toHaveBeenCalledWith(nextPreferences);

    mocks.apply.mockClear();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "voyagewright-preferences:account-1",
        newValue: JSON.stringify(nextPreferences),
      }),
    );
    expect(mocks.apply).toHaveBeenCalledWith(nextPreferences);

    mocks.apply.mockClear();
    messageListener?.(
      new MessageEvent("message", {
        data: { type: "preferences-updated", accountId: "account-2", preferences: nextPreferences },
      }),
    );
    expect(mocks.apply).not.toHaveBeenCalled();

    view.unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it("preserves a Player route's local motion choice when no account preference authority exists", () => {
    mocks.currentUser = { status: "anonymous", authenticated: false };
    render(<PreferenceRuntimeBridge />);

    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.apply).toHaveBeenCalledWith(
      {
        experience: { motion: "SYSTEM", textScale: 1, theme: "SYSTEM", contrast: "SYSTEM" },
      },
      { preserveStoredMotion: true },
    );
  });

  it("preserves a local motion choice when an authenticated account delegates motion to SYSTEM", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          preferences: { experience: { motion: "SYSTEM", textScale: 1, theme: "LIGHT", contrast: "STANDARD" } },
        }),
        { status: 200 },
      ),
    );
    render(<PreferenceRuntimeBridge />);
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith(
        { experience: { motion: "SYSTEM", textScale: 1, theme: "LIGHT", contrast: "STANDARD" } },
        { preserveStoredMotion: true },
      ),
    );
  });

  it("keeps a same-tab saved motion choice through later system-preference revalidation", async () => {
    render(<PreferenceRuntimeBridge />);
    await waitFor(() => expect(mocks.apply).toHaveBeenCalled());
    mocks.apply.mockClear();

    window.dispatchEvent(
      new CustomEvent("voyagewright-preferences-updated", {
        detail: { accountId: "account-1", preferences: nextPreferences },
      }),
    );
    systemPreferenceListener?.(new Event("change"));

    expect(mocks.apply).toHaveBeenCalledWith(nextPreferences);
  });

  it.each(["local", "storage", "channel"])(
    "keeps a newer %s save when an older hydration read completes",
    async (source) => {
      let completeRead!: (response: Response) => void;
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              completeRead = resolve;
            }),
        ),
      );
      render(<PreferenceRuntimeBridge />);
      if (source === "local") {
        localStorage.setItem("voyagewright-preferences:account-1", JSON.stringify(nextPreferences));
        window.dispatchEvent(
          new CustomEvent("voyagewright-preferences-updated", {
            detail: { accountId: "account-1", preferences: nextPreferences },
          }),
        );
      } else if (source === "storage") {
        localStorage.setItem("voyagewright-preferences:account-1", JSON.stringify(nextPreferences));
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "voyagewright-preferences:account-1",
            newValue: JSON.stringify(nextPreferences),
          }),
        );
      } else {
        messageListener?.(
          new MessageEvent("message", {
            data: { type: "preferences-updated", accountId: "account-1", preferences: nextPreferences },
          }),
        );
      }
      completeRead(
        new Response(
          JSON.stringify({
            preferences: {
              experience: { motion: "SYSTEM", textScale: 1, theme: "LIGHT", contrast: "STANDARD" },
            },
          }),
          { status: 200 },
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      systemPreferenceListener?.(new Event("change"));
      expect(mocks.apply).toHaveBeenLastCalledWith(nextPreferences);
      expect(mocks.apply.mock.calls.some(([preferences]) => preferences.experience.theme === "LIGHT")).toBe(false);
      if (source !== "channel")
        expect(JSON.parse(localStorage.getItem("voyagewright-preferences:account-1")!)).toEqual(nextPreferences);
    },
  );

  it("ignores an older refresh and a response after account cleanup", async () => {
    const pending: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve))),
    );
    const view = render(<PreferenceRuntimeBridge />);
    window.dispatchEvent(new Event("focus"));
    pending[1](new Response(JSON.stringify({ preferences: nextPreferences }), { status: 200 }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledWith(nextPreferences));
    mocks.apply.mockClear();
    pending[0](
      new Response(
        JSON.stringify({
          preferences: {
            experience: { motion: "SYSTEM", textScale: 1, theme: "LIGHT", contrast: "STANDARD" },
          },
        }),
        { status: 200 },
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.apply).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("focus"));
    view.unmount();
    pending[2](new Response(JSON.stringify({ preferences: nextPreferences }), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});
