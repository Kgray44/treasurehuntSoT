import { describe, expect, it } from "vitest";
import {
  archiveChronology,
  compareArchiveIdentity,
  decodeArchiveCursor,
  encodeArchiveCursor,
  formatDuration,
  invitationArchiveDate,
  isAfterArchiveCursor,
  presentArtifactState,
  presentLifecycle,
  presentOutcome,
  presentTiming,
} from "@/wakebook/presentation";

describe("Wakebook archive presentation", () => {
  it("uses completed, started, then joined time and preserves an unavailable date", () => {
    const completed = new Date("2026-04-03T12:00:00.000Z");
    const started = new Date("2026-04-02T12:00:00.000Z");
    const joined = new Date("2026-04-01T12:00:00.000Z");

    expect(archiveChronology(completed, started, joined)).toEqual({
      archiveDate: completed.toISOString(),
      year: 2026,
      dateQuality: "EXACT",
    });
    expect(archiveChronology(null, started, joined).archiveDate).toBe(started.toISOString());
    expect(archiveChronology(null, null, joined).archiveDate).toBe(joined.toISOString());
    expect(archiveChronology(null, null, null)).toEqual({
      archiveDate: null,
      year: null,
      dateQuality: "UNAVAILABLE",
    });
  });

  it("round-trips a versioned opaque cursor and rejects malformed or sort-mismatched cursors", () => {
    const cursor = { v: 1 as const, sort: "NEWEST" as const, date: "2026-04-03T12:00:00.000Z", id: "record-9" };
    const encoded = encodeArchiveCursor(cursor);

    expect(encoded).not.toContain("record-9");
    expect(decodeArchiveCursor(encoded, "NEWEST")).toEqual(cursor);
    expect(() => decodeArchiveCursor(encoded, "OLDEST")).toThrow("Archive cursor is invalid.");
    expect(() => decodeArchiveCursor("not-a-cursor", "NEWEST")).toThrow("Archive cursor is invalid.");
  });

  it("orders dates and deterministic IDs without moving unavailable dates ahead of known history", () => {
    const newer = { id: "record-b", chronology: archiveChronology(new Date("2026-04-03Z"), null, null) };
    const older = { id: "record-a", chronology: archiveChronology(new Date("2025-04-03Z"), null, null) };
    const unavailable = { id: "record-z", chronology: archiveChronology(null, null, null) };

    expect([older, unavailable, newer].sort((a, b) => compareArchiveIdentity(a, b, "NEWEST"))).toEqual([
      newer,
      older,
      unavailable,
    ]);
    expect([newer, unavailable, older].sort((a, b) => compareArchiveIdentity(a, b, "OLDEST"))).toEqual([
      older,
      newer,
      unavailable,
    ]);
    expect(
      isAfterArchiveCursor(older, { v: 1, sort: "NEWEST", date: newer.chronology.archiveDate, id: newer.id }, "NEWEST"),
    ).toBe(true);
  });

  it("presents known lifecycle and outcome states without exposing internal completion identifiers", () => {
    expect(presentLifecycle("PAUSED").humanLabel).toBe("Paused");
    expect(presentLifecycle("FUTURE_INTERNAL_STATE").humanLabel).toBe("History status unavailable");
    expect(presentOutcome("COMPLETED:internal-ending-id")).toEqual({
      label: "Completed",
      quality: "SAFE_GENERIC",
    });
    expect(presentOutcome("opaque-internal-value")).toEqual({
      label: "Outcome unavailable",
      quality: "UNAVAILABLE",
    });
  });

  it("distinguishes exact, estimated, unavailable, and not-applicable timing", () => {
    expect(presentTiming(3720, "EXACT")).toEqual({ seconds: 3720, quality: "EXACT", humanLabel: "1 hr 2 min" });
    expect(presentTiming(600, "ESTIMATED").humanLabel).toBe("Approx. 10 min");
    expect(presentTiming(null, "EXACT").humanLabel).toBe("Duration unavailable");
    expect(formatDuration(null, "NOT_APPLICABLE")).toBe("Not applicable");
  });

  it("keeps shared artifact evidence distinct from personal Cabinet state", () => {
    expect(presentArtifactState("OWNED")).toBe("In your Artifact Cabinet");
    expect(presentArtifactState("UNRECOGNIZED")).toBe("Recorded in your Artifact Cabinet");
  });

  it("dates invitation history from accepted terminal evidence before view or creation", () => {
    const acceptedAt = new Date("2026-02-03T00:00:00.000Z");
    expect(
      invitationArchiveDate({
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        viewedAt: new Date("2026-02-02T00:00:00.000Z"),
        acceptedAt,
        declinedAt: null,
        revokedAt: null,
        expiresAt: new Date("2026-03-01T00:00:00.000Z"),
        status: "ACCEPTED",
      }),
    ).toEqual({ archiveDate: acceptedAt.toISOString(), year: 2026, dateQuality: "EXACT" });
  });
});
