#!/usr/bin/env node
/* Combine independently sealed car qualifications without inventing a landing. */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { sealTrain, verifyTrain } from "./mainline-train.mjs";

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  const result = index < 0 ? undefined : args[index + 1];
  if (!result) throw new Error(`TRAIN_QUALIFICATION_MERGE_${flag.slice(2).toUpperCase()}_REQUIRED`);
  return result;
};
const json = async (file) => JSON.parse(await readFile(file, "utf8"));

export function mergeTrainQualifications({ base, states, timestamp = new Date().toISOString() }) {
  if (!verifyTrain(base).valid) throw new Error("TRAIN_QUALIFICATION_MERGE_BASE_INVALID");
  if (states.length === 0) throw new Error("TRAIN_QUALIFICATION_MERGE_EMPTY");
  const merged = JSON.parse(JSON.stringify(base));
  const mergedIds = new Set();
  for (const state of states) {
    if (!verifyTrain(state).valid || state.trainId !== base.trainId || state.generation !== base.generation)
      throw new Error("TRAIN_QUALIFICATION_MERGE_STATE_INVALID");
    const qualified = state.cars.filter((car) => car.state === "QUALIFIED");
    if (qualified.length !== 1) throw new Error("TRAIN_QUALIFICATION_MERGE_CARDINALITY_INVALID");
    const qualifiedCar = qualified[0];
    if (mergedIds.has(qualifiedCar.carId)) throw new Error("TRAIN_QUALIFICATION_MERGE_DUPLICATE");
    const index = merged.cars.findIndex((car) => car.carId === qualifiedCar.carId);
    if (index < 0 || merged.cars[index].candidateHeadCommitSha !== qualifiedCar.candidateHeadCommitSha)
      throw new Error("TRAIN_QUALIFICATION_MERGE_IDENTITY_MISMATCH");
    merged.cars[index] = qualifiedCar;
    const audit = state.audit.filter(
      (entry) => entry.kind === "QUALIFIED" && entry.candidateId === qualifiedCar.candidateId,
    );
    if (audit.length !== 1) throw new Error("TRAIN_QUALIFICATION_MERGE_AUDIT_INVALID");
    merged.audit.push(audit[0]);
    mergedIds.add(qualifiedCar.carId);
  }
  if (mergedIds.size !== merged.cars.length) throw new Error("TRAIN_QUALIFICATION_MERGE_INCOMPLETE");
  merged.status = "QUALIFIED";
  merged.updatedAt = timestamp;
  return sealTrain(merged);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = await json(path.resolve(value("--base")));
  const root = path.resolve(value("--states"));
  const files = await readdir(root, { recursive: true });
  const states = await Promise.all(
    files
      .filter((file) => path.basename(file) === "mainline-train-qualified.json")
      .map((file) => json(path.join(root, file))),
  );
  const result = mergeTrainQualifications({ base, states });
  await writeFile(path.resolve(value("--out")), `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
