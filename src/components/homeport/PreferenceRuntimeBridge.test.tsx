import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  currentUser: {
    status: "authenticated",
    authenticated: true,
    user: { accountId: "account-1", displayName: "Synthetic Owner", initials: "SO" },
  },
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
}));

import { PreferenceRuntimeBridge } from "./PreferenceRuntimeBridge";

const nextPreferences = {
  experience: { motion: "REDUCED", textScale: 1.25, theme: "DARK", contrast: "HIGH" },
} as const;

describe("Project Homeport preference reconciliation", () => {
  let messageListener: ((event: MessageEvent) => void) | undefined;
  const close = vi.fn();

  beforeEach(() => {
    mocks.apply.mockReset();
    close.mockReset();
    localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
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
});
