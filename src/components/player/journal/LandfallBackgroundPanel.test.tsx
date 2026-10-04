import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandfallBackgroundPanel } from "./LandfallBackgroundPanel";
let operations: string[];
const fetcher = vi.fn();
const registration = {
  available: true,
  returnHandle: "SYNTHETIC_LAB_HANDLE_ONLY_0000000001",
  latitude: 44,
  longitude: -72,
  radiusMeters: 150,
  expiresAt: Date.now() + 60000,
};
beforeEach(() => {
  operations = [];
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
  fetcher.mockResolvedValue({ ok: true, json: async () => registration });
  window.LandfallNative = {
    version: 1,
    platform: "ANDROID",
    request: vi.fn(async (raw) => {
      const value = JSON.parse(raw);
      operations.push(value.operation);
      return value.operation === "GEOFENCE_CLEAR" ? { accepted: true } : { state: "GRANTED" };
    }),
  };
});
afterEach(() => {
  cleanup();
  delete window.LandfallNative;
  vi.unstubAllGlobals();
});
describe("deliberate optional background reminders", () => {
  it("has no mount-time permission or network work and registers only after deliberate grants", async () => {
    render(<LandfallBackgroundPanel sessionId="synthetic-session" csrfToken="synthetic-csrf" />);
    expect(operations).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enable reminders" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Broad reminder enabled"));
    expect(operations).toEqual([
      "LOCATION_PERMISSION",
      "BACKGROUND_PERMISSION",
      "NOTIFICATION_PERMISSION",
      "GEOFENCE_CLEAR",
      "GEOFENCE_REGISTER",
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("drops an access response after backgrounding and does not auto-register on return", async () => {
    let resolve!: (value: unknown) => void;
    fetcher.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<LandfallBackgroundPanel sessionId="synthetic-session" csrfToken="synthetic-csrf" />);
    fireEvent.click(screen.getByRole("button", { name: "Enable reminders" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    act(() =>
      window.dispatchEvent(
        new CustomEvent("landfall-native-event", { detail: { type: "lifecycle", state: "BACKGROUND" } }),
      ),
    );
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => resolve({ ok: true, json: async () => registration }));
    act(() =>
      window.dispatchEvent(
        new CustomEvent("landfall-native-event", { detail: { type: "lifecycle", state: "FOREGROUND" } }),
      ),
    );
    expect(operations).not.toContain("GEOFENCE_REGISTER");
    expect(screen.getByRole("status")).toHaveTextContent("Nothing starts automatically");
  });
  it("cancels an in-flight native registration on Disable and ignores its late success", async () => {
    let resolve!: (value: unknown) => void;
    window.LandfallNative!.request = vi.fn(async (raw) => {
      const value = JSON.parse(raw);
      operations.push(value.operation);
      if (value.operation === "GEOFENCE_REGISTER")
        return new Promise((done) => {
          resolve = done;
        });
      return value.operation === "GEOFENCE_CLEAR" ? { accepted: true } : { state: "GRANTED" };
    });
    render(<LandfallBackgroundPanel sessionId="synthetic-session" csrfToken="synthetic-csrf" />);
    fireEvent.click(screen.getByRole("button", { name: "Enable reminders" }));
    await waitFor(() => expect(operations).toContain("GEOFENCE_REGISTER"));
    fireEvent.click(screen.getByRole("button", { name: "Disable reminders" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("pending hints are cleared"));
    await act(async () => resolve({ state: "GRANTED" }));
    expect(screen.getByRole("status")).toHaveTextContent("pending hints are cleared");
    expect(operations.filter((value) => value === "GEOFENCE_CLEAR")).toHaveLength(2);
  });
  it("does not claim cleanup when the OS removal fails", async () => {
    window.LandfallNative!.request = vi.fn(async () => ({ accepted: false }));
    render(<LandfallBackgroundPanel sessionId="synthetic-session" csrfToken="synthetic-csrf" />);
    fireEvent.click(screen.getByRole("button", { name: "Disable reminders" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Open system app settings"));
    expect(screen.getByRole("status")).not.toHaveTextContent("pending hints are cleared");
  });
});
