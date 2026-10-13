"use client";
import { evaluateSpatialScene, maximumSpatialInputs, type SpatialInput } from "@/parallax/behavior";
import type { SpatialDraft } from "@/parallax/authoring";
import type { RendererReceipt } from "./spatial-workstation";
import styles from "./SpatialStudio.module.css";

type EvidenceProps = {
  draft: SpatialDraft;
  inputs: SpatialInput[];
  timeMs: number;
  rendered: Record<string, RendererReceipt["status"]>;
};
const nameOf = (draft: SpatialDraft, id?: string) => draft.content.entities.find((e) => e.id === id)?.name ?? "Scene";
const actionName = { SHOW: "Show", HIDE: "Hide", HIGHLIGHT: "Highlight" };
export function SimulationEvents({ draft, inputs, timeMs, rendered }: EvidenceProps) {
  const scene = evaluateSpatialScene(draft.content, inputs, timeMs);
  return (
    <div className={styles.simulationEvidence}>
      <h3>Interaction results</h3>
      <ol>
        {inputs.map((input, index) => {
          const matches = scene.events.filter((event) => event.inputIndex === index);
          return (
            <li key={index}>
              <strong>
                {(input.atMs / 1000).toFixed(1)} s · {input.trigger.toLowerCase().replaceAll("_", " ")} ·{" "}
                {nameOf(draft, input.entityId)}
              </strong>
              {matches.length ? (
                <ul>
                  {matches.map((event) => (
                    <li key={event.behaviorId}>
                      {actionName[event.action]} {nameOf(draft, event.entityId)} at {(event.atMs / 1000).toFixed(1)} s ·{" "}
                      {event.status === "WAITING"
                        ? `waiting ${(Math.max(0, event.atMs - timeMs) / 1000).toFixed(1)} s`
                        : event.status === "SUPPRESSED"
                          ? "excluded from Player preview by its layer audience"
                          : `evaluated · renderer: ${rendered[event.entityId]?.replaceAll("_", " ").toLowerCase() ?? "awaiting render"}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No matching behavior. Add a behavior with this trigger and source object in Timeline.</p>
              )}
            </li>
          );
        })}
      </ol>
      <p>These inputs are transient. Saving preserves the authored scene; reload begins a fresh simulation.</p>
    </div>
  );
}
export function SpatialSimulation(
  props: EvidenceProps & {
    selected: string | null;
    playing: boolean;
    preview: string;
    mode: string;
    feedback: string;
    onTrigger: (trigger: "INSPECT" | "PICK" | "PLACE") => void;
    onRun: () => void;
    onReset: () => void;
    onTime: (value: number) => void;
    onSelect: (id: string) => void;
  },
) {
  const { draft, inputs, timeMs, rendered, selected, playing, preview, mode, feedback } = props;
  const entity = draft.content.entities.find((e) => e.id === selected);
  const scene = evaluateSpatialScene(draft.content, inputs, timeMs);
  const pending = scene.events.find((event) => event.status === "WAITING" && event.atMs <= 60000);
  const selectedBehaviors = (draft.content.studio?.behaviors ?? []).filter((b) => b.sourceEntityId === selected);
  return (
    <div className={styles.simulationEvidence}>
      <p>
        <strong>
          {playing ? "Running" : "Paused"} · {(timeMs / 1000).toFixed(1)} seconds
        </strong>{" "}
        · {inputs.length} of {maximumSpatialInputs} inputs
      </p>
      {feedback && <p aria-live="polite">{feedback}</p>}
      <p>
        {preview === "EDITOR"
          ? "Editing view shows the authored pose. Run or trigger simulation to preview Player scene state."
          : "Player preview evaluates the authored timeline and interactions. Chronicle progress is unchanged."}
      </p>
      <div className={styles.inline}>
        <button onClick={props.onRun}>{playing ? "Pause simulation" : "Run simulation"}</button>
        <button onClick={props.onReset}>Reset simulation</button>
        <button disabled={!pending} onClick={() => pending && props.onTime(pending.atMs)}>
          Preview next delayed action
        </button>
      </div>
      <label>
        Simulation time
        <input
          aria-label="Simulation time in milliseconds"
          type="range"
          min="0"
          max="60000"
          step="100"
          value={timeMs}
          onChange={(event) => props.onTime(Number(event.target.value))}
        />
      </label>
      <h3>{entity ? `Interact with ${entity.name}` : "Select an object to simulate an interaction"}</h3>
      <div className={styles.inline}>
        {(["INSPECT", "PICK", "PLACE"] as const).map((trigger) => (
          <button
            key={trigger}
            disabled={!entity?.interactions.includes(trigger) || inputs.length >= maximumSpatialInputs}
            onClick={() => props.onTrigger(trigger)}
          >
            Simulate {trigger.toLowerCase()}
          </button>
        ))}
      </div>
      {entity && (
        <p>
          {selectedBehaviors.length
            ? `${selectedBehaviors.length} authored behavior${selectedBehaviors.length === 1 ? "" : "s"} respond to this object. Delays begin when its matching interaction occurs.`
            : "This object has no interaction behaviors. Its available interactions can be tested, but they will not change another object until you author a behavior in Timeline."}
        </p>
      )}
      <h3>Evaluated objects</h3>
      <ul className={styles.simulationObjects}>
        {draft.content.entities.map((object) => {
          const state = scene.states[object.id],
            status = rendered[object.id];
          return (
            <li key={object.id}>
              <button aria-pressed={selected === object.id} onClick={() => props.onSelect(object.id)}>
                {object.name}
              </button>
              <span>
                {state.visible ? "Shown" : "Hidden"}
                {state.highlighted ? " · highlighted" : ""}
                {state.animated ? " · animated" : ""} · renderer:{" "}
                {status?.replaceAll("_", " ").toLowerCase() ?? "awaiting render"}
              </span>
              {state.visible && status && ["OUTSIDE_VIEW", "OCCLUDED", "TOO_SMALL"].includes(status) && (
                <small>Select this object and use Frame selection or Isolate in the canvas.</small>
              )}
              {status === "TRANSPARENT" && (
                <small>Opacity is zero at this time. Return to Editor to reveal and edit the object.</small>
              )}
              {mode === "ENGINEERING" && (
                <small>
                  {object.id} · local position{" "}
                  {Object.values(state.transform.position)
                    .map((v) => v.toFixed(3))
                    .join(", ")}{" "}
                  m · scale {state.transform.scale.toFixed(3)}
                </small>
              )}
            </li>
          );
        })}
      </ul>
      <SimulationEvents {...props} />
    </div>
  );
}
