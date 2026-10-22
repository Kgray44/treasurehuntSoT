import test from "node:test";
import assert from "node:assert/strict";
import { lstat, open, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import {
  PREPARATION_PHASES,
  PREPARATION_ROOT,
  PREPARATION_CHANNEL,
  PREPARATION_PROFILE,
  emitPreparationPhase,
  preparationProductEnvironment,
} from "../../scripts/sounding-line/preparation-phases.mjs";
import {
  createPreparationEventValidator,
  createPreparationSession,
  createPreparationStatusPublisher,
  supervisePreparation,
  readPreparationEvent,
} from "../../scripts/sounding-line/preparation-supervisor.mjs";
import { preparationJobBudget } from "../../scripts/sounding-line/experience-prepare-supervised.mjs";

const binding = {
  repository: "synthetic/example",
  base: "a".repeat(40),
  candidate: "b".repeat(40),
  runId: "42",
  attempt: "1",
};
const runtime = path.join(PREPARATION_ROOT, "tests/sounding-line/fixtures/preparation-runtime.mjs");
const digests = { sourceDigest: "1".repeat(64), contractDigest: "2".repeat(64), planDigest: "3".repeat(64) };
const sessionFor = () => createPreparationSession({ authorityRoot: PREPARATION_ROOT, binding });
const event = (session, sequence, phase, extra = {}) => ({
  ...session.binding,
  sequence,
  phase,
  profile: 0,
  step: 0,
  sourceDigest: null,
  contractDigest: null,
  planDigest: null,
  ...extra,
});
const run = (session, mode, extra = {}) =>
  supervisePreparation({
    session,
    command: process.execPath,
    args: [runtime, mode, "PRIVATE_ARGUMENT_SENTINEL"],
    root: PREPARATION_ROOT,
    environment: {
      ...process.env,
      GH_TOKEN: "SYNTHETIC_TRUSTED_TOKEN",
      GITHUB_TOKEN: "SYNTHETIC_TRUSTED_TOKEN",
    },
    publish: async () => {},
    absoluteMs: 15000,
    ...extra,
  });

test("ordered synthetic phases are published before child completion without private fields", async () => {
  const session = await sessionFor();
  const observations = [];
  const receipt = await run(session, "advance", {
    publish: async (record) => {
      observations.push(structuredClone(record));
    },
  });
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.phase, "COMPLETE");
  assert.equal(receipt.cleanup.treeReaped, true);
  assert.equal(receipt.cleanup.streamsClosed, true);
  assert.equal(receipt.observerClosed, true);
  assert.deepEqual(
    observations.filter((r) => r.sequence > 0 && !r.status).map((r) => r.phase),
    ["ADMISSION", "PLANNING", "STAGING", "VALIDATION", "COMPLETE"],
  );
  const original = await readFile(path.join(session.publicDirectory, "terminal.json"), "utf8");
  assert(!original.includes("PRIVATE_ARGUMENT_SENTINEL"));
  assert(!original.includes("SYNTHETIC_TRUSTED_TOKEN"));
  assert(observations.some((r) => r.child === "RUNNING"));
});

test("silent synchronous controller and detached listener stop with tree streams and port closed", async () => {
  const session = await sessionFor();
  const receipt = await run(session, "silent", {
    phaseLimits: { ...PREPARATION_PHASES, FIXTURE_PRISMA: 2000 },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.reason, "PHASE_TIMEOUT");
  assert.equal(receipt.cleanup.status, "PASS");
  assert.equal(receipt.cleanup.treeReaped, true);
  assert.equal(receipt.cleanup.streamsClosed, true);
  assert(receipt.elapsedMs < 14000);
  const descendant = JSON.parse(await readFile(path.join(session.directory, "probe/descendant.json"), "utf8"));
  const blocker = JSON.parse(await readFile(path.join(session.directory, "probe/blocker.json"), "utf8"));
  assert.equal(descendant.tokenPresent, false);
  assert.equal(descendant.channelPresent, false);
  for (const pid of [descendant.pid, blocker.pid]) assert.throws(() => process.kill(pid, 0));
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(descendant.port, "127.0.0.1", () => server.close(resolve));
  });
});

test("absolute watchdog is independent of a live phase and cleans a blocked payload", async () => {
  const session = await sessionFor();
  const receipt = await run(session, "hosted-advance", { absoluteMs: 2000 });
  assert.equal(receipt.reason, "ABSOLUTE_TIMEOUT");
  assert.equal(receipt.cleanup.status, "PASS");
  assert.equal(receipt.cleanup.treeReaped, true);
  assert.equal(receipt.cleanup.streamsClosed, true);
});

test("cancellation preserves a durable incomplete receipt after owned cleanup", async () => {
  const session = await sessionFor();
  const cancellation = new AbortController();
  const receipt = await run(session, "hosted-advance", {
    signal: cancellation.signal,
    publish: async (record) => {
      if (record.phase === "ADMISSION") queueMicrotask(() => cancellation.abort());
    },
  });
  assert.equal(receipt.reason, "CANCELLED");
  assert.equal(receipt.cleanup.status, "PASS");
  assert.equal(receipt.cleanup.treeReaped, true);
  assert.equal(receipt.cleanup.streamsClosed, true);
  const retained = JSON.parse(await readFile(path.join(session.publicDirectory, "terminal.json"), "utf8"));
  assert.equal(retained.status, "FAIL");
  assert.equal(retained.reason, "CANCELLED");
});

test("duplicate and wrong-source native transport fail closed and retain originals", async () => {
  for (const mode of ["duplicate", "wrong-source"]) {
    const session = await sessionFor();
    const receipt = await run(session, mode);
    assert.equal(receipt.status, "FAIL");
    assert.equal(receipt.reason, "PHASE_INVALID");
    assert.equal(receipt.cleanup.status, "PASS");
    assert((await readFile(path.join(session.transport, "000001.json"))).length > 0);
  }
});

test("initial progress publication failure never starts a controller", async () => {
  const session = await sessionFor();
  let launches = 0,
    calls = 0;
  const receipt = await run(session, "advance", {
    launch() {
      launches++;
      throw new Error("MUST_NOT_START");
    },
    publish: async () => {
      calls++;
      throw new Error("PRIVATE_PUBLISH_ERROR");
    },
  });
  assert.equal(launches, 0);
  assert.equal(calls, 2);
  assert.equal(receipt.reason, "PUBLISH_FAILURE");
  assert.equal(receipt.publication, "FAIL");
  const original = await readFile(path.join(session.publicDirectory, "terminal.json"), "utf8");
  assert(!original.includes("PRIVATE_PUBLISH_ERROR"));
});

test("phase validation rejects stale sequence tuple unknown fields digest changes and preparer reordering", async () => {
  const session = await sessionFor();
  for (const corrupt of [
    { sequence: 2 },
    { candidate: "c".repeat(40) },
    { runId: "43" },
    { attempt: "2" },
    { nonce: "0".repeat(36) },
    { phase: "PRIVATE_PROSE" },
    { argv: "PRIVATE_PROSE" },
    { profile: 1 },
  ]) {
    assert.throws(
      () => createPreparationEventValidator(session.binding)(event(session, 1, "ADMISSION", corrupt)),
      /PHASE_INVALID/u,
    );
  }
  const validate = createPreparationEventValidator(session.binding);
  validate(event(session, 1, "ADMISSION"));
  validate(event(session, 2, "PLANNING"));
  validate(event(session, 3, "STAGING", digests));
  assert.throws(() => validate(event(session, 4, "VALIDATION", { ...digests, planDigest: "4".repeat(64) })));
  validate(event(session, 4, "FIXTURE_PRISMA", { ...digests, profile: 1 }));
  validate(event(session, 5, "FIXTURE_PREPARER", { ...digests, profile: 1, step: 2 }));
  assert.throws(() => validate(event(session, 6, "FIXTURE_PREPARER", { ...digests, profile: 1, step: 1 })));
  assert.throws(() => validate(event(session, 6, "ADMISSION")));
});

test("producer is inert without a channel and product environment loses both credentials and descriptors", () => {
  emitPreparationPhase("IGNORED", { environment: {} });
  const source = {
    GH_TOKEN: "secret",
    GITHUB_TOKEN: "secret",
    [PREPARATION_CHANNEL]: "private",
    [PREPARATION_PROFILE]: "1",
    KEEP: "public",
  };
  assert.deepEqual(preparationProductEnvironment(source), { KEEP: "public" });
  assert.equal(source.GH_TOKEN, "secret");
  assert.throws(() => emitPreparationPhase("ADMISSION", { environment: { [PREPARATION_CHANNEL]: "C:/" } }));
});

test("status publisher uses a separate fixed context and one bounded request with closed output", async () => {
  const session = await sessionFor();
  const calls = [];
  const publish = createPreparationStatusPublisher({
    binding: session.binding,
    token: "SYNTHETIC_TRUSTED_TOKEN",
    request: async (url, options) => {
      calls.push({ url, options });
      return { status: 201 };
    },
  });
  const record = { binding: session.binding, phase: "PLANNING", sequence: 1 };
  await publish(record);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].url, "https://api.github.com/repos/synthetic/example/statuses/" + binding.candidate);
  assert.match(body.context, /^Sounding Line \/ Preparation progress /u);
  assert(!body.context.includes("Mainline Decision"));
  assert.equal(body.state, "pending");
  assert(!calls[0].options.body.includes("SYNTHETIC_TRUSTED_TOKEN"));
  const otherSession = await sessionFor();
  const other = createPreparationStatusPublisher({
    binding: otherSession.binding,
    token: "synthetic",
    request: async (_url, options) => {
      assert.notEqual(JSON.parse(options.body).context, body.context);
      return { status: 201 };
    },
  });
  await other({ ...record, binding: otherSession.binding });
  await assert.rejects(() => publish({ ...record, phase: "PRIVATE_PROSE" }));
  await assert.rejects(() => publish({ ...record, binding: { ...session.binding, candidate: "c".repeat(40) } }));
  assert.equal(calls.length, 1);
  let failures = 0;
  const failed = createPreparationStatusPublisher({
    binding: session.binding,
    token: "synthetic",
    request: async () => {
      failures++;
      return { status: 503 };
    },
  });
  await assert.rejects(() => failed(record), /PUBLISH_FAILURE/u);
  assert.equal(failures, 1);
});

test("remaining execution budget debits the existing job age and preserves its two minute tail", async () => {
  const request = async () => ({
    status: 200,
    json: async () => ({
      jobs: [
        {
          name: "Sounding Line / Experience preparation (no mainline decision)",
          status: "in_progress",
          started_at: "2026-10-22T00:00:00Z",
        },
      ],
    }),
  });
  const budget = await preparationJobBudget({
    binding,
    token: "synthetic",
    request,
    now: () => Date.parse("2026-10-22T00:10:00Z"),
  });
  assert.equal(budget, 28 * 60000);
  await assert.rejects(
    () =>
      preparationJobBudget({
        binding,
        token: "synthetic",
        request,
        now: () => Date.parse("2026-10-22T00:39:00Z"),
      }),
    /BUDGET_EXHAUSTED/u,
  );
});

test("transport growth and replacement are rejected using a bounded same-handle read", async () => {
  for (const mutation of ["grow", "replace"]) {
    const session = await sessionFor();
    const file = path.join(session.transport, "000001.json");
    await writeFile(file, JSON.stringify(event(session, 1, "ADMISSION")), { flag: "wx" });
    let maximumRead = 0;
    await assert.rejects(
      readPreparationEvent(session, 1, {
        openFile: async (...args) => {
          const handle = await open(...args);
          return {
            stat: () => handle.stat(),
            read: async (buffer, ...rest) => {
              maximumRead = buffer.length;
              if (mutation === "grow") await writeFile(file, Buffer.alloc(8192));
              if (mutation === "replace") {
                await rename(file, file + ".original");
                await writeFile(file, JSON.stringify(event(session, 1, "PLANNING")), { flag: "wx" });
              }
              return handle.read(buffer, ...rest);
            },
            close: () => handle.close(),
          };
        },
      }),
      /PHASE_INVALID/u,
    );
    assert.equal(maximumRead, 4097);
  }
});

test("queued late phases cannot reset an expired phase deadline", async () => {
  const session = await sessionFor();
  let clock = 0;
  const receipt = await run(session, "advance", {
    now: () => clock,
    phaseLimits: { ...PREPARATION_PHASES, ADMISSION: 1000 },
    publish: async (record) => {
      if (record.phase === "ADMISSION") clock = 1001;
    },
  });
  assert.equal(receipt.reason, "PHASE_TIMEOUT");
  assert.equal(receipt.phase, "ADMISSION");
  assert.equal(receipt.cleanup.status, "PASS");
});

test("cancellation through cleanup and terminal publication cannot leave PASS", async () => {
  const { stopOwnedProcess } = await import("../../scripts/sounding-line/owned-process.mjs");
  for (const at of ["cleanup", "publication", "absolute-boundary"]) {
    const session = await sessionFor();
    const cancellation = new AbortController();
    let clock = 0;
    const observations = [];
    const receipt = await run(session, "advance", {
      signal: cancellation.signal,
      now: () => clock,
      stop: async (child) => {
        const result = await stopOwnedProcess(child);
        if (at === "cleanup") cancellation.abort();
        if (at === "absolute-boundary") clock = 15000;
        return result;
      },
      publish: async (record) => {
        observations.push(structuredClone(record));
        if (at === "publication" && record.status === "PASS") cancellation.abort();
      },
    });
    assert.equal(receipt.status, "FAIL");
    assert.equal(receipt.reason, at === "absolute-boundary" ? "ABSOLUTE_TIMEOUT" : "CANCELLED");
    assert.equal(receipt.cleanup.status, "PASS");
    assert.equal(observations.at(-1).status, "FAIL");
    const retained = JSON.parse(await readFile(path.join(session.publicDirectory, "terminal.json"), "utf8"));
    assert.equal(retained.status, "FAIL");
    assert.equal(retained.reason, receipt.reason);
  }
});

test("cancellation during terminal persistence preserves the original and gives correction precedence", async () => {
  const session = await sessionFor();
  const cancellation = new AbortController();
  const observations = [];
  const receipt = await run(session, "advance", {
    signal: cancellation.signal,
    publish: async (record) => observations.push(structuredClone(record)),
    writeCheckpoint: async (file, content, options) => {
      await writeFile(file, content, options);
      if (path.basename(file) === "terminal.json") cancellation.abort();
    },
  });
  const original = JSON.parse(await readFile(path.join(session.publicDirectory, "terminal.json"), "utf8"));
  const correction = JSON.parse(await readFile(path.join(session.publicDirectory, "terminal-correction.json"), "utf8"));
  assert.equal(original.status, "PASS");
  assert.equal(correction.status, "FAIL");
  assert.equal(correction.reason, "CANCELLED");
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.reason, "CANCELLED");
  assert.equal(receipt.publication, "PASS");
  assert.equal(observations.at(-1).status, "FAIL");
  assert.deepEqual(correction.binding, original.binding);
  assert.equal(correction.sequence, original.sequence);
});

test("atomic producer retains stable create-only hardlinks while the observer is live", async () => {
  const session = await sessionFor();
  for (const [index, phase] of ["ADMISSION", "PLANNING"].entries()) {
    emitPreparationPhase(phase, { environment: { [PREPARATION_CHANNEL]: session.transport } });
    const sequence = index + 1;
    const file = path.join(session.transport, String(sequence).padStart(6, "0") + ".json");
    const alias = path.join(session.transport, "event." + sequence + ".pending");
    const before = await lstat(file),
      linked = await lstat(alias);
    assert.equal(before.nlink, 2);
    assert.equal(linked.ino, before.ino);
    assert.equal(linked.dev, before.dev);
    const actual = await readPreparationEvent(session, sequence);
    assert.deepEqual(actual, event(session, sequence, phase));
    assert.equal(await readFile(file, "utf8"), await readFile(alias, "utf8"));
    const after = await lstat(file);
    assert.equal(after.ctimeMs, before.ctimeMs);
    assert.equal(after.mtimeMs, before.mtimeMs);
    assert.equal(after.size, before.size);
    assert.equal(after.nlink, 2);
  }
});
