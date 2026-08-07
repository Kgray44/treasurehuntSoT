import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const command = process.argv[2] ?? "journeys";
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const seed = path.join(taskRoot, "immutable-fixture-seed", "homeport-phase7-integrated-v1.db");
const canonical = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
if (!taskRoot.startsWith(path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport") + path.sep))
  throw new Error(`HOMEPORT_PHASE7_TASK_ROOT_REFUSED:${taskRoot}`);
if (path.resolve(seed) === canonical || (await stat(seed)).size < 1) throw new Error("HOMEPORT_PHASE7_SEED_INVALID");

if (command === "journeys") {
  const receipts = [];
  const requestedJourneys = (process.env.HOMEPORT_PHASE7_JOURNEYS ?? "ABCDEFGHIJKLMNO").replaceAll(/[^A-O]/gu, "");
  for (const journeyId of requestedJourneys)
    receipts.push(
      await clone(seed, path.join(taskRoot, "automated-journey-databases", `journey-${journeyId}.db`), journeyId),
    );
  process.stdout.write(`${JSON.stringify({ status: "HOMEPORT_PHASE7_JOURNEY_CLONES_READY", receipts }, null, 2)}\n`);
} else if (command === "walkthrough") {
  const receipt = await clone(
    seed,
    path.join(taskRoot, "final-walkthrough-database", "homeport-phase7-walkthrough.db"),
    "WALKTHROUGH",
  );
  const receiptPath = path.join(taskRoot, "reports", "phase7-final-walkthrough-clone-receipt.json");
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify({ status: "HOMEPORT_PHASE7_WALKTHROUGH_CLONE_READY", ...receipt }, null, 2)}\n`,
  );
} else {
  throw new Error(`HOMEPORT_PHASE7_CLONE_COMMAND_UNKNOWN:${command}`);
}

async function clone(source, target, cloneId) {
  if (!target.startsWith(taskRoot + path.sep) || target === canonical || target === source)
    throw new Error(`HOMEPORT_PHASE7_CLONE_TARGET_REFUSED:${target}`);
  await mkdir(path.dirname(target), { recursive: true });
  for (const candidate of [target, `${target}-wal`, `${target}-shm`]) await rm(candidate, { force: true });
  await copyFile(source, target);
  const [sourceHash, targetHash] = await Promise.all([sha256(source), sha256(target)]);
  if (sourceHash !== targetHash) throw new Error(`HOMEPORT_PHASE7_CLONE_HASH_MISMATCH:${cloneId}`);
  return { cloneId, path: target, sourceHash, databaseHash: targetHash, bytes: (await stat(target)).size };
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
