import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { LandfallOnlinePlacePanel } from "./LandfallOnlinePlacePanel";
const fetcher = vi.fn();
const world = structuredClone(landfallFixture.worldspaces[0]);
world.privacyPolicy.classification = "PUBLIC_REAL_WORLD";
const service = {
  id: "configured-geocoder",
  family: "GEOCODING",
  state: "CONFIGURED",
  recipient: "geo.example.test",
  attributionLabel: "Synthetic geography",
  attributionUrl: "https://geo.example.test/license",
  license: "Synthetic license",
  cacheRights: "PROHIBITED",
  offlineRights: "PROHIBITED",
  authoringRights: "ALLOWED",
};
const place = {
  id: "synthetic-square",
  label: "Synthetic Square",
  point: { latitude: 40, longitude: -75 },
  source: "EXTERNAL",
  authoritative: false,
  accuracy: "UNKNOWN",
};
const selected = vi.fn();
const props = {
  taleId: "synthetic-tale",
  sourceVersion: 4,
  csrfToken: "synthetic-csrf",
  worldspace: world,
  unsaved: false,
  onSelectPlace: selected,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetcher);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fetcher.mockImplementation(async (_url, init) => ({
    ok: true,
    json: async () =>
      JSON.parse(init.body).operation === "STATUS"
        ? { state: "STATUS", services: [service] }
        : { state: "RESULT", service, places: [place], canComplete: false },
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Creator online coordinate suggestion", () => {
  it("keeps suggestions unavailable for authoring without explicit coordinate reuse rights", async () => {
    const prohibited = { ...service, authoringRights: "PROHIBITED" };
    fetcher.mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () =>
        JSON.parse(init.body).operation === "STATUS"
          ? { state: "STATUS", services: [prohibited] }
          : { state: "RESULT", service: prohibited, places: [place], canComplete: false },
    }));
    render(<LandfallOnlinePlacePanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Check online data options" }));
    await screen.findByRole("checkbox");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Synthetic Square" } });
    fireEvent.click(screen.getByRole("button", { name: "Search online places" }));
    expect(await screen.findByRole("button", { name: "Synthetic Square" })).toBeDisabled();
    expect(selected).not.toHaveBeenCalled();
  });
  it("requires a saved public physical draft and does not fetch at mount", () => {
    const view = render(<LandfallOnlinePlacePanel {...props} />);
    expect(fetcher).not.toHaveBeenCalled();
    view.rerender(<LandfallOnlinePlacePanel {...props} unsaved />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Save your chart/)).toBeVisible();
    view.rerender(
      <LandfallOnlinePlacePanel
        {...props}
        worldspace={{ ...world, privacyPolicy: { ...world.privacyPolicy, classification: "PRIVATE_REAL_WORLD" } }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("binds saved draft context, offers text search only and selects coordinates without saving", async () => {
    render(<LandfallOnlinePlacePanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Check online data options" }));
    await screen.findByRole("checkbox");
    expect(fetcher.mock.calls[0][0]).toBe("/api/studio/tales/synthetic-tale/landfall/data");
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({
      "x-landfall-worldspace": "town",
      "x-landfall-draft-version": "4",
    });
    expect(screen.queryByRole("button", { name: "Look up my current location online" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Synthetic Square" } });
    expect(fetcher).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Search online places" }));
    fireEvent.click(await screen.findByRole("button", { name: "Synthetic Square" }));
    expect(selected).toHaveBeenCalledWith(place);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1].headers["x-landfall-recipient"]).toBe("geo.example.test");
  });
});
