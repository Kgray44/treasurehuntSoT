"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RecordingReview } from "@/components/studio/RecordingReview";
import { StudioCapturePanel } from "@/components/studio/StudioCapturePanel";
import { VisionRegionEditor } from "@/components/studio/VisionRegionEditor";
import type { AuthoringMutate, StudioAuthoringAggregate } from "@/components/studio/vision-authoring-types";
import { selectCapturePlatformAdapter } from "@/vision/capture-adapters";
import { waypointTypes } from "@/vision/domain";

const steps = [
  "Purpose",
  "Story Intent",
  "Companion",
  "Record Target",
  "Accepted Player Area",
  "Boundaries",
  "Similar Wrong Places",
  "Important Visual Regions",
  "Data Health",
  "Build Preparation",
  "Test Plan",
  "Review",
] as const;

type Waypoint = {
  id: string;
  name: string;
  description: string;
  type: string;
  sharingScope: string;
  locationTags: string[];
  versions: Array<{
    id: string;
    versionNumber: number;
    lifecycleStatus: string;
    publishedAt: string | null;
    deprecatedAt: string | null;
    publication: { packageHash: string; packageSchemaVersion: number; status: string } | null;
  }>;
  usage: Array<{ id: string; storyTitle: string; blockTitle: string; waypointVersionId: string }>;
};

function defaultData(step: number, aggregate: StudioAuthoringAggregate): Record<string, unknown> {
  const stored =
    aggregate.authoring.steps[
      [
        "purpose",
        "storyIntent",
        "companion",
        "recordTarget",
        "acceptedArea",
        "boundaries",
        "wrongPlaces",
        "visualRegions",
        "dataHealth",
        "buildPreparation",
        "testPlan",
        "review",
      ][step - 1]
    ];
  if (stored) return stored;
  if (step === 1)
    return {
      summary: aggregate.waypoint.description || "Recognize this reusable story location.",
      successDefinition: "The player is inside the accepted area and the durable target detail is visible.",
      waypointType: aggregate.waypoint.type,
      verificationProfile: aggregate.version.verificationProfile,
      buildPreference: "LOCAL",
    };
  if (step === 2)
    return {
      playerTask: "Find and inspect the described landmark.",
      narrativeImportance: "This confirms the crew reached the intended story location.",
      failureConsequence: "Do not advance; offer a retry and Captain fallback.",
    };
  if (step === 3) return { privacyAcknowledged: false, selectedPath: "NONE", lastConnectionState: "Not checked" };
  if (step === 4)
    return {
      guidanceNotes: "Circle the target slowly and include stable surrounding context.",
      coveragePlan: "BALANCED",
      representativeAssetId: null,
    };
  if (step === 5)
    return {
      instructions: "Walk the positions from which a player should be accepted.",
      provisionalAccuracyAcknowledged: false,
    };
  if (step === 6)
    return {
      instructions: "Mark where acceptance must end and explain why.",
      reasons: ["The target is no longer clearly visible."],
    };
  if (step === 7)
    return {
      confusionNotes: "Capture the strongest visually similar wrong places.",
      storyCriticalRequirementAcknowledged: aggregate.version.verificationProfile !== "STORY_CRITICAL",
    };
  if (step === 8)
    return {
      targetDescription: "Mark durable target detail and stable context.",
      ignoreDescription: "Ignore water, sky, players, UI, particles, and transient lighting.",
    };
  if (step === 9) return { reviewedAt: null, acknowledgedWarningCodes: [] };
  if (step === 10) return { executionTarget: "LOCAL", rawMediaConsent: false };
  if (step === 11)
    return {
      notes: "Include a correct view, wrong place, boundary, and environmental variation.",
      acceptanceNotes: "Locked tests must remain outside tuning decisions.",
    };
  return { confirmCaptureConsent: false, confirmNoModelYet: false, confirmLockedTests: false };
}

function PoseRegionEditor({
  aggregate,
  mutate,
  classification,
}: {
  aggregate: StudioAuthoringAggregate;
  mutate: AuthoringMutate;
  classification: "ACCEPTED" | "BOUNDARY" | "EXCLUDED";
}) {
  const [centerX, setCenterX] = useState(0);
  const [centerZ, setCenterZ] = useState(0);
  const [radius, setRadius] = useState(3);
  const [facing, setFacing] = useState(0);
  const [tolerance, setTolerance] = useState(90);
  const [orientationRules, setOrientationRules] = useState("Any comfortable facing is accepted.");
  const [visibilityRules, setVisibilityRules] = useState("The target must remain clearly visible.");
  const regions = aggregate.poseRegions.filter((region) => region.classification === classification);
  return (
    <section className="pose-editor">
      <header>
        <div>
          <p className="eyebrow">Plain-rule provisional editor</p>
          <h3>{classification === "ACCEPTED" ? "Accepted player regions" : "Boundary and excluded regions"}</h3>
        </div>
        <span>Not surveyed 3D geometry</span>
      </header>
      <p>Coordinates are creator-relative planning values. They do not claim game-world localization precision.</p>
      <div className="pose-input-grid">
        <label>
          <span>Center east/west</span>
          <input type="number" value={centerX} onChange={(event) => setCenterX(Number(event.target.value))} />
        </label>
        <label>
          <span>Center forward/back</span>
          <input type="number" value={centerZ} onChange={(event) => setCenterZ(Number(event.target.value))} />
        </label>
        <label>
          <span>Radius (creator units)</span>
          <input type="number" min={0.1} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
        </label>
        <label>
          <span>Facing degrees</span>
          <input
            type="number"
            min={0}
            max={360}
            value={facing}
            onChange={(event) => setFacing(Number(event.target.value))}
          />
        </label>
        <label>
          <span>Facing tolerance</span>
          <input
            type="number"
            min={0}
            max={180}
            value={tolerance}
            onChange={(event) => setTolerance(Number(event.target.value))}
          />
        </label>
      </div>
      <label>
        <span>Orientation rule</span>
        <input value={orientationRules} onChange={(event) => setOrientationRules(event.target.value)} />
      </label>
      <label>
        <span>Visibility rule</span>
        <input value={visibilityRules} onChange={(event) => setVisibilityRules(event.target.value)} />
      </label>
      <button
        type="button"
        onClick={() =>
          void mutate({
            operation: "UPSERT_POSE_REGION",
            classification,
            parameters: { centerX, centerZ, radius, facingDegrees: facing, toleranceDegrees: tolerance },
            orientationRules,
            visibilityRules,
          })
        }
      >
        Add {classification.toLocaleLowerCase()} region
      </button>
      <ul className="authoring-record-list">
        {regions.map((region) => (
          <li key={region.id}>
            <span>
              {String(region.parameters.radius)} unit radius at {String(region.parameters.centerX)},{" "}
              {String(region.parameters.centerZ)}
            </span>
            <button type="button" onClick={() => void mutate({ operation: "DELETE_POSE_REGION", id: region.id })}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HardNegativeEditor({ aggregate, mutate }: { aggregate: StudioAuthoringAggregate; mutate: AuthoringMutate }) {
  const assets = aggregate.assets.filter((asset) => !asset.deletedAt && asset.isUsable);
  const [name, setName] = useState("Nearby look-alike");
  const [classification, setClassification] = useState("NEARBY");
  const [reason, setReason] = useState("Similar silhouette, but the surrounding structure is different.");
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  return (
    <section className="negative-editor">
      <h3>Wrong-place profiles</h3>
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>Kind</span>
          <select value={classification} onChange={(event) => setClassification(event.target.value)}>
            <option value="NEARBY">Nearby confuser</option>
            <option value="DISTANT">Distant confuser</option>
            <option value="INVALID_POSE">Invalid pose</option>
          </select>
        </label>
      </div>
      <label>
        <span>Why a player could confuse it</span>
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <label>
        <span>Evidence recording</span>
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
          <option value="">Select recording</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.label ?? asset.id}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!assetId}
        onClick={() =>
          void mutate({ operation: "UPSERT_HARD_NEGATIVE", name, classification, reason, assetIds: [assetId] })
        }
      >
        Add wrong-place profile
      </button>
      <ul className="authoring-record-list">
        {aggregate.hardNegatives.map((negative) => (
          <li key={negative.id}>
            <span>
              <strong>{negative.name}</strong> · {negative.classification.toLocaleLowerCase()}
              <small>{String(negative.metadata.reason ?? "")}</small>
            </span>
            <button type="button" onClick={() => void mutate({ operation: "DELETE_HARD_NEGATIVE", id: negative.id })}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TestCaseEditor({ aggregate, mutate }: { aggregate: StudioAuthoringAggregate; mutate: AuthoringMutate }) {
  const assets = aggregate.assets.filter((asset) => !asset.deletedAt && asset.isUsable);
  const [name, setName] = useState("Correct target from accepted area");
  const [testType, setTestType] = useState("POSITIVE");
  const [expectedResult, setExpectedResult] = useState("MATCH");
  const [instructions, setInstructions] = useState("Use this evidence without changing authoring decisions.");
  const [environment, setEnvironment] = useState("Daylight, ordinary weather, UI excluded.");
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  return (
    <section className="test-editor">
      <h3>Authored test cases</h3>
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>Test type</span>
          <select value={testType} onChange={(event) => setTestType(event.target.value)}>
            <option>POSITIVE</option>
            <option>NEGATIVE</option>
            <option>BOUNDARY</option>
            <option>ENVIRONMENT</option>
          </select>
        </label>
        <label>
          <span>Expected</span>
          <select value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)}>
            <option>MATCH</option>
            <option>NO_MATCH</option>
            <option>INSUFFICIENT</option>
          </select>
        </label>
      </div>
      <label>
        <span>Instructions</span>
        <textarea rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
      </label>
      <label>
        <span>Environment</span>
        <input value={environment} onChange={(event) => setEnvironment(event.target.value)} />
      </label>
      <label>
        <span>Evidence</span>
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
          <option value="">Select recording</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.label ?? asset.id}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!assetId}
        onClick={() =>
          void mutate({
            operation: "UPSERT_TEST",
            name,
            testType,
            expectedResult,
            instructions,
            assetIds: [assetId],
            environment,
          })
        }
      >
        Add test case
      </button>
      <ul className="authoring-record-list">
        {aggregate.tests.map((test) => (
          <li key={test.id}>
            <span>
              <strong>{test.name}</strong> · {test.testType.toLocaleLowerCase()} →{" "}
              {test.expectedResult.toLocaleLowerCase()}
              <small>{test.lockedAt ? "Locked away from authoring" : "Editable validation evidence"}</small>
            </span>
            <div>
              {!test.lockedAt && (
                <button type="button" onClick={() => void mutate({ operation: "LOCK_TEST", id: test.id })}>
                  Lock test
                </button>
              )}
              {!test.lockedAt && (
                <button type="button" onClick={() => void mutate({ operation: "DELETE_TEST", id: test.id })}>
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VisionWaypointEditor({ waypointId, authenticated }: { waypointId: string; authenticated: boolean }) {
  const adapter = useMemo(() => selectCapturePlatformAdapter(), []);
  const [waypoint, setWaypoint] = useState<Waypoint | null>(null);
  const [aggregate, setAggregate] = useState<StudioAuthoringAggregate | null>(null);
  const [csrf, setCsrf] = useState("");
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [buildProgress, setBuildProgress] = useState<{
    buildId: string;
    status: string;
    stage: string;
    progress: number | null;
  } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/vision-waypoints/${waypointId}`, { cache: "no-store" });
    const body = (await response.json()) as { waypoint?: Waypoint; csrfToken?: string; error?: string };
    if (!response.ok || !body.waypoint) throw new Error(body.error ?? "The waypoint could not be opened.");
    setWaypoint(body.waypoint);
    setCsrf(body.csrfToken ?? "");
    const draft = body.waypoint.versions.find((version) => !version.publishedAt && !version.deprecatedAt);
    if (!draft) return setAggregate(null);
    const authoringResponse = await fetch(`/api/vision-waypoint-versions/${draft.id}/authoring`, { cache: "no-store" });
    const authoringBody = (await authoringResponse.json()) as {
      authoring?: StudioAuthoringAggregate;
      csrfToken?: string;
      error?: string;
    };
    if (!authoringResponse.ok || !authoringBody.authoring)
      throw new Error(authoringBody.error ?? "Authoring data could not be opened.");
    setAggregate(authoringBody.authoring);
    setCsrf(authoringBody.csrfToken ?? body.csrfToken ?? "");
    setForm(defaultData(authoringBody.authoring.version.currentWizardStep, authoringBody.authoring));
  }, [waypointId]);

  useEffect(() => {
    if (authenticated)
      queueMicrotask(
        () =>
          void load().catch((cause) => setMessage(cause instanceof Error ? cause.message : "Waypoint unavailable.")),
      );
  }, [authenticated, load]);

  const mutate: AuthoringMutate = useCallback(
    async (operation) => {
      if (!aggregate) return false;
      setBusy(true);
      setMessage("");
      try {
        const response = await fetch(`/api/vision-waypoint-versions/${aggregate.version.id}/authoring`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ ...operation, expectedRevision: aggregate.version.authoringRevision }),
        });
        const body = (await response.json()) as { authoring?: StudioAuthoringAggregate; error?: string; code?: string };
        if (!response.ok || !body.authoring) {
          if (response.status === 409) await load();
          throw new Error(body.error ?? "The draft could not be saved.");
        }
        setAggregate(body.authoring);
        setForm(defaultData(body.authoring.version.currentWizardStep, body.authoring));
        setMessage("Saved to the authoritative waypoint draft.");
        return true;
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "The draft could not be saved.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [aggregate, csrf, load],
  );

  useEffect(() => {
    if (!aggregate || !dirty || busy || aggregate.version.lifecycleStatus !== "DRAFT") return;
    const timer = window.setTimeout(() => {
      setAutoSaving(true);
      void mutate({
        operation: "SAVE_STEP",
        step: aggregate.version.currentWizardStep,
        complete: aggregate.authoring.completedSteps.includes(aggregate.version.currentWizardStep),
        data: form,
      }).then((saved) => {
        if (saved) setDirty(false);
        setAutoSaving(false);
      });
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [aggregate, busy, dirty, form, mutate]);

  function field(name: string, value: unknown) {
    setForm((current) => ({ ...current, [name]: value }));
    setDirty(true);
    setMessage("Unsaved changes; autosave is queued.");
  }
  async function openStep(step: number) {
    if (!aggregate || step === aggregate.version.currentWizardStep) return;
    const saved = await mutate({
      operation: "SET_NAVIGATION",
      mode: aggregate.version.authoringMode,
      currentStep: step,
    });
    if (saved) setForm(defaultData(step, { ...aggregate, version: { ...aggregate.version, currentWizardStep: step } }));
  }
  async function saveStep() {
    if (!aggregate) return;
    const saved = await mutate({
      operation: "SAVE_STEP",
      step: aggregate.version.currentWizardStep,
      complete: true,
      data: form,
    });
    if (saved) setDirty(false);
  }
  async function createNextDraft() {
    if (!waypoint) return;
    setBusy(true);
    const parentVersionId = waypoint.versions.find((version) => version.publishedAt)?.id;
    const response = await fetch(`/api/vision-waypoints/${waypoint.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ parentVersionId }),
    });
    setBusy(false);
    if (response.ok) await load();
    else setMessage(((await response.json()) as { error?: string }).error ?? "Draft creation failed.");
  }
  async function persistBuildUpdate(buildId: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/vision-build-jobs/${buildId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      throw new Error(((await response.json()) as { error?: string }).error ?? "Build state could not be persisted.");
  }

  async function prepareBuild() {
    if (!aggregate) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/vision-waypoint-versions/${aggregate.version.id}/prepare-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ expectedRevision: aggregate.version.authoringRevision }),
      });
      const body = (await response.json()) as { error?: string; inputHash?: string; jobId?: string };
      if (!response.ok || !body.jobId || !body.inputHash) throw new Error(body.error ?? "Build preparation failed.");
      const jobResponse = await fetch(`/api/vision-build-jobs/${body.jobId}`, { cache: "no-store" });
      const job = (await jobResponse.json()) as {
        error?: string;
        buildInput?: Record<string, unknown>;
        createdAt?: string;
      };
      if (!jobResponse.ok || !job.buildInput) throw new Error(job.error ?? "Persisted BuildInput could not be read.");
      const capabilities = await adapter.getVisionEngineCapabilities();
      const configured = capabilities.configured as Record<string, unknown> | undefined;
      if (capabilities.buildEngine !== true || capabilities.shadowModeOnly !== true || configured?.buildEngine !== true)
        throw new Error("The connected Companion does not expose the governed B-4 shadow build engine.");
      await adapter.startVisionBuild({
        buildId: body.jobId,
        inputHash: body.inputHash,
        buildInput: job.buildInput,
        builtAt: job.createdAt ?? new Date().toISOString(),
        provider: "DIRECTML_DETECTED",
        allowProviderFallback: true,
      });
      let lastStage = "QUEUED";
      let terminal: Record<string, unknown> | null = null;
      while (!terminal) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        const local = await adapter.getVisionBuildStatus(body.jobId);
        const status = String(local.status ?? "RUNNING");
        const stage = String(local.processingStage ?? "QUEUED");
        const progress = typeof local.progress === "number" ? local.progress : null;
        setBuildProgress({ buildId: body.jobId, status, stage, progress });
        if (stage !== lastStage && status === "RUNNING") {
          await persistBuildUpdate(body.jobId, {
            event: "PROGRESS",
            stage,
            progress,
            messageCode: `COMPANION_${stage}`,
            detail: { source: "LOCAL_COMPANION" },
          });
          lastStage = stage;
        }
        if (["COMPLETED", "FAILED", "CANCELLED"].includes(status)) terminal = local;
      }
      if (terminal.status === "COMPLETED") {
        const report = terminal.report as Record<string, unknown> | undefined;
        const packageArtifact = report?.packageArtifact as Record<string, unknown> | undefined;
        if (!report || !packageArtifact) throw new Error("Companion completed without immutable package metadata.");
        const persistedReport = { ...report };
        delete persistedReport.packageArtifact;
        await persistBuildUpdate(body.jobId, { event: "COMPLETED", report: persistedReport, packageArtifact });
        const certification = persistedReport.certification as Record<string, unknown> | undefined;
        setMessage(
          `Local verification package built and persisted. Reliability: ${String(certification?.reliabilityGrade ?? "UNSAFE")}. Shadow mode only; automatic progression remains disabled.`,
        );
      } else if (terminal.status === "CANCELLED") {
        await persistBuildUpdate(body.jobId, {
          event: "CANCELLED",
          report: (terminal.failure as Record<string, unknown>) ?? {},
        });
        setMessage("The local build was cancelled without publishing a package.");
      } else {
        const failure = (terminal.failure as Record<string, unknown>) ?? {};
        await persistBuildUpdate(body.jobId, {
          event: "FAILED",
          failureCode: String(failure.failureCode ?? "INTERNAL_BUILD_ERROR"),
          report: failure,
        });
        throw new Error(`Local build failed: ${String(failure.failureCode ?? "INTERNAL_BUILD_ERROR")}.`);
      }
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Local verification build failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runShadowScan() {
    if (!aggregate) return;
    const job = aggregate.buildJobs.find((candidate) => candidate.status === "COMPLETED" && candidate.packageId);
    if (!job?.packageId) return setMessage("Build a runtime package before running a shadow scan.");
    setBusy(true);
    setMessage("Capturing a five-second shadow scan. Story progression remains disabled.");
    const attemptId = `att_${crypto.randomUUID()}`;
    const stageToken = `stage_${crypto.randomUUID()}`;
    try {
      const captureStatus = await adapter.getStatus();
      if (!captureStatus.target)
        throw new Error("Select the Sea of Thieves window in Companion before the shadow scan.");
      await adapter.armVisionRuntime({
        attemptId,
        packageId: job.packageId,
        waypointVersionId: aggregate.version.id,
        stageToken,
        expectedStageToken: stageToken,
        provider: "DIRECTML_DETECTED",
        allowProviderFallback: true,
        timeoutMs: 8_000,
        checkpointContext: {},
      });
      const scan = await adapter.beginPlayerScan({
        requestId: `request_${crypto.randomUUID()}`,
        attemptId,
        durationMs: 5_000,
        sampleFps: 10,
        minimumFrames: 6,
      });
      await new Promise((resolve) => window.setTimeout(resolve, 5_100));
      const capture = await adapter.stopPlayerScan(scan.sessionId);
      const result = capture.verificationResult as Record<string, unknown> | null;
      if (!result) throw new Error("The scan completed without a shadow verification result.");
      const persisted = {
        attemptId,
        waypointId: aggregate.waypoint.id,
        waypointVersionId: aggregate.version.id,
        packageId: job.packageId,
        packageHash: job.packageHash,
        stageToken,
        result: result.result,
        guidanceCode: result.guidanceCode ?? null,
        failedGates: result.failedGates ?? [],
        evidenceDigest: result.evidenceDigest ?? null,
        engineVersion: result.engineVersion,
        modelBundleVersion: result.modelBundleVersion,
        provider: result.provider ?? "CPU_CLASSICAL",
        providerFallbackUsed: result.providerFallbackUsed === true,
        capturedFrameCount: result.capturedFrameCount ?? 0,
        usableFrameCount: result.usableFrameCount ?? 0,
        passingFrameCount: result.passingFrameCount ?? 0,
        durationMs: result.durationMs ?? 0,
        shadowMode: true,
        automaticProgression: false,
        diagnostics: result.diagnostics ?? {},
      };
      const response = await fetch("/api/vision-shadow-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(persisted),
      });
      if (!response.ok)
        throw new Error(((await response.json()) as { error?: string }).error ?? "Shadow result was not persisted.");
      setMessage(
        `Shadow result persisted: ${String(result.result).replaceAll("_", " ")}. Guidance: ${String(result.guidanceCode ?? "none")}. No story event was emitted.`,
      );
    } catch (cause) {
      await adapter.disarmVisionRuntime(attemptId).catch(() => {});
      setMessage(cause instanceof Error ? cause.message : "Shadow scan failed.");
    } finally {
      setBusy(false);
    }
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
  if (!aggregate)
    return (
      <main className="vision-editor">
        <header>
          <div>
            <Link href="/studio/vision-waypoints">← Vision Waypoints</Link>
            <h1>{waypoint.name}</h1>
            <p>No editable draft exists. Published versions remain immutable.</p>
          </div>
        </header>
        <section className="no-draft-card">
          <button className="brass-button" disabled={busy} onClick={() => void createNextDraft()}>
            Create next draft from latest published version
          </button>
          <VersionHistory waypoint={waypoint} />
        </section>
      </main>
    );

  const step = aggregate.version.currentWizardStep;
  const readOnly = aggregate.version.lifecycleStatus !== "DRAFT";
  return (
    <main className="vision-editor vision-authoring">
      <header>
        <div>
          <Link href="/studio/vision-waypoints">← Vision Waypoints</Link>
          <p className="eyebrow">
            {aggregate.waypoint.type.replaceAll("_", " ")} · Draft v{aggregate.version.versionNumber}
          </p>
          <h1>{aggregate.waypoint.name}</h1>
          <p>{aggregate.waypoint.description}</p>
        </div>
        <div className="authoring-status">
          <span className={`health-badge ${aggregate.dataHealth.readyToPrepare ? "ready" : "blocked"}`}>
            {aggregate.dataHealth.readyToPrepare ? "Ready to prepare" : `${aggregate.dataHealth.blockerCount} blockers`}
          </span>
          <span>
            {autoSaving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"} · Revision{" "}
            {aggregate.version.authoringRevision}
          </span>
        </div>
      </header>
      {message && (
        <p className={message.startsWith("Saved") ? "captain-notice" : "studio-error"} role="status">
          {message}
        </p>
      )}
      {aggregate.buildJobs.some((job) => job.status === "COMPLETED" && job.packageId) && (
        <section className="review-grid" aria-label="B-4 shadow reliability controls">
          <section>
            <p className="eyebrow">B-4 reliability</p>
            <h2>{aggregate.buildJobs[0].reliabilityGrade?.replaceAll("_", " ") ?? "Unrated"}</h2>
            <p>Immutable package {aggregate.buildJobs[0].packageId}</p>
          </section>
          <section>
            <p>
              Run the exact production runtime against a live selected-window scan. The result is persisted for analysis
              only.
            </p>
            <button type="button" className="brass-button" disabled={busy} onClick={() => void runShadowScan()}>
              Run five-second shadow scan
            </button>
            <p>Automatic progression: disabled</p>
          </section>
        </section>
      )}
      <section className="authoring-shell">
        <aside className="wizard-sidebar">
          <label>
            <span>Authoring mode</span>
            <select
              value={aggregate.version.authoringMode}
              disabled={readOnly || busy}
              onChange={(event) =>
                void mutate({ operation: "SET_NAVIGATION", mode: event.target.value, currentStep: step })
              }
            >
              <option value="GUIDED">Guided</option>
              <option value="DETAILED">Detailed</option>
              <option value="ENGINEERING">Engineering</option>
            </select>
          </label>
          <p>
            {aggregate.version.authoringMode === "GUIDED"
              ? "Plain-language essentials."
              : aggregate.version.authoringMode === "DETAILED"
                ? "Adds evidence and configuration detail."
                : "Shows hashes, schemas, and persisted boundary data."}
          </p>
          <progress value={aggregate.authoring.completedSteps.length} max={12} aria-label="Wizard completion" />
          <ol>
            {steps.map((name, index) => {
              const number = index + 1;
              const complete = aggregate.authoring.completedSteps.includes(number);
              return (
                <li key={name} className={number === step ? "current" : complete ? "complete" : ""}>
                  <button
                    type="button"
                    disabled={busy || dirty}
                    title={dirty ? "Wait for the queued autosave before changing steps." : undefined}
                    aria-current={number === step ? "step" : undefined}
                    onClick={() => void openStep(number)}
                  >
                    <span>{complete ? "✓" : number}</span>
                    {name}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
        <section className="wizard-content">
          <header>
            <div>
              <p className="eyebrow">Step {step} of 12</p>
              <h2>{steps[step - 1]}</h2>
            </div>
            <span>
              {readOnly ? aggregate.version.lifecycleStatus.toLocaleLowerCase().replaceAll("_", " ") : "Editable draft"}
            </span>
          </header>
          {step === 1 && (
            <>
              <label>
                <span>What this waypoint proves</span>
                <textarea
                  rows={4}
                  value={String(form.summary ?? "")}
                  onChange={(event) => field("summary", event.target.value)}
                />
              </label>
              <label>
                <span>Success in plain language</span>
                <textarea
                  rows={3}
                  value={String(form.successDefinition ?? "")}
                  onChange={(event) => field("successDefinition", event.target.value)}
                />
              </label>
              <div className="form-grid">
                <label>
                  <span>Waypoint type</span>
                  <select
                    value={String(form.waypointType ?? aggregate.waypoint.type)}
                    onChange={(event) => field("waypointType", event.target.value)}
                  >
                    {waypointTypes.map((type) => (
                      <option value={type} key={type}>
                        {type.toLocaleLowerCase().replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Verification profile</span>
                  <select
                    value={String(form.verificationProfile ?? "BALANCED")}
                    onChange={(event) => field("verificationProfile", event.target.value)}
                  >
                    <option>BALANCED</option>
                    <option>STRICT</option>
                    <option>STORY_CRITICAL</option>
                    <option>CUSTOM</option>
                  </select>
                </label>
                <label>
                  <span>Build preference</span>
                  <select
                    value={String(form.buildPreference ?? "LOCAL")}
                    onChange={(event) => field("buildPreference", event.target.value)}
                  >
                    <option>LOCAL</option>
                    <option>CLOUD_ASSISTED</option>
                    <option>UNDECIDED</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <label>
                <span>What the player is trying to do</span>
                <textarea
                  rows={3}
                  value={String(form.playerTask ?? "")}
                  onChange={(event) => field("playerTask", event.target.value)}
                />
              </label>
              <label>
                <span>Why success matters to the story</span>
                <textarea
                  rows={3}
                  value={String(form.narrativeImportance ?? "")}
                  onChange={(event) => field("narrativeImportance", event.target.value)}
                />
              </label>
              <label>
                <span>What should happen when evidence is insufficient</span>
                <textarea
                  rows={3}
                  value={String(form.failureConsequence ?? "")}
                  onChange={(event) => field("failureConsequence", event.target.value)}
                />
              </label>
            </>
          )}
          {step === 3 && (
            <>
              <div className="plain-callout">
                <h3>One Companion, two paths</h3>
                <p>
                  Desktop uses the restricted Electron bridge. Browser uses an approved loopback pairing. Both call the
                  same B-2 coordinator and capture core.
                </p>
                <Link href="/vision-companion" target="_blank">
                  Open Companion connection and privacy center
                </Link>
              </div>
              <label>
                <span>Connection path</span>
                <select
                  value={String(form.selectedPath ?? "NONE")}
                  onChange={(event) => field("selectedPath", event.target.value)}
                >
                  <option value="NONE">Not connected yet</option>
                  <option value="DESKTOP">Integrated desktop</option>
                  <option value="BROWSER_PAIRED">Paired browser</option>
                </select>
              </label>
              <label>
                <span>Last observed state</span>
                <input
                  value={String(form.lastConnectionState ?? "")}
                  onChange={(event) => field("lastConnectionState", event.target.value)}
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.privacyAcknowledged)}
                  onChange={(event) => field("privacyAcknowledged", event.target.checked)}
                />
                <span>I understand which window is captured and where creator recordings are retained.</span>
              </label>
            </>
          )}
          {step === 4 && (
            <div id="studio-capture">
              <label>
                <span>Coverage plan</span>
                <select
                  value={String(form.coveragePlan ?? "BALANCED")}
                  onChange={(event) => field("coveragePlan", event.target.value)}
                >
                  <option>QUICK</option>
                  <option>BALANCED</option>
                  <option>THOROUGH</option>
                </select>
              </label>
              <label>
                <span>Recording guidance</span>
                <textarea
                  rows={3}
                  value={String(form.guidanceNotes ?? "")}
                  onChange={(event) => field("guidanceNotes", event.target.value)}
                />
              </label>
              <StudioCapturePanel
                adapter={adapter}
                versionId={aggregate.version.id}
                csrfToken={csrf}
                purpose="TARGET_REFERENCE"
                label="Target reference"
                onChanged={load}
              />
              <RecordingReview aggregate={aggregate} adapter={adapter} csrfToken={csrf} mutate={mutate} reload={load} />
            </div>
          )}
          {step === 5 && (
            <>
              <label>
                <span>Guided walk instructions</span>
                <textarea
                  rows={3}
                  value={String(form.instructions ?? "")}
                  onChange={(event) => field("instructions", event.target.value)}
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.provisionalAccuracyAcknowledged)}
                  onChange={(event) => field("provisionalAccuracyAcknowledged", event.target.checked)}
                />
                <span>I understand these are provisional creator-relative regions, not surveyed game coordinates.</span>
              </label>
              <StudioCapturePanel
                adapter={adapter}
                versionId={aggregate.version.id}
                csrfToken={csrf}
                purpose="ACCEPTED_AREA_WALK"
                label="Accepted area walk"
                onChanged={load}
              />
              <PoseRegionEditor aggregate={aggregate} mutate={mutate} classification="ACCEPTED" />
            </>
          )}
          {step === 6 && (
            <>
              <label>
                <span>Boundary instructions</span>
                <textarea
                  rows={3}
                  value={String(form.instructions ?? "")}
                  onChange={(event) => field("instructions", event.target.value)}
                />
              </label>
              <label>
                <span>Reasons, one per line</span>
                <textarea
                  rows={4}
                  value={Array.isArray(form.reasons) ? form.reasons.join("\n") : ""}
                  onChange={(event) =>
                    field(
                      "reasons",
                      event.target.value
                        .split("\n")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <StudioCapturePanel
                adapter={adapter}
                versionId={aggregate.version.id}
                csrfToken={csrf}
                purpose="BOUNDARY"
                label="Boundary evidence"
                onChanged={load}
              />
              <PoseRegionEditor aggregate={aggregate} mutate={mutate} classification="BOUNDARY" />
            </>
          )}
          {step === 7 && (
            <>
              <label>
                <span>Confusion analysis</span>
                <textarea
                  rows={3}
                  value={String(form.confusionNotes ?? "")}
                  onChange={(event) => field("confusionNotes", event.target.value)}
                />
              </label>
              {aggregate.version.verificationProfile === "STORY_CRITICAL" && (
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={Boolean(form.storyCriticalRequirementAcknowledged)}
                    onChange={(event) => field("storyCriticalRequirementAcknowledged", event.target.checked)}
                  />
                  <span>I will provide both nearby and distant hard negatives before build preparation.</span>
                </label>
              )}
              <div className="dual-capture">
                <StudioCapturePanel
                  adapter={adapter}
                  versionId={aggregate.version.id}
                  csrfToken={csrf}
                  purpose="NEARBY_HARD_NEGATIVE"
                  label="Nearby wrong place"
                  onChanged={load}
                />
                <StudioCapturePanel
                  adapter={adapter}
                  versionId={aggregate.version.id}
                  csrfToken={csrf}
                  purpose="DISTANT_HARD_NEGATIVE"
                  label="Distant wrong place"
                  onChanged={load}
                />
              </div>
              <HardNegativeEditor aggregate={aggregate} mutate={mutate} />
            </>
          )}
          {step === 8 && (
            <>
              <label>
                <span>Durable target detail</span>
                <textarea
                  rows={3}
                  value={String(form.targetDescription ?? "")}
                  onChange={(event) => field("targetDescription", event.target.value)}
                />
              </label>
              <label>
                <span>Transient or ignored content</span>
                <textarea
                  rows={3}
                  value={String(form.ignoreDescription ?? "")}
                  onChange={(event) => field("ignoreDescription", event.target.value)}
                />
              </label>
              <VisionRegionEditor aggregate={aggregate} adapter={adapter} mutate={mutate} />
            </>
          )}
          {step === 9 && (
            <>
              <div className="health-summary">
                <strong>{aggregate.dataHealth.score}% authoring health</strong>
                <span>
                  {aggregate.dataHealth.blockerCount} blockers · {aggregate.dataHealth.warningCount} warnings
                </span>
                <progress value={aggregate.dataHealth.score} max={100} />
              </div>
              <ul className="health-list">
                {aggregate.dataHealth.items.map((item) => (
                  <li key={item.code} className={item.severity.toLocaleLowerCase()}>
                    <div>
                      <strong>
                        {item.severity}: {item.message}
                      </strong>
                      <p>{item.recovery}</p>
                    </div>
                    <button type="button" onClick={() => void openStep(item.step)}>
                      Go to step {item.step}
                    </button>
                  </li>
                ))}
              </ul>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.reviewedAt)}
                  onChange={(event) => field("reviewedAt", event.target.checked ? new Date().toISOString() : null)}
                />
                <span>I reviewed these current persisted results.</span>
              </label>
            </>
          )}
          {step === 10 && (
            <>
              <div className="boundary-banner">
                <strong>Local B-4 verification build</strong>
                <p>
                  The connected Companion consumes local derived frames, builds visual indexes, calibrates independent
                  gates, runs locked tests, and publishes an immutable data-only package. Raw recordings never leave
                  Companion storage.
                </p>
              </div>
              <label>
                <span>Execution target</span>
                <select
                  value={String(form.executionTarget ?? "LOCAL")}
                  onChange={(event) => field("executionTarget", event.target.value)}
                >
                  <option>LOCAL</option>
                </select>
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.rawMediaConsent)}
                  onChange={(event) => field("rawMediaConsent", event.target.checked)}
                />
                <span>
                  I understand cloud or raw-media movement would require separate consent. This local build uploads no
                  media.
                </span>
              </label>
              <button
                type="button"
                className="brass-button"
                disabled={!aggregate.dataHealth.readyToPrepare || busy || readOnly}
                onClick={() => void prepareBuild()}
              >
                Build verification package locally
              </button>
              {buildProgress && (
                <section className="health-summary" aria-live="polite">
                  <strong>{buildProgress.stage.toLocaleLowerCase().replaceAll("_", " ")}</strong>
                  <span>
                    {buildProgress.status} ·{" "}
                    {buildProgress.progress === null ? "indeterminate" : `${Math.round(buildProgress.progress * 100)}%`}
                  </span>
                  <progress value={buildProgress.progress ?? undefined} max={1} />
                </section>
              )}
              {!aggregate.dataHealth.readyToPrepare && <p>Resolve every Data Health blocker first.</p>}
              <ul className="build-job-list">
                {aggregate.buildJobs.map((job) => (
                  <li key={job.id}>
                    <strong>{job.processingStage.toLocaleLowerCase().replaceAll("_", " ")}</strong>
                    <code>{job.inputHash ? `sha256:${job.inputHash}` : "No input hash"}</code>
                    <span>
                      {job.reliabilityGrade ? `${job.reliabilityGrade.replaceAll("_", " ")} reliability` : job.status}
                      {" · "}Shadow only · automatic disabled
                    </span>
                    {job.packageHash && <code>{job.packageHash}</code>}
                  </li>
                ))}
              </ul>
              {aggregate.buildJobs[0]?.status === "COMPLETED" && (
                <section className="review-grid" aria-label="Reliability report">
                  <section>
                    <h3>Reliability</h3>
                    <p>{aggregate.buildJobs[0].reliabilityGrade?.replaceAll("_", " ") ?? "Unavailable"}</p>
                    <p>Package {aggregate.buildJobs[0].packageId}</p>
                  </section>
                  <section>
                    <h3>Runtime authorization</h3>
                    <p>Shadow verification only.</p>
                    <p>Automatic story progression is disabled regardless of grade.</p>
                  </section>
                </section>
              )}
            </>
          )}
          {step === 11 && (
            <>
              <label>
                <span>Test-plan notes</span>
                <textarea
                  rows={3}
                  value={String(form.notes ?? "")}
                  onChange={(event) => field("notes", event.target.value)}
                />
              </label>
              <label>
                <span>Acceptance notes</span>
                <textarea
                  rows={3}
                  value={String(form.acceptanceNotes ?? "")}
                  onChange={(event) => field("acceptanceNotes", event.target.value)}
                />
              </label>
              <TestCaseEditor aggregate={aggregate} mutate={mutate} />
            </>
          )}
          {step === 12 && (
            <>
              <div className="review-grid">
                <section>
                  <h3>Waypoint</h3>
                  <dl>
                    <div>
                      <dt>Type</dt>
                      <dd>{aggregate.waypoint.type.replaceAll("_", " ")}</dd>
                    </div>
                    <div>
                      <dt>Profile</dt>
                      <dd>{aggregate.version.verificationProfile}</dd>
                    </div>
                    <div>
                      <dt>Recordings</dt>
                      <dd>{aggregate.assets.filter((asset) => !asset.deletedAt).length}</dd>
                    </div>
                    <div>
                      <dt>Regions</dt>
                      <dd>{aggregate.poseRegions.length + aggregate.visualRegions.length}</dd>
                    </div>
                    <div>
                      <dt>Wrong places</dt>
                      <dd>{aggregate.hardNegatives.length}</dd>
                    </div>
                    <div>
                      <dt>Tests</dt>
                      <dd>{aggregate.tests.length}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h3>Exit readiness</h3>
                  <p>
                    {aggregate.dataHealth.readyToPrepare
                      ? "Persisted authoring evidence is ready for BuildInput preparation."
                      : `${aggregate.dataHealth.blockerCount} data-health blockers remain.`}
                  </p>
                  <p>
                    Human usability and real Sea of Thieves evidence are external validation gates; automated fixtures
                    do not satisfy them.
                  </p>
                </section>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.confirmCaptureConsent)}
                  onChange={(event) => field("confirmCaptureConsent", event.target.checked)}
                />
                <span>Capture retention and consent are correct.</span>
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.confirmNoModelYet)}
                  onChange={(event) => field("confirmNoModelYet", event.target.checked)}
                />
                <span>I understand B-4 results remain shadow-only and do not advance a story automatically.</span>
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.confirmLockedTests)}
                  onChange={(event) => field("confirmLockedTests", event.target.checked)}
                />
                <span>Locked test evidence is isolated from authoring decisions.</span>
              </label>
              {aggregate.authoring.completedSteps.includes(12) && (
                <button
                  type="button"
                  className="brass-button"
                  disabled={!aggregate.dataHealth.readyToPrepare || busy}
                  onClick={() => void prepareBuild()}
                >
                  Build and certify shadow package locally
                </button>
              )}
            </>
          )}
          {!readOnly && (
            <footer className="wizard-actions">
              <button type="button" disabled={busy || step === 1} onClick={() => void openStep(step - 1)}>
                Back
              </button>
              <button type="button" className="brass-button" disabled={busy} onClick={() => void saveStep()}>
                {step === 12 ? "Complete authoring review" : "Save and continue"}
              </button>
            </footer>
          )}
          {aggregate.version.authoringMode === "ENGINEERING" && (
            <details className="engineering-details">
              <summary>Persisted engineering details</summary>
              <dl>
                <div>
                  <dt>Version ID</dt>
                  <dd>
                    <code>{aggregate.version.id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Authoring schema</dt>
                  <dd>{aggregate.authoring.schemaVersion}</dd>
                </div>
                <div>
                  <dt>Revision</dt>
                  <dd>{aggregate.version.authoringRevision}</dd>
                </div>
                <div>
                  <dt>Local assets</dt>
                  <dd>{aggregate.assets.filter((asset) => asset.cloudState === "LOCAL_ONLY").length}</dd>
                </div>
              </dl>
            </details>
          )}
        </section>
      </section>
      <VersionHistory waypoint={waypoint} />
    </main>
  );
}

function VersionHistory({ waypoint }: { waypoint: Waypoint }) {
  return (
    <section className="authoring-version-history">
      <h2>Immutable version history</h2>
      <div>
        {waypoint.versions.map((version) => (
          <article key={version.id}>
            <strong>Version {version.versionNumber}</strong>
            <span>{version.lifecycleStatus.toLocaleLowerCase().replaceAll("_", " ")}</span>
            {version.publication && <code>sha256:{version.publication.packageHash}</code>}
          </article>
        ))}
      </div>
      {waypoint.usage.length > 0 && (
        <p>
          Used by {waypoint.usage.length} exact story binding{waypoint.usage.length === 1 ? "" : "s"}.
        </p>
      )}
    </section>
  );
}
