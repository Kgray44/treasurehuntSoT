import { describe, expect, it } from "vitest";
import { canonicalJson, sha256, TIDEGLASS_LIMITS, type TideglassCompareRequest } from "../../src/tideglass/core";
import { diagnosticProjection, publicSafeFoundationProjection } from "../../src/tideglass/comparison";
import { compareExactEditions, type TideglassPublishedEdition } from "../../src/tideglass/service";
import { baseSnapshot, clone, edition, FixtureRepository } from "./fixtures";

const principal = { kind: "ACCOUNT" as const, accountId: "synthetic-creator-account" };

function request(sourceEditionId = "edition-a", targetEditionId = "edition-b"): TideglassCompareRequest {
  return { chronicleId: "chronicle-tideglass", sourceEditionId, targetEditionId };
}

describe("Tideglass service authorization, integrity, and projection boundaries", () => {
  it("F22 compares an exact edition to itself as NO_MEANINGFUL_CHANGE and authorizes both anchors", async () => {
    const item = edition("edition-a", baseSnapshot());
    const repository = new FixtureRepository([item]);
    const result = await compareExactEditions(repository, principal, request("edition-a", "edition-a"));
    expect(result.ok && result.value.changeSet.status).toBe("NO_MEANINGFUL_CHANGE");
    expect(repository.authorizationCalls).toEqual(["edition-a", "edition-a"]);
    expect(result.ok && result.value.receipt.sourceEditionId).toBe("edition-a");
    expect(result.ok && result.value.receipt.targetEditionId).toBe("edition-a");
  });

  it("F24 rejects exact edition IDs from different Chronicles", async () => {
    const source = edition("edition-a", baseSnapshot());
    const otherSnapshot = baseSnapshot();
    otherSnapshot.tale.id = "chronicle-other";
    const target = edition("edition-b", otherSnapshot, { chronicleId: "chronicle-other" });
    const result = await compareExactEditions(new FixtureRepository([source, target]), principal, request());
    expect(result).toMatchObject({ ok: false, code: "CROSS_CHRONICLE_COMPARISON" });
  });

  it("F25 fails closed when a historical target edition is unauthorized", async () => {
    const source = edition("edition-a", baseSnapshot());
    const target = edition("edition-b", baseSnapshot());
    const repository = new FixtureRepository([source, target], new Set(["edition-a"]));
    const result = await compareExactEditions(repository, principal, request());
    expect(result).toMatchObject({ ok: false, code: "EDITION_NOT_AUTHORIZED" });
    expect(JSON.stringify(result)).not.toContain("edition-b");
  });

  it("fails closed for source-only, target-only, and fully unauthorized access", async () => {
    const source = edition("edition-a", baseSnapshot());
    const target = edition("edition-b", baseSnapshot());
    for (const authorized of [new Set(["edition-a"]), new Set(["edition-b"]), new Set<string>()]) {
      const result = await compareExactEditions(
        new FixtureRepository([source, target], authorized),
        principal,
        request(),
      );
      expect(result).toMatchObject({ ok: false, code: "EDITION_NOT_AUTHORIZED" });
    }
  });

  it("binds comparison to the exact published snapshot checksum", async () => {
    const source = edition("edition-a", baseSnapshot());
    const target = { ...edition("edition-b", baseSnapshot()), checksum: "0".repeat(64) };
    const result = await compareExactEditions(new FixtureRepository([source, target]), principal, request());
    expect(result).toMatchObject({ ok: false, code: "CHECKSUM_MISMATCH" });
  });

  it("returns one generic unavailable error for missing exact IDs without enumeration detail", async () => {
    const source = edition("edition-a", baseSnapshot());
    const result = await compareExactEditions(new FixtureRepository([source]), principal, request());
    expect(result).toMatchObject({ ok: false, code: "EDITION_NOT_FOUND" });
    expect(JSON.stringify(result)).not.toContain("edition-b");
  });

  it("rejects malformed identifiers and client-supplied diagnostic privilege mode", async () => {
    const repository = new FixtureRepository([]);
    const malformed = await compareExactEditions(repository, principal, {
      chronicleId: "../private",
      sourceEditionId: "edition-a",
      targetEditionId: "edition-b",
    });
    const escalated = await compareExactEditions(repository, principal, {
      ...request(),
      mode: "creator",
    } as TideglassCompareRequest);
    expect(malformed).toMatchObject({ ok: false, code: "EDITION_NOT_FOUND" });
    expect(escalated).toMatchObject({ ok: false, code: "EDITION_NOT_FOUND" });
  });

  it("rejects oversized/pathological snapshot input before semantic traversal", async () => {
    const snapshot = { ...baseSnapshot(), padding: "x".repeat(TIDEGLASS_LIMITS.snapshotBytes + 1) };
    const source = edition("edition-a", snapshot);
    const target = edition("edition-b", snapshot);
    const result = await compareExactEditions(new FixtureRepository([source, target]), principal, request());
    expect(result).toMatchObject({ ok: false, code: "COMPARISON_LIMIT_EXCEEDED" });
  });

  it("reports invalid current-schema data without returning the invalid payload", async () => {
    const raw = '{"schemaVersion":1,"tale":{"id":"chronicle-tideglass","title":"PRIVATE_SENTINEL"},"chapters":"bad"}';
    const invalid: TideglassPublishedEdition = {
      id: "edition-a",
      chronicleId: "chronicle-tideglass",
      contentSnapshot: raw,
      schemaVersion: 1,
      checksum: sha256(raw),
    };
    const result = await compareExactEditions(
      new FixtureRepository([invalid]),
      principal,
      request("edition-a", "edition-a"),
    );
    expect(result).toMatchObject({ ok: false, code: "PUBLISHED_SNAPSHOT_INVALID" });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
  });

  it("never leaks raw snapshots, storage paths, answers, Creator notes, or Captain-only prose", async () => {
    const sourceSnapshot = baseSnapshot();
    sourceSnapshot.assets[0].storageKey = "STORAGE_KEY_SENTINEL";
    sourceSnapshot.chapters[0].blocks[0].creatorNotes = "CREATOR_NOTE_SENTINEL";
    sourceSnapshot.chapters[0].blocks.push({
      id: "block-secret-answer",
      chapterId: "chapter-opening",
      blockType: "textAnswer",
      title: "Synthetic answer",
      configuration: {
        prompt: "Safe prompt",
        acceptedAnswers: ["SECRET_ANSWER_SENTINEL"],
        caseSensitive: false,
        normalizeWhitespace: true,
        feedback: "Try again",
        hints: [],
        completionMode: "textAnswer",
      },
      presentation: {},
      completion: { captainInstruction: "CAPTAIN_ONLY_SENTINEL" },
      creatorNotes: "CREATOR_NOTE_SENTINEL",
      isEnabled: true,
      schemaVersion: 1,
      orderIndex: 2,
      nextBlockId: null,
      connections: [],
    });
    const targetSnapshot = clone(sourceSnapshot);
    (targetSnapshot.chapters[0].blocks.at(-1)?.configuration as Record<string, unknown>).acceptedAnswers = [
      "CHANGED_SECRET_ANSWER_SENTINEL",
    ];
    const result = await compareExactEditions(
      new FixtureRepository([edition("edition-a", sourceSnapshot), edition("edition-b", targetSnapshot)]),
      principal,
      request(),
    );
    if (!result.ok) throw new Error(result.code);
    const diagnostic = JSON.stringify(diagnosticProjection(result.value));
    const publicSafeProjection = publicSafeFoundationProjection(result.value);
    const publicSafe = JSON.stringify(publicSafeProjection);
    for (const sentinel of [
      "STORAGE_KEY_SENTINEL",
      "SECRET_ANSWER_SENTINEL",
      "CHANGED_SECRET_ANSWER_SENTINEL",
      "CREATOR_NOTE_SENTINEL",
      "CAPTAIN_ONLY_SENTINEL",
    ]) {
      expect(diagnostic).not.toContain(sentinel);
      expect(publicSafe).not.toContain(sentinel);
    }
    expect(publicSafe).not.toContain("block-secret-answer");
    expect(publicSafe).not.toContain("semanticPath");
    expect(publicSafeProjection.safeChangeCount).toBe(0);
    expect(publicSafeProjection.hasWithheldChanges).toBe(true);
    expect(publicSafeProjection).not.toHaveProperty("changeCount");
    expect(publicSafeProjection).not.toHaveProperty("categoryCounts");
  });

  it("reports unsupported schemas honestly as a partial safe-anchor comparison", async () => {
    const raw = JSON.stringify({ schemaVersion: 99, unknowable: "PRIVATE_UNKNOWN_SENTINEL" });
    const item = (id: string): TideglassPublishedEdition => ({
      id,
      chronicleId: "chronicle-tideglass",
      contentSnapshot: raw,
      schemaVersion: 99,
      checksum: sha256(raw),
    });
    const result = await compareExactEditions(
      new FixtureRepository([item("edition-a"), item("edition-b")]),
      principal,
      request(),
    );
    expect(result.ok && result.value.changeSet.status).toBe("PARTIAL");
    expect(result.ok && result.value.changeSet.unsupportedSections[0]).toMatchObject({ code: "SCHEMA_UNSUPPORTED" });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_UNKNOWN_SENTINEL");
  });

  it("supports cancellation through the bounded failure union", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await compareExactEditions(new FixtureRepository([]), principal, request(), {
      signal: controller.signal,
    });
    expect(result).toMatchObject({ ok: false, code: "COMPARISON_CANCELLED" });
  });

  it("does not mutate published rows, live Voyages, Wayfarer history, or Community releases", async () => {
    const source = edition("edition-a", baseSnapshot());
    const targetSnapshot = baseSnapshot();
    targetSnapshot.tale.title = "Changed synthetic title";
    const target = edition("edition-b", targetSnapshot);
    const state = {
      publishedVersions: [source, target],
      taleSessions: [
        {
          id: "session-fixture",
          publishedVersionId: "edition-a",
          currentChapterId: "chapter-opening",
          currentBlockId: "block-opening",
          currentSequence: 17,
          memberships: ["membership-fixture"],
          inventory: ["artifact-glass-token"],
          variables: { safe: true },
          events: ["event-fixture"],
        },
      ],
      wayfarerHistory: [{ publishedVersionId: "edition-a", checksum: source.checksum }],
      communityReleases: [{ publishedVersionId: "edition-b", packageChecksum: "community-checksum" }],
    };
    const before = canonicalJson(state);
    const result = await compareExactEditions(new FixtureRepository(state.publishedVersions), principal, request());
    expect(result.ok).toBe(true);
    expect(canonicalJson(state)).toBe(before);
  });
});
