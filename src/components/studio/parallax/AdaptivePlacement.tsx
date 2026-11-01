"use client";
import { useState } from "react";
import type { SpatialDraft } from "@/parallax/authoring";
import {
  enableAdaptiveAuthoring,
  interpretPlacementPhrase,
  updateAdaptiveContent,
} from "@/parallax/adaptive-authoring";
import {
  placementPolicies,
  surfaceClasses,
  contextClasses,
  type SemanticRecipe,
  type AdaptiveContent,
} from "@/parallax/adaptive-contracts";
import type { SceneResolution } from "@/parallax/adaptive";
import styles from "./SpatialStudio.module.css";

export function AdaptivePlacement({
  draft,
  selectedId,
  mode,
  replace,
  resolution,
}: {
  draft: SpatialDraft;
  selectedId: string | null;
  mode: string;
  replace: (draft: SpatialDraft) => void;
  resolution: SceneResolution | null;
}) {
  const [phrase, setPhrase] = useState("Place a pirate map on a table near furniture away from the walkway");
  const [proposal, setProposal] = useState<ReturnType<typeof interpretPlacementPhrase> | null>(null);
  const [proposalBinding, setProposalBinding] = useState("");
  const [otherId, setOtherId] = useState("");
  const a = draft.content.adaptive;
  const recipe = a?.recipes.find((r) => r.entityId === selectedId);
  const discovery = a?.discovery.find((p) => p.entityId === selectedId);
  const apply = (patch: Partial<AdaptiveContent>) => {
    if (a) replace(updateAdaptiveContent(draft, { ...a, ...patch }));
  };
  const changeRecipe = (patch: Partial<SemanticRecipe>) => {
    if (a && recipe)
      apply({
        recipes: a.recipes.map((r) => (r.entityId === selectedId ? { ...r, ...patch } : r)),
        calibration: { ...a.calibration, maturity: "SEMANTIC", reviewReceiptId: undefined },
      });
  };
  const bound = JSON.stringify([draft, selectedId]);
  return (
    <section aria-label="Adaptive placement" className={styles.adaptive}>
      <h3>{a ? "Automatic placement" : "Manual placement"}</h3>
      {!a ? (
        <>
          <p>
            You choose the exact position. Surfaces snaps and aligns an object to a wall, floor or furniture. Switch to
            automatic placement to let each room find a safe match.
          </p>
          <button onClick={() => replace(enableAdaptiveAuthoring(draft))}>Author remotely</button>
          <small>Author remotely enables automatic placement for this scene.</small>
        </>
      ) : (
        <>
          <p>
            The room chooses a safe surface and aligns each object to it. Move changes surface preferences; Rotate and
            Scale adjust the object on that surface.
          </p>
          <label>
            Authoring approach
            <select
              value={a.authoringApproach}
              onChange={(e) => apply({ authoringApproach: e.target.value as AdaptiveContent["authoringApproach"] })}
            >
              <option value="REMOTE_SEMANTIC">Remote semantic placement</option>
              <option value="ON_SITE">On-site placement</option>
              <option value="EVIDENCE_CALIBRATED">Evidence-calibrated placement</option>
            </select>
          </label>
          <label>
            Placement lifetime
            <select
              aria-label="Placement policy"
              value={draft.content.placementPolicy}
              onChange={(e) => {
                const policy = e.target.value as SpatialDraft["content"]["placementPolicy"];
                const lifecycle =
                  policy === "ADAPTIVE_PER_CREW"
                    ? "CREW"
                    : policy === "ADAPTIVE_PER_RUN"
                      ? "RUN"
                      : policy === "ADAPTIVE_VARIANT"
                        ? "VARIANT"
                        : "DEFINITION";
                replace({
                  ...draft,
                  content: { ...draft.content, placementPolicy: policy, adaptive: { ...a, lifecycle } },
                });
              }}
            >
              {placementPolicies
                .filter(
                  (p) =>
                    p !== "FIXED" &&
                    (p !== "CALIBRATED" || ["CALIBRATED", "VERIFIED"].includes(a.calibration.maturity)),
                )
                .map((p) => (
                  <option key={p} value={p}>
                    {
                      {
                        ADAPTIVE_STICKY: "Keep this placement",
                        ADAPTIVE_PER_CREW: "One decision per crew",
                        ADAPTIVE_PER_RUN: "One decision per run",
                        ADAPTIVE_VARIANT: "Vary each replay",
                        PERSONAL: "Personal placement",
                        CALIBRATED: "Reviewed calibration",
                      }[p as Exclude<typeof p, "FIXED">]
                    }
                  </option>
                ))}
            </select>
          </label>
          <small>
            Decisions stay stable within their lifetime. Crew/run identity does not establish physical alignment between
            devices.
          </small>
          {recipe && (
            <>
              <label>
                Describe where it belongs
                <textarea
                  aria-label="Semantic placement goal"
                  value={phrase}
                  onChange={(e) => {
                    setPhrase(e.target.value);
                    setProposal(null);
                  }}
                  maxLength={500}
                />
              </label>
              <button
                onClick={() => {
                  setProposal(interpretPlacementPhrase(phrase, recipe.entityId));
                  setProposalBinding(bound);
                }}
              >
                Interpret supported phrase
              </button>
              <small>Uses explicit phrase rules. Configured AI assistance remains available below.</small>
              {proposal && (
                <div className={styles.notice}>
                  <p>{proposal.explanation}</p>
                  {proposal.status === "PROPOSED" && (
                    <>
                      <p>
                        Surfaces: {proposal.recipe.preferredSurfaces.join(", ")}. Near:{" "}
                        {proposal.recipe.preferredContext.join(", ") || "any safe context"}. Height:{" "}
                        {proposal.recipe.minimumHeightMeters}–{proposal.recipe.maximumHeightMeters} m.
                      </p>
                      <button
                        disabled={proposalBinding !== bound}
                        onClick={() => {
                          changeRecipe(proposal.recipe);
                          setProposal(null);
                        }}
                      >
                        Apply reviewed recipe
                      </button>
                    </>
                  )}
                </div>
              )}
              <label>
                Preferred surface
                <select
                  aria-label="Semantic surface"
                  value={recipe.preferredSurfaces[0]}
                  onChange={(e) =>
                    changeRecipe({
                      preferredSurfaces: [e.target.value as SemanticRecipe["preferredSurfaces"][number]],
                      orientation: "SURFACE",
                      alternateSurfaces: recipe.alternateSurfaces.filter((s) => s !== e.target.value),
                      minimumHeightMeters: e.target.value === "FLOOR" ? 0 : 0.4,
                      maximumHeightMeters: e.target.value === "FLOOR" ? 0.3 : 1.8,
                      preferredHeightMeters: e.target.value === "FLOOR" ? 0 : 0.75,
                    })
                  }
                >
                  {surfaceClasses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Near
                <select
                  aria-label="Nearby context"
                  value={recipe.preferredContext[0] ?? "ANY"}
                  onChange={(e) =>
                    changeRecipe({
                      preferredContext:
                        e.target.value === "ANY" ? [] : [e.target.value as SemanticRecipe["preferredContext"][number]],
                    })
                  }
                >
                  <option value="ANY">Any safe context</option>
                  {["FURNITURE", "ENTRANCE", "WINDOW"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <details open={mode !== "GUIDED"}>
                <summary>Placement constraints and alternatives</summary>
                <label>
                  Relative position
                  <select
                    value={recipe.relativePlacement}
                    onChange={(e) =>
                      changeRecipe({ relativePlacement: e.target.value as SemanticRecipe["relativePlacement"] })
                    }
                  >
                    {["CENTER", "EDGE", "LEFT", "RIGHT", "NEAR"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Orientation
                  <select
                    value={recipe.orientation}
                    onChange={(e) => changeRecipe({ orientation: e.target.value as SemanticRecipe["orientation"] })}
                  >
                    {["SURFACE", "UPRIGHT", "PLAYER_FACING"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Concealment
                  <select
                    value={recipe.concealment}
                    onChange={(e) => changeRecipe({ concealment: e.target.value as SemanticRecipe["concealment"] })}
                  >
                    <option>NONE</option>
                    <option>PARTIAL</option>
                  </select>
                </label>
                <fieldset>
                  <legend>Allowed substitute surfaces</legend>
                  {surfaceClasses
                    .filter((s) => !recipe.preferredSurfaces.includes(s))
                    .map((s) => (
                      <label key={s}>
                        <input
                          type="checkbox"
                          checked={recipe.alternateSurfaces.includes(s)}
                          onChange={(e) =>
                            changeRecipe({
                              alternateSurfaces: e.target.checked
                                ? [...recipe.alternateSurfaces, s]
                                : recipe.alternateSurfaces.filter((x) => x !== s),
                            })
                          }
                        />{" "}
                        {s}
                      </label>
                    ))}
                </fieldset>
                <fieldset>
                  <legend>Forbidden regions</legend>
                  {contextClasses.map((c) => (
                    <label key={c}>
                      <input
                        type="checkbox"
                        checked={recipe.forbiddenContext.includes(c)}
                        onChange={(e) =>
                          changeRecipe({
                            forbiddenContext: e.target.checked
                              ? [...recipe.forbiddenContext, c]
                              : recipe.forbiddenContext.filter((x) => x !== c),
                          })
                        }
                      />{" "}
                      {c}
                    </label>
                  ))}
                </fieldset>
                <small>Walkway, stairs, obstacle and private-region safety rejection is always enforced.</small>
                {(
                  [
                    ["minimumHeightMeters", "Minimum height (m)", 0, 20],
                    ["maximumHeightMeters", "Maximum height (m)", 0, 20],
                    ["preferredHeightMeters", "Preferred height (m)", 0, 20],
                    ["minimumClearanceMeters", "Clearance (m)", 0, 20],
                    ["maximumReachMeters", "Maximum reach (m)", 0, 20],
                    ["minimumVisibility", "Minimum visibility", 0, 1],
                    ["confidenceThreshold", "Confidence threshold", 0.5, 1],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      step="0.05"
                      min={min}
                      max={max}
                      value={recipe[key]}
                      onChange={(e) => changeRecipe({ [key]: Number(e.target.value) })}
                    />
                  </label>
                ))}
                <label>
                  Search region
                  <select
                    value={recipe.searchRegion}
                    onChange={(e) => changeRecipe({ searchRegion: e.target.value as SemanticRecipe["searchRegion"] })}
                  >
                    <option>CURRENT_ROOM</option>
                    <option>ENTRANCE_REGION</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={recipe.seatedRequired}
                    onChange={(e) => changeRecipe({ seatedRequired: e.target.checked })}
                  />{" "}
                  Reachable while seated
                </label>
                <label>
                  Placement fallback
                  <select
                    value={recipe.fallback}
                    onChange={(e) => changeRecipe({ fallback: e.target.value as SemanticRecipe["fallback"] })}
                  >
                    <option>GUIDED</option>
                    <option>ACCESSIBLE_DIRECT</option>
                  </select>
                </label>
              </details>
            </>
          )}
          <details open={mode !== "GUIDED"}>
            <summary>Variation and scene staging</summary>
            <label>
              Variation
              <select
                value={a.variation}
                onChange={(e) => apply({ variation: e.target.value as AdaptiveContent["variation"] })}
              >
                <option value="BEST_MATCH">Best semantic match</option>
                <option value="VALID_ALTERNATIVES">Vary among safe matches</option>
              </select>
            </label>
            <label>
              Replay variant
              <input
                type="number"
                min="0"
                max="10000"
                value={a.variant}
                onChange={(e) => apply({ variant: Number(e.target.value) })}
              />
            </label>
            <label>
              Relate selected object to
              <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
                <option value="">Choose another object</option>
                {a.recipes
                  .filter((r) => r.entityId !== selectedId)
                  .map((r) => (
                    <option key={r.entityId} value={r.entityId}>
                      {draft.content.entities.find((e) => e.id === r.entityId)?.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              disabled={!recipe || !otherId}
              onClick={() => {
                if (recipe)
                  apply({
                    relationships: [
                      ...a.relationships,
                      {
                        entityId: recipe.entityId,
                        otherEntityId: otherId,
                        minimumSeparationMeters: 0.6,
                        maximumSeparationMeters: 5,
                        sameSurface: false,
                        sightlineRequired: true,
                        visibility: "SIMULTANEOUS",
                      },
                    ],
                  });
              }}
            >
              Add scene relationship
            </button>
            {a.relationships.map((r, i) => (
              <fieldset key={i}>
                <legend>Relationship {i + 1}</legend>
                <p>
                  {draft.content.entities.find((e) => e.id === r.entityId)?.name} ↔{" "}
                  {draft.content.entities.find((e) => e.id === r.otherEntityId)?.name}
                </p>
                {(["minimumSeparationMeters", "maximumSeparationMeters"] as const).map((key) => (
                  <label key={key}>
                    {key === "minimumSeparationMeters" ? "Minimum separation" : "Maximum separation"}
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="20"
                      value={r[key]}
                      onChange={(e) =>
                        apply({
                          relationships: a.relationships.map((v, j) =>
                            i === j ? { ...v, [key]: Number(e.target.value) } : v,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  <input
                    type="checkbox"
                    checked={r.sameSurface}
                    onChange={(e) =>
                      apply({
                        relationships: a.relationships.map((v, j) =>
                          i === j ? { ...v, sameSurface: e.target.checked } : v,
                        ),
                      })
                    }
                  />{" "}
                  Same surface
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={r.sightlineRequired}
                    onChange={(e) =>
                      apply({
                        relationships: a.relationships.map((v, j) =>
                          i === j ? { ...v, sightlineRequired: e.target.checked } : v,
                        ),
                      })
                    }
                  />{" "}
                  Clear sightline
                </label>
                <label>
                  Visibility
                  <select
                    value={r.visibility}
                    onChange={(e) =>
                      apply({
                        relationships: a.relationships.map((v, j) =>
                          i === j ? { ...v, visibility: e.target.value as typeof r.visibility } : v,
                        ),
                        revealOrder:
                          e.target.value === "SEQUENTIAL"
                            ? [...new Set([...a.revealOrder, r.entityId, r.otherEntityId])]
                            : a.revealOrder,
                      })
                    }
                  >
                    <option>SIMULTANEOUS</option>
                    <option>SEQUENTIAL</option>
                  </select>
                </label>
                <button onClick={() => apply({ relationships: a.relationships.filter((_, j) => i !== j) })}>
                  Remove relationship {i + 1}
                </button>
              </fieldset>
            ))}
            <button
              onClick={() =>
                apply({
                  revealOrder: a.revealOrder.length ? [] : a.recipes.map((r) => r.entityId),
                  relationships: a.relationships.map((r) => ({
                    ...r,
                    visibility: a.revealOrder.length ? "SIMULTANEOUS" : "SEQUENTIAL",
                  })),
                })
              }
            >
              {a.revealOrder.length ? "Show scene simultaneously" : "Reveal objects in scene order"}
            </button>
            <p>
              {resolution?.status}: {resolution?.quality.replaceAll("_", " ")}.{" "}
              {resolution?.exhausted ? "Search budget reached; use the authored fallback." : "Bounded staging search."}
            </p>
            {mode !== "GUIDED" && resolution && (
              <ul>
                {[
                  ...new Set(
                    resolution.diagnostics.map(
                      (d) =>
                        `${draft.content.entities.find((e) => e.id === d.entityId)?.name}: ${d.constraints.join(", ")}`,
                    ),
                  ),
                ]
                  .slice(0, 12)
                  .map((s) => (
                    <li key={s}>{s}</li>
                  ))}
              </ul>
            )}
          </details>
          {discovery && (
            <details open={mode !== "GUIDED"}>
              <summary>Discovery assistance</summary>
              <p>Show me and accessible direct mode are always available. Normal passage controls own completion.</p>
              <label>
                Expected search seconds
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={discovery.expectedSearchSeconds}
                  onChange={(e) =>
                    apply({
                      discovery: a.discovery.map((p) =>
                        p.entityId === selectedId ? { ...p, expectedSearchSeconds: Number(e.target.value) } : p,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Maximum unguided seconds
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={discovery.maximumUnguidedSeconds}
                  onChange={(e) =>
                    apply({
                      discovery: a.discovery.map((p) =>
                        p.entityId === selectedId ? { ...p, maximumUnguidedSeconds: Number(e.target.value) } : p,
                      ),
                    })
                  }
                />
              </label>
              {discovery.stages.map((s, i) => (
                <label key={i}>
                  Hint {i + 1}
                  <input
                    aria-label={`Hint ${i + 1} seconds`}
                    type="number"
                    min="0"
                    max="600"
                    value={s.afterSeconds}
                    onChange={(e) =>
                      apply({
                        discovery: a.discovery.map((p) =>
                          p.entityId === selectedId
                            ? {
                                ...p,
                                stages: p.stages.map((v, j) =>
                                  i === j ? { ...v, afterSeconds: Number(e.target.value) } : v,
                                ),
                              }
                            : p,
                        ),
                      })
                    }
                  />
                  <textarea
                    aria-label={`Hint ${i + 1} message`}
                    value={s.message}
                    onChange={(e) =>
                      apply({
                        discovery: a.discovery.map((p) =>
                          p.entityId === selectedId
                            ? {
                                ...p,
                                stages: p.stages.map((v, j) => (i === j ? { ...v, message: e.target.value } : v)),
                              }
                            : p,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Alternate completion
                <select
                  value={discovery.alternateCompletion}
                  onChange={(e) =>
                    apply({
                      discovery: a.discovery.map((p) =>
                        p.entityId === selectedId
                          ? { ...p, alternateCompletion: e.target.value as typeof p.alternateCompletion }
                          : p,
                      ),
                    })
                  }
                >
                  <option>PLAYER_CONFIRMATION</option>
                  <option>CAPTAIN_CONFIRMATION</option>
                </select>
              </label>
            </details>
          )}
          <details>
            <summary>Calibration and field quality</summary>
            <p>
              Maturity: {a.calibration.maturity.replaceAll("_", " ")}. Physical reliability is not established by
              simulation.
            </p>
            <label>
              <input
                type="checkbox"
                checked={a.calibration.enabled}
                onChange={(e) => apply({ calibration: { ...a.calibration, enabled: e.target.checked } })}
              />{" "}
              Offer optional metadata field observations
            </label>
            <label>
              Retention days
              <input
                type="number"
                min="1"
                max="30"
                value={a.calibration.retentionDays}
                onChange={(e) => apply({ calibration: { ...a.calibration, retentionDays: Number(e.target.value) } })}
              />
            </label>
            <p>
              Automatic image upload is unavailable. Only consented surface/quality categories are accepted; no room
              imagery or coordinates.
            </p>
          </details>
          {mode === "ENGINEERING" && (
            <details>
              <summary>Typed recipe and resolution evidence</summary>
              <pre className={styles.recipe}>{JSON.stringify({ adaptive: a, receipt: resolution }, null, 2)}</pre>
            </details>
          )}
        </>
      )}
    </section>
  );
}
