import { beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture, physicalObservation } from "@/landfall/fixtures";
import { projectLandfallJourney } from "@/landfall/journey-projection";
import type { PublishedBlock } from "@/chronicle/types";

type FixtureSession = {
  currentSequence: number;
  currentBlockId: string;
  version: { contentSnapshot: string; publishedAt?: Date };
  [key: string]: unknown;
};
type FixtureEvent = {
  id: string;
  sequence: number;
  sessionId: string;
  blockId: string | null;
  eventType: string;
  payload: string;
  createdAt: Date;
  idempotencyKey?: string;
  sourceId?: string | null;
};
type FixtureRequest = {
  id: string;
  providerType: string;
  configurationSnapshot: string;
  requestedAt: Date;
  [key: string]: unknown;
};
type EventFilter = { sessionId?: string; blockId?: string; eventType?: string | { startsWith?: string; in: string[] } };

const persistence = vi.hoisted(() => ({
  session: {} as FixtureSession,
  events: [] as FixtureEvent[],
  request: null as FixtureRequest | null,
}));
vi.mock("@/lib/db", () => {
  const db = {
    userAccount: { findUnique: async () => ({ legacyGameMasterId: null }) },
    taleSession: {
      findUniqueOrThrow: async () => ({
        ...persistence.session,
        events: [...persistence.events],
        verificationRequests: persistence.request ? [persistence.request] : [],
        revealStates: [],
      }),
      update: async ({ data }: { data: Record<string, unknown> & { currentSequence?: { increment: number } } }) => {
        if (data.currentSequence?.increment) persistence.session.currentSequence += data.currentSequence.increment;
        for (const [key, value] of Object.entries(data))
          if (key !== "currentSequence") persistence.session[key] = value;
        return { ...persistence.session };
      },
    },
    taleSessionEvent: {
      findFirst: async ({ where }: { where: EventFilter }) =>
        persistence.events.find(
          (event) =>
            event.sessionId === where.sessionId &&
            event.blockId === where.blockId &&
            event.eventType === where.eventType,
        ) ?? null,
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        persistence.events.find((event) => event.idempotencyKey === where.idempotencyKey) ?? null,
      findMany: async ({ where }: { where: EventFilter }) =>
        persistence.events.filter(
          (event) =>
            (!where.blockId || event.blockId === where.blockId) &&
            (!where.eventType ||
              (typeof where.eventType === "string"
                ? event.eventType === where.eventType
                : where.eventType.startsWith
                  ? event.eventType.startsWith(where.eventType.startsWith)
                  : where.eventType.in.includes(event.eventType))),
        ),
      create: async ({ data }: { data: Omit<FixtureEvent, "id" | "createdAt"> }) => {
        const event = { ...data, id: `event-${persistence.events.length}`, createdAt: new Date() };
        persistence.events.push(event);
        return event;
      },
    },
    revealState: { upsert: async () => ({}), updateMany: async () => ({ count: 1 }) },
    taleVerificationRequest: {
      findFirst: async () => persistence.request,
      findUnique: async () => (persistence.request ? { ...persistence.request, session: persistence.session } : null),
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "verification" }),
      update: async () => ({}),
    },
    taleVerificationEvent: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    $transaction: async (callback: (tx: unknown) => unknown) => {
      const before = structuredClone(persistence);
      try {
        return await callback(db);
      } catch (error) {
        persistence.session = before.session;
        persistence.events = before.events;
        throw error;
      }
    },
  };
  return { db };
});
vi.mock("@/wayfarer/accounts", () => ({ canonicalAccountForLegacyActor: async (id: string) => id }));
vi.mock("@/lib/events", () => ({ publishTaleSessionEvent: vi.fn() }));

import {
  captainLandfallCommand,
  submitPlayerLandfallEvidence,
  interactWithTaleSession,
  captainSessionAction,
} from "@/chronicle/progression";

let definition: typeof landfallFixture;
let snapshot: { chapters: { blocks: PublishedBlock[]; [key: string]: unknown }[]; [key: string]: unknown };
const block = () => snapshot.chapters[0].blocks[0];
const publish = () => {
  persistence.session.version.contentSnapshot = JSON.stringify(snapshot);
};
const command = (action: string, targetId?: string, extra = {}) =>
  captainLandfallCommand("session-1", "captain-1", {
    action,
    ...(targetId ? { targetId } : {}),
    expectedSequence: persistence.session.currentSequence,
    idempotencyKey: `synthetic-command-${action}-${persistence.session.currentSequence}`,
    ...extra,
  });
const seed = (eventType: string, payload: Record<string, unknown>) =>
  persistence.events.push({
    id: `seed-${persistence.events.length}`,
    eventType,
    sequence: persistence.session.currentSequence++,
    payload: JSON.stringify(payload),
    blockId: "active",
    sessionId: "session-1",
    createdAt: new Date(),
  });

beforeEach(() => {
  persistence.request = null;
  definition = structuredClone(landfallFixture);
  definition.waypoints[0].evidenceProfile.acceptedSources.push("PLAYER_CONFIRMATION");
  definition.waypoints.push({
    ...structuredClone(definition.waypoints[0]),
    id: "town-hidden",
    name: "Hidden destination",
    visibility: { hiddenUntilRevealed: true },
    sequence: { afterWaypointIds: [], optional: false },
  });
  definition.routes.push({
    ...structuredClone(definition.routes[0]),
    id: "hidden-route",
    model: "HIDDEN",
    waypointIds: ["town-hidden"],
  });
  snapshot = {
    schemaVersion: 1,
    tale: {
      id: "fixture-tale",
      title: "Synthetic command Chronicle",
      slug: "synthetic-command",
      theme: "CARTOGRAPHERS_TABLE",
    },
    chapters: [
      {
        id: "chapter",
        title: "Arrival",
        orderIndex: 0,
        blocks: [
          {
            id: "active",
            chapterId: "chapter",
            title: "Active Passage",
            blockType: "narrative",
            configuration: { worldspaceId: "town", waypointId: "town-arrival" },
            completion: {},
            presentation: {},
            orderIndex: 0,
            isEnabled: true,
            connections: [],
            nextBlockId: "next",
          },
          {
            id: "next",
            chapterId: "chapter",
            title: "Next Passage",
            blockType: "narrative",
            configuration: {},
            completion: {},
            presentation: {},
            orderIndex: 1,
            isEnabled: true,
            connections: [],
            nextBlockId: null,
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    landfall: definition,
    publishedAt: new Date().toISOString(),
  };
  persistence.session = {
    id: "session-1",
    publishedVersionId: "version-1",
    draftRevisionId: null,
    captainAccountId: "captain-1",
    captainAuthorityState: "HELD",
    status: "ACTIVE",
    previewMode: false,
    previewSnapshot: null,
    currentSequence: 4,
    currentBlockId: "active",
    currentChapterId: "chapter",
    variables: "{}",
    inventory: "[]",
    version: { contentSnapshot: "", publishedAt: new Date() },
    startedAt: new Date(),
    updatedAt: new Date(),
  };
  persistence.events = [];
  publish();
});

describe("Captain Landfall command transaction branches", () => {
  it("records a regional Captain confirmation without camera or physical evidence", async () => {
    definition.context = {
      regions: [
        {
          id: "synthetic-site",
          name: "Fictional site",
          worldspaceId: "town",
          mapId: definition.waypoints[0].mapId,
          kind: "SITE",
          geometry: structuredClone(definition.waypoints[0].geometry),
          privacyClassification: definition.waypoints[0].privacyClassification,
          hiddenUntilRevealed: false,
        },
      ],
      landmarks: [],
    };
    definition.waypoints[0].regionId = "synthetic-site";
    publish();
    await command("confirmArrival", "town-arrival", { reason: "Synthetic accessible fallback" });
    const payload = JSON.parse(persistence.events.at(-1)!.payload);
    expect(payload.contextualSummary).toMatchObject({
      state: "CONFIRMED",
      regionId: "synthetic-site",
      evidenceCategories: ["CAPTAIN_CONFIRMATION"],
      fallbackUsed: true,
    });
    expect(JSON.stringify(payload)).not.toMatch(/latitude|longitude|LANDMARK|frames/);
  });
  it.each([
    ["revealWaypoint", "town-hidden", "landfallWaypointRevealed"],
    ["revealRoute", "hidden-route", "landfallRouteRevealed"],
    ["selectWaypoint", "town-arrival", "landfallWaypointSelected"],
    ["selectRoute", "town-route", "landfallRouteSelected"],
    ["skipWaypoint", "town-arrival", "landfallWaypointSkipped"],
    ["confirmArrival", "town-arrival", "landfallWaypointConfirmed"],
    ["pause", undefined, "landfallProgressPaused"],
    ["resume", undefined, "landfallProgressResumed"],
  ])("%s writes exactly one ordered canonical event", async (action, target, eventType) => {
    if (action === "resume") seed("landfallProgressPaused", {});
    const sequence = persistence.session.currentSequence;
    await command(action!, target, { reason: "Synthetic Captain fallback approval" });
    const event = persistence.events.at(-1)!;
    expect(event.eventType).toBe(eventType);
    expect(event.sequence).toBe(sequence + 1);
    expect(persistence.session.currentSequence).toBe(sequence + 1);
    expect(event.sourceId).toBe("captain-1");
    expect(event.payload).not.toMatch(/latitude|longitude|BROWSER_GEOLOCATION|observations/);
    if (action === "confirmArrival")
      expect(JSON.parse(event.payload)).toMatchObject({ method: "CAPTAIN_CONFIRMATION", outcome: "CONFIRMED" });
  });
  it.each(["revealWaypoint", "revealRoute"])("%s rejects invalid and wrong Worldspace targets", async (action) => {
    await expect(command(action, "missing")).rejects.toThrow("UNAVAILABLE");
    await expect(command(action, action === "revealWaypoint" ? "isle-region" : "isle-route")).rejects.toThrow(
      "UNAVAILABLE",
    );
    expect(persistence.events).toHaveLength(0);
  });
  it("selectWaypoint accepts flexible and Captain-directed branches but rejects an ordered jump or visited target", async () => {
    seed("landfallWaypointRevealed", { waypointId: "town-hidden" });
    definition.routes[0].waypointIds.push("town-hidden");
    publish();
    await expect(command("selectWaypoint", "town-hidden")).rejects.toThrow("SEQUENCE_CONFLICT");
    for (const model of ["FLEXIBLE", "BRANCHING", "CAPTAIN_DIRECTED"] as const) {
      definition.routes[0].model = model;
      publish();
      await expect(command("selectWaypoint", "town-hidden")).resolves.toMatchObject({ accepted: true });
    }
    seed("landfallWaypointConfirmed", { waypointId: "town-hidden", worldspaceId: "town" });
    await expect(command("selectWaypoint", "town-hidden")).rejects.toThrow("ALREADY_VISITED");
  });
  it("selectRoute requires hidden route release and preserves the canonical selection", async () => {
    await expect(command("selectRoute", "hidden-route")).rejects.toThrow("NOT_RELEASED");
    await command("revealRoute", "hidden-route");
    await command("selectRoute", "hidden-route");
    expect(projectLandfallJourney(definition, persistence.events).selectedRouteId).toBe("hidden-route");
  });
  it.each(["skipWaypoint", "confirmArrival"])(
    "%s enforces override, reason, current target and block policy",
    async (action) => {
      await expect(command(action, "town-arrival")).rejects.toThrow("REASON_REQUIRED");
      seed("landfallWaypointRevealed", { waypointId: "town-hidden" });
      await expect(command(action, "town-hidden", { reason: "Synthetic reason" })).rejects.toThrow("WRONG_WAYPOINT");
      definition.waypoints[0].evidenceProfile.allowCaptainOverride = false;
      publish();
      await expect(command(action, "town-arrival", { reason: "Synthetic reason" })).rejects.toThrow(
        "OVERRIDE_UNAVAILABLE",
      );
      definition.waypoints[0].evidenceProfile.allowCaptainOverride = true;
      block().completion = {
        mode: "landfall",
        provider: {
          id: "landfall",
          version: 1,
          options: {
            worldspaceId: "town",
            locationId: "town-arrival",
            requiredOutcome: "CONFIRMED",
            allowCaptainOverride: false,
            allowPlayerFallback: false,
            replayPolicy: "PRESENTATION_ONLY",
          },
        },
      };
      publish();
      await expect(command(action, "town-arrival", { reason: "Synthetic reason" })).rejects.toThrow(
        "OVERRIDE_UNAVAILABLE",
      );
    },
  );
  it("pause/resume reject impossible states and an exact duplicate never adds another event", async () => {
    const key = "synthetic-pause-idempotency";
    await command("pause", undefined, { idempotencyKey: key });
    const sequence = persistence.session.currentSequence;
    await expect(command("pause", undefined, { idempotencyKey: key, expectedSequence: 0 })).resolves.toMatchObject({
      duplicate: true,
    });
    expect(persistence.session.currentSequence).toBe(sequence);
    await expect(command("pause")).rejects.toThrow("ALREADY_PAUSED");
    await command("resume");
    await expect(command("resume")).rejects.toThrow("NOT_PAUSED");
  });
  it.each(["revealWaypoint", "confirmArrival"])(
    "%s preserves idempotency and rejects conflicting command identity",
    async (action) => {
      const key = "synthetic-duplicate-command";
      await command(action, action === "revealWaypoint" ? "town-hidden" : "town-arrival", {
        idempotencyKey: key,
        reason: "Original reason",
      });
      await expect(
        command(action, action === "revealWaypoint" ? "town-hidden" : "town-arrival", {
          idempotencyKey: key,
          reason: "Original reason",
        }),
      ).resolves.toMatchObject({ duplicate: true });
      await expect(
        command(action, action === "revealWaypoint" ? "town-hidden" : "town-arrival", {
          idempotencyKey: key,
          reason: "Different reason",
        }),
      ).rejects.toThrow("IDENTITY_MISMATCH");
      expect(persistence.events).toHaveLength(1);
    },
  );
  it.each([{ captainAccountId: "other" }, { previewMode: true }, { status: "COMPLETED" }, { status: "PAUSED" }])(
    "rejects authority or session failure %j without events",
    async (state) => {
      Object.assign(persistence.session, state);
      await expect(command("pause")).rejects.toThrow("AUTHORITY_UNAVAILABLE");
      expect(persistence.events).toHaveLength(0);
    },
  );
  it("rejects stale sequence and leaves the exact sequence unchanged", async () => {
    await expect(command("revealWaypoint", "town-hidden", { expectedSequence: 0 })).rejects.toThrow("Voyage changed");
    expect(persistence.session.currentSequence).toBe(4);
    expect(persistence.events).toHaveLength(0);
  });
  it.each(["skipWaypoint", "confirmArrival"])(
    "%s advances an eligible waypointJourney through normal canonical completion",
    async (action) => {
      block().blockType = "waypointJourney";
      publish();
      await command(action, "town-arrival", { reason: "Synthetic approval" });
      expect(persistence.session.currentBlockId).toBe("next");
      expect(persistence.events.filter((event) => event.eventType === "blockCompleted")).toHaveLength(1);
    },
  );
  it("Captain fallback approval unlocks observation without responding on the Player's behalf", async () => {
    block().blockType = "locationObservation";
    block().configuration.prompt = "Describe the carved bird";
    publish();
    await command("confirmArrival", "town-arrival", { reason: "Captain approves fallback at this location" });
    expect(persistence.session.currentBlockId).toBe("active");
    expect(persistence.events.map((event) => event.eventType)).toEqual(["landfallWaypointConfirmed"]);
  });
});

describe("locationObservation canonical arrival and response transaction", () => {
  beforeEach(() => {
    block().blockType = "locationObservation";
    block().configuration.prompt = "Observe the carved bird";
    publish();
  });
  const playerEvidence = (extra = {}) => ({
    schemaVersion: 1,
    sessionId: "session-1",
    publishedVersionId: "version-1",
    worldspaceId: "town",
    waypointId: "town-arrival",
    evidenceId: "synthetic-arrival-evidence",
    expectedSequence: persistence.session.currentSequence,
    idempotencyKey: "synthetic-player-arrival",
    method: "PLAYER_FALLBACK",
    ...extra,
  });
  it("rejects a response before arrival and leaves the Passage active", async () => {
    await expect(
      interactWithTaleSession(
        "session-1",
        undefined,
        { action: "confirm", idempotencyKey: "synthetic-response" },
        true,
      ),
    ).rejects.toThrow("CONTEXT_REQUIRED");
    expect(persistence.events).toHaveLength(0);
  });
  it.each(["PLAYER", "CAPTAIN"])(
    "a previously visited location requires fresh block-bound %s context",
    async (actor) => {
      seed("landfallWaypointConfirmed", { worldspaceId: "town", waypointId: "town-arrival", outcome: "CONFIRMED" });
      persistence.events[0].blockId = "earlier-passage";
      await expect(
        interactWithTaleSession(
          "session-1",
          undefined,
          { action: "confirm", idempotencyKey: "unready-response" },
          true,
        ),
      ).rejects.toThrow("CONTEXT_REQUIRED");
      if (actor === "PLAYER") await submitPlayerLandfallEvidence(playerEvidence());
      else await command("confirmArrival", "town-arrival", { reason: "Fresh observation context approval" });
      expect(persistence.events.filter((event) => event.eventType === "landfallWaypointConfirmed")).toHaveLength(2);
      expect(persistence.session.currentBlockId).toBe("active");
      await expect(submitPlayerLandfallEvidence(playerEvidence({ evidenceId: "different-fix" }))).rejects.toThrow(
        "WAYPOINT_UNAVAILABLE",
      );
      await interactWithTaleSession(
        "session-1",
        undefined,
        { action: "confirm", idempotencyKey: "ready-response" },
        true,
      );
      expect(persistence.session.currentBlockId).toBe("next");
    },
  );
  it("text observation preserves answer verification after arrival and cannot be confirmed around", async () => {
    persistence.request = {
      id: "answer-request",
      providerType: "textAnswer",
      configurationSnapshot: JSON.stringify({ acceptedAnswers: ["bird"] }),
      requestedAt: new Date(),
    };
    await expect(
      interactWithTaleSession(
        "session-1",
        undefined,
        { action: "answer", answer: "bird", idempotencyKey: "early-answer" },
        true,
      ),
    ).rejects.toThrow("CONTEXT_REQUIRED");
    await submitPlayerLandfallEvidence(playerEvidence());
    await expect(
      interactWithTaleSession("session-1", undefined, { action: "confirm", idempotencyKey: "bypass-answer" }, true),
    ).rejects.toThrow("RESPONSE_REQUIRED");
    await interactWithTaleSession(
      "session-1",
      undefined,
      { action: "answer", answer: "bird", idempotencyKey: "correct-answer" },
      true,
    );
    expect(persistence.session.currentBlockId).toBe("next");
    const response = persistence.events.find((event) => event.eventType === "landfallObservationResponded")!;
    expect(JSON.parse(response.payload).response).toBe("ANSWER");
    expect(response.payload).not.toContain("bird");
  });
  it("Captain observation approval requires context and records a separate response", async () => {
    block().id = "observation-active";
    persistence.session.currentBlockId = block().id;
    publish();
    persistence.request = {
      id: "captain-request",
      sessionId: "session-1",
      blockId: block().id,
      providerType: "captainManual",
      status: "PENDING",
      configurationSnapshot: "{}",
      requestedAt: new Date(),
    };
    await expect(
      captainSessionAction("session-1", "captain-1", { action: "approve", idempotencyKey: "before-context" }),
    ).rejects.toThrow("locationContextRequired");
    await command("confirmArrival", "town-arrival", { reason: "Approve physical fallback context" });
    expect(persistence.session.currentBlockId).toBe("observation-active");
    await captainSessionAction("session-1", "captain-1", { action: "approve", idempotencyKey: "after-context" });
    expect(persistence.session.currentBlockId).toBe("next");
    expect(persistence.events.filter((event) => event.eventType === "landfallObservationResponded")).toHaveLength(1);
  });
  it("qualified foreground arrival unlocks but does not complete; a separate response advances", async () => {
    const now = Date.now();
    const receipt = await submitPlayerLandfallEvidence(
      playerEvidence({
        method: "FOREGROUND_LOCATION",
        evidenceId: "fix-2",
        observations: [
          { ...physicalObservation("fix-1", new Date(now - 1000).toISOString()), providerId: "browser-geolocation" },
          { ...physicalObservation("fix-2", new Date(now).toISOString()), providerId: "browser-geolocation" },
        ],
      }),
    );
    expect(receipt.advanced).toBe(false);
    expect(persistence.session.currentBlockId).toBe("active");
    await interactWithTaleSession(
      "session-1",
      undefined,
      { action: "confirm", idempotencyKey: "synthetic-response" },
      true,
    );
    expect(persistence.session.currentBlockId).toBe("next");
    expect(persistence.events.map((event) => event.eventType)).toContain("landfallObservationResponded");
    expect(JSON.stringify(persistence.events)).not.toMatch(/latitude|longitude|accuracyMeters/);
  });
  it("duplicate prerequisite is safe and stale sequence, wrong Worldspace and disabled fallback fail", async () => {
    const evidence = playerEvidence();
    await expect(submitPlayerLandfallEvidence({ ...evidence, worldspaceId: "isles" })).rejects.toThrow(
      "WRONG_WORLDSPACE",
    );
    await expect(submitPlayerLandfallEvidence({ ...evidence, expectedSequence: 0 })).rejects.toThrow("Voyage changed");
    definition.waypoints[0].evidenceProfile.allowManualFallback = false;
    definition.waypoints[0].fallback.mode = "CAPTAIN";
    publish();
    await expect(submitPlayerLandfallEvidence(evidence)).rejects.toThrow("FALLBACK_UNAVAILABLE");
    definition.waypoints[0].evidenceProfile.allowManualFallback = true;
    definition.waypoints[0].fallback.mode = "PLAYER";
    publish();
    await submitPlayerLandfallEvidence(evidence);
    await expect(submitPlayerLandfallEvidence(evidence)).resolves.toMatchObject({ duplicate: true, advanced: false });
    expect(persistence.events).toHaveLength(1);
  });
  it("records the actor and rejects another actor's duplicate acknowledgement without a second canonical event", async () => {
    const evidence = playerEvidence();
    await submitPlayerLandfallEvidence(evidence, "player-1");
    expect(JSON.parse(persistence.events[0].payload)).toMatchObject({
      actorProfileId: "player-1",
      publishedVersionId: "version-1",
    });
    await expect(submitPlayerLandfallEvidence(evidence, "player-2")).rejects.toThrow("ACTOR_MISMATCH");
    await expect(submitPlayerLandfallEvidence(evidence, "player-1")).resolves.toMatchObject({ duplicate: true });
    expect(persistence.events).toHaveLength(1);
  });
});

describe("reusable Landfall completion on ordinary Chronicle blocks", () => {
  function requireLocation(requiredOutcome: "NEARBY" | "LIKELY_INSIDE" | "CONFIRMED", extra = {}) {
    block().completion = {
      mode: "landfall",
      provider: {
        id: "landfall",
        version: 1,
        options: {
          worldspaceId: "town",
          locationId: "town-arrival",
          requiredOutcome,
          allowCaptainOverride: true,
          allowPlayerFallback: true,
          replayPolicy: "PRESENTATION_ONLY",
          ...extra,
        },
      },
    };
    publish();
  }
  function evidence(observations: ReturnType<typeof physicalObservation>[], extra = {}) {
    return {
      schemaVersion: 1,
      sessionId: "session-1",
      publishedVersionId: "version-1",
      worldspaceId: "town",
      waypointId: "town-arrival",
      evidenceId: observations.at(-1)?.id ?? "fallback",
      expectedSequence: persistence.session.currentSequence,
      idempotencyKey: "synthetic-normal-block",
      method: "FOREGROUND_LOCATION",
      observations,
      ...extra,
    };
  }
  it.each(["NEARBY", "LIKELY_INSIDE", "CONFIRMED"] as const)(
    "a normal narrative completes for the authored %s outcome",
    async (outcome) => {
      const now = Date.now();
      definition.waypoints[0].completion.requiredOutcome = outcome;
      definition.routes[0].semantics = "ILLUSTRATIVE";
      requireLocation(outcome);
      const count = outcome === "CONFIRMED" ? 2 : 1;
      const observations = Array.from({ length: count }, (_, index) => ({
        ...physicalObservation(
          `normal-${index}`,
          new Date(now - (count - index) * 1000).toISOString(),
          outcome === "NEARBY" ? 44.00092 : 44,
        ),
        providerId: "browser-geolocation",
      }));
      await expect(submitPlayerLandfallEvidence(evidence(observations))).resolves.toMatchObject({ advanced: true });
      expect(persistence.session.currentBlockId).toBe("next");
      const receipt = persistence.events.find((event) => event.eventType === "landfallWaypointConfirmed")!;
      expect(JSON.parse(receipt.payload).outcome).toBe(outcome);
      expect(JSON.stringify(persistence.events)).not.toMatch(/latitude|longitude|observations/);
    },
  );
  it("enforces a block dwell override, rejects weak/stale/wrong-location evidence and leaves progress unchanged", async () => {
    requireLocation("CONFIRMED", { dwellSeconds: 10 });
    const now = Date.now();
    const fixes = [0, 1].map((i) => ({
      ...physicalObservation(`normal-${i}`, new Date(now - (2 - i) * 1000).toISOString()),
      providerId: "browser-geolocation",
    }));
    await expect(submitPlayerLandfallEvidence(evidence(fixes))).rejects.toThrow("NOT_QUALIFIED");
    await expect(submitPlayerLandfallEvidence(evidence(fixes, { expectedSequence: 0 }))).rejects.toThrow(
      "Voyage changed",
    );
    await expect(submitPlayerLandfallEvidence(evidence(fixes, { worldspaceId: "isles" }))).rejects.toThrow(
      "WRONG_WORLDSPACE",
    );
    await expect(submitPlayerLandfallEvidence(evidence(fixes, { waypointId: "town-hidden" }))).rejects.toThrow(
      "UNAVAILABLE",
    );
    expect(persistence.events).toHaveLength(0);
    expect(persistence.session.currentBlockId).toBe("active");
  });
  it("a stronger block outcome rejects weaker waypoint evidence without consuming the visit", async () => {
    definition.waypoints[0].completion.requiredOutcome = "NEARBY";
    definition.routes[0].semantics = "ILLUSTRATIVE";
    requireLocation("CONFIRMED");
    const now = Date.now();
    const near = {
      ...physicalObservation("near-fix", new Date(now).toISOString(), 44.00092),
      providerId: "browser-geolocation",
    };
    await expect(submitPlayerLandfallEvidence(evidence([near]))).rejects.toThrow("NOT_QUALIFIED");
    expect(persistence.events).toHaveLength(0);
    const strong = [0, 1].map((i) => ({
      ...physicalObservation(`strong-${i}`, new Date(now - (1 - i) * 1000).toISOString()),
      providerId: "browser-geolocation",
    }));
    await expect(submitPlayerLandfallEvidence(evidence(strong))).resolves.toMatchObject({ advanced: true });
  });
  it.each(["narrative", "imageReveal", "directions"])(
    "%s supports configured Player and Captain fallback without a GPS claim",
    async (kind) => {
      block().blockType = kind;
      requireLocation("CONFIRMED");
      await submitPlayerLandfallEvidence(evidence([], { method: "PLAYER_FALLBACK", observations: undefined }));
      expect(persistence.session.currentBlockId).toBe("next");
      expect(JSON.parse(persistence.events[0].payload).method).toBe("PLAYER_CONFIRMATION");
    },
  );
  it("Captain confirmation completes a provider-bound ordinary block and completed replay rejects new evidence", async () => {
    requireLocation("CONFIRMED");
    await command("confirmArrival", "town-arrival", { reason: "Synthetic ordinary-block approval" });
    expect(persistence.session.currentBlockId).toBe("next");
    expect(JSON.parse(persistence.events[0].payload).method).toBe("CAPTAIN_CONFIRMATION");
    persistence.session.status = "COMPLETED";
    const before = persistence.events.length;
    await expect(
      submitPlayerLandfallEvidence(
        evidence([], { method: "PLAYER_FALLBACK", observations: undefined, evidenceId: "replay-visit" }),
      ),
    ).rejects.toThrow("SESSION_UNAVAILABLE");
    expect(persistence.events).toHaveLength(before);
  });
});
