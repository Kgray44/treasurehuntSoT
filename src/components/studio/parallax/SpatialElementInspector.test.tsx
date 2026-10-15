import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createSpatialDraft } from "@/parallax/authoring";
import { effectPresets } from "@/parallax/element-authoring";
import { spatialElementSchema } from "@/parallax/element-contracts";
import { SpatialElementInspector } from "./SpatialElementInspector";

afterEach(cleanup);

it("presents light controls at three depths without changing typed scene data on mode switches", () => {
  const entity = {
    ...createSpatialDraft("inspector-light").content.entities[0],
    element: spatialElementSchema.parse(effectPresets[0].element),
  };
  const onChange = vi.fn();
  const mounted = render(<SpatialElementInspector entity={entity} mode="GUIDED" onChange={onChange} />);
  expect(screen.getByRole("slider", { name: "Light intensity" })).toBeVisible();
  expect(screen.getByRole("spinbutton", { name: "Light range in meters" })).toBeVisible();
  expect(screen.queryByRole("spinbutton", { name: "Light falloff" })).toBeNull();
  expect(screen.queryByRole("spinbutton", { name: "Light pulse frequency" })).toBeNull();

  mounted.rerender(<SpatialElementInspector entity={entity} mode="DETAILED" onChange={onChange} />);
  expect(screen.getByRole("spinbutton", { name: "Light falloff" })).toBeVisible();
  expect(screen.getByRole("spinbutton", { name: "Light pulse frequency" })).toBeVisible();
  expect(screen.queryByText(/Aims along local/)).toBeNull();

  mounted.rerender(<SpatialElementInspector entity={entity} mode="ENGINEERING" onChange={onChange} />);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("spinbutton", { name: "Light intensity numeric value" }), {
    target: { value: "35" },
  });
  fireEvent.blur(screen.getByRole("spinbutton", { name: "Light intensity numeric value" }));
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.calls[0][0]).toMatchObject({ kind: "LIGHT", intensity: 35, range: 6, decay: 2 });
});

it("commits a valid whole particle count and keeps its numeric display consistent", () => {
  const particles = effectPresets.find((preset) => preset.element.kind === "PARTICLES")!;
  const entity = {
    ...createSpatialDraft("inspector-particles").content.entities[0],
    element: spatialElementSchema.parse(particles.element),
  };
  const onChange = vi.fn();
  render(<SpatialElementInspector entity={entity} mode="GUIDED" onChange={onChange} />);
  const input = screen.getByRole("spinbutton", { name: "Particle count numeric value" });
  fireEvent.change(input, { target: { value: "10.5" } });
  fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.calls[0][0]).toMatchObject({ kind: "PARTICLES", count: 11 });
  expect(input).toHaveValue(11);
  expect(screen.getByRole("slider", { name: "Particle count" })).toHaveValue("11");
});
