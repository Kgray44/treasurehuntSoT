import { createHash } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import visionRuntimeModule from "../../apps/companion/vision-runtime-engine.cjs";
import visionPilotsModule from "../../apps/companion/vision-pilots.cjs";

const { VisionRuntimeEngine } = visionRuntimeModule as {
  VisionRuntimeEngine: new () => {
    verify(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};
const { cloneFrames, createSyntheticPilots } = visionPilotsModule as {
  cloneFrames(frames: unknown): unknown;
  createSyntheticPilots(): Array<{
    runtime: { positive: unknown; negative: unknown; insufficient: unknown };
  }>;
};

type RuntimeAuthorization = {
  attemptId: string;
  stageToken: string;
  packageId: string;
  packageHash: string;
  waypointId: string;
  waypointVersionId: string;
  storyStateVersion: number;
  effectiveMode: string;
};

async function ok(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  expect(response.ok(), `${response.url()} returned ${response.status()}: ${await response.text()}`).toBeTruthy();
  return response;
}

async function startFixture(context: BrowserContext) {
  const response = await context.request.post("/api/tales/b5-vision-integration-demo/start", {
    data: { ownerLabel: `B5 Crew ${crypto.randomUUID().slice(0, 6)}` },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json() as Promise<{ sessionId: string; url: string }>;
}

async function arm(context: BrowserContext, sessionId: string) {
  const stateResponse = await ok(await context.request.get(`/api/play/sessions/${sessionId}`));
  const state = (await stateResponse.json()) as {
    block: { id: string; configuration: { waypointVersionId: string } };
  };
  const response = await context.request.post("/api/vision-runtime/attempts", {
    data: {
      sessionId,
      blockId: state.block.id,
      waypointVersionId: state.block.configuration.waypointVersionId,
      platform: "WEB",
      adapterType: "WEB_COMPANION",
      companionInstanceId: "companion_playwright_b5",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return {
    state,
    authorization: (await response.json()) as RuntimeAuthorization,
  };
}

async function productionResult(context: BrowserContext, authorization: RuntimeAuthorization, frames: unknown) {
  const packageResponse = await ok(
    await context.request.get(
      `/api/vision-runtime/packages/${authorization.packageId}?attemptId=${authorization.attemptId}`,
    ),
  );
  const packageBody = (await packageResponse.json()) as {
    packageId: string;
    packageHash: string;
    package: Record<string, unknown>;
  };
  expect(packageBody).toMatchObject({
    packageId: authorization.packageId,
    packageHash: authorization.packageHash,
  });
  const result = await new VisionRuntimeEngine().verify({
    attemptId: authorization.attemptId,
    package: packageBody.package,
    waypointVersionId: authorization.waypointVersionId,
    stageToken: authorization.stageToken,
    expectedStageToken: authorization.stageToken,
    provider: "CPU_CLASSICAL",
    frames: cloneFrames(frames),
  });
  return {
    stageToken: authorization.stageToken,
    waypointId: String(result.waypointId),
    waypointVersionId: String(result.waypointVersionId),
    packageId: String(result.packageId),
    packageHash: authorization.packageHash,
    companionInstanceId: "companion_playwright_b5",
    result: String(result.result),
    guidanceCode: String(result.guidanceCode),
    failedGates: result.failedGates,
    evidenceDigest: result.evidenceDigest,
    engineVersion: String(result.engineVersion),
    modelBundleVersion: String(result.modelBundleVersion),
    provider: String(result.provider),
    providerFallbackUsed: Boolean(result.providerFallbackUsed),
    capturedFrameCount: Number(result.capturedFrameCount),
    usableFrameCount: Number(result.usableFrameCount),
    passingFrameCount: Number(result.passingFrameCount),
    durationMs: Number(result.durationMs),
    rawFramesRetained: false,
    diagnostics: result.diagnostics,
    observedAt: new Date().toISOString(),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function payloadHash(payload: Record<string, unknown>) {
  return `sha256:${createHash("sha256").update(stableJson(payload)).digest("hex")}`;
}

async function openJournal(page: Page) {
  await page.getByRole("button", { name: /Open the journal/i }).click();
  await page.getByRole("button", { name: "Skip ceremony" }).click();
  await expect(page.locator("main.tall-tale-journal-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
}

test("real B-4 replay is governed through Player, story, Captain, stale, negative, and offline B-5 paths", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Shared-database B-5 mutation coverage runs once in Chromium.");
  test.setTimeout(240_000);
  const pilot = createSyntheticPilots()[0];
  const captainContext = await browser.newContext();
  const login = await captainContext.request.post("/api/gm/login", {
    data: {
      username: process.env.GM_USERNAME ?? "kato",
      password: process.env.GM_PASSWORD ?? "development-captain-only",
    },
  });
  await ok(login);
  const { csrfToken } = (await login.json()) as { csrfToken: string };

  const playerContext = await browser.newContext();
  const run = await startFixture(playerContext);
  const { state, authorization } = await arm(playerContext, run.sessionId);
  expect(authorization.effectiveMode).toBe("CAPTAIN_CONFIRMED");
  const positive = await productionResult(playerContext, authorization, pilot.runtime.positive);
  const submitted = await playerContext.request.post(`/api/vision-runtime/attempts/${authorization.attemptId}/result`, {
    data: positive,
  });
  await ok(submitted);
  expect(await submitted.json()).toMatchObject({
    result: "VERIFIED",
    attemptState: "AWAITING_CAPTAIN",
    eventDeliveryStatus: "RESULT_RECORDED",
    captainDecisionStatus: "PENDING",
    rawFramesRetained: false,
  });
  const unchanged = (await (
    await ok(await playerContext.request.get(`/api/play/sessions/${run.sessionId}`))
  ).json()) as { block: { id: string } };
  expect(unchanged.block.id).toBe(state.block.id);

  const arbitrary = await playerContext.request.post(`/api/vision-runtime/attempts/${authorization.attemptId}/result`, {
    data: { ...positive, packageHash: `sha256:${"f".repeat(64)}` },
  });
  expect(arbitrary.status()).toBe(409);

  const promote = await captainContext.request.post(
    `/api/vision-runtime/attempts/${authorization.attemptId}/captain-action`,
    {
      headers: { "x-csrf-token": csrfToken },
      data: {
        action: "PROMOTE_TO_AUTOMATIC",
        reason: "B-5 must reject automatic mode without real field evidence",
        idempotencyKey: `captain:${crypto.randomUUID()}`,
      },
    },
  );
  expect(promote.status()).toBe(422);
  expect(await promote.json()).toMatchObject({ code: "FIELD_EVIDENCE_REQUIRED" });

  const decisionKey = `captain:${authorization.attemptId}:approve`;
  const approved = await captainContext.request.post(
    `/api/vision-runtime/attempts/${authorization.attemptId}/captain-action`,
    {
      headers: { "x-csrf-token": csrfToken },
      data: {
        action: "APPROVE",
        reason: "Production-engine replay matches the synthetic fixture",
        truthLabel: "TRUE_POSITIVE",
        idempotencyKey: decisionKey,
      },
    },
  );
  await ok(approved);
  expect(await approved.json()).toMatchObject({
    eventDeliveryStatus: "DELIVERED",
    captainDecisionStatus: "APPROVED",
    progressionAppliedAt: expect.any(String),
  });
  const duplicateApproval = await captainContext.request.post(
    `/api/vision-runtime/attempts/${authorization.attemptId}/captain-action`,
    {
      headers: { "x-csrf-token": csrfToken },
      data: {
        action: "APPROVE",
        reason: "Production-engine replay matches the synthetic fixture",
        truthLabel: "TRUE_POSITIVE",
        idempotencyKey: decisionKey,
      },
    },
  );
  await ok(duplicateApproval);
  expect(await duplicateApproval.json()).toMatchObject({ duplicate: true });

  const truthLabel = await captainContext.request.post(
    `/api/vision-runtime/attempts/${authorization.attemptId}/captain-action`,
    {
      headers: { "x-csrf-token": csrfToken },
      data: {
        action: "LABEL_TRUTH",
        reason: "Retain the metadata-only positive as a governed improvement candidate",
        truthLabel: "TRUE_POSITIVE",
        idempotencyKey: `captain:${authorization.attemptId}:truth-label`,
      },
    },
  );
  await ok(truthLabel);
  const improvementQueue = await ok(await captainContext.request.get("/api/vision-improvement-candidates"));
  const queueBody = (await improvementQueue.json()) as {
    candidates: Array<{
      id: string;
      sourceAttemptId: string;
      proposedPartition: string;
      rawFramesRetained: boolean;
      status: string;
    }>;
  };
  const candidate = queueBody.candidates.find((item) => item.sourceAttemptId === authorization.attemptId);
  expect(candidate).toMatchObject({
    sourceAttemptId: authorization.attemptId,
    proposedPartition: "POSITIVE_CANDIDATE",
    rawFramesRetained: false,
    status: "QUEUED",
  });
  const disposition = await captainContext.request.patch("/api/vision-improvement-candidates", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      candidateId: candidate!.id,
      action: "ACCEPT_FOR_CORPUS",
      reason: "Independent Creator review is still required before corpus admission",
    },
  });
  await ok(disposition);
  expect(await disposition.json()).toMatchObject({
    candidate: { status: "ACCEPTED_FOR_REVIEW", rawFramesRetained: false },
  });
  const advanced = (await (
    await ok(await playerContext.request.get(`/api/play/sessions/${run.sessionId}`))
  ).json()) as { block: { id: string; title: string } };
  expect(advanced.block.title).toBe("The governed mark is true");
  const captainState = (await (
    await ok(await captainContext.request.get(`/api/captain/sessions/${run.sessionId}`))
  ).json()) as { events: Array<{ eventType: string }> };
  expect(captainState.events.filter((event) => event.eventType === "verificationSatisfied")).toHaveLength(1);
  expect(captainState.events.some((event) => event.eventType === "visionVerificationSucceeded")).toBe(true);
  expect(captainState.events.some((event) => event.eventType === "visionPresentationRequested")).toBe(true);

  for (const [name, frames, expected] of [
    ["negative", pilot.runtime.negative, ["NOT_AT_TARGET", "AMBIGUOUS"]],
    ["insufficient", pilot.runtime.insufficient, ["INSUFFICIENT_VISUAL_EVIDENCE"]],
  ] as const) {
    const context = await browser.newContext();
    const scenario = await startFixture(context);
    const armed = await arm(context, scenario.sessionId);
    const payload = await productionResult(context, armed.authorization, frames);
    const response = await context.request.post(
      `/api/vision-runtime/attempts/${armed.authorization.attemptId}/result`,
      { data: payload },
    );
    await ok(response);
    const body = (await response.json()) as { result: string; eventDeliveryStatus: string };
    expect(expected).toContain(body.result);
    expect(body.eventDeliveryStatus).toBe("RESULT_RECORDED");
    const after = (await (await ok(await context.request.get(`/api/play/sessions/${scenario.sessionId}`))).json()) as {
      block: { id: string };
    };
    expect(after.block.id, `${name} must not progress`).toBe(armed.state.block.id);
    await context.close();
  }

  const staleContext = await browser.newContext();
  const staleRun = await startFixture(staleContext);
  const staleArmed = await arm(staleContext, staleRun.sessionId);
  const stalePayload = await productionResult(staleContext, staleArmed.authorization, pilot.runtime.positive);
  await ok(
    await captainContext.request.post(`/api/captain/sessions/${staleRun.sessionId}`, {
      headers: { "x-csrf-token": csrfToken },
      data: {
        action: "jump",
        targetBlockId: "b5_fixture_reveal_stage",
        reason: "Advance the story before the delayed result arrives",
        idempotencyKey: crypto.randomUUID(),
      },
    }),
  );
  const staleResponse = await staleContext.request.post(
    `/api/vision-runtime/attempts/${staleArmed.authorization.attemptId}/result`,
    { data: stalePayload },
  );
  await ok(staleResponse);
  expect(await staleResponse.json()).toMatchObject({
    result: "STALE",
    eventDeliveryStatus: "REJECTED_STALE",
    staleResultRejected: true,
  });

  const offlineContext = await browser.newContext();
  const offlineRun = await startFixture(offlineContext);
  const offlineArmed = await arm(offlineContext, offlineRun.sessionId);
  const offlinePayload = await productionResult(offlineContext, offlineArmed.authorization, pilot.runtime.positive);
  const transmittedOfflinePayload = JSON.parse(JSON.stringify(offlinePayload)) as Record<string, unknown>;
  const offlineEvent = {
    eventId: `offline_${crypto.randomUUID()}`,
    idempotencyKey: `offline:${crypto.randomUUID()}`,
    attemptId: offlineArmed.authorization.attemptId,
    eventType: "vision.result",
    storyStateVersion: offlineArmed.authorization.storyStateVersion,
    payloadHash: payloadHash(transmittedOfflinePayload),
    observedAt: offlinePayload.observedAt,
    payload: transmittedOfflinePayload,
  };
  const reconciled = await offlineContext.request.post("/api/vision-runtime/offline/reconcile", {
    data: { sessionId: offlineRun.sessionId, events: [offlineEvent] },
  });
  await ok(reconciled);
  expect(await reconciled.json()).toMatchObject({
    results: [{ eventId: offlineEvent.eventId, status: "SYNCED" }],
  });
  const replayed = await offlineContext.request.post("/api/vision-runtime/offline/reconcile", {
    data: { sessionId: offlineRun.sessionId, events: [offlineEvent] },
  });
  await ok(replayed);
  expect(await replayed.json()).toMatchObject({
    results: [{ eventId: offlineEvent.eventId, status: "SYNCED", duplicate: true }],
  });

  const uiContext = await browser.newContext();
  const uiRun = await startFixture(uiContext);
  const page = await uiContext.newPage();
  await page.goto(uiRun.url);
  await openJournal(page);
  await expect(page.getByRole("heading", { name: "Inspect the Governed Landmark", exact: true })).toBeVisible();
  await expect(page.getByText("Pair the local Companion")).toBeVisible();
  await expect(page.getByText(/Frames remain in memory/)).toBeVisible();

  await Promise.all([
    captainContext.close(),
    playerContext.close(),
    staleContext.close(),
    offlineContext.close(),
    uiContext.close(),
  ]);
});
