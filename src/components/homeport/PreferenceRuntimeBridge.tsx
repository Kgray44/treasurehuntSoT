"use client";

import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import {
  accountPreferenceCacheKey,
  applyRuntimePreferences,
  defaultRuntimePreferences,
  preferenceRuntimeChannel,
  type RuntimePreferences,
} from "@/homeport/preference-runtime";

type PreferencesResponse = { preferences: RuntimePreferences };

function isRuntimePreferences(value: unknown): value is RuntimePreferences {
  if (!value || typeof value !== "object") return false;
  const experience = (value as RuntimePreferences).experience;
  return Boolean(experience && typeof experience.textScale === "number" && typeof experience.motion === "string");
}

export function PreferenceRuntimeBridge() {
  const { state } = useCurrentUser();
  const current = useRef<RuntimePreferences>(defaultRuntimePreferences);

  useEffect(() => {
    if (state.status !== "authenticated") {
      current.current = defaultRuntimePreferences;
      // Player-only routes do not have an account preference authority. Reset
      // account-owned presentation defaults without overwriting an explicit
      // local motion choice before the Player journal hydrates.
      applyRuntimePreferences(current.current, { preserveStoredMotion: true });
      return;
    }
    const accountId = state.user.accountId;
    const cacheKey = accountPreferenceCacheKey(accountId);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) ?? "null") as unknown;
      if (isRuntimePreferences(cached)) {
        current.current = cached;
        applyRuntimePreferences(cached);
      }
    } catch {
      try {
        localStorage.removeItem(cacheKey);
      } catch {
        // A blocked cache must not prevent server-backed preference hydration.
      }
    }
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/passport/preferences", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const body = (await response.json()) as PreferencesResponse;
        if (!isRuntimePreferences(body.preferences)) return;
        current.current = body.preferences;
        try {
          localStorage.setItem(cacheKey, JSON.stringify(body.preferences));
        } catch {
          // Apply the authoritative response even when the optional cache is unavailable.
        }
        applyRuntimePreferences(body.preferences);
      } catch {
        // The last validated cached preference remains effective during a transient read failure.
      }
    };
    void refresh();
    const onFocus = () => void refresh();
    const onSystemPreference = () => applyRuntimePreferences(current.current);
    const schemes = [
      window.matchMedia("(prefers-color-scheme: dark)"),
      window.matchMedia("(prefers-contrast: more)"),
      window.matchMedia("(forced-colors: active)"),
    ];
    window.addEventListener("focus", onFocus);
    schemes.forEach((query) => query.addEventListener("change", onSystemPreference));
    const onStorage = (event: StorageEvent) => {
      if (event.key !== cacheKey || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue) as unknown;
        if (isRuntimePreferences(next)) {
          current.current = next;
          applyRuntimePreferences(next);
        }
      } catch {
        // Ignore another tab's malformed write and retain the last validated value.
      }
    };
    window.addEventListener("storage", onStorage);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(preferenceRuntimeChannel);
    channel?.addEventListener("message", (event) => {
      if (event.data?.type !== "preferences-updated" || event.data?.accountId !== accountId) return;
      if (isRuntimePreferences(event.data.preferences)) {
        current.current = event.data.preferences;
        applyRuntimePreferences(event.data.preferences);
      }
    });
    return () => {
      controller.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      schemes.forEach((query) => query.removeEventListener("change", onSystemPreference));
      channel?.close();
    };
  }, [state]);

  return null;
}
