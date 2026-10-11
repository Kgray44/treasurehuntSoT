import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const loadClient = createRequire(import.meta.url);
const metricsPath = process.env.CROSSDECK_SERVER_METRICS_PATH;
const allowedRoot = path.resolve(process.cwd(), "artifacts", "crossdeck", "realtime-browser");
const relative = metricsPath ? path.relative(allowedRoot, path.resolve(metricsPath)) : "..";
if (!metricsPath || relative.startsWith("..") || path.isAbsolute(relative))
  throw new Error("CROSSDECK_TASK_OWNED_METRICS_PATH_REQUIRED");
// Synthetic load instrumentation. Never retain SQL, parameters, account or content data.
const prisma = loadClient("@prisma/client");
const Original = prisma.PrismaClient;
let sqlQueries = 0,
  instances = 0;
prisma.PrismaClient = class extends Original {
  constructor(options = {}) {
    super({
      ...options,
      log: [
        ...(options.log ?? []).filter((value) =>
          typeof value === "string" ? value !== "query" : value.level !== "query",
        ),
        { emit: "event", level: "query" },
      ],
    });
    instances++;
    this.$on("query", () => sqlQueries++);
  }
};
const samples = [];
const committedHints = [];
const revisions = new Map();
const instrumented = new WeakSet();
// Observe the real post-transaction hint method without replacing its delivery.
// Scope keys stay in memory; artifacts contain only ordinal scopes/revisions/times.
function observeBus() {
  const bus = globalThis.crossdeckCommittedChangeBus;
  if (!bus || instrumented.has(bus)) return;
  const publish = bus.publish;
  bus.publish = (change) => {
    const key = JSON.stringify([change.accountId, change.voyageId]);
    const previous = revisions.get(key);
    if (!previous || change.revision > previous.revision) {
      const scope = previous?.scope ?? revisions.size;
      revisions.set(key, { scope, revision: change.revision });
      committedHints.push({ scope, revision: change.revision, at: Date.now() });
      if (committedHints.length > 5000) committedHints.shift();
    }
    return publish.call(bus, change);
  };
  instrumented.add(bus);
}
function record() {
  const memory = process.memoryUsage(),
    cpu = process.cpuUsage();
  samples.push({
    at: Date.now(),
    sqlQueries,
    rssBytes: memory.rss,
    heapBytes: memory.heapUsed,
    cpuUserUs: cpu.user,
    cpuSystemUs: cpu.system,
  });
  if (samples.length > 1200) samples.shift();
  fs.writeFileSync(`${metricsPath}.tmp`, JSON.stringify({ pid: process.pid, instances, samples, committedHints }));
  fs.renameSync(`${metricsPath}.tmp`, metricsPath);
}
fs.mkdirSync(allowedRoot, { recursive: true });
record();
setInterval(record, 1000).unref();
setInterval(observeBus, 100).unref();
