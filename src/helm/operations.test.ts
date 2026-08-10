import { describe, expect, it } from "vitest";
import {
  classifyAggregatePresence,
  compareCaptainOperationalPriority,
  deriveCaptainNeedsAttention,
  deriveCaptainOperationalStatus,
  projectCaptainOperationalEvent,
  projectMembershipPresenceOperationalEvent,
  summarizeCrewPresence,
} from "./operations";

const now = new Date("2026-08-10T20:00:00.000Z");

describe("Helm Phase 2 operational projections", () => {
  it("maps aggregate evidence truthfully and preserves unknown", () => {
    expect(classifyAggregatePresence(null, now)).toBe("UNKNOWN");
    expect(classifyAggregatePresence(new Date("2026-08-10T19:59:30.000Z"), now)).toBe("CONNECTED_SYNCED");
    expect(classifyAggregatePresence(new Date("2026-08-10T19:57:00.000Z"), now)).toBe("RECENTLY_LOST");
    expect(classifyAggregatePresence(new Date("2026-08-10T19:50:00.000Z"), now)).toBe("NOT_CURRENTLY_CONNECTED");
  });

  it("derives stable deduplicated attention from canonical facts", () => {
    const input = {
      voyageId: "voyage-1",
      pendingVerification: {
        id: "verify-1",
        providerType: "manual",
        requestedAt: new Date("2026-08-10T19:00:00.000Z"),
      },
      membershipStates: ["READY", "INVITED", "ACCEPTED"],
      sessionStatus: "ACTIVE",
      memberPresence: [
        {
          membershipId: "membership-1",
          displayName: "Safe Crew",
          membershipStatus: "READY",
          presence: {
            state: "STALE" as const,
            lastSeenAt: "2026-08-10T19:50:00.000Z",
            activeDeviceCount: 0,
            acknowledgedSequence: null,
            eventLag: null,
            synchronized: null,
            synchronizationState: "UNKNOWN" as const,
            safeActivity: null,
            evidenceUpdatedAt: "2026-08-10T19:50:00.000Z",
          },
        },
      ],
      updatedAt: new Date("2026-08-10T19:55:00.000Z"),
      now,
    };
    const first = deriveCaptainNeedsAttention(input);
    const second = deriveCaptainNeedsAttention(input);
    expect(first.map((item) => item.key)).toEqual(second.map((item) => item.key));
    expect(first.map((item) => item.severity)).toEqual(["HIGH", "HIGH", "WARNING"]);
    expect(first.every((item) => item.dismissible === false && item.resolved === false)).toBe(true);
  });

  it("does not rewrite canonical lifecycle when deriving operational status", () => {
    expect(
      deriveCaptainOperationalStatus({ sessionStatus: "ACTIVE", membershipStates: ["READY"], attention: [] }),
    ).toBe("ACTIVE_HEALTHY");
    expect(
      deriveCaptainOperationalStatus({
        sessionStatus: "ACTIVE",
        membershipStates: ["READY"],
        attention: deriveCaptainNeedsAttention({
          voyageId: "voyage-1",
          pendingVerification: { id: "verify-1", providerType: "manual", requestedAt: now },
          membershipStates: ["READY"],
          sessionStatus: "ACTIVE",
          updatedAt: now,
          now,
        }),
      }),
    ).toBe("ACTIVE_ATTENTION");
    expect(
      deriveCaptainOperationalStatus({ sessionStatus: "PAUSED", membershipStates: ["READY"], attention: [] }),
    ).toBe("PAUSED");
  });

  it("orders severity before status and uses a stable identifier fallback", () => {
    const empty: [] = [];
    const warning = deriveCaptainNeedsAttention({
      voyageId: "warning",
      pendingVerification: null,
      membershipStates: ["INVITED"],
      sessionStatus: "ACTIVE",
      updatedAt: now,
      now,
    });
    expect(
      compareCaptainOperationalPriority(
        { status: "ACTIVE_HEALTHY", attention: empty, firstObservedAt: "2026-08-10T19:00:00.000Z", id: "b" },
        { status: "ACTIVE_HEALTHY", attention: warning, firstObservedAt: "2026-08-10T19:01:00.000Z", id: "a" },
      ),
    ).toBeGreaterThan(0);
    expect(
      compareCaptainOperationalPriority(
        { status: "SETUP", attention: empty, firstObservedAt: "2026-08-10T19:00:00.000Z", id: "b" },
        { status: "SETUP", attention: empty, firstObservedAt: "2026-08-10T19:00:00.000Z", id: "a" },
      ),
    ).toBeGreaterThan(0);
  });

  it("allows only operational event fields into the event DTO", () => {
    const event = projectCaptainOperationalEvent({
      id: "event-1",
      eventType: "verificationAccepted",
      sequence: 7,
      createdAt: now,
    });
    expect(event).toEqual({
      id: "event-1",
      category: "VERIFICATION",
      timestamp: now.toISOString(),
      sequence: 7,
      safeActorLabel: "Voyage system",
      summary: "Verification Accepted",
      sourceAuthority: "TaleSessionEvent",
      sourceId: "event-1",
    });
    expect(JSON.stringify(event)).not.toMatch(
      /PRIVATE_REFLECTION_CANARY|ACCOUNT_EMAIL_CANARY|SESSION_SECRET_CANARY|RAW_VERIFICATION_CANARY|CREATOR_DRAFT_CANARY/,
    );
  });

  it("exposes a current member presence observation without a device identifier or permanent history", () => {
    const event = projectMembershipPresenceOperationalEvent({
      membershipId: "membership-1",
      displayName: "Safe Crew",
      presence: {
        state: "CONNECTED",
        lastSeenAt: now.toISOString(),
        activeDeviceCount: 2,
        acknowledgedSequence: 7,
        eventLag: 0,
        synchronized: true,
        synchronizationState: "SYNCHRONIZED",
        safeActivity: "JOURNAL",
        evidenceUpdatedAt: now.toISOString(),
      },
      computedAt: now,
    });
    expect(event).toMatchObject({ category: "CONNECTION", safeActorLabel: "Safe Crew", sourceId: "membership-1" });
    expect(JSON.stringify(event)).not.toMatch(/deviceInstanceId|550e8400|JOURNAL/);
  });

  it("keeps removed members out of connection summaries and observations", () => {
    const presence = {
      state: "RECENTLY_LOST" as const,
      lastSeenAt: now.toISOString(),
      activeDeviceCount: 0,
      acknowledgedSequence: null,
      eventLag: null,
      synchronized: null,
      synchronizationState: "UNKNOWN" as const,
      safeActivity: null,
      evidenceUpdatedAt: now.toISOString(),
    };
    expect(summarizeCrewPresence([{ membershipStatus: "REMOVED", presence }])).toMatchObject({
      total: 0,
      removed: 1,
      recentlyLost: 0,
    });
    expect(
      projectMembershipPresenceOperationalEvent({
        membershipId: "removed-member",
        displayName: "Removed Crew",
        membershipStatus: "REMOVED",
        presence,
        computedAt: now,
      }),
    ).toBeNull();
  });
});
