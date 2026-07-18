"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CapturePlatformAdapter } from "@/vision/capture-adapters";
import type { AuthoringMutate, StudioAuthoringAggregate } from "@/components/studio/vision-authoring-types";

type Point = { x: number; y: number };
type Geometry =
  | { tool: "RECTANGLE"; x: number; y: number; width: number; height: number }
  | { tool: "POLYGON"; points: Point[] }
  | { tool: "BRUSH"; strokes: Point[][]; radius: number };

const initialGeometry: Geometry = { tool: "RECTANGLE", x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function point(event: ReactPointerEvent<SVGSVGElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height),
  };
}

function Shape({ geometry, opacity = 0.5 }: { geometry: Record<string, unknown> | Geometry; opacity?: number }) {
  if (geometry.tool === "RECTANGLE")
    return (
      <rect
        x={`${Number(geometry.x) * 100}%`}
        y={`${Number(geometry.y) * 100}%`}
        width={`${Number(geometry.width) * 100}%`}
        height={`${Number(geometry.height) * 100}%`}
        fill={`rgba(231,199,126,${opacity})`}
        stroke="#fff2bd"
        strokeWidth="2"
      />
    );
  if (geometry.tool === "POLYGON" && Array.isArray(geometry.points))
    return (
      <polygon
        points={(geometry.points as Point[]).map((item) => `${item.x * 1000},${item.y * 600}`).join(" ")}
        fill={`rgba(67,190,181,${opacity})`}
        stroke="#d6fffa"
        strokeWidth="2"
      />
    );
  if (geometry.tool === "BRUSH" && Array.isArray(geometry.strokes))
    return (
      <>
        {(geometry.strokes as Point[][]).map((stroke, index) => (
          <polyline
            key={index}
            points={stroke.map((item) => `${item.x * 1000},${item.y * 600}`).join(" ")}
            fill="none"
            stroke={`rgba(231,199,126,${Math.max(0.25, opacity)})`}
            strokeWidth={Math.max(2, Number(geometry.radius) * 600)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </>
    );
  return null;
}

export function VisionRegionEditor({
  aggregate,
  adapter,
  mutate,
}: {
  aggregate: StudioAuthoringAggregate;
  adapter: CapturePlatformAdapter;
  mutate: AuthoringMutate;
}) {
  const assets = useMemo(
    () => aggregate.assets.filter((asset) => !asset.deletedAt && asset.isUsable),
    [aggregate.assets],
  );
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [regionType, setRegionType] = useState("TARGET");
  const [label, setLabel] = useState("Stable target detail");
  const [geometry, setGeometry] = useState<Geometry>(initialGeometry);
  const [undo, setUndo] = useState<Geometry[]>([]);
  const [redo, setRedo] = useState<Geometry[]>([]);
  const [opacity, setOpacity] = useState(0.55);
  const [visible, setVisible] = useState(true);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [coordinateText, setCoordinateText] = useState(JSON.stringify(initialGeometry, null, 2));
  const startPoint = useRef<Point | null>(null);
  const drawing = useRef(false);
  const regions = aggregate.visualRegions.filter((region) => region.recordingAssetId === assetId);

  function commit(next: Geometry) {
    setUndo((items) => [...items.slice(-49), geometry]);
    setRedo([]);
    setGeometry(next);
    setCoordinateText(JSON.stringify(next, null, 2));
  }

  function chooseTool(tool: Geometry["tool"]) {
    if (tool === "RECTANGLE") commit(initialGeometry);
    if (tool === "POLYGON") commit({ tool: "POLYGON", points: [] });
    if (tool === "BRUSH") commit({ tool: "BRUSH", strokes: [], radius: 0.02 });
  }

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const next = point(event);
    drawing.current = true;
    if (geometry.tool === "RECTANGLE") startPoint.current = next;
    if (geometry.tool === "POLYGON") commit({ ...geometry, points: [...geometry.points, next] });
    if (geometry.tool === "BRUSH") commit({ ...geometry, strokes: [...geometry.strokes, [next]] });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drawing.current || geometry.tool !== "BRUSH") return;
    const strokes = geometry.strokes.map((stroke, index) =>
      index === geometry.strokes.length - 1 ? [...stroke, point(event)] : stroke,
    );
    setGeometry({ ...geometry, strokes });
    setCoordinateText(JSON.stringify({ ...geometry, strokes }, null, 2));
  }

  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    drawing.current = false;
    if (geometry.tool === "RECTANGLE" && startPoint.current) {
      const end = point(event);
      const start = startPoint.current;
      startPoint.current = null;
      commit({
        tool: "RECTANGLE",
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.max(0.005, Math.abs(end.x - start.x)),
        height: Math.max(0.005, Math.abs(end.y - start.y)),
      });
    }
  }

  function applyCoordinates() {
    try {
      const parsed = JSON.parse(coordinateText) as Geometry;
      if (!parsed || !["RECTANGLE", "POLYGON", "BRUSH"].includes(parsed.tool)) throw new Error();
      commit(parsed);
    } catch {
      setCoordinateText(JSON.stringify(geometry, null, 2));
    }
  }

  function selectRegion(id: string) {
    const region = regions.find((item) => item.id === id);
    if (!region) return;
    setSelectedRegionId(id);
    setRegionType(region.regionType);
    setLabel(region.semanticLabel ?? "Region");
    setGeometry(region.geometry as Geometry);
    setCoordinateText(JSON.stringify(region.geometry, null, 2));
  }

  if (!assets.length)
    return (
      <p className="authoring-empty">
        Record and mark at least one usable asset before drawing important visual regions.
      </p>
    );

  return (
    <section className="region-editor" aria-labelledby="visual-region-heading">
      <header>
        <div>
          <p className="eyebrow">Image-space editor</p>
          <h3 id="visual-region-heading">Important visual regions</h3>
        </div>
        <span>Normalized coordinates</span>
      </header>
      <div className="region-frame-toolbar">
        <label>
          <span>Representative recording/frame source</span>
          <select
            value={assetId}
            onChange={(event) => {
              setAssetId(event.target.value);
              setSelectedRegionId(null);
            }}
          >
            {assets.map((asset) => (
              <option value={asset.id} key={asset.id}>
                {asset.label ?? asset.id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void adapter.previewCreatorArtifact(assetId).then((value) => setPreview(value.previewUrl))}
        >
          Open local video preview
        </button>
      </div>
      {preview && <video className="region-video-preview" src={preview} controls muted />}
      <div className="region-toolbox" role="toolbar" aria-label="Region drawing tools">
        {(["BRUSH", "POLYGON", "RECTANGLE"] as const).map((tool) => (
          <button type="button" aria-pressed={geometry.tool === tool} onClick={() => chooseTool(tool)} key={tool}>
            {tool.toLocaleLowerCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            selectedRegionId &&
            void mutate({ operation: "DELETE_VISUAL_REGION", id: selectedRegionId }).then(() =>
              setSelectedRegionId(null),
            )
          }
          disabled={!selectedRegionId}
        >
          Eraser
        </button>
        <button
          type="button"
          onClick={() => {
            const prior = undo.at(-1);
            if (prior) {
              setRedo((items) => [...items, geometry]);
              setUndo((items) => items.slice(0, -1));
              setGeometry(prior);
              setCoordinateText(JSON.stringify(prior, null, 2));
            }
          }}
          disabled={!undo.length}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => {
            const next = redo.at(-1);
            if (next) {
              setUndo((items) => [...items, geometry]);
              setRedo((items) => items.slice(0, -1));
              setGeometry(next);
              setCoordinateText(JSON.stringify(next, null, 2));
            }
          }}
          disabled={!redo.length}
        >
          Redo
        </button>
        <button type="button" onClick={() => commit(initialGeometry)}>
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedRegionId(null);
            commit({ tool: "RECTANGLE", x: 0.2, y: 0.2, width: 0.6, height: 0.6 });
            setLabel("Review this centered layout suggestion");
          }}
        >
          Layout suggestion (not AI)
        </button>
        <button
          type="button"
          onClick={() =>
            selectedRegionId &&
            void mutate({
              operation: "UPSERT_VISUAL_REGION",
              recordingAssetId: assetId,
              regionType,
              semanticLabel: `${label} copy`,
              geometry,
            })
          }
          disabled={!selectedRegionId}
        >
          Copy
        </button>
      </div>
      <div className="region-workspace">
        <svg
          viewBox="0 0 1000 600"
          role="img"
          aria-label="Normalized visual region drawing surface"
          tabIndex={0}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
        >
          <defs>
            <linearGradient id="region-grid" x1="0" x2="1">
              <stop offset="0" stopColor="#123844" />
              <stop offset="1" stopColor="#071b25" />
            </linearGradient>
          </defs>
          <rect width="1000" height="600" fill="url(#region-grid)" />
          <path d="M0 300H1000M500 0V600" stroke="rgba(255,255,255,.12)" strokeDasharray="8 8" />
          {visible &&
            regions.map((region) => (
              <Shape
                key={region.id}
                geometry={region.geometry}
                opacity={region.id === selectedRegionId ? opacity : 0.25}
              />
            ))}
          {visible && <Shape geometry={geometry} opacity={opacity} />}
        </svg>
        <aside>
          <label>
            <span>Region kind</span>
            <select value={regionType} onChange={(event) => setRegionType(event.target.value)}>
              <option value="TARGET">Target</option>
              <option value="STABLE">Stable context</option>
              <option value="IGNORE">Ignore</option>
              <option value="TRANSIENT">Transient</option>
            </select>
          </label>
          <label>
            <span>Plain-language label</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            <span>Overlay opacity</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
            <span>Show overlays</span>
          </label>
          <label>
            <span>Accessible coordinate list</span>
            <textarea
              rows={10}
              value={coordinateText}
              onChange={(event) => setCoordinateText(event.target.value)}
              onBlur={applyCoordinates}
              aria-describedby="coordinate-help"
            />
          </label>
          <small id="coordinate-help">
            Edit normalized values from 0 to 1 without a pointer, then leave the field to apply them.
          </small>
          <button
            type="button"
            className="brass-button"
            onClick={() =>
              void mutate({
                operation: "UPSERT_VISUAL_REGION",
                ...(selectedRegionId ? { id: selectedRegionId } : {}),
                recordingAssetId: assetId,
                regionType,
                semanticLabel: label,
                geometry,
              }).then((saved) => saved && setSelectedRegionId(null))
            }
          >
            {selectedRegionId ? "Update region" : "Save region"}
          </button>
        </aside>
      </div>
      <ul className="region-list" aria-label="Saved visual regions">
        {regions.map((region) => (
          <li key={region.id}>
            <button type="button" onClick={() => selectRegion(region.id)}>
              {region.semanticLabel} · {region.regionType.toLocaleLowerCase()}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
