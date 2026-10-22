import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREPARATION_PHASES, PREPARATION_ROOT } from "./preparation-phases.mjs";
import {
  createPreparationSession,
  createPreparationStatusPublisher,
  preparationProgressContext,
  supervisePreparation,
} from "./preparation-supervisor.mjs";

async function main() {
  assert.equal(process.argv.length, 4);
  assert.equal(process.argv[2], "--source");
  const source = process.argv[3];
  assert.match(source, /^[a-f0-9]{40}$/u);
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main");
  assert.equal(process.env.GITHUB_SHA, source);
  const binding = {
    repository: process.env.GITHUB_REPOSITORY,
    base: source,
    candidate: source,
    runId: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
  };
  const sessions = [
    await createPreparationSession({ authorityRoot: PREPARATION_ROOT, binding }),
    await createPreparationSession({ authorityRoot: PREPARATION_ROOT, binding }),
  ];
  const summaryDirectory = path.join(
    PREPARATION_ROOT,
    "artifacts/sounding-line",
    "preparation-probe-" + binding.runId + "-" + binding.attempt,
  );
  await mkdir(summaryDirectory);
  const relative = (file) => path.relative(process.cwd(), file).split(path.sep).join("/");
  const delimiter = "preparation_probe_paths";
  await appendFile(
    process.env.GITHUB_OUTPUT,
    "probe_progress_paths<<" +
      delimiter +
      "\n" +
      sessions.map((session) => relative(session.publicDirectory)).join("\n") +
      "\n" +
      delimiter +
      "\n" +
      "probe_summary_path=" +
      relative(path.join(summaryDirectory, "summary.json")) +
      "\n",
  );
  const receipts = [];
  for (const [index, mode] of ["hosted-advance", "hosted-silent"].entries()) {
    const session = sessions[index];
    const environment = { ...process.env };
    delete environment.GH_TOKEN;
    delete environment.GITHUB_TOKEN;
    receipts.push(
      await supervisePreparation({
        session,
        command: process.execPath,
        args: [path.join(PREPARATION_ROOT, "tests/sounding-line/fixtures/preparation-runtime.mjs"), mode],
        root: PREPARATION_ROOT,
        environment,
        publish: createPreparationStatusPublisher({ binding: session.binding, token: process.env.GH_TOKEN }),
        absoluteMs: 60000,
        phaseLimits: { ...PREPARATION_PHASES, FIXTURE_PRISMA: 10000 },
      }),
    );
  }
  let portReleased = false,
    descendantsAbsent = false;
  const descendant = JSON.parse(await readFile(path.join(sessions[1].directory, "probe/descendant.json"), "utf8"));
  const blocker = JSON.parse(await readFile(path.join(sessions[1].directory, "probe/blocker.json"), "utf8"));
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(descendant.port, "127.0.0.1", () => server.close(resolve));
    });
    portReleased = true;
  } catch {
    /* Retain explicit failed cleanup. */
  }
  try {
    assert.throws(() => process.kill(descendant.pid, 0));
    assert.throws(() => process.kill(blocker.pid, 0));
    descendantsAbsent = true;
  } catch {
    /* Never infer absence from the direct child exit. */
  }
  const environmentStripped = descendant.tokenPresent === false && descendant.channelPresent === false;
  const pass =
    receipts[0].status === "PASS" &&
    receipts[1].status === "FAIL" &&
    receipts[1].reason === "PHASE_TIMEOUT" &&
    receipts.every(
      (receipt) =>
        receipt.cleanup.status === "PASS" &&
        receipt.cleanup.treeReaped &&
        receipt.cleanup.streamsClosed &&
        receipt.observerClosed &&
        receipt.publication === "PASS",
    ) &&
    portReleased &&
    descendantsAbsent &&
    environmentStripped;
  await writeFile(
    path.join(summaryDirectory, "summary.json"),
    JSON.stringify(
      {
        version: 1,
        executionLabel: "NON_CONSUMING_SYNTHETIC_PROBE",
        source,
        binding,
        status: pass ? "PASS" : "FAIL",
        qualification: false,
        consumerCapture: false,
        contexts: sessions.map((session) => preparationProgressContext(session.binding)),
        receipts,
        portReleased,
        descendantsAbsent,
        environmentStripped,
        independentMidRunObservation: "REQUIRED_SEPARATELY; this summary is producer evidence",
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  if (!pass) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch {
    console.error("SOUNDING_LINE_PREPARATION_SYNTHETIC_PROBE_INCOMPLETE");
    process.exitCode = 1;
  }
}
