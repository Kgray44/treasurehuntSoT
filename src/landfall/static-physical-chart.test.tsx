import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StaticPhysicalChart } from "@/landfall/static-physical-chart";
import { landfallFixture } from "@/landfall/fixtures";
import { projectLandfallMap } from "@/landfall/map-projection";

afterEach(cleanup);
const scene = () =>
  projectLandfallMap(landfallFixture, {
    activeWorldspaceId: "town",
    availableLocations: [{ id: "town-arrival" }],
    activeRouteId: "town-route",
  });
describe("static released physical chart", () => {
  it("renders selected released geometry while keeping withheld centers and current positions absent", () => {
    const value = scene();
    render(
      <StaticPhysicalChart
        scene={{
          ...value,
          selectedFeatureId: "town-arrival",
          features: [
            ...value.features,
            { id: "withheld", label: "Withheld", kind: "POINT", coordinates: [], hiddenCenter: true },
          ],
        }}
      />,
    );
    const image = screen.getByRole("img", { name: "Released physical chart" });
    expect(image.querySelector('[data-landfall-feature="town-arrival"]')).toHaveAttribute("r", "24");
    expect(image.querySelector('[data-landfall-feature="town-route"]')).not.toBeNull();
    expect(image.querySelector('[data-landfall-feature="withheld"]')).toBeNull();
    expect(image.textContent).not.toContain("Withheld");
    expect(image.querySelectorAll("circle")).toHaveLength(1);
  });
  it("keeps dateline-adjacent points close and renders no invalid SVG coordinates at poles or single points", () => {
    const value = scene();
    const view = render(
      <StaticPhysicalChart
        scene={{
          ...value,
          camera: { ...value.camera, center: [180, 0] },
          features: [
            { id: "a", label: "A", kind: "POINT", coordinates: [[179.999, 0]] },
            { id: "b", label: "B", kind: "POINT", coordinates: [[-179.999, 0.1]] },
          ],
        }}
      />,
    );
    const circles = screen.getByRole("img").querySelectorAll("circle");
    expect(Math.abs(Number(circles[0].getAttribute("cx")) - Number(circles[1].getAttribute("cx")))).toBeLessThan(30);
    view.rerender(
      <StaticPhysicalChart
        scene={{ ...value, features: [{ id: "pole", label: "Pole", kind: "POINT", coordinates: [[0, 90]] }] }}
      />,
    );
    expect(screen.getByRole("img").querySelector("circle")).toHaveAttribute("cx", "500");
    expect(screen.getByRole("img").outerHTML).not.toMatch(/NaN|Infinity/);
  });
});
