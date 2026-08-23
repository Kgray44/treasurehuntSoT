import assert from "node:assert/strict";
import test from "node:test";
import { validateDeclarativeRegistrations } from "../../scripts/sounding-line/test-registration.mjs";

const fixture = () => ({
  ownership: { owners: [{ id: "drydock", contractIds: ["drydock.hull"] }] },
  contracts: { contracts: [{ id: "drydock.hull" }] },
  suites: { suites: [{ id: "unit.drydock", owner: "drydock" }] },
  cases: [{ semanticId: "stable-case", file: "src/drydock/hull.test.ts", title: "proves hull", suiteId: "unit.drydock" }],
  registrations: [
    {
      source: "testing/test-registrations/drydock-hull.json",
      schemaVersion: "1.0",
      id: "unit.drydock.hull",
      owner: "drydock",
      contracts: ["drydock.hull"],
      test: { file: "src/drydock/hull.test.ts", title: "proves hull", suiteId: "unit.drydock" },
      tier: 1,
      risk: "MODERATE",
      adapter: "vitest",
      resources: ["node-slot"],
      parallelSafety: "READ_ONLY_PARALLEL",
      releaseRelevant: true
    }
  ]
});

test("a valid owned declarative registration is accepted", () => {
  assert.deepEqual(validateDeclarativeRegistrations(fixture()).errors, []);
});

test("unknown owner, contract, or missing discovered test fails closed with an actionable error", () => {
  const unknown = fixture();
  unknown.registrations[0].owner = "unknown";
  assert.ok(validateDeclarativeRegistrations(unknown).errors.some((error) => error.endsWith(":UNKNOWN_OWNER")));
  const missing = fixture();
  missing.registrations[0].test.title = "not discovered";
  assert.ok(validateDeclarativeRegistrations(missing).errors.some((error) => error.endsWith(":DISCOVERED_TEST_NOT_FOUND")));
});
