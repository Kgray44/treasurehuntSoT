import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

/** A disposable real SQLite authority. Import server code only after binding the owned database. */
export async function createDeviceLabVoyage(destination: string, worldspace: "PHYSICAL" | "VIRTUAL" = "PHYSICAL") {
  if (!["PHYSICAL", "VIRTUAL"].includes(worldspace)) throw new Error("LANDFALL_LAB_WORLDSPACE_INVALID");
  if ((globalThis as { prisma?: unknown }).prisma) throw new Error("LANDFALL_LAB_DATABASE_ALREADY_BOUND");
  const root = process.cwd();
  const parent = path.join(root, "artifacts", "landfall-device-lab");
  const directory = path.resolve(destination);
  const relative = path.relative(parent, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("LANDFALL_LAB_DATABASE_PATH_INVALID");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, "one-voyage.db");
  if (
    await stat(file).then(
      () => true,
      () => false,
    )
  )
    throw new Error("LANDFALL_LAB_DATABASE_ALREADY_EXISTS");
  const sqlite = new DatabaseSync(file);
  try {
    sqlite.exec("PRAGMA foreign_keys = ON;");
    const migrations = path.join(root, "prisma", "migrations");
    for (const name of (await readdir(migrations)).sort()) {
      const sql = path.join(migrations, name, "migration.sql");
      if (
        await stat(sql).then(
          () => true,
          () => false,
        )
      )
        sqlite.exec(await readFile(sql, "utf8"));
    }
    assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length, 0);
  } catch (error) {
    sqlite.close();
    await rm(file, { force: true });
    throw error;
  } finally {
    if (sqlite.isOpen) sqlite.close();
  }
  let disconnect: (() => Promise<void>) | undefined;
  const removeDatabase = async () => {
    try {
      await disconnect?.();
    } finally {
      for (const suffix of ["", "-journal", "-wal", "-shm"]) await rm(file + suffix, { force: true });
    }
  };
  try {
    process.env.DATABASE_URL = `file:${file.replaceAll("\\", "/")}`;
    const { db } = await import("../../../src/lib/db");
    disconnect = () => db.$disconnect();
    const { landfallFixture, physicalObservation } = await import("../../../src/landfall/fixtures");
    const { submitPlayerLandfallEvidence } = await import("../../../src/chronicle/progression");
    const { playerCanAccessPlaythrough } = await import("../../../src/platform/auth");
    const { projectRecordedLandfallEvidence } = await import("../../../src/landfall/recorded-evidence");
    const definition = structuredClone(landfallFixture);
    definition.worldspaces[0].observationPolicy.allowedSources.push("NATIVE_LOCATION");
    definition.waypoints[0].evidenceProfile.acceptedSources.push("NATIVE_LOCATION");
    definition.routes[0].semantics = "ILLUSTRATIVE";
    if (worldspace === "VIRTUAL") {
      const world = definition.worldspaces.find((item) => item.kind === "VIRTUAL")!;
      definition.worldspaces = [world];
      definition.maps = definition.maps.filter((item) => item.worldspaceId === world.id);
      definition.waypoints = definition.waypoints.filter((item) => item.worldspaceId === world.id);
      definition.routes = definition.routes.filter((item) => item.worldspaceId === world.id);
      definition.transitions = [];
      definition.waypoints[0].visibility.hiddenUntilRevealed = false;
    }
    const targetWorld = definition.worldspaces[0].id;
    const targetWaypoint = definition.waypoints[0].id;
    const snapshot = {
      schemaVersion: 1,
      tale: {
        id: "fixture-tale",
        title: "Synthetic Device Lab Voyage",
        slug: "synthetic-device-lab",
        theme: "CARTOGRAPHERS_TABLE",
      },
      chapters: [
        {
          id: "chapter",
          title: "Synthetic arrival",
          orderIndex: 0,
          blocks: [
            {
              id: "active",
              chapterId: "chapter",
              title: "Arrival",
              blockType: "waypointJourney",
              configuration: { worldspaceId: targetWorld, waypointId: targetWaypoint },
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
      publishedAt: "2026-10-03T12:00:00.000Z",
    };
    const contentSnapshot = JSON.stringify(snapshot);
    const checksum = createHash("sha256").update(contentSnapshot).digest("hex");
    await db.chronicle.create({
      data: {
        id: "fixture-tale",
        slug: "synthetic-device-lab",
        title: snapshot.tale.title,
        creatorId: "synthetic-captain",
      },
    });
    await db.publishedTaleVersion.create({
      data: {
        id: "version-1",
        taleId: "fixture-tale",
        versionNumber: 1,
        versionLabel: "Synthetic v1",
        publishedBy: "synthetic-captain",
        contentSnapshot,
        checksum,
      },
    });
    await db.taleSession.create({
      data: {
        id: "session-1",
        taleId: "fixture-tale",
        publishedVersionId: "version-1",
        captainId: "synthetic-captain",
        accessTokenHash: createHash("sha256").update("synthetic-unusable-lab-token").digest("hex"),
        currentChapterId: "chapter",
        currentBlockId: "active",
        currentSequence: 0,
      },
    });
    await db.playerProfile.create({ data: { id: "synthetic-player", displayName: "Synthetic Lab Player" } });
    await db.playthroughMembership.create({
      data: { playthroughId: "session-1", playerProfileId: "synthetic-player", status: "ACTIVE_MEMBER" },
    });
    return {
      fixtureHash: checksum,
      evidence: (id: string) => ({
        schemaVersion: 1,
        sessionId: "session-1",
        publishedVersionId: "version-1",
        worldspaceId: targetWorld,
        waypointId: targetWaypoint,
        evidenceId: id,
        expectedSequence: 0,
        idempotencyKey: `synthetic-${id}`,
        method: worldspace === "VIRTUAL" ? "PLAYER_FALLBACK" : "FOREGROUND_LOCATION",
        observations:
          worldspace === "VIRTUAL"
            ? undefined
            : [0, 1].map((index) => ({
                ...physicalObservation(
                  index === 1 ? id : `first-${id}`,
                  new Date(Date.now() - (2 - index) * 1000).toISOString(),
                ),
                providerId: "android-location",
                source: "NATIVE_LOCATION",
              })),
      }),
      submit: async (request: unknown, actor = "synthetic-player") => {
        if (!(await playerCanAccessPlaythrough("session-1", actor)))
          throw new Error("LANDFALL_LAB_MEMBERSHIP_UNAVAILABLE");
        return submitPlayerLandfallEvidence(request, actor);
      },
      revoke: () =>
        db.playthroughMembership.updateMany({ where: { playthroughId: "session-1" }, data: { status: "REMOVED" } }),
      authorize: async (evidence?: { evidenceId: string }) => {
        if (!(await playerCanAccessPlaythrough("session-1", "synthetic-player"))) return { state: "REVOKED" as const };
        const session = await db.taleSession.findUniqueOrThrow({ where: { id: "session-1" } });
        const recordedEvidence = evidence
          ? projectRecordedLandfallEvidence(
              await db.taleSessionEvent.findUnique({
                where: { idempotencyKey: `landfall:session-1:${evidence.evidenceId}` },
              }),
              {
                sessionId: "session-1",
                publishedVersionId: session.publishedVersionId!,
                playerProfileId: "synthetic-player",
                evidenceId: evidence.evidenceId,
              },
            )
          : null;
        return {
          state: "AUTHORIZED" as const,
          sessionId: session.id,
          publishedVersionId: session.publishedVersionId!,
          currentSequence: session.currentSequence,
          replayOnly: session.status !== "ACTIVE",
          recordedEvidence,
        };
      },
      counts: async () => ({
        canonicalProgressionEvents: await db.taleSessionEvent.count({
          where: { sessionId: "session-1", eventType: "landfallWaypointConfirmed" },
        }),
        blockCompletions: await db.taleSessionEvent.count({
          where: { sessionId: "session-1", eventType: "blockCompleted" },
        }),
        currentBlock: (await db.taleSession.findUniqueOrThrow({ where: { id: "session-1" } })).currentBlockId,
        rawLocationsRetained: /latitude|longitude|observations/.test(
          JSON.stringify(await db.taleSessionEvent.findMany()),
        ),
      }),
      cleanup: async () => {
        await removeDatabase();
        return !(await stat(file).then(
          () => true,
          () => false,
        ));
      },
    };
  } catch (error) {
    await removeDatabase();
    throw error;
  }
}

async function main() {
  const directory = path.join(
    process.cwd(),
    "artifacts",
    "landfall-device-lab",
    `authority-${Date.now()}-${process.pid}`,
  );
  const voyage = await createDeviceLabVoyage(directory, process.argv[2] === "--virtual" ? "VIRTUAL" : "PHYSICAL");
  const assertions: string[] = [];
  let cleaned = false;
  try {
    const request = voyage.evidence("synthetic-native-arrival");
    await assert.rejects(voyage.submit(request, "wrong-player"), /MEMBERSHIP/);
    assertions.push("wrong-actor-rejected");
    await assert.rejects(voyage.submit({ ...request, publishedVersionId: "wrong-pin" }), /STALE_VERSION/);
    assertions.push("wrong-pin-rejected");
    await assert.rejects(voyage.submit({ ...request, expectedSequence: 9 }), /Voyage changed/);
    assertions.push("stale-sequence-rejected");
    await assert.rejects(
      voyage.submit({ ...request, worldspaceId: request.worldspaceId === "town" ? "isles" : "town" }),
      /WRONG_WORLDSPACE/,
    );
    assertions.push("cross-worldspace-evidence-rejected");
    const result = await voyage.submit(request);
    assert.equal(result.advanced, true);
    assert.equal(result.duplicate, false);
    assertions.push("real-canonical-writer-advanced");
    const retries = await Promise.all([voyage.submit(request), voyage.submit(request)]);
    assert.ok(retries.every((receipt) => receipt.duplicate));
    assertions.push("concurrent-retries-idempotent");
    const acknowledgement = await voyage.authorize({ evidenceId: request.evidenceId });
    assert.equal(acknowledgement.state, "AUTHORIZED");
    if (acknowledgement.state === "AUTHORIZED") {
      assert.deepEqual(acknowledgement.recordedEvidence, {
        evidenceId: request.evidenceId,
        worldspaceId: request.worldspaceId,
        waypointId: request.waypointId,
      });
      assert.ok(acknowledgement.currentSequence > request.expectedSequence);
    }
    assertions.push("lost-response-actor-bound-acknowledgement");
    const counts = await voyage.counts();
    assert.equal(counts.canonicalProgressionEvents, 1);
    assert.equal(counts.blockCompletions, 1);
    assert.equal(counts.currentBlock, "next");
    assert.equal(counts.rawLocationsRetained, false);
    assertions.push("actual-database-counts-and-private-receipts");
    await voyage.revoke();
    await assert.rejects(voyage.submit(request), /MEMBERSHIP/);
    assertions.push("revoked-membership-cannot-replay");
    await writeFile(
      path.join(directory, "authority.json"),
      JSON.stringify(
        { version: 1, authority: "ONE_VOYAGE_REAL_SQLITE", fixtureHash: voyage.fixtureHash, assertions, counts },
        null,
        2,
      ),
    );
  } finally {
    cleaned = await voyage.cleanup();
    await writeFile(
      path.join(directory, "cleanup.json"),
      JSON.stringify({ result: cleaned ? "PASS" : "FAIL", remainingResources: cleaned ? [] : ["one-voyage.db"] }),
    );
  }
  if (!cleaned) throw new Error("LANDFALL_LAB_DATABASE_CLEANUP_FAILED");
  process.stdout.write(`${JSON.stringify({ result: "PASS", assertions, directory })}\n`);
}
async function worker() {
  const voyage = await createDeviceLabVoyage(
    process.argv[3],
    (process.argv[4] ?? "PHYSICAL") as "PHYSICAL" | "VIRTUAL",
  );
  process.send?.({ ready: true, fixtureHash: voyage.fixtureHash });
  process.on("message", async (message: unknown) => {
    const input = message as { id?: unknown; operation?: unknown; value?: unknown };
    if (!Number.isInteger(input?.id)) return;
    try {
      let value: unknown;
      if (input.operation === "submit") value = await voyage.submit(input.value);
      else if (input.operation === "counts") value = await voyage.counts();
      else if (input.operation === "authorize")
        value = await voyage.authorize(input.value as { evidenceId: string } | undefined);
      else if (input.operation === "cleanup") value = await voyage.cleanup();
      else throw new Error("LANDFALL_LAB_AUTHORITY_OPERATION_INVALID");
      process.send?.({ id: input.id, value }, () => {
        if (input.operation === "cleanup") process.disconnect();
      });
    } catch (error) {
      process.send?.({
        id: input.id,
        error: error instanceof Error ? error.message.slice(0, 160) : "LANDFALL_LAB_AUTHORITY_FAILED",
      });
    }
  });
}
if (process.argv[1]?.endsWith("one-voyage.ts"))
  (process.argv[2] === "--worker" ? worker() : main()).catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
