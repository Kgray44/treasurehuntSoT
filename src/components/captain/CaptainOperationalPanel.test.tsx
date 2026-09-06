import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptainOperationalPanel } from "./CaptainOperationalPanel";

function response(body: unknown) {
  return { ok: true, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

const projection = {
  csrfToken: "csrf-token",
  voyage: {
    chronicle: "The Moonlit Key",
    voyageName: "Lanternwake",
    edition: "Edition one",
    lifecycle: "ACTIVE",
    captainAuthorityState: "ASSIGNED",
    concurrencyVersion: 4,
    operationalStatus: "ATTENTION_REQUIRED",
    aggregatePresence: "CONNECTED_CATCHING_UP",
    crewPresenceSummary: {
      total: 2,
      connected: 1,
      recentlyLost: 1,
      stale: 0,
      unknown: 0,
      synchronized: 1,
      catchingUp: 1,
    },
    sourceUpdatedAt: "2026-09-06T12:00:00.000Z",
    computedAt: "2026-09-06T12:00:30.000Z",
  },
  attention: [
    {
      key: "crew-sync",
      severity: "MEDIUM",
      title: "One Crew member is catching up",
      explanation: "Wait for synchronization before moving the Crew.",
      stale: false,
    },
  ],
  crew: [
    {
      id: "captain-membership",
      displayName: "Kato",
      crewRole: "Navigator",
      membership: { status: "ACTIVE" },
      presence: {
        state: "CONNECTED",
        lastSeenAt: "2026-09-06T12:00:00.000Z",
        activeDeviceCount: 1,
        safeActivity: null,
      },
      synchronization: { state: "SYNCHRONIZED", lag: 0 },
      readiness: { state: "READY" },
      isCaptainsOwnPlayerMembership: true,
      canReceiveCaptaincy: false,
    },
    {
      id: "crew-membership",
      displayName: "Mira",
      crewRole: "Lookout",
      membership: { status: "ACTIVE" },
      presence: {
        state: "RECENTLY_LOST",
        lastSeenAt: "2026-09-06T11:59:00.000Z",
        activeDeviceCount: 0,
        safeActivity: null,
      },
      synchronization: { state: "CATCHING_UP", lag: 2 },
      readiness: { state: "NOT_READY" },
      isCaptainsOwnPlayerMembership: false,
      canReceiveCaptaincy: true,
    },
  ],
  progress: {
    currentChapter: "The Lantern Room",
    currentCheckpoint: "Open the map",
    currentSequence: 12,
    pendingCaptain: false,
    pendingPlayer: true,
    providerWaiting: false,
    blockedRequirementCount: 0,
    updatedAt: "2026-09-06T12:00:00.000Z",
  },
  events: [
    {
      id: "event-1",
      category: "PLAYER_PROGRESS",
      timestamp: "2026-09-06T12:00:00.000Z",
      sequence: 12,
      safeActorLabel: "Mira",
      summary: "Mira selected a course.",
    },
  ],
};

describe("CaptainOperationalPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("makes readiness, presence, synchronization, freshness, and action consequence scannable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(projection)));
    render(<CaptainOperationalPanel voyageId="voyage-1" authenticated />);

    expect(await screen.findByRole("heading", { name: "What needs your attention" })).toBeVisible();
    expect(screen.getByText("Who is ready")).toBeVisible();
    expect(screen.getByText("Who is present")).toBeVisible();
    expect(screen.getByText("Synchronization")).toBeVisible();
    expect(screen.getByText("Is this view current?")).toBeVisible();
    expect(screen.getByText("Transfers Captain authority and preserves this Voyage")).toBeVisible();
    expect(screen.getByText(/Cancellation is deliberate/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Transfer Captaincy" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel Voyage for Everyone" })).toBeVisible();
    expect(screen.getByText("Show operational source details")).toBeVisible();
  });
});
