"use client";
import { useEffect, useRef, useState } from "react";
import { DOMPaintResources } from "@/animation/embarkation/dom-paint";
import { LivePaintBinding } from "@/animation/embarkation/live-paint-binding";
import { PaintSurface } from "@/animation/embarkation/paint-surface";
import { PaintMesh } from "@/animation/embarkation/paint-mesh";
import { scalePaintInsets } from "@/animation/embarkation/paint-raster";
import { ConstrainedSheet } from "@/animation/embarkation/cloth";
import { cssToWorld, REST_CAMERA, WORLD_HEIGHT } from "@/animation/embarkation/projection";

export function MaterialDiagnostic() {
  const source = useRef<HTMLDivElement>(null),
    parent = useRef<HTMLDivElement>(null),
    child = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    displaced = useRef(false),
    flex = useRef(false);
  const [revision, setRevision] = useState(0),
    [wide, setWide] = useState(false),
    [stats, setStats] = useState("Preparing live paint");
  useEffect(() => {
    const abort = new AbortController(),
      c = canvas.current!,
      gl = c.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true })!;
    const resources = new DOMPaintResources(abort.signal),
      nodes = [parent.current!, child.current!];
    const independent = new Set<Element>([nodes[1]]),
      overrides = new Map<Element, Record<string, string>>();
    nodes.forEach((node) =>
      overrides.set(node, {
        transform: "none",
        opacity: "1",
        visibility: "visible",
        filter: getComputedStyle(node).filter,
      }),
    );
    const bindings = nodes.map(
      (node) =>
        new LivePaintBinding(node, resources, {
          rect: () => node.getBoundingClientRect(),
          independent: () => independent,
          overrides: () => overrides,
          pixelRatio: () => devicePixelRatio,
          padding: 24,
        }),
    );
    const surfaces = nodes.map(() => new PaintSurface(gl));
    const uv = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
    surfaces.forEach((surface) => surface.topology(uv, indices));
    let geometry: { key: string; mesh: PaintMesh; sheet: ConstrainedSheet } | null = null;
    let raf = 0,
      lastReport = 0;
    const frame = (time: number) => {
      const width = 500,
        height = 400,
        dpr = devicePixelRatio;
      if (c.width !== Math.round(width * dpr) || c.height !== Math.round(height * dpr)) {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      gl.viewport(0, 0, c.width, c.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      const origin = source.current!.getBoundingClientRect();
      bindings.forEach((binding, i) => {
        const paint = binding.paint.current;
        if (!paint) return;
        const rect = nodes[i].getBoundingClientRect(),
          scale = WORLD_HEIGHT / height;
        const left = -(paint.width / 2 + paint.insets.left) * scale,
          right = (paint.width / 2 + paint.insets.right) * scale,
          bottom = -(paint.height / 2 + paint.insets.bottom) * scale,
          top = (paint.height / 2 + paint.insets.top) * scale;
        let points: Float32Array = new Float32Array([left, bottom, 0, right, bottom, 0, left, top, 0, right, top, 0]);
        if (i === 0) {
          const key = [paint.width, paint.height, scale, JSON.stringify(paint.insets)].join(":");
          if (!geometry || geometry.key !== key) {
            const sheet = new ConstrainedSheet(paint.width * scale, paint.height * scale, "paper", "edge", () => ({
              air: [300, 100, -7200],
              holds: [1, 1, 1, 1],
            }));
            sheet.at(0.75);
            geometry = {
              key,
              sheet,
              mesh: new PaintMesh(sheet, paint.padding * scale, scalePaintInsets(paint.insets, scale)),
            };
            surfaces[i].topology(geometry.mesh.uv, geometry.mesh.indices);
          }
          points = geometry.mesh.update(geometry.sheet.at(flex.current ? 0.65 : 0));
        }
        const position = cssToWorld(
          rect.left - origin.left + rect.width / 2,
          rect.top - origin.top + rect.height / 2,
          0,
          { width, height },
        );
        if (i === 1 && displaced.current) {
          position[0] -= 120;
          position[2] = 420;
        }
        surfaces[i].updatePaint(paint);
        surfaces[i].draw(points, position, [0, 0, 0, 1], REST_CAMERA, width, height);
      });
      if (time - lastReport > 200) {
        setStats(
          JSON.stringify({
            dpr,
            paints: bindings.map((b, i) => ({
              revision: b.paint.revision,
              painted: b.paint.paintedRevision,
              captures: b.paint.captures,
              discarded: b.paint.discarded,
              uploads: surfaces[i].uploads,
              ready: b.paint.ready,
              error: b.paint.failure ? String(b.paint.failure) : null,
            })),
            gpuError: gl.getError(),
            constrainedStrain: geometry?.sheet.strain(geometry.sheet.at(flex.current ? 0.65 : 0)),
          }),
        );
        lastReport = time;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      abort.abort();
      cancelAnimationFrame(raf);
      bindings.forEach((b) => b.dispose());
      surfaces.forEach((s) => s.dispose());
    };
  }, []);
  return (
    <section style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={() => setRevision((v) => v + 1)}>Update live crew and readiness</button>
        <button onClick={() => setWide((v) => !v)}>Resize canonical surface</button>
        <button
          onClick={() => {
            flex.current = !flex.current;
          }}
        >
          Flex constrained paper
        </button>
        <button
          onClick={() => {
            displaced.current = !displaced.current;
          }}
        >
          Move independent child
        </button>
      </div>
      <p>Canonical DOM (left) and current GPU paint (right). The readiness subpart has a separate visual owner.</p>
      <div style={{ display: "flex", gap: 20, alignItems: "start" }}>
        <div ref={source} style={{ position: "relative", width: 500, height: 400, flexShrink: 0, padding: 24 }}>
          <div
            ref={parent}
            style={{
              width: wide ? 440 : 380,
              minHeight: 280,
              padding: 24,
              border: "2px solid #b58c4d",
              borderRadius: 18,
              background: "linear-gradient(120deg,#f1dfaf,#cbac70)",
              boxShadow: "0 8px 12px #0007",
              color: "#35251b",
              fontSize: 17,
            }}
          >
            <h2 style={{ marginTop: 0 }}>The Forever Treasure</h2>
            <p>Live crew revision {revision}. Typography belongs to this canonical surface.</p>
            <div
              ref={child}
              style={{
                background: "#153f46",
                color: "#f7e5ad",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #f7e5ad",
              }}
            >
              Crew readiness: {revision % 2 ? "Preparing" : "All ready"}
            </div>
            <p>A new horizon awaits.</p>
          </div>
        </div>
        <canvas ref={canvas} aria-label="GPU live paint output" style={{ width: 500, height: 400, flexShrink: 0 }} />
      </div>
      <output style={{ display: "block", fontSize: 12, overflowWrap: "anywhere" }}>{stats}</output>
      <p>
        Negative capability result: same-document SVG and canvas fragments are tainted displacement inputs under Filter
        Effects §15.2. They cannot replace image transport for feDisplacementMap.
      </p>
    </section>
  );
}
