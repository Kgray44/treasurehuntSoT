// Import-time fixture data only. Never use this helper to admit live work.
import assert from "node:assert/strict";
import { mock } from "node:test";
import { currentAdmissionBinding } from "../../../scripts/sounding-line/experience-current-admission.mjs";

export function historicalAdmissionBinding(record) {
  const dateDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Date");
  const approval = Date.parse(record.ownerApproval.approvedAtUtc);
  assert(Number.isFinite(approval) && approval < Date.parse(record.expiresAt));
  // Synchronous module initialization has no active per-test timer scope. Restore
  // the ambient clock immediately, including on validation failure.
  let ownsClock = false;
  try {
    mock.timers.enable({ apis: ["Date"], now: approval });
    ownsClock = true;
    return currentAdmissionBinding(record);
  } finally {
    try {
      if (ownsClock) mock.timers.reset();
    } finally {
      Object.defineProperty(globalThis, "Date", dateDescriptor);
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, "Date"), dateDescriptor);
  }
}
