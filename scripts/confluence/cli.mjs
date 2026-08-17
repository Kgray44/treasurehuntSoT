#!/usr/bin/env node
import { resolve } from "node:path";
import {
  acquireArchiveLock,
  collectEngineering,
  deliverExact,
  parsePeriod,
  replay,
  statusForWeek,
  validateArchiveLayout,
  validateDesign,
  verifyArchivePrivacy,
} from "./core.mjs";

function options(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    out[key.slice(2)] = argv[index + 1]?.startsWith("--") ? true : (argv[index + 1] ?? true);
    if (out[key.slice(2)] !== true) index += 1;
  }
  return out;
}
const [command, ...argv] = process.argv.slice(2);
const args = options(argv);
const archiveInput = args.archive ?? process.env.CONFLUENCE_ARCHIVE_PATH;
if (!archiveInput) throw new Error("CONFLUENCE_ARCHIVE_PATH_REQUIRED");
const archiveRoot = resolve(archiveInput);
const publicRoot = resolve(args.publicRoot ?? process.cwd());
const repositoryRoot = resolve(args.repositoryRoot ?? publicRoot);
const period = parsePeriod({
  week: args.week,
  start: args.start,
  end: args.end,
  rollingDays: args["rolling-days"],
  last7Days: args["last-7-days"],
});
let result;
if (command === "collect") {
  const release = await acquireArchiveLock(archiveRoot, `engineering-${period.weekId}`);
  try {
    result = await collectEngineering({ archiveRoot, repositoryRoot, period, dryRun: Boolean(args["dry-run"]) });
  } finally {
    await release();
  }
} else if (command === "status") result = await statusForWeek({ archiveRoot, publicRoot, weekId: period.weekId });
else if (command === "validate-design")
  result = await validateDesign({ archiveRoot, metadataPath: resolve(args.metadata) });
else if (command === "deliver") {
  const release = await acquireArchiveLock(archiveRoot, `delivery-${period.weekId}`);
  try {
    result = await deliverExact({ archiveRoot, publicRoot, weekId: period.weekId, dryRun: Boolean(args["dry-run"]) });
  } finally {
    await release();
  }
} else if (command === "replay") {
  const release = await acquireArchiveLock(archiveRoot, `replay-${args.run ?? period.weekId}`);
  try {
    result = await replay({ archiveRoot, publicRoot, repositoryRoot, period, runId: args.run });
  } finally {
    await release();
  }
} else if (command === "verify-archive") result = await verifyArchivePrivacy(archiveRoot);
else if (command === "validate-archive") result = await validateArchiveLayout(archiveRoot);
else throw new Error("CONFLUENCE_UNKNOWN_COMMAND");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
