"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mockVisionScenarios, type MockVisionScenario } from "@/vision/domain";

type Configuration = {
  schemaVersion: 1;
  waypointType: string;
  verificationProfile: "BALANCED" | "STRICT" | "STORY_CRITICAL" | "CUSTOM";
  scanInteraction: { mode: "HOLD" | "TOGGLE"; holdDurationMs: number; progressAnnouncementIntervalMs: number };
  creatorGuidancePreferences: Record<string, unknown>;
  captainFallbackPolicy: {
    enabled: boolean;
    allowManualApprove: boolean;
    allowManualReject: boolean;
    requireReason: boolean;
  };
  acceptedPoseConfiguration: Record<string, unknown>;
  stableRegionConfiguration: Record<string, unknown>;
  hardNegativeRequirement: Record<string, unknown>;
  storyPurposeMetadata: Record<string, unknown>;
  buildPreference: "LOCAL" | "CLOUD_ASSISTED" | "UNDECIDED";
};
type Version = {
  id: string;
  versionNumber: number;
  lifecycleStatus: string;
  draftConfiguration: Configuration;
  publishedAt: string | null;
  deprecatedAt: string | null;
  publication: { packageHash: string; packageSchemaVersion: number; status: string } | null;
};
type Waypoint = {
  id: string;
  name: string;
  description: string;
  type: string;
  sharingScope: string;
  locationTags: string[];
  archivedAt: string | null;
  versions: Version[];
  usage: Array<{ id: string; storyTitle: string; blockTitle: string; waypointVersionId: string }>;
};

export function VisionWaypointEditor({ waypointId, authenticated }: { waypointId: string; authenticated: boolean }) {
  const [waypoint, setWaypoint] = useState<Waypoint | null>(null);
  const [csrf, setCsrf] = useState("");
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [scenario, setScenario] = useState<MockVisionScenario>("verified");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/vision-waypoints/${waypointId}`, { cache: "no-store" });
    const body = (await response.json()) as { waypoint?: Waypoint; csrfToken?: string; error?: string };
    if (!response.ok) return setMessage(body.error ?? "The waypoint could not be opened.");
    setWaypoint(body.waypoint ?? null);
    setCsrf(body.csrfToken ?? "");
    const draft = body.waypoint?.versions.find(
      (version) => version.lifecycleStatus === "DRAFT" && !version.publishedAt,
    );
    setConfiguration(draft?.draftConfiguration ?? null);
  }, [waypointId]);
  useEffect(() => {
    if (authenticated) queueMicrotask(() => void load());
  }, [authenticated, load]);
  const draft = useMemo(
    () => waypoint?.versions.find((version) => version.lifecycleStatus === "DRAFT" && !version.publishedAt) ?? null,
    [waypoint],
  );
  async function mutate(url: string, options: RequestInit = {}) {
    setBusy(true);
    setMessage("");
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf, ...(options.headers ?? {}) },
    });
    const body = (await response.json()) as { error?: string };
    setMessage(response.ok ? "Saved to the authoritative waypoint record." : (body.error ?? "Waypoint action failed."));
    if (response.ok) await load();
    setBusy(false);
    return response.ok;
  }
  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <section>
          <h1>Creator authentication required</h1>
          <Link href="/quartermaster">Open Quartermaster login</Link>
        </section>
      </main>
    );
  if (!waypoint)
    return (
      <main className="vision-editor">
        <p role="status">{message || "Opening waypoint…"}</p>
      </main>
    );
  return (
    <main className="vision-editor">
      <header>
        <div>
          <Link href="/studio/vision-waypoints">← Vision Waypoints</Link>
          <p className="eyebrow">{waypoint.type.replaceAll("_", " ")}</p>
          <h1>{waypoint.name}</h1>
          <p>{waypoint.description || "No description yet."}</p>
        </div>
        <span className="development-badge">Development mock only</span>
      </header>
      {message && (
        <p className="captain-notice" role="status">
          {message}
        </p>
      )}
      <div className="vision-editor-grid">
        <section>
          <h2>Metadata</h2>
          <label>
            <span>Name</span>
            <input value={waypoint.name} onChange={(event) => setWaypoint({ ...waypoint, name: event.target.value })} />
          </label>
          <label>
            <span>Description</span>
            <textarea
              rows={4}
              value={waypoint.description}
              onChange={(event) => setWaypoint({ ...waypoint, description: event.target.value })}
            />
          </label>
          <label>
            <span>Location tags</span>
            <input
              value={waypoint.locationTags.join(", ")}
              onChange={(event) =>
                setWaypoint({
                  ...waypoint,
                  locationTags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void mutate(`/api/vision-waypoints/${waypoint.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  name: waypoint.name,
                  description: waypoint.description,
                  locationTags: waypoint.locationTags,
                  sharingScope: waypoint.sharingScope,
                }),
              })
            }
          >
            Save metadata
          </button>
        </section>
        <section>
          <h2>{draft ? `Draft version ${draft.versionNumber}` : "No editable draft"}</h2>
          {configuration && draft ? (
            <>
              <label>
                <span>Verification profile</span>
                <select
                  value={configuration.verificationProfile}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      verificationProfile: event.target.value as Configuration["verificationProfile"],
                    })
                  }
                >
                  <option>BALANCED</option>
                  <option>STRICT</option>
                  <option>STORY_CRITICAL</option>
                  <option>CUSTOM</option>
                </select>
              </label>
              <label>
                <span>Scan interaction</span>
                <select
                  value={configuration.scanInteraction.mode}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      scanInteraction: {
                        ...configuration.scanInteraction,
                        mode: event.target.value as "HOLD" | "TOGGLE",
                      },
                    })
                  }
                >
                  <option>HOLD</option>
                  <option>TOGGLE</option>
                </select>
              </label>
              <label>
                <span>Hold duration (ms)</span>
                <input
                  type="number"
                  min={250}
                  max={15000}
                  value={configuration.scanInteraction.holdDurationMs}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      scanInteraction: { ...configuration.scanInteraction, holdDurationMs: Number(event.target.value) },
                    })
                  }
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={configuration.captainFallbackPolicy.enabled}
                  onChange={(event) =>
                    setConfiguration({
                      ...configuration,
                      captainFallbackPolicy: { ...configuration.captainFallbackPolicy, enabled: event.target.checked },
                    })
                  }
                />
                <span>Captain fallback enabled</span>
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate(`/api/vision-waypoint-versions/${draft.id}/draft`, {
                    method: "PATCH",
                    body: JSON.stringify(configuration),
                  })
                }
              >
                Save draft configuration
              </button>
              <div className="development-publish">
                <label>
                  <span>Deterministic scenario</span>
                  <select value={scenario} onChange={(event) => setScenario(event.target.value as MockVisionScenario)}>
                    {mockVisionScenarios.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="brass-button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Publish immutable version ${draft.versionNumber}?`))
                      void mutate(`/api/vision-waypoint-versions/${draft.id}/publish`, {
                        method: "POST",
                        body: JSON.stringify({ scenario }),
                      });
                  }}
                >
                  Publish development package
                </button>
              </div>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                void mutate(`/api/vision-waypoints/${waypoint.id}/versions`, {
                  method: "POST",
                  body: JSON.stringify({
                    parentVersionId: waypoint.versions.find((version) => version.publishedAt)?.id,
                  }),
                })
              }
            >
              Create next draft from latest published
            </button>
          )}
        </section>
        <section className="vision-version-history">
          <h2>Immutable version history</h2>
          {waypoint.versions.map((version) => (
            <article key={version.id}>
              <strong>Version {version.versionNumber}</strong>
              <span>{version.lifecycleStatus.toLocaleLowerCase()}</span>
              {version.publication && (
                <>
                  <code>sha256:{version.publication.packageHash}</code>
                  <small>Package schema {version.publication.packageSchemaVersion}</small>
                </>
              )}
              {version.publishedAt && version.lifecycleStatus !== "DEPRECATED" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate(`/api/vision-waypoint-versions/${version.id}/deprecate`, { method: "POST" })
                  }
                >
                  Deprecate without breaking bindings
                </button>
              )}
            </article>
          ))}
        </section>
        <section>
          <h2>Story usage</h2>
          {waypoint.usage.length ? (
            <ul>
              {waypoint.usage.map((use) => (
                <li key={use.id}>
                  <strong>{use.storyTitle}</strong> · {use.blockTitle}
                </li>
              ))}
            </ul>
          ) : (
            <p>Not yet bound to a story block.</p>
          )}
        </section>
      </div>
    </main>
  );
}
