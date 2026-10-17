// Additive private reporter. No test actions, credentials, titles or assertion text are published.
import path from "node:path";
import { createHash } from "node:crypto";
import {
  BROWSER_FAILURE_LIMITS,
  loadBrowserFailureContext,
  writeBrowserFailureManifest,
} from "./private-browser-failure.mjs";
export default class PrivateBrowserFailureReporter {
  constructor() {
    this.records = [];
    this.failures = [];
    this.overflow = false;
  }
  onBegin() {
    try {
      this.context = loadBrowserFailureContext();
    } catch {
      this.context = null;
    }
  }
  onTestEnd(test, result) {
    if (
      !this.context ||
      result.status === test.expectedStatus ||
      !["failed", "timedOut", "interrupted"].includes(result.status)
    )
      return;
    if (this.failures.length >= BROWSER_FAILURE_LIMITS.files) {
      this.overflow = true;
      return;
    }
    const failureId = createHash("sha256").update(`${test.id}\0${result.retry}\0${result.workerIndex}`).digest("hex");
    this.failures.push({ id: failureId, status: result.status });
    for (const attachment of result.attachments) {
      if (!["screenshot", "video", "trace", "error-context"].includes(attachment.name) || !attachment.path) continue;
      if (this.records.length >= BROWSER_FAILURE_LIMITS.files) {
        this.overflow = true;
        break;
      }
      this.records.push({
        failureId,
        status: result.status,
        kind: attachment.name,
        path: path.relative(path.join(this.context.directory, "results"), attachment.path).split(path.sep).join("/"),
      });
    }
  }
  onEnd() {
    if (!this.context) return;
    try {
      writeBrowserFailureManifest(this.context, this.records, this.overflow, this.failures);
    } catch {
      /* Parent reports missing manifest; original failure remains authoritative. */
    }
  }
}
