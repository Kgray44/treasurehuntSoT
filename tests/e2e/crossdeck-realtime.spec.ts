// @sounding-line-registration owner=project-crossdeck suite=browser.crossdeck contracts=crossdeck.phase2.continuity
import { test, expect, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { createAccountSession } from "../../src/wayfarer/accounts";
import { closureAccount, closureVoyage, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { projectCapabilities } from "../../src/crossdeck/contracts";

test.describe.configure({ mode: "serial", timeout: 600000 });
test.afterAll(() => db.$disconnect());
const baselineSha = "f458bf2dc1176016c2d166180f038f0f15ac9f7c";
type Driver = {
  metrics: {
    reads: number;
    failures: number;
    snapshots: number[];
    events: number;
    opened: number;
    latest: number;
    readLatencies: number[];
    visibleAt: number;
    stopped: boolean;
    errors: string[];
  };
  stop: () => void;
};
declare global {
  interface Window {
    CrossdeckTransport: {
      createHttpSyncTransport: (...args: unknown[]) => {
        subscribe: (next: (snapshot: { revision: number }) => void, failed: (error: Error) => void) => () => void;
      };
    };
    crossdeckDriver: Driver;
  }
}
const percentile = (samples: number[], p: number) =>
  [...samples].sort((a, b) => a - b)[Math.max(0, Math.ceil(samples.length * p) - 1)] ?? null;
async function bundles() {
  const current = await build({
    entryPoints: ["src/crossdeck/transport.ts"],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "CrossdeckTransport",
    platform: "browser",
  });
  const previous = execFileSync("git", ["show", `${baselineSha}:src/crossdeck/transport.ts`], { encoding: "utf8" });
  const old = await build({
    stdin: { contents: previous, loader: "ts" },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "CrossdeckTransport",
    platform: "browser",
  });
  return { current: current.outputFiles[0].text, previous: old.outputFiles[0].text };
}
async function start(page: Page, script: string, voyage: string, surface: string, csrf: string, suppress = false) {
  await page.addScriptTag({ content: script });
  await page.evaluate(
    ({ voyage, surface, csrf, suppress }) => {
      const metrics: Driver["metrics"] = {
        reads: 0,
        failures: 0,
        snapshots: [],
        events: 0,
        opened: 0,
        latest: -1,
        readLatencies: [],
        visibleAt: 0,
        stopped: false,
        errors: [],
      };
      const fetcher = async (url: RequestInfo | URL, init?: RequestInit) => {
        const begun = performance.now();
        if (!init?.method) metrics.reads++;
        try {
          return await fetch(url, init);
        } finally {
          metrics.readLatencies.push(performance.now() - begun);
        }
      };
      const environment = {
        events: (url: string) => {
          const event = new EventSource(url);
          event.addEventListener("open", () => metrics.opened++);
          const wrapped = new EventTarget();
          for (const kind of ["open", "error", "crossdeck-ended"])
            event.addEventListener(kind, () => wrapped.dispatchEvent(new Event(kind)));
          event.addEventListener("crossdeck-change", (message: MessageEvent) => {
            metrics.events++;
            if (!suppress) wrapped.dispatchEvent(new MessageEvent("crossdeck-change", { data: message.data }));
          });
          return Object.assign(wrapped, { close: () => event.close() });
        },
      };
      const transport = window.CrossdeckTransport.createHttpSyncTransport(
        voyage,
        surface,
        csrf,
        fetcher,
        undefined,
        environment,
      );
      const stop = transport.subscribe(
        (snapshot) => {
          metrics.latest = snapshot.revision;
          metrics.snapshots.push(snapshot.revision);
          metrics.visibleAt = performance.now();
        },
        (error: Error) => {
          metrics.failures++;
          metrics.errors.push(error.message);
        },
      );
      window.crossdeckDriver = {
        metrics,
        stop: () => {
          stop();
          metrics.stopped = true;
        },
      };
    },
    { voyage, surface, csrf, suppress },
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => ({ latest: window.crossdeckDriver.metrics.latest, visibility: document.visibilityState })),
      { timeout: 60000 },
    )
    .toMatchObject({ latest: expect.any(Number), visibility: "visible" });
  await expect
    .poll(() => page.evaluate(() => window.crossdeckDriver.metrics.latest), { timeout: 60000 })
    .toBeGreaterThanOrEqual(0);
}
test("actual browser transport load, event latency, missed-event recovery and revocation", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    !process.env.CROSSDECK_SERVER_METRICS_PATH,
    "Focused load measurement requires task-owned SQL/CPU counters.",
  );
  ensureGenericSoundingLineIsolation();
  const compiled = await bundles();
  const activeOnly = process.env.CROSSDECK_ACTIVE_MEASUREMENT_ONLY === "1";
  const output: Record<string, unknown> = {
    baselineSha,
    currentSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    dirtySource: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
    lockfileSha256: createHash("sha256")
      .update(await readFile("package-lock.json"))
      .digest("hex"),
    runtime: process.version,
    cohorts: [],
    qualification: "D1_BROWSER_HTTP_TRANSPORT_ONLY_NOT_PHYSICAL",
    measurementScope: activeOnly ? "ACTIVE_AND_RECOVERY_SUPPLEMENT" : "IDLE_AND_ACTIVE_COMPARISON",
  };
  const cohorts: unknown[] = [];
  const owned: BrowserContext[] = [];
  const extraBrowsers: Browser[] = [];
  try {
    for (const count of activeOnly ? [2] : [2, 5, 20, 32]) {
      const pages: {
        page: Page;
        context: BrowserContext;
        voyage: string;
        surface: string;
        csrf: string;
        session: string;
        account: string;
      }[] = [];
      for (let group = 0; group < Math.ceil(count / 10); group++) {
        const account = await closureAccount(`Synthetic transport load ${count}/${group}`);
        const voyage = await closureVoyage(account, account, "livingChart", { virtual: true });
        for (let index = 0; index < Math.min(10, count - group * 10); index++) {
          const session = await createAccountSession(account.id, "Synthetic browser transport load");
          // Distinct browser processes represent distinct devices and keep HTTP/1.1's
          // six per-origin sockets from making the load generator block its own reads.
          const processIndex = Math.floor(pages.length / 5);
          if (processIndex > extraBrowsers.length) extraBrowsers.push(await chromium.launch());
          const deviceBrowser = processIndex === 0 ? browser : extraBrowsers[processIndex - 1];
          const context = await deviceBrowser.newContext({
            viewport: { width: 390, height: 844 },
            reducedMotion: "reduce",
          });
          owned.push(context);
          await authenticateClosure(context, { ...account, token: session.token }, baseURL!);
          const list = await context.request.get(`${baseURL}/api/crossdeck?voyage=${voyage.id}`);
          expect(list.ok()).toBe(true);
          const { csrfToken } = await list.json();
          const surface = randomUUID();
          const registered = await context.request.post(`${baseURL}/api/crossdeck`, {
            headers: { "x-csrf-token": csrfToken },
            data: {
              action: "register",
              voyageId: voyage.id,
              surfaceId: surface,
              label: `Synthetic surface ${index + 1}`,
              capabilities: projectCapabilities({ formFactor: "PHONE", viewportClass: "COMPACT", reducedMotion: true }),
            },
          });
          expect(registered.ok(), await registered.text()).toBe(true);
          const initial = await context.request.get(
            `${baseURL}/api/crossdeck/sync?voyage=${voyage.id}&surface=${surface}`,
          );
          expect(initial.ok()).toBe(true);
          const page = await context.newPage();
          await page.goto(`${baseURL}/devices/pair`);
          pages.push({
            page,
            context,
            voyage: voyage.id,
            surface,
            csrf: csrfToken,
            session: session.id,
            account: account.id,
          });
        }
      }
      const result: Record<string, unknown> = {
        surfaces: count,
        personVoyageScopes: Math.ceil(count / 10),
        windowMs: 20000,
      };
      const idleModes = [
        ["polling500ms", compiled.previous],
        ["sse10s", compiled.current],
      ] as const;
      for (const [name, code] of activeOnly ? [] : idleModes) {
        console.log(`Crossdeck measure: ${count} surfaces, ${name}; steady state after staggered startup`);
        for (const participant of pages)
          await start(participant.page, code, participant.voyage, participant.surface, participant.csrf);
        const before = await Promise.all(
          pages.map((p) => p.page.evaluate(() => ({ ...window.crossdeckDriver.metrics }))),
        );
        const started = Date.now();
        const backendBefore = JSON.parse(await readFile(process.env.CROSSDECK_SERVER_METRICS_PATH!, "utf8"));
        await pages[0].page.waitForTimeout(20000);
        const after = await Promise.all(
          pages.map((p) => p.page.evaluate(() => ({ ...window.crossdeckDriver.metrics }))),
        );
        const elapsedMs = Date.now() - started;
        const backendAfter = JSON.parse(await readFile(process.env.CROSSDECK_SERVER_METRICS_PATH!, "utf8"));
        const requests = after.reduce((sum, m, i) => sum + m.reads - before[i].reads, 0);
        const durations = after.flatMap((m, i) => m.readLatencies.slice(before[i].readLatencies.length));
        result[name] = {
          startupFailures: before.reduce((sum, m) => sum + m.failures, 0),
          idleSnapshotRequests: requests,
          elapsedMs,
          aggregateRequestsPerSecond: (requests * 1000) / elapsedMs,
          failures: after.reduce((sum, m, i) => sum + m.failures - before[i].failures, 0),
          eventConnectionsOpened: after.reduce((sum, m) => sum + m.opened, 0),
          snapshotHttpLatencyMs: {
            samples: durations.length,
            p50: percentile(durations, 0.5),
            p95: percentile(durations, 0.95),
            p99: percentile(durations, 0.99),
          },
        };
        const first = backendBefore.samples.at(-1),
          last = backendAfter.samples.at(-1);
        const samples = backendAfter.samples.filter((sample: { at: number }) => sample.at > first.at);
        Object.assign(result[name] as object, {
          backend: {
            source: "actual Next process; Prisma SQL event counts; one-second sampling",
            querySamples: samples.length,
            observedSqlQueries: last.sqlQueries - first.sqlQueries,
            sampleElapsedMs: last.at - first.at,
            cpuUserMs: (last.cpuUserUs - first.cpuUserUs) / 1000,
            cpuSystemMs: (last.cpuSystemUs - first.cpuSystemUs) / 1000,
            rssBytesMin: Math.min(...samples.map((sample: { rssBytes: number }) => sample.rssBytes)),
            rssBytesMax: Math.max(...samples.map((sample: { rssBytes: number }) => sample.rssBytes)),
            prismaInstances: backendAfter.instances,
          },
        });
        await Promise.all(pages.map((p) => p.page.evaluate(() => window.crossdeckDriver.stop())));
      }
      if (!activeOnly) {
        const old = result.polling500ms as { idleSnapshotRequests: number },
          updated = result.sse10s as { idleSnapshotRequests: number };
        result.measuredIdleSnapshotReductionPercent =
          100 * (1 - updated.idleSnapshotRequests / old.idleSnapshotRequests);
        expect(updated.idleSnapshotRequests).toBeLessThan(old.idleSnapshotRequests / 5);
        cohorts.push(result);
      }
      if (count === 2) {
        const source = pages[0],
          target = pages[1];
        for (const participant of pages) {
          const heartbeat = await participant.context.request.post(`${baseURL}/api/crossdeck`, {
            headers: { "x-csrf-token": participant.csrf },
            data: { action: "heartbeat", surfaceId: participant.surface, lifecycle: "ACTIVE" },
          });
          expect(heartbeat.ok()).toBe(true);
        }
        const beforeProgression = await db.taleSessionEvent.count({ where: { sessionId: source.voyage } });
        await Promise.all(pages.map((p) => start(p.page, compiled.current, p.voyage, p.surface, p.csrf)));
        const activeBefore = await Promise.all(
          pages.map((p) => p.page.evaluate(() => ({ ...window.crossdeckDriver.metrics }))),
        );
        const activeBackendBefore = JSON.parse(await readFile(process.env.CROSSDECK_SERVER_METRICS_PATH!, "utf8"));
        const activeStarted = Date.now();
        const latencies: number[] = [];
        for (let index = 0; index < 20; index++) {
          const snapshot = await source.context.request.get(
            `${baseURL}/api/crossdeck/sync?voyage=${source.voyage}&surface=${source.surface}`,
          );
          const state = await snapshot.json();
          const begun = Date.now();
          const committed = await source.context.request.post(`${baseURL}/api/crossdeck/sync`, {
            headers: { "x-csrf-token": source.csrf },
            data: {
              voyageId: source.voyage,
              surfaceId: source.surface,
              messageId: randomUUID(),
              payloadSchemaVersion: 1,
              sequence: state.nextSequence,
              payload: { action: "focus", family: "MAP", targetId: target.surface },
            },
          });
          expect(committed.ok(), await committed.text()).toBe(true);
          const revision = (await committed.json()).revision;
          await expect
            .poll(() => target.page.evaluate(() => window.crossdeckDriver.metrics.latest), {
              intervals: [10, 20, 50],
              timeout: 3000,
            })
            .toBeGreaterThanOrEqual(revision);
          latencies.push(Date.now() - begun);
        }
        output.commandRequestToSnapshotMs = {
          samples: latencies.length,
          p50: percentile(latencies, 0.5),
          p95: percentile(latencies, 0.95),
          p99: percentile(latencies, 0.99),
          scope: "includes command HTTP round-trip, canonical fetch and driver callback; not physical display paint",
        };
        const activeAfter = await Promise.all(
          pages.map((p) => p.page.evaluate(() => ({ ...window.crossdeckDriver.metrics }))),
        );
        await target.page.waitForTimeout(1100); // Complete the one-second backend observation window.
        const activeBackendAfter = JSON.parse(await readFile(process.env.CROSSDECK_SERVER_METRICS_PATH!, "utf8"));
        const backendStart = activeBackendBefore.samples.at(-1),
          backendEnd = activeBackendAfter.samples.at(-1);
        output.activeChangeLoad = {
          commands: 20,
          explicitSequenceSnapshotReads: 20,
          notificationSnapshotReads: activeAfter.reduce((sum, m, i) => sum + m.reads - activeBefore[i].reads, 0),
          eventNotifications: activeAfter.reduce((sum, m, i) => sum + m.events - activeBefore[i].events, 0),
          eventConnectionsOpened: activeAfter.reduce((sum, m, i) => sum + m.opened - activeBefore[i].opened, 0),
          callbackWindowMs: Date.now() - activeStarted - 1100,
          backendSampleWindowMs: backendEnd.at - backendStart.at,
          observedSqlQueries: backendEnd.sqlQueries - backendStart.sqlQueries,
          cpuMs:
            (backendEnd.cpuUserUs + backendEnd.cpuSystemUs - backendStart.cpuUserUs - backendStart.cpuSystemUs) / 1000,
          scope:
            "actual HTTP commands; authorized sequence fetches plus subscribed fetches; sampled window includes periodic authority checks",
        };
        const focusOn = async (participant: typeof source, targetId: string, serverURL = baseURL!) => {
          const state = await (
            await participant.context.request.get(
              `${serverURL}/api/crossdeck/sync?voyage=${participant.voyage}&surface=${participant.surface}`,
            )
          ).json();
          return participant.context.request.post(`${serverURL}/api/crossdeck/sync`, {
            headers: { "x-csrf-token": participant.csrf },
            data: {
              voyageId: participant.voyage,
              surfaceId: participant.surface,
              messageId: randomUUID(),
              payloadSchemaVersion: 1,
              sequence: state.nextSequence,
              payload: { action: "focus", family: "MAP", targetId },
            },
          });
        };
        const crossProcessStarted = Date.now();
        const remote = await focusOn(source, source.surface, process.env.CROSSDECK_SECONDARY_URL!);
        expect(remote.ok(), await remote.text()).toBe(true);
        const remoteRevision = (await remote.json()).revision;
        await expect
          .poll(() => target.page.evaluate(() => window.crossdeckDriver.metrics.latest), { timeout: 3000 })
          .toBeGreaterThanOrEqual(remoteRevision);
        output.crossProcessCommandToSnapshotMs = Date.now() - crossProcessStarted;
        await target.context.setOffline(true);
        await target.page.evaluate(() => window.dispatchEvent(new Event("offline")));
        const duringLoss = await focusOn(source, target.surface);
        expect(duringLoss.ok()).toBe(true);
        const lossRevision = (await duringLoss.json()).revision;
        const restoreStarted = Date.now();
        await target.context.setOffline(false);
        await target.page.evaluate(() => window.dispatchEvent(new Event("online")));
        await expect
          .poll(() => target.page.evaluate(() => window.crossdeckDriver.metrics.latest), { timeout: 3000 })
          .toBeGreaterThanOrEqual(lossRevision);
        output.networkRestoreToSnapshotMs = Date.now() - restoreStarted;
        await target.page.evaluate(() => {
          Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        const hiddenReads = await target.page.evaluate(() => window.crossdeckDriver.metrics.reads);
        const hiddenChange = await focusOn(source, source.surface);
        expect(hiddenChange.ok()).toBe(true);
        const hiddenRevision = (await hiddenChange.json()).revision;
        await target.page.waitForTimeout(11000);
        expect(await target.page.evaluate(() => window.crossdeckDriver.metrics.reads)).toBe(hiddenReads);
        const foregroundStarted = Date.now();
        await target.page.evaluate(() => {
          Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await expect
          .poll(() => target.page.evaluate(() => window.crossdeckDriver.metrics.latest), { timeout: 3000 })
          .toBeGreaterThanOrEqual(hiddenRevision);
        output.controlledForegroundToSnapshotMs = Date.now() - foregroundStarted;
        output.lifecycleScope = "D1 controlled visibility events and actual offline network; not OS suspension";
        const reloadStarted = Date.now();
        await target.page.reload();
        await start(target.page, compiled.current, target.voyage, target.surface, target.csrf);
        expect(await target.page.evaluate(() => window.crossdeckDriver.metrics.latest)).toBeGreaterThanOrEqual(
          hiddenRevision,
        );
        output.reloadAndReconcileMs = Date.now() - reloadStarted;
        for (const participant of pages)
          await participant.context.request.post(`${baseURL}/api/crossdeck`, {
            headers: { "x-csrf-token": participant.csrf },
            data: { action: "heartbeat", surfaceId: participant.surface, lifecycle: "ACTIVE" },
          });
        const competing = await Promise.all([focusOn(source, source.surface), focusOn(target, target.surface)]);
        expect(competing.some((response) => response.status() === 200)).toBe(true);
        expect(competing.every((response) => [200, 409].includes(response.status()))).toBe(true);
        const winner = await (
          await source.context.request.get(
            `${baseURL}/api/crossdeck/sync?voyage=${source.voyage}&surface=${source.surface}`,
          )
        ).json();
        await expect
          .poll(
            async () =>
              Promise.all(
                pages.map((participant) => participant.page.evaluate(() => window.crossdeckDriver.metrics.latest)),
              ),
            { timeout: 3000 },
          )
          .toEqual([winner.revision, winner.revision]);
        output.concurrentFocus = {
          statuses: competing.map((response) => response.status()),
          convergedRevision: winner.revision,
          winner: "one canonical per-family focus; no browser-local writer",
        };
        await target.page.evaluate(() => window.crossdeckDriver.stop());
        await start(target.page, compiled.current, target.voyage, target.surface, target.csrf, true);
        await source.context.request.post(`${baseURL}/api/crossdeck`, {
          headers: { "x-csrf-token": source.csrf },
          data: { action: "heartbeat", surfaceId: source.surface, lifecycle: "ACTIVE" },
        });
        const state = await (
          await source.context.request.get(
            `${baseURL}/api/crossdeck/sync?voyage=${source.voyage}&surface=${source.surface}`,
          )
        ).json();
        const begun = Date.now();
        const committed = await source.context.request.post(`${baseURL}/api/crossdeck/sync`, {
          headers: { "x-csrf-token": source.csrf },
          data: {
            voyageId: source.voyage,
            surfaceId: source.surface,
            messageId: randomUUID(),
            payloadSchemaVersion: 1,
            sequence: state.nextSequence,
            payload: { action: "focus", family: "MAP", targetId: source.surface },
          },
        });
        expect(committed.ok()).toBe(true);
        const revision = (await committed.json()).revision;
        await expect
          .poll(() => target.page.evaluate(() => window.crossdeckDriver.metrics.latest), { timeout: 12000 })
          .toBeGreaterThanOrEqual(revision);
        output.droppedNotificationRecoveryMs = Date.now() - begun;
        expect(await db.taleSessionEvent.count({ where: { sessionId: source.voyage } })).toBe(beforeProgression);
        await db.accountSession.update({ where: { id: target.session }, data: { revokedAt: new Date() } });
        await expect
          .poll(() => target.page.evaluate(() => window.crossdeckDriver.metrics.failures), { timeout: 7000 })
          .toBeGreaterThan(0);
        expect(
          (
            await target.context.request.get(
              `${baseURL}/api/crossdeck/sync?voyage=${target.voyage}&surface=${target.surface}`,
            )
          ).status(),
        ).toBe(401);
        output.revocation = "active event channel ended; canonical snapshot returned 401";
        await Promise.all(pages.map((p) => p.page.evaluate(() => window.crossdeckDriver.stop())));
      }
      await Promise.all(pages.map((p) => p.context.close()));
      await Promise.all(extraBrowsers.splice(0).map((device) => device.close()));
    }
  } finally {
    await Promise.all(owned.map((context) => context.close()));
    await Promise.all(extraBrowsers.map((device) => device.close()));
    output.cohorts = cohorts;
    await mkdir("artifacts/crossdeck/realtime-browser", { recursive: true });
    await writeFile(
      `artifacts/crossdeck/realtime-browser/${activeOnly ? "active-measurements" : "measurements"}.json`,
      JSON.stringify(output, null, 2) + "\n",
    );
  }
});
