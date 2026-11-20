#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { changes, commit, git, metadata, registry, select } from "./plan.mjs";
import { needsDependencies, runJob, runLocal, snapshotReader } from "./checks.mjs";

import { suiteCacheKey } from "./reuse.mjs";

const usage =
  "sl plan|explain|test [--base <ref>] [--head <ref>] [--project <name>] [--suite <id>] [--mode <mode>] [--full]";
const [operation = "plan", ...args] = process.argv.slice(2);
try {
  const { values } = parseArgs({
    args,
    options: {
      base: { type: "string" },
      head: { type: "string", default: "HEAD" },
      project: { type: "string", multiple: true },
      suite: { type: "string", multiple: true },
      mode: { type: "string" },
      full: { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help || operation === "help") {
    console.log(usage);
    process.exit(0);
  }
  if (!["plan", "explain", "test", "ci-plan", "ci-job"].includes(operation)) throw new Error(usage);
  const tree = commit(values.head);
  const base = values.base ? commit(values.base) : git(["merge-base", "refs/remotes/origin/main", tree]).trim();
  const entries = changes(base, tree);
  const read = snapshotReader(tree);
  const ci = operation.startsWith("ci-");
  const event = ci ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) : {};
  const request = metadata(event.pull_request?.labels?.map(({ name }) => name) ?? []);
  if (ci && event.pull_request && process.env.SL_REQUIRE_BASE === "1") {
    if (base !== event.pull_request.base.sha || commit(tree + "^2") !== event.pull_request.head.sha)
      throw new Error("Checkout is not the exact GitHub PR merge candidate.");
  }
  request.projects.push(...(values.project ?? []));
  request.suites.push(...(values.suite ?? []));
  request.mode = values.mode ?? request.mode;
  request.full ||= values.full;
  const plan = select(entries, read, request, registry(tree), snapshotReader(base));

  if (operation === "ci-plan") {
    const include = plan.jobs.map((job) => ({
      id: job.id,
      kind: job.kind,
      dependencies: needsDependencies(job.kind),
      publicationHistory:
        job.kind === "browser-full" ||
        (job.kind === "browser" && job.files.includes("tests/e2e/homeport-phase7-owner-correction-round2.spec.ts")),
      cache: plan.category === "full" ? "" : suiteCacheKey(job, tree, event.pull_request?.number),
    }));
    appendFileSync(process.env.GITHUB_OUTPUT, "matrix=" + JSON.stringify({ include }) + "\n");
    const summary = [
      "## Sounding Line V3",
      "",
      "Mode **" + plan.category + "**",
      "",
      "Base " + base,
      "Test tree " + git(["rev-parse", tree + "^{tree}"]).trim(),
      "",
      ...plan.jobs.map(({ id, files }) => "- " + id + (files.length ? " (" + files.length + " files)" : "")),
      "",
      ...plan.notes,
      "",
      ...Object.entries(plan.reasons).map(([id, reasons]) => id + " ← " + reasons.join(", ")),
    ].join("\n");
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  } else if (operation === "ci-job") {
    const job = plan.jobs.find(({ id }) => id === process.env.SL_JOB);
    if (!job) throw new Error("Job does not match the selected plan.");
    await runJob(job, { base, tree, entries, read, plan });
  } else if (operation === "test") {
    if (tree !== commit("HEAD") || git(["diff", "--name-only", "HEAD", "--"]).trim())
      throw new Error("Run tests from a clean checkout of the requested commit. Commit the intended change first.");
    await runLocal(plan, { base, tree, entries, read, plan });
  } else if (values.json) {
    console.log(JSON.stringify({ base, tree, ...plan }, null, 2));
  } else {
    console.log(plan.category.toUpperCase() + " verification");
    for (const { id, files } of plan.jobs) {
      console.log(id + (files.length ? " (" + files.length + " files)" : ""));
      if (operation === "explain") for (const file of files) console.log("  " + file);
    }
    for (const [id, reasons] of Object.entries(plan.reasons)) console.log(id + " ← " + reasons.join(", "));
    for (const note of plan.notes) console.log(note);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
