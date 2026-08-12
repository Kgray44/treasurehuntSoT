#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { parseHeartbeat } from "../src/telemetry.js";

const endpoint = process.env.BRIDGEWATCH_TELEMETRY_ENDPOINT;
const token = process.env.BRIDGEWATCH_TELEMETRY_TOKEN;
const input = process.argv[2];

if (!endpoint || !/^https?:\/\//u.test(endpoint)) throw new Error("BRIDGEWATCH_TELEMETRY_ENDPOINT_REQUIRED");
if (!token) throw new Error("BRIDGEWATCH_TELEMETRY_TOKEN_REQUIRED");
if (!input) throw new Error("HEARTBEAT_JSON_PATH_REQUIRED");

const heartbeat = parseHeartbeat(JSON.parse(await readFile(input, "utf8")));
const response = await fetch(endpoint, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(heartbeat),
});
if (!response.ok) throw new Error(`BRIDGEWATCH_REPORTER_REJECTED:${response.status}`);
// Deliberately never write the endpoint, token, or submitted activity to stdout.
process.stdout.write(`${JSON.stringify({ accepted: true, workerId: heartbeat.workerId, activityOnly: true })}\n`);
