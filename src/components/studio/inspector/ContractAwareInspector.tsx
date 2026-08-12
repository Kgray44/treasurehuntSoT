"use client";

import { useMemo, useState, type RefObject } from "react";
import { readStayStoryMotion, storyMotionPresets } from "@/animation/presentation/story-motion";
import type { DraftValidationResult, JsonObject, ValidationIssue } from "@/chronicle/types";
import type { Asset, Block, Chapter, LibraryRecord, RegistryItem } from "@/components/studio/studio-types";
import { type DrydockVariableType, type DrydockVariableValue } from "@/drydock/variables";
import {
  authoringModes,
  getShipwrightAuthoringAdapter,
  sectionForFieldPath,
  type AuthoringMode,
  type InspectorSectionId,
} from "@/studio/authoring/adapters";
import {
  issuesForContractPath,
  issueCountsBySection,
  issuesForContractBlock,
} from "@/studio/authoring/drydock-adapter";
import { contractFieldsForRegistry, type ContractInspectorField } from "@/studio/authoring/field-model";
import { effectiveValue, effectiveValueLabel } from "@/studio/authoring/effective-values";
import { applyCanonicalTargetSelection } from "@/studio/authoring/targets";
import {
  inspectExpressionCandidate,
  type ShipwrightExpression,
  type ShipwrightExpressionNode,
} from "@/studio/authoring/expression-model";

export type StudioVariableExplorer = {
  variables: Array<{
    id: string;
    name: string;
    description?: string;
    type: DrydockVariableType;
    scope: string;
    defaultValue?: unknown;
    privacy: string;
    allowedOperations: readonly string[];
    readers: Array<{ blockId?: string; fieldPath: string; kind?: string; reachable?: boolean | null }>;
    writers: Array<{
      blockId?: string;
      fieldPath: string;
      kind?: string;
      operation?: string;
      reachable?: boolean | null;
    }>;
    initialization: {
      proofStatus: string;
      potentiallyUninitializedReferences: Array<{ blockId: string; fieldPath: string }>;
    };
    unusedState: string;
    renameState: "AVAILABLE_WITH_CURRENT_STUDIO_DRAFT_GUARD";
    relatedIssueCodes: string[];
  }>;
};

type Props = {
  block: Block;
  chapter: Chapter;
  chapters: Chapter[];
  registry?: RegistryItem;
  assets: Asset[];
  locations: LibraryRecord[];
  artifacts: LibraryRecord[];
  validation: DraftValidationResult | null;
  onChange: (mutator: (block: Block) => void) => void;
  onTitleChange: (title: string) => void;
  variableExplorer: StudioVariableExplorer | null;
  onRequestVariables: () => void;
  onRenameVariable: (variableId: string, nextName: string) => Promise<boolean>;
  onRequestMigration: (blockId: string) => void;
  initialFocusField?: string | null;
  titleInputRef?: RefObject<HTMLInputElement | null>;
  onClose: () => void;
};

const storageKey = "shipwright.authoring-mode.v1";
const sectionLabels: Record<InspectorSectionId, string> = {
  CONTENT: "Content",
  BEHAVIOR: "Behavior",
  COMPLETION: "Completion",
  PRESENTATION: "Presentation",
  ACCESSIBILITY: "Accessibility",
  ADVANCED: "Advanced",
};

const modeCopy: Record<AuthoringMode, string> = {
  GUIDED: "Guided shows the next useful authoring steps in plain language.",
  DETAILED: "Detailed shows all supported authoring controls without raw IDs or JSON.",
  ENGINEERING: "Engineering adds contract identity and safe structural diagnostics. It never bypasses Drydock.",
};

const object = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

function useAuthoringMode() {
  const [mode, setMode] = useState<AuthoringMode>(() => {
    if (typeof window === "undefined") return "GUIDED";
    const stored = window.localStorage.getItem(storageKey);
    return authoringModes.includes(stored as AuthoringMode) ? (stored as AuthoringMode) : "GUIDED";
  });
  const update = (next: AuthoringMode) => {
    setMode(next);
    window.localStorage.setItem(storageKey, next);
  };
  return [mode, update] as const;
}

function issueCopy(issue: ValidationIssue, mode: AuthoringMode) {
  if (mode === "GUIDED") return issue.remediation ?? issue.message;
  if (mode === "DETAILED") return issue.message;
  return `${issue.code}${issue.field ? ` · ${issue.field}` : ""}: ${issue.message}`;
}

function InlineIssues({ issues, mode }: { issues: readonly ValidationIssue[]; mode: AuthoringMode }) {
  if (!issues.length) return null;
  return (
    <ul className="contract-inline-issues" aria-live="polite">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${issue.field ?? "field"}-${index}`} data-severity={issue.severity}>
          <strong>{issue.severity === "error" ? "Needs attention" : "Heads up"}</strong>
          <span>{issueCopy(issue, mode)}</span>
        </li>
      ))}
    </ul>
  );
}

function InspectorSection({
  id,
  mode,
  issues,
  children,
  initialOpen,
}: {
  id: InspectorSectionId;
  mode: AuthoringMode;
  issues: readonly ValidationIssue[];
  children: React.ReactNode;
  initialOpen: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <section className="contract-inspector-section" data-section={id} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="contract-section-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`contract-section-${id}`}
      >
        <span>{sectionLabels[id]}</span>
        {issues.length ? (
          <b data-severity={issues.some((issue) => issue.severity === "error") ? "error" : "warning"}>
            {issues.length}
          </b>
        ) : null}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? <div id={`contract-section-${id}`}>{children}</div> : null}
      {open && mode === "GUIDED" && id === "ACCESSIBILITY" ? (
        <p className="contract-tip">Help every Player receive the clue, even when media is unavailable.</p>
      ) : null}
    </section>
  );
}

function readableTarget(block: Block, chapter: Chapter) {
  const summary = String(
    block.configuration.heading ?? block.configuration.prompt ?? block.configuration.caption ?? block.title,
  ).trim();
  return `${chapter.title} · ${block.title || block.blockType}${summary && summary !== block.title ? ` — ${summary.slice(0, 72)}` : ""}`;
}

function TargetPicker({
  value,
  blocks,
  label,
  fieldPath,
  onChange,
  disabledTargets = [],
}: {
  value: string;
  blocks: Array<{ block: Block; chapter: Chapter }>;
  label: string;
  fieldPath?: string;
  onChange: (target: string) => void;
  disabledTargets?: string[];
}) {
  return (
    <label className="contract-field" data-inspector-field={fieldPath ?? label}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose where the story continues</option>
        {blocks.map(({ block, chapter }) => (
          <option key={block.id} value={block.id} disabled={disabledTargets.includes(block.id)}>
            {readableTarget(block, chapter)}
            {block.blockType === "taleComplete" ? " (terminal)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function StringListControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (next: string[]) => void;
}) {
  const values = Array.isArray(value) ? value.map((item) => String(item)) : [];
  return (
    <fieldset className="contract-string-list" data-inspector-field={label}>
      <legend>{label}</legend>
      {values.map((item, index) => (
        <div key={`${item}-${index}`}>
          <input
            value={item}
            aria-label={`${label} ${index + 1}`}
            onChange={(event) =>
              onChange(values.map((value, itemIndex) => (itemIndex === index ? event.target.value : value)))
            }
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            aria-label={`Remove ${label} ${index + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...values, ""])}>
        Add item
      </button>
    </fieldset>
  );
}

function AlignmentControl({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const alignment = object(block.configuration.alignment);
  const current = (key: string, fallback: number) => Number(alignment[key] ?? fallback);
  const update = (key: string, value: number) =>
    onChange((draft) => {
      draft.configuration.alignment = { ...object(draft.configuration.alignment), [key]: value };
    });
  const controls = [
    ["opacity", "Overlay opacity", 0, 100, 1, 50],
    ["x", "Horizontal offset", -200, 200, 1, 0],
    ["y", "Vertical offset", -200, 200, 1, 0],
    ["scale", "Scale", 0.5, 2, 0.01, 1],
    ["rotation", "Rotation", -20, 20, 0.5, 0],
  ] as const;
  return (
    <fieldset className="alignment-editor" data-inspector-field="configuration.alignment">
      <legend>Before / after alignment</legend>
      <p className="contract-tip">
        Adjust the governed overlay; focal coordinates remain available in Engineering diagnostics.
      </p>
      {controls.map(([key, label, min, max, step, fallback]) => (
        <label key={key} className="contract-field">
          <span>
            {label}: {current(key, fallback)}
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={current(key, fallback)}
            onChange={(event) => update(key, Number(event.target.value))}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange((draft) => {
            draft.configuration.alignment = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 50, focalX: 50, focalY: 50 };
          })
        }
      >
        Reset alignment
      </button>
    </fieldset>
  );
}

function DurationControl({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const seconds = Math.max(0, Number(block.configuration.durationSeconds ?? 0));
  const minutes = Math.floor(seconds / 60);
  const readable = minutes
    ? `${minutes} minute${minutes === 1 ? "" : "s"}${seconds % 60 ? ` ${seconds % 60} seconds` : ""}`
    : `${seconds} seconds`;
  return (
    <fieldset className="duration-control" data-inspector-field="configuration.durationSeconds">
      <legend>Wait duration</legend>
      <p className="contract-summary">Configured: {readable}. This is the canonical timer value.</p>
      <label className="contract-field">
        <span>Seconds</span>
        <input
          type="number"
          min={0}
          step={1}
          value={seconds}
          onChange={(event) =>
            onChange((draft) => {
              draft.configuration.durationSeconds = Math.max(0, Number(event.target.value));
            })
          }
        />
      </label>
      <div className="expression-actions" aria-label="Wait duration presets">
        {[5, 30, 60, 300].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() =>
              onChange((draft) => {
                draft.configuration.durationSeconds = preset;
              })
            }
          >
            {preset >= 60 ? `${preset / 60} min` : `${preset} sec`}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function NarrativeEditor({ block, mode }: { block: Block; mode: AuthoringMode }) {
  return (
    <div className="purpose-built-editor narrative-editor">
      <p>
        {mode === "GUIDED"
          ? "Write the moment Players will encounter. The title stays internal to your Chronicle outline."
          : "Narrative content remains in the current supported plain-text representation."}
      </p>
      <p className="contract-summary">
        Player visibility:{" "}
        {block.isEnabled ? "Enabled for the current draft" : "Disabled; this Passage will not be shown"}.
      </p>
    </div>
  );
}

function ArtifactRevealEditor({ block, mode }: { block: Block; mode: AuthoringMode }) {
  return (
    <div className="purpose-built-editor artifact-reveal-editor">
      <p>
        {mode === "GUIDED"
          ? "Choose the recovered Artifact, describe the reveal, and tell Drydock who receives it."
          : "Artifact ownership, collection impact, and recipient policy remain the accepted artifact-contract fields."}
      </p>
      <p className="contract-summary">
        Collection impact:{" "}
        {block.configuration.addToCollection === false
          ? "No collection update"
          : "Adds to the configured collection policy"}
        .
      </p>
    </div>
  );
}

function FinaleEditor({ block, chapter }: { block: Block; chapter: Chapter }) {
  const terminal = block.blockType === "taleComplete";
  return (
    <div className="purpose-built-editor finale-editor">
      <p>
        {terminal
          ? "This is a terminal Voyage outcome. Configure the ceremony and replay behavior below."
          : `This closes ${chapter.title}. Configure the completion message and continuation behavior below.`}
      </p>
    </div>
  );
}

function MigrationControl({
  block,
  registry,
  onRequestMigration,
}: {
  block: Block;
  registry?: RegistryItem;
  onRequestMigration: (blockId: string) => void;
}) {
  const currentVersion = registry?.contract?.currentVersion;
  if (!currentVersion || block.schemaVersion >= currentVersion) return null;
  return (
    <section className="migration-control" aria-label="Drydock migration status">
      <strong>Migration requires server confirmation</strong>
      <p className="contract-summary">
        Draft v{block.schemaVersion}; current contract v{currentVersion}. Review Drydock's safe structural preview
        before changing this Passage.
      </p>
      <button type="button" onClick={() => onRequestMigration(block.id)}>
        Preview Drydock migration
      </button>
    </section>
  );
}

function ContractField({
  field,
  block,
  assets,
  locations,
  artifacts,
  mode,
  issues,
  onChange,
  contract,
  defaultConfiguration,
  defaultCompletion,
}: {
  field: ContractInspectorField;
  block: Block;
  assets: Asset[];
  locations: LibraryRecord[];
  artifacts: LibraryRecord[];
  mode: AuthoringMode;
  issues: readonly ValidationIssue[];
  onChange: (value: unknown) => void;
  contract?: RegistryItem["contract"];
  defaultConfiguration?: JsonObject;
  defaultCompletion?: JsonObject;
}) {
  const source = field.path.startsWith("completion.") ? block.completion : block.configuration;
  const defaults = field.path.startsWith("completion.") ? defaultCompletion : defaultConfiguration;
  const localPath = field.path.replace(/^(configuration|completion)\./, "");
  const effective = effectiveValue(
    source,
    defaults,
    localPath,
    block.schemaVersion < (contract?.currentVersion ?? block.schemaVersion),
  );
  const assetRequirement = contract?.assetRequirements.find((item) => item.fieldPath === field.path);
  const matchingIssues = issuesForContractPath(block, field.path, issues);
  const label = (
    <span>
      {field.label}
      {field.required ? <b aria-label="required"> *</b> : null}
    </span>
  );
  const update = (value: unknown) => onChange(value);
  const descriptor = (
    <small className="effective-value" data-state={effective.state}>
      {effectiveValueLabel(effective)}
    </small>
  );

  if (field.kind === "textarea")
    return (
      <label className="contract-field" data-inspector-field={field.path}>
        {label}
        <textarea rows={5} value={String(effective.effective ?? "")} onChange={(event) => update(event.target.value)} />
        {descriptor}
        {field.help ? <small>{field.help}</small> : null}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </label>
    );
  if (field.kind === "boolean")
    return (
      <label className="contract-field contract-toggle" data-inspector-field={field.path}>
        <input
          type="checkbox"
          checked={Boolean(effective.effective)}
          onChange={(event) => update(event.target.checked)}
        />
        {label}
        {descriptor}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </label>
    );
  if (field.kind === "number")
    return (
      <label className="contract-field" data-inspector-field={field.path}>
        {label}
        <input
          type="number"
          value={typeof effective.effective === "number" ? effective.effective : ""}
          onChange={(event) => update(event.target.value === "" ? null : Number(event.target.value))}
        />
        {descriptor}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </label>
    );
  if (field.kind === "select")
    return (
      <label className="contract-field" data-inspector-field={field.path}>
        {label}
        <select value={String(effective.effective ?? "")} onChange={(event) => update(event.target.value)}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {descriptor}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </label>
    );
  if (field.kind === "asset") {
    const types = assetRequirement?.mediaTypes ?? field.mediaTypes ?? [];
    const compatible = assets.filter((asset) => !types.length || types.includes(asset.mediaType as never));
    return (
      <label className="contract-field" data-inspector-field={field.path}>
        {label}
        <select value={String(effective.effective ?? "")} onChange={(event) => update(event.target.value || null)}>
          <option value="">No asset selected</option>
          {compatible.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.displayName}
              {" \u00b7 "}
              {asset.mediaType}
            </option>
          ))}
        </select>
        {types.length ? (
          <small>Only compatible {types.join(" / ").toLocaleLowerCase()} media is available.</small>
        ) : null}
        {assetRequirement?.accessibilityFallback ? (
          <small>Accessibility fallback: {assetRequirement.accessibilityFallback.replace("configuration.", "")}</small>
        ) : null}
        {descriptor}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </label>
    );
  }
  if (field.kind === "location")
    return (
      <label className="contract-field" data-inspector-field={field.path}>
        {label}
        <select value={String(effective.effective ?? "")} onChange={(event) => update(event.target.value || null)}>
          <option value="">Choose a location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
              {location.region ? ` \u00b7 ${location.region}` : ""}
            </option>
          ))}
        </select>
        {descriptor}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </label>
    );
  if (field.kind === "artifact")
    return (
      <label className="contract-field" data-inspector-field={field.path}>
        {label}
        <select value={String(effective.effective ?? "")} onChange={(event) => update(event.target.value || null)}>
          <option value="">Choose an artifact</option>
          {artifacts.map((artifact) => (
            <option key={artifact.id} value={artifact.id}>
              {artifact.name}
            </option>
          ))}
        </select>
        {descriptor}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </label>
    );
  if (field.kind === "json" && Array.isArray(effective.effective))
    return (
      <>
        <StringListControl label={field.label} value={effective.effective} onChange={update} />
        {descriptor}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </>
    );
  if (field.kind === "json")
    return mode === "ENGINEERING" ? (
      <label className="contract-field" data-inspector-field={field.path}>
        {label}
        <SafeStructuredControl
          key={JSON.stringify(effective.effective ?? {})}
          label={field.label}
          value={effective.effective ?? {}}
          onChange={update}
        />
        {descriptor}
        <InlineIssues issues={matchingIssues} mode={mode} />
      </label>
    ) : (
      <div className="contract-field" data-inspector-field={field.path}>
        {label}
        <p>This structured setting is available through its purpose-built control or safe Engineering diagnostics.</p>
        <InlineIssues issues={matchingIssues} mode={mode} />
      </div>
    );
  return (
    <label className="contract-field" data-inspector-field={field.path}>
      {label}
      <input value={String(effective.effective ?? "")} onChange={(event) => update(event.target.value)} />
      {descriptor}
      {field.help ? <small>{field.help}</small> : null}
      <InlineIssues issues={matchingIssues} mode={mode} />
    </label>
  );
}

function SafeStructuredControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const serialized = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <textarea
        rows={5}
        value={draft}
        aria-label={`${label} structured editor`}
        aria-describedby={error ? `${label}-structured-error` : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          try {
            onChange(JSON.parse(next));
            setError(null);
          } catch {
            setError("Enter valid JSON before this structured value can be saved through Drydock.");
          }
        }}
      />
      {error ? (
        <small id={`${label}-structured-error`} role="alert">
          {error}
        </small>
      ) : (
        <small>Engineering fallback. Drydock remains the schema and validation authority.</small>
      )}
    </>
  );
}

function setChoiceTargets(block: Block, choices: Array<{ id: string; label: string; targetBlockId: string }>) {
  const currentChoices = Array.isArray(block.configuration.choices) ? block.configuration.choices : [];
  block.configuration.choices = choices.map((choice, index) => ({
    ...object(currentChoices[index]),
    id: choice.id,
    label: choice.label,
  }));
  applyCanonicalTargetSelection(
    block,
    choices
      .filter((choice) => choice.targetBlockId)
      .map((choice, index) => ({
        targetBlockId: choice.targetBlockId,
        connectionType: "CHOICE",
        label: choice.label,
        orderIndex: index,
      })),
  );
}

function ChoiceEditor({
  block,
  candidates,
  mode,
  issues,
  onChange,
}: {
  block: Block;
  candidates: Array<{ block: Block; chapter: Chapter }>;
  mode: AuthoringMode;
  issues: readonly ValidationIssue[];
  onChange: Props["onChange"];
}) {
  const choices = Array.isArray(block.configuration.choices)
    ? block.configuration.choices.map((choice, index) => {
        const value = object(choice);
        const target = block.connections
          ?.filter((connection) => connection.connectionType === "CHOICE")
          .sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0))[index]?.targetBlockId;
        return {
          id: String(value.id ?? `choice-${index + 1}`),
          label: String(value.label ?? ""),
          targetBlockId: String(target ?? value.targetBlockId ?? ""),
        };
      })
    : [];
  const update = (next: typeof choices) => onChange((current) => setChoiceTargets(current, next));
  return (
    <div className="purpose-built-editor choice-editor" data-inspector-field="configuration.choices">
      <p>
        {mode === "GUIDED"
          ? "Describe each path, then choose where it leads."
          : "Choice targets use the canonical Chronicle graph; their legacy mirrors are kept compatible."}
      </p>
      {choices.map((choice, index) => (
        <article key={choice.id}>
          <label>
            <span>Choice {index + 1} label</span>
            <input
              value={choice.label}
              onChange={(event) =>
                update(
                  choices.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label: event.target.value } : item,
                  ),
                )
              }
            />
          </label>
          <TargetPicker
            label={`Choice ${index + 1} destination`}
            fieldPath={`configuration.choices.${index}.targetBlockId`}
            value={choice.targetBlockId}
            blocks={candidates}
            disabledTargets={choices
              .filter((item, itemIndex) => itemIndex !== index)
              .map((item) => item.targetBlockId)
              .filter(Boolean)}
            onChange={(targetBlockId) =>
              update(choices.map((item, itemIndex) => (itemIndex === index ? { ...item, targetBlockId } : item)))
            }
          />
          <button
            type="button"
            onClick={() => update(choices.filter((_, itemIndex) => itemIndex !== index))}
            disabled={choices.length <= 2}
          >
            Remove choice
          </button>
        </article>
      ))}
      <button
        type="button"
        onClick={() => update([...choices, { id: crypto.randomUUID(), label: "New path", targetBlockId: "" }])}
        disabled={choices.length >= 20}
      >
        Add choice
      </button>
      <InlineIssues issues={issuesForContractPath(block, "configuration.choices", issues)} mode={mode} />
    </div>
  );
}

const typeLabel = (type: DrydockVariableType) => type.kind.replaceAll("_", " ").toLocaleLowerCase();
const variableValueType = (type: DrydockVariableType) =>
  type.kind === "STRING_SET"
    ? "stringSet"
    : type.kind.toLocaleLowerCase().replace("identifier_reference", "identifierReference");
const storedOperation = (operation: string) => (operation === "assign" ? "set" : operation);
const displayOperation = (operation: string) =>
  ({
    assign: "Set",
    increment: "Increase by",
    decrement: "Decrease by",
    toggle: "Toggle",
    min: "Minimum",
    max: "Maximum",
    clear: "Clear",
    compare: "Compare",
    add: "Add item",
    remove: "Remove item",
    contains: "Contains",
    count: "Count",
  })[operation] ?? operation;

function VariablePicker({
  explorer,
  value,
  label,
  onChange,
  onRequest,
  onRename,
}: {
  explorer: StudioVariableExplorer | null;
  value: string;
  label: string;
  onChange: (variable: StudioVariableExplorer["variables"][number]) => void;
  onRequest: () => void;
  onRename: (variableId: string, nextName: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [renameName, setRenameName] = useState("");
  if (!explorer)
    return (
      <button type="button" className="load-variables" onClick={onRequest}>
        Load declared variables
      </button>
    );
  const variables = explorer.variables.filter(
    (variable) =>
      variable.id === value ||
      ((query.trim() === "" || variable.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) &&
        (typeFilter === "ALL" || variable.type.kind === typeFilter) &&
        (scopeFilter === "ALL" || variable.scope === scopeFilter)),
  );
  const typeOptions = [...new Set(explorer.variables.map((variable) => variable.type.kind))];
  const scopeOptions = [...new Set(explorer.variables.map((variable) => variable.scope))];
  const selectedVariable = explorer.variables.find((variable) => variable.id === value);
  const affectedBlocks = new Set(
    [...(selectedVariable?.readers ?? []), ...(selectedVariable?.writers ?? [])]
      .map((reference) => reference.blockId)
      .filter((blockId): blockId is string => Boolean(blockId)),
  );
  const expressionCount = (selectedVariable?.readers ?? []).filter(
    (reference) => reference.kind === "EXPRESSION",
  ).length;
  return (
    <fieldset className="variable-browser">
      <legend>{label}</legend>
      <label className="contract-field">
        <span>Search declared variables</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by variable name"
        />
      </label>
      <div className="variable-browser-filters">
        <label className="contract-field">
          <span>Type</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="ALL">All types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ").toLocaleLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="contract-field">
          <span>Scope</span>
          <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
            <option value="ALL">All scopes</option>
            {scopeOptions.map((scope) => (
              <option key={scope} value={scope}>
                {scope}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="contract-field" data-inspector-field="configuration.variableId">
        <span>Choose a declared variable</span>
        <select
          value={value}
          onChange={(event) => {
            const variable = explorer.variables.find((item) => item.id === event.target.value);
            if (variable) onChange(variable);
          }}
        >
          <option value="">Choose a declared variable</option>
          {variables.map((variable) => (
            <option key={variable.id} value={variable.id}>
              {variable.name} · {typeLabel(variable.type)} · {variable.scope} · {variable.privacy}
            </option>
          ))}
        </select>
      </label>
      <p className="contract-summary">
        {variables.length} declared variable{variables.length === 1 ? "" : "s"} match the current filters.
      </p>
      {selectedVariable?.description ? <p className="contract-summary">{selectedVariable.description}</p> : null}
      {selectedVariable?.renameState === "AVAILABLE_WITH_CURRENT_STUDIO_DRAFT_GUARD" ? (
        <fieldset className="variable-rename" aria-label="Rename selected variable">
          <legend>Rename selected variable</legend>
          <p className="contract-summary">
            {selectedVariable.readers.length + selectedVariable.writers.length} governed reference
            {selectedVariable.readers.length + selectedVariable.writers.length === 1 ? "" : "s"} across{" "}
            {affectedBlocks.size} Passage
            {affectedBlocks.size === 1 ? "" : "s"}
            {expressionCount ? `, including ${expressionCount} expression${expressionCount === 1 ? "" : "s"}` : ""}.
            Stable ID stays the same.
          </p>
          <label className="contract-field">
            <span>New variable name</span>
            <input
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              placeholder={selectedVariable.name}
              aria-label={`New name for ${selectedVariable.name}`}
            />
          </label>
          <button
            type="button"
            disabled={!renameName.trim() || renameName.trim() === selectedVariable.name}
            onClick={() =>
              void onRename(selectedVariable.id, renameName.trim()).then((renamed) => {
                if (renamed) setRenameName("");
              })
            }
          >
            Rename with Drydock
          </button>
        </fieldset>
      ) : null}
    </fieldset>
  );
}

function OperandEditor({
  type,
  value,
  onChange,
}: {
  type: DrydockVariableType;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (type.kind === "BOOLEAN")
    return (
      <label className="contract-field">
        <span>Value</span>
        <select value={String(Boolean(value))} onChange={(event) => onChange(event.target.value === "true")}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    );
  if (type.kind === "INTEGER" || type.kind === "NUMBER")
    return (
      <label className="contract-field">
        <span>Value</span>
        <input
          type="number"
          step={type.kind === "INTEGER" ? 1 : "any"}
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
        />
      </label>
    );
  if (type.kind === "ENUM")
    return (
      <label className="contract-field">
        <span>Value</span>
        <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          {type.members.map((member) => (
            <option key={member} value={member}>
              {member}
            </option>
          ))}
        </select>
      </label>
    );
  if (type.kind === "STRING_SET") return <StringListControl label="Items" value={value} onChange={onChange} />;
  return (
    <label className="contract-field">
      <span>Value</span>
      <input
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(event) =>
          onChange(type.kind === "IDENTIFIER_REFERENCE" && event.target.value === "" ? null : event.target.value)
        }
      />
    </label>
  );
}

function SetVariableEditor({
  block,
  explorer,
  mode,
  issues,
  onChange,
  onRequestVariables,
  onRenameVariable,
  allowedOperations,
}: {
  block: Block;
  explorer: StudioVariableExplorer | null;
  mode: AuthoringMode;
  issues: readonly ValidationIssue[];
  onChange: Props["onChange"];
  onRequestVariables: () => void;
  onRenameVariable: Props["onRenameVariable"];
  allowedOperations: readonly string[];
}) {
  const variable = explorer?.variables.find((item) => item.id === block.configuration.variableId) ?? null;
  const allowed = variable?.allowedOperations.filter((operation) => allowedOperations.includes(operation)) ?? [];
  return (
    <div className="purpose-built-editor variable-editor" data-inspector-field="configuration.variableId">
      <VariablePicker
        explorer={explorer}
        value={String(block.configuration.variableId ?? "")}
        label="Variable"
        onRequest={onRequestVariables}
        onRename={onRenameVariable}
        onChange={(next) =>
          onChange((current) => {
            current.configuration.variableId = next.id;
            current.configuration.variableName = next.name;
            current.configuration.variable = next.name;
            current.configuration.valueType = variableValueType(next.type);
            current.configuration.scope = next.scope;
            current.configuration.privacy = next.privacy;
            current.configuration.operation = storedOperation(
              next.allowedOperations.includes("assign") ? "assign" : (next.allowedOperations[0] ?? "assign"),
            );
            current.configuration.value =
              next.defaultValue ??
              (next.type.kind === "BOOLEAN"
                ? false
                : next.type.kind === "STRING_SET"
                  ? []
                  : next.type.kind === "IDENTIFIER_REFERENCE"
                    ? null
                    : "");
          })
        }
      />
      {variable ? (
        <>
          <p className="contract-summary">
            {variable.name} is a {typeLabel(variable.type)} in {variable.scope}. {variable.readers.length} reads ·{" "}
            {variable.writers.length} writes · {variable.unusedState.toLocaleLowerCase()}.
          </p>
          <label className="contract-field">
            <span>Operation</span>
            <select
              value={String(block.configuration.operation ?? "set")}
              onChange={(event) =>
                onChange((current) => {
                  current.configuration.operation = event.target.value;
                })
              }
            >
              {allowed.map((operation) => (
                <option key={operation} value={storedOperation(operation)}>
                  {displayOperation(operation)}
                </option>
              ))}
            </select>
          </label>
          {["toggle"].includes(String(block.configuration.operation)) ? (
            <p className="contract-tip">This toggles the selected Boolean value; no operand is needed.</p>
          ) : (
            <OperandEditor
              type={variable.type}
              value={block.configuration.value}
              onChange={(value) =>
                onChange((current) => {
                  current.configuration.value = value;
                })
              }
            />
          )}
        </>
      ) : (
        <p className="contract-tip">Choose a declared variable to see valid operations and a matching value editor.</p>
      )}
      <InlineIssues issues={issuesForContractPath(block, "configuration.variableId", issues)} mode={mode} />
    </div>
  );
}

function defaultCompare(
  variableId: string,
  type: DrydockVariableType,
): Extract<ShipwrightExpressionNode, { kind: "compare" }> {
  const value: DrydockVariableValue =
    type.kind === "BOOLEAN"
      ? false
      : type.kind === "INTEGER" || type.kind === "NUMBER"
        ? 0
        : type.kind === "STRING_SET"
          ? []
          : type.kind === "IDENTIFIER_REFERENCE"
            ? null
            : type.kind === "ENUM"
              ? (type.members[0] ?? "")
              : "";
  return {
    kind: "compare",
    operator: "equals",
    left: { kind: "variable", variableId },
    right: {
      kind: "literal",
      valueType: type.kind,
      value,
      ...(type.kind === "ENUM" ? { enumDomainId: type.domainId } : {}),
      ...(type.kind === "IDENTIFIER_REFERENCE" ? { identifierEntityType: type.entityType } : {}),
    },
  };
}

type ExpressionPath = Array<number | "left" | "right" | "operand" | "source" | "value">;

function updateExpressionNode(
  node: ShipwrightExpressionNode,
  path: ExpressionPath,
  replacement: ShipwrightExpressionNode,
): ShipwrightExpressionNode {
  if (!path.length) return replacement;
  const [segment, ...tail] = path;
  if (node.kind === "logical" && typeof segment === "number")
    return {
      ...node,
      operands: node.operands.map((child, index) =>
        index === segment ? updateExpressionNode(child, tail, replacement) : child,
      ),
    };
  if (node.kind === "compare" && (segment === "left" || segment === "right"))
    return { ...node, [segment]: updateExpressionNode(node[segment], tail, replacement) };
  if (node.kind === "not" && segment === "operand")
    return { ...node, operand: updateExpressionNode(node.operand, tail, replacement) };
  if (node.kind === "contains" && (segment === "source" || segment === "value"))
    return { ...node, [segment]: updateExpressionNode(node[segment], tail, replacement) };
  if (node.kind === "count" && segment === "source")
    return { ...node, source: updateExpressionNode(node.source, tail, replacement) };
  return node;
}

function ExpressionNodeEditor({
  node,
  path,
  explorer,
  onChange,
}: {
  node: ShipwrightExpressionNode;
  path: ExpressionPath;
  explorer: StudioVariableExplorer;
  onChange: (path: ExpressionPath, replacement: ShipwrightExpressionNode) => void;
}) {
  if (node.kind === "logical")
    return (
      <fieldset className="expression-group">
        <legend>{node.operator === "and" ? "All of these must be true" : "Any of these may be true"}</legend>
        <select
          value={node.operator}
          onChange={(event) => onChange(path, { ...node, operator: event.target.value as "and" | "or" })}
        >
          <option value="and">All of these</option>
          <option value="or">Any of these</option>
        </select>
        {node.operands.map((child, index) => (
          <ExpressionNodeEditor
            key={index}
            node={child}
            path={[...path, index]}
            explorer={explorer}
            onChange={onChange}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            const candidate = explorer.variables[0];
            if (candidate)
              onChange(path, { ...node, operands: [...node.operands, defaultCompare(candidate.id, candidate.type)] });
          }}
        >
          Add condition
        </button>
      </fieldset>
    );
  if (node.kind === "not")
    return (
      <fieldset className="expression-group">
        <legend>NOT</legend>
        <ExpressionNodeEditor node={node.operand} path={[...path, "operand"]} explorer={explorer} onChange={onChange} />
      </fieldset>
    );
  if (node.kind === "contains") {
    const sourceId = node.source.kind === "variable" ? node.source.variableId : "";
    const value = node.value.kind === "literal" ? String(node.value.value ?? "") : "";
    const stringSets = explorer.variables.filter((variable) => variable.type.kind === "STRING_SET");
    return (
      <div className="expression-row">
        <label>
          <span>String set</span>
          <select
            value={sourceId}
            onChange={(event) =>
              onChange(path, { ...node, source: { kind: "variable", variableId: event.target.value } })
            }
          >
            <option value="">Choose a String Set</option>
            {stringSets.map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Contains item</span>
          <input
            value={value}
            onChange={(event) =>
              onChange(path, { ...node, value: { kind: "literal", valueType: "STRING", value: event.target.value } })
            }
          />
        </label>
      </div>
    );
  }
  if (node.kind === "count") {
    const sourceId = node.source.kind === "variable" ? node.source.variableId : "";
    const stringSets = explorer.variables.filter((variable) => variable.type.kind === "STRING_SET");
    return (
      <label className="contract-field">
        <span>Count items in</span>
        <select
          value={sourceId}
          onChange={(event) =>
            onChange(path, { ...node, source: { kind: "variable", variableId: event.target.value } })
          }
        >
          <option value="">Choose a String Set</option>
          {stringSets.map((variable) => (
            <option key={variable.id} value={variable.id}>
              {variable.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (node.kind === "literal" || node.kind === "variable")
    return (
      <div className="expression-row">
        <p className="contract-summary">
          This imported expression leaf is preserved. Replace it with a typed comparison to edit it visually.
        </p>
        <button
          type="button"
          onClick={() =>
            onChange(
              path,
              defaultCompare(explorer.variables[0]?.id ?? "", explorer.variables[0]?.type ?? { kind: "BOOLEAN" }),
            )
          }
        >
          Replace with comparison
        </button>
      </div>
    );
  const compare =
    node.kind === "compare"
      ? node
      : defaultCompare(explorer.variables[0]?.id ?? "", explorer.variables[0]?.type ?? { kind: "BOOLEAN" });
  const countSourceId =
    compare.left.kind === "count" && compare.left.source.kind === "variable" ? compare.left.source.variableId : "";
  const countComparison = compare.left.kind === "count";
  const variableId = compare.left.kind === "variable" ? compare.left.variableId : "";
  const variable = explorer.variables.find((item) => item.id === variableId) ?? explorer.variables[0];
  const type = countComparison ? ({ kind: "INTEGER" } as const) : (variable?.type ?? { kind: "BOOLEAN" as const });
  const sourceOptions = countComparison
    ? explorer.variables.filter((item) => item.type.kind === "STRING_SET")
    : explorer.variables;
  const literal = compare.right.kind === "literal" ? compare.right.value : "";
  const operators =
    type.kind === "INTEGER" || type.kind === "NUMBER"
      ? ["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"]
      : ["equals", "notEquals"];
  return (
    <div className="expression-row">
      <label>
        <span>{countComparison ? "Count items in" : "Variable"}</span>
        <select
          value={countComparison ? countSourceId : variableId}
          onChange={(event) => {
            const selected = explorer.variables.find((item) => item.id === event.target.value);
            if (!selected) return;
            onChange(
              path,
              countComparison
                ? { ...compare, left: { kind: "count", source: { kind: "variable", variableId: selected.id } } }
                : defaultCompare(selected.id, selected.type),
            );
          }}
        >
          <option value="">{countComparison ? "Choose a String Set" : "Choose variable"}</option>
          {sourceOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {" \u00b7 "}
              {typeLabel(item.type)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Comparison</span>
        <select
          value={compare.operator}
          onChange={(event) => onChange(path, { ...compare, operator: event.target.value as typeof compare.operator })}
        >
          {operators.map((operator) => (
            <option key={operator} value={operator}>
              {operator.replace(/([A-Z])/g, " $1")}
            </option>
          ))}
        </select>
      </label>
      <OperandEditor
        type={type}
        value={literal}
        onChange={(value) =>
          onChange(path, {
            ...compare,
            right: {
              kind: "literal",
              valueType: type.kind,
              value: value as DrydockVariableValue,
              ...(type.kind === "ENUM" ? { enumDomainId: type.domainId } : {}),
              ...(type.kind === "IDENTIFIER_REFERENCE" ? { identifierEntityType: type.entityType } : {}),
            },
          })
        }
      />
    </div>
  );
}

function ConditionEditor({
  block,
  candidates,
  explorer,
  mode,
  issues,
  onChange,
  onRequestVariables,
}: {
  block: Block;
  candidates: Array<{ block: Block; chapter: Chapter }>;
  explorer: StudioVariableExplorer | null;
  mode: AuthoringMode;
  issues: readonly ValidationIssue[];
  onChange: Props["onChange"];
  onRequestVariables: () => void;
}) {
  if (!explorer)
    return (
      <div className="purpose-built-editor">
        <p>Load declared variables to build this condition visually.</p>
        <button type="button" onClick={onRequestVariables}>
          Load declared variables
        </button>
      </div>
    );
  const fallbackVariable = explorer.variables[0];
  const expression = object(block.configuration.expression) as unknown as ShipwrightExpression;
  const root =
    expression?.root ?? (fallbackVariable ? defaultCompare(fallbackVariable.id, fallbackVariable.type) : null);
  if (!root || !fallbackVariable)
    return (
      <div className="purpose-built-editor">
        <p>Declare a variable before building a condition.</p>
      </div>
    );
  const checked = inspectExpressionCandidate(
    { schemaVersion: 1, root },
    new Map(explorer.variables.map((variable) => [variable.id, variable.type])),
  );
  const setRoot = (next: ShipwrightExpressionNode) =>
    onChange((current) => {
      current.configuration.expression = { schemaVersion: 1, root: next };
      if (next.kind !== "compare") return;
      const left = next.left;
      const right = next.right;
      if (left.kind !== "variable" || right.kind !== "literal") return;
      const selected = explorer.variables.find((item) => item.id === left.variableId);
      current.configuration.variable = selected?.name ?? current.configuration.variable;
      current.configuration.operator =
        next.operator === "greaterThanOrEqual" || next.operator === "lessThanOrEqual" ? "equals" : next.operator;
      current.configuration.value = right.value as never;
    });
  const targets = new Set([block.id]);
  const successTarget = String(
    block.connections?.find((connection) => connection.connectionType === "SUCCESS")?.targetBlockId ??
      block.configuration.successTargetBlockId ??
      "",
  );
  const failureTarget = String(
    block.connections?.find((connection) => connection.connectionType === "FAILURE")?.targetBlockId ??
      block.configuration.failureTargetBlockId ??
      "",
  );
  return (
    <div className="purpose-built-editor condition-editor" data-inspector-field="configuration.expression">
      <p>
        {mode === "GUIDED"
          ? "Choose a declared variable and describe when this path is true."
          : "This is the canonical Drydock expression tree. Studio keeps a compatible legacy summary for existing runtime readers."}
      </p>
      <ExpressionNodeEditor
        node={root}
        path={[]}
        explorer={explorer}
        onChange={(path, replacement) => setRoot(updateExpressionNode(root, path, replacement))}
      />
      <div className="expression-actions">
        <button
          type="button"
          onClick={() =>
            setRoot({
              kind: "logical",
              operator: "and",
              operands: [root, defaultCompare(fallbackVariable.id, fallbackVariable.type)],
            })
          }
        >
          Add ALL group
        </button>
        <button
          type="button"
          onClick={() =>
            setRoot({
              kind: "logical",
              operator: "or",
              operands: [root, defaultCompare(fallbackVariable.id, fallbackVariable.type)],
            })
          }
        >
          Add ANY group
        </button>
        <button type="button" onClick={() => setRoot({ kind: "not", operand: root })}>
          Add NOT
        </button>
        <button
          type="button"
          disabled={!explorer.variables.some((variable) => variable.type.kind === "STRING_SET")}
          onClick={() => {
            const source = explorer.variables.find((variable) => variable.type.kind === "STRING_SET");
            if (source)
              setRoot({
                kind: "logical",
                operator: "and",
                operands: [
                  root,
                  {
                    kind: "contains",
                    source: { kind: "variable", variableId: source.id },
                    value: { kind: "literal", valueType: "STRING", value: "" },
                  },
                ],
              });
          }}
        >
          Add contains check
        </button>
        <button
          type="button"
          disabled={!explorer.variables.some((variable) => variable.type.kind === "STRING_SET")}
          onClick={() => {
            const source = explorer.variables.find((variable) => variable.type.kind === "STRING_SET");
            if (source)
              setRoot({
                kind: "logical",
                operator: "and",
                operands: [
                  root,
                  {
                    kind: "compare",
                    operator: "greaterThanOrEqual",
                    left: { kind: "count", source: { kind: "variable", variableId: source.id } },
                    right: { kind: "literal", valueType: "INTEGER", value: 1 },
                  },
                ],
              });
          }}
        >
          Add count check
        </button>
      </div>
      {checked.length ? (
        <ul className="contract-inline-issues">
          {checked.map((issue) => (
            <li key={`${issue.code}-${issue.message}`} data-severity="error">
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      <TargetPicker
        label="When the condition is true"
        fieldPath="configuration.successTargetBlockId"
        value={successTarget}
        blocks={candidates}
        disabledTargets={[...targets]}
        onChange={(target) =>
          onChange((current) => {
            applyCanonicalTargetSelection(current, [
              { targetBlockId: target, connectionType: "SUCCESS", orderIndex: 0 },
              ...(current.connections ?? []).filter((connection) => connection.connectionType === "FAILURE"),
            ]);
          })
        }
      />
      <TargetPicker
        label="When the condition is false"
        fieldPath="configuration.failureTargetBlockId"
        value={failureTarget}
        blocks={candidates}
        disabledTargets={[...targets, successTarget]}
        onChange={(target) =>
          onChange((current) => {
            applyCanonicalTargetSelection(current, [
              ...(current.connections ?? []).filter((connection) => connection.connectionType === "SUCCESS"),
              { targetBlockId: target, connectionType: "FAILURE", orderIndex: 1 },
            ]);
          })
        }
      />
      <InlineIssues issues={issuesForContractPath(block, "configuration.expression", issues)} mode={mode} />
    </div>
  );
}

function PresentationFields({
  block,
  mode,
  onChange,
}: {
  block: Block;
  mode: AuthoringMode;
  onChange: Props["onChange"];
}) {
  return (
    <div className="presentation-contract-fields">
      <label className="contract-field" data-inspector-field="presentation.spreadMode">
        <span>Page layout</span>
        <select
          aria-label="Page layout"
          value={String(block.presentation.spreadMode ?? "")}
          onChange={(event) =>
            onChange((current) => {
              if (event.target.value) current.presentation.spreadMode = event.target.value;
              else delete current.presentation.spreadMode;
            })
          }
        >
          <option value="">Automatic for this Passage</option>
          <option value="left">Left page</option>
          <option value="right">Right page</option>
          <option value="two-page">Two-page spread</option>
          <option value="overlay">Physical insert</option>
          <option value="cinematic">Cinematic expansion</option>
        </select>
        <small>{block.presentation.spreadMode ? "Configured" : "Canonical default"}</small>
      </label>
      <fieldset className="journal-presentation-fields shipwright-motion-fields">
        <legend>Passage animation</legend>
        <p>
          These settings are saved with this Passage. Reduced-motion preferences always receive the governed calm
          alternative.
        </p>
        <label className="contract-field" data-inspector-field="presentation.transitionIn">
          <span>Opening animation</span>
          <select
            aria-label="Opening animation"
            value={String(block.presentation.transitionIn ?? "fade")}
            onChange={(event) =>
              onChange((current) => {
                current.presentation.transitionIn = event.target.value;
              })
            }
          >
            {storyMotionPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <small>{block.presentation.transitionIn ? "Configured" : "Canonical default"}</small>
        </label>
        <label className="contract-field" data-inspector-field="presentation.transitionOut">
          <span>Leaving animation</span>
          <select
            aria-label="Leaving animation"
            value={String(block.presentation.transitionOut ?? "minimize")}
            onChange={(event) =>
              onChange((current) => {
                current.presentation.transitionOut = event.target.value;
              })
            }
          >
            {storyMotionPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <small>{block.presentation.transitionOut ? "Configured" : "Canonical default"}</small>
        </label>
        <label className="contract-field" data-inspector-field="presentation.backgroundScene">
          <span>While this Passage is active</span>
          <select
            aria-label="While this Passage is active"
            value={readStayStoryMotion(block.presentation.backgroundScene) ?? ""}
            onChange={(event) =>
              onChange((current) => {
                if (event.target.value) current.presentation.backgroundScene = `shipwright-stay:${event.target.value}`;
                else delete current.presentation.backgroundScene;
              })
            }
          >
            <option value="">Natural resting state</option>
            {storyMotionPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {mode === "GUIDED" ? (
        <p className="contract-tip">Players who prefer reduced motion always receive the governed calm alternative.</p>
      ) : null}
    </div>
  );
}

export function ContractAwareInspector({
  block,
  chapter,
  chapters,
  registry,
  assets,
  locations,
  artifacts,
  validation,
  onChange,
  onTitleChange,
  variableExplorer,
  onRequestVariables,
  onRenameVariable,
  onRequestMigration,
  initialFocusField,
  titleInputRef,
  onClose,
}: Props) {
  const [mode, setMode] = useAuthoringMode();
  const adapter = getShipwrightAuthoringAdapter(block.blockType, Boolean(registry?.contract));
  const contract = registry?.contract;
  const allIssues = useMemo(() => [...(validation?.errors ?? []), ...(validation?.warnings ?? [])], [validation]);
  const blockIssues = issuesForContractBlock(block, allIssues);
  const issueCounts = issueCountsBySection(block, allIssues);
  const fields = registry ? contractFieldsForRegistry(registry, mode) : [];
  const candidates = useMemo(
    () =>
      chapters.flatMap((item) =>
        item.blocks
          .filter((candidate) => candidate.id !== block.id)
          .map((candidate) => ({ block: candidate, chapter: item })),
      ),
    [block.id, chapters],
  );
  const focusedSection = sectionForFieldPath(initialFocusField);
  const fieldsFor = (section: InspectorSectionId) => fields.filter((field) => field.section === section);
  const renderFields = (section: InspectorSectionId) =>
    fieldsFor(section)
      .filter(
        (field) =>
          !(
            (block.blockType === "choice" && field.key === "choices") ||
            (block.blockType === "condition" &&
              ["variable", "operator", "value", "successTargetBlockId", "failureTargetBlockId"].includes(field.key)) ||
            (block.blockType === "setVariable" &&
              ["variable", "valueType", "operation", "value"].includes(field.key)) ||
            (block.blockType === "imageTransformation" && field.key === "alignment") ||
            (block.blockType === "wait" && field.key === "durationSeconds")
          ),
      )
      .map((field) => (
        <ContractField
          key={field.path}
          field={field}
          block={block}
          assets={assets}
          locations={locations}
          artifacts={artifacts}
          mode={mode}
          issues={allIssues}
          contract={contract}
          defaultConfiguration={registry?.defaultConfiguration}
          defaultCompletion={registry?.defaultCompletion}
          onChange={(value) =>
            onChange((current) => {
              if (field.path === "completion.mode") current.completion.mode = value;
              else current.configuration[field.key] = value;
            })
          }
        />
      ));
  return (
    <div className="contract-aware-inspector" data-authoring-mode={mode} data-editor-strategy={adapter.strategy}>
      <header className="contract-inspector-header">
        <button type="button" className="inspector-mobile-close" onClick={onClose} aria-label="Close Passage inspector">
          {"\u00d7"}
        </button>
        <p className="eyebrow">{registry?.displayName ?? adapter.displayName}</p>
        <input
          ref={titleInputRef}
          value={block.title}
          aria-label="Passage title"
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <p>{adapter.guidedSummary}</p>
        <label className="authoring-mode-control">
          <span>Authoring level</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as AuthoringMode)}>
            {authoringModes.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate[0]}
                {candidate.slice(1).toLocaleLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <small>{modeCopy[mode]}</small>
      </header>
      <InspectorSection
        key={`${block.id}-CONTENT-${focusedSection === "CONTENT" ? (initialFocusField ?? "focus") : "idle"}`}
        id="CONTENT"
        mode={mode}
        issues={blockIssues.filter((issue) => sectionForFieldPath(issue.field) === "CONTENT")}
        initialOpen={focusedSection === "CONTENT" || true}
      >
        {block.blockType === "choice" ? (
          <ChoiceEditor block={block} candidates={candidates} mode={mode} issues={allIssues} onChange={onChange} />
        ) : null}
        {block.blockType === "narrative" ? <NarrativeEditor block={block} mode={mode} /> : null}
        {block.blockType === "artifactReveal" ? <ArtifactRevealEditor block={block} mode={mode} /> : null}
        {block.blockType === "chapterComplete" || block.blockType === "taleComplete" ? (
          <FinaleEditor block={block} chapter={chapter} />
        ) : null}
        {renderFields("CONTENT")}
      </InspectorSection>
      <InspectorSection
        key={`${block.id}-BEHAVIOR-${focusedSection === "BEHAVIOR" ? (initialFocusField ?? "focus") : "idle"}`}
        id="BEHAVIOR"
        mode={mode}
        issues={blockIssues.filter((issue) => sectionForFieldPath(issue.field) === "BEHAVIOR")}
        initialOpen={
          focusedSection === "BEHAVIOR" ||
          block.blockType === "condition" ||
          block.blockType === "setVariable" ||
          block.blockType === "wait"
        }
      >
        {block.blockType === "condition" ? (
          <ConditionEditor
            block={block}
            candidates={candidates}
            explorer={variableExplorer}
            mode={mode}
            issues={allIssues}
            onChange={onChange}
            onRequestVariables={onRequestVariables}
          />
        ) : null}
        {block.blockType === "setVariable" ? (
          <SetVariableEditor
            block={block}
            explorer={variableExplorer}
            mode={mode}
            issues={allIssues}
            onChange={onChange}
            onRequestVariables={onRequestVariables}
            onRenameVariable={onRenameVariable}
            allowedOperations={
              contract?.variableWrites.find((reference) => reference.fieldPath === "configuration.variableId")
                ?.operations ?? []
            }
          />
        ) : null}
        {block.blockType === "wait" ? <DurationControl block={block} onChange={onChange} /> : null}
        {renderFields("BEHAVIOR")}
      </InspectorSection>
      <InspectorSection
        key={`${block.id}-COMPLETION-${focusedSection === "COMPLETION" ? (initialFocusField ?? "focus") : "idle"}`}
        id="COMPLETION"
        mode={mode}
        issues={blockIssues.filter((issue) => sectionForFieldPath(issue.field) === "COMPLETION")}
        initialOpen={focusedSection === "COMPLETION"}
      >
        {renderFields("COMPLETION")}
        <p className="contract-summary">
          Provider: {contract?.providerContract ?? "Not required"}. Connections:{" "}
          {contract?.connectionPolicy.terminal
            ? "Terminal outcome"
            : `${contract?.connectionPolicy.minimum ?? 0}-${contract?.connectionPolicy.maximum ?? 0} canonical edge(s)`}
          .
        </p>
      </InspectorSection>
      <InspectorSection
        key={`${block.id}-PRESENTATION-${focusedSection === "PRESENTATION" ? (initialFocusField ?? "focus") : "idle"}`}
        id="PRESENTATION"
        mode={mode}
        issues={blockIssues.filter((issue) => sectionForFieldPath(issue.field) === "PRESENTATION")}
        initialOpen={focusedSection === "PRESENTATION" || block.blockType === "narrative"}
      >
        <PresentationFields block={block} mode={mode} onChange={onChange} />
        {block.blockType === "imageTransformation" ? <AlignmentControl block={block} onChange={onChange} /> : null}
        {renderFields("PRESENTATION")}
      </InspectorSection>
      <InspectorSection
        key={`${block.id}-ACCESSIBILITY-${focusedSection === "ACCESSIBILITY" ? (initialFocusField ?? "focus") : "idle"}`}
        id="ACCESSIBILITY"
        mode={mode}
        issues={blockIssues.filter((issue) => sectionForFieldPath(issue.field) === "ACCESSIBILITY")}
        initialOpen={focusedSection === "ACCESSIBILITY" || issueCounts.ACCESSIBILITY > 0}
      >
        {contract?.accessibilityRules.map((rule) => (
          <p key={rule.code} className="accessibility-obligation">
            <strong>{mode === "ENGINEERING" ? rule.code : "Player access"}</strong> {rule.obligation}
          </p>
        ))}
        {renderFields("ACCESSIBILITY")}
      </InspectorSection>
      <InspectorSection
        key={`${block.id}-ADVANCED-${focusedSection === "ADVANCED" ? (initialFocusField ?? "focus") : "idle"}`}
        id="ADVANCED"
        mode={mode}
        issues={blockIssues.filter((issue) => sectionForFieldPath(issue.field) === "ADVANCED")}
        initialOpen={focusedSection === "ADVANCED" || mode === "ENGINEERING"}
      >
        {mode === "ENGINEERING" ? (
          <>
            <dl className="contract-diagnostics">
              <dt>Contract</dt>
              <dd>{registry?.type ?? "Unknown future contract"}</dd>
              <dt>Schema</dt>
              <dd>
                Draft v{block.schemaVersion}; current v{contract?.currentVersion ?? "unknown"}
              </dd>
              <dt>Compatibility</dt>
              <dd>
                {block.schemaVersion < (contract?.currentVersion ?? block.schemaVersion)
                  ? "Migration available"
                  : "Current"}
              </dd>
              <dt>Canonical connection owner</dt>
              <dd>{contract?.connectionPolicy.canonicalAuthority ?? "Unknown"}</dd>
            </dl>
            {renderFields("ADVANCED")}
          </>
        ) : (
          <p>Compatibility, identifiers, and safe structural diagnostics are available in Engineering mode.</p>
        )}
        <MigrationControl block={block} registry={registry} onRequestMigration={onRequestMigration} />
        <InlineIssues
          issues={blockIssues.filter((issue) => sectionForFieldPath(issue.field) === "ADVANCED")}
          mode={mode}
        />
      </InspectorSection>
      <label className="contract-field">
        <span>Private creator notes</span>
        <textarea
          rows={4}
          value={block.creatorNotes ?? ""}
          onChange={(event) =>
            onChange((current) => {
              current.creatorNotes = event.target.value;
            })
          }
        />
      </label>
    </div>
  );
}
