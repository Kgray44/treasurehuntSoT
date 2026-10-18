// Trusted host output only. Product children must not inherit GITHUB_OUTPUT.
import { randomUUID } from "node:crypto";
import {
  constants as F,
  closeSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { browserFailurePublicationUploadPaths } from "./private-browser-failure-publication.mjs";

export const BROWSER_FAILURE_OUTPUT_KEYS = Object.freeze({
  publish: "private_browser_failure_publish",
  paths: "private_browser_failure_paths",
});
const disabled = `${BROWSER_FAILURE_OUTPUT_KEYS.publish}=false\n${BROWSER_FAILURE_OUTPUT_KEYS.paths}=\n`;
const maximum = 64 * 1024;
const requireValue = (value) => {
  if (!value) throw Error("PRIVATE_BROWSER_PUBLICATION_OUTPUT_INVALID");
};
function access(file, operation, allowLarge = false) {
  requireValue(
    typeof file === "string" && path.isAbsolute(file) && path.normalize(file) === file && !/[\r\n\0]/u.test(file),
  );
  const named = lstatSync(file);
  requireValue(named.isFile() && !named.isSymbolicLink() && named.uid === process.getuid() && named.nlink === 1);
  requireValue((allowLarge || named.size <= maximum) && realpathSync(file) === file);
  let fd;
  try {
    fd = openSync(file, F.O_RDWR | F.O_APPEND | F.O_NOFOLLOW | F.O_NONBLOCK);
    const opened = fstatSync(fd);
    requireValue(
      opened.isFile() &&
        opened.uid === process.getuid() &&
        opened.dev === named.dev &&
        opened.ino === named.ino &&
        opened.nlink === 1 &&
        opened.size === named.size &&
        (allowLarge || opened.size <= maximum),
    );
    return operation(fd, opened.size);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
function append(file, text) {
  const bytes = Buffer.from(text);
  access(file, (fd, size) => {
    requireValue(size + bytes.length <= maximum);
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(fd, bytes, offset, bytes.length - offset);
      requireValue(count > 0);
      offset += count;
    }
    fsyncSync(fd);
  });
}
function reset(file, detectPrior = false) {
  return access(
    file,
    (fd, size) => {
      let prior = size > maximum;
      if (detectPrior && !prior) {
        const bytes = Buffer.alloc(size);
        let offset = 0;
        while (offset < bytes.length) {
          const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
          requireValue(count > 0);
          offset += count;
        }
        // Detect only; previous path values never become publication authority.
        const text = bytes.toString("utf8");
        prior =
          /^private_browser_failure_publish=(?!false\r?$).+$/mu.test(text) ||
          /^private_browser_failure_paths<</mu.test(text);
      }
      // This dedicated framework step owns its output file. Replacing the whole
      // control state also repairs unterminated or oversized preexisting records.
      ftruncateSync(fd, 0);
      const bytes = Buffer.from(disabled);
      let offset = 0;
      while (offset < bytes.length) {
        const count = writeSync(fd, bytes, offset, bytes.length - offset);
        requireValue(count > 0);
        offset += count;
      }
      fsyncSync(fd);
      return prior;
    },
    true,
  );
}
// Construct once in the trusted host before children. capture is passed only to
// the genuine collector callback; finish uses this live memory, never JSON.
export function createBrowserFailurePublicationOutput({ outputFile, nonce }) {
  const startedAt = performance.now(),
    publications = new WeakSet(),
    paths = [];
  let invalid = false,
    finished = false,
    initialized = false;
  const disable = () => {
    if (!outputFile) return true;
    try {
      reset(outputFile);
      return true;
    } catch {
      return false;
    }
  };
  if (outputFile) {
    try {
      requireValue(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(nonce ?? ""));
      invalid = reset(outputFile, true);
      initialized = true;
    } catch {
      invalid = true;
      disable();
    }
  }
  return Object.freeze({
    initialized: !outputFile || initialized,
    capture(publication) {
      try {
        requireValue(!finished && !invalid && !publications.has(publication) && paths.length < 4);
        const pair = browserFailurePublicationUploadPaths(publication, startedAt);
        requireValue(pair.length === 2 && path.dirname(pair[0]) === path.dirname(pair[1]));
        requireValue(path.basename(pair[0]) === "failure.encrypted" && path.basename(pair[1]) === "retention.json");
        for (const file of pair) {
          requireValue(path.isAbsolute(file) && path.normalize(file) === file && !/[\r\n\0*?\[\]{}!]/u.test(file));
          const stat = lstatSync(file);
          requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && realpathSync(file) === file);
        }
        publications.add(publication);
        paths.push(...pair);
      } catch (error) {
        invalid = true;
        disable();
        throw error;
      }
    },
    finish({ failed }) {
      const duplicate = finished;
      finished = true;
      if (!outputFile) return { status: "NOT_CONFIGURED", qualification: false };
      if (duplicate || invalid || !initialized || !failed || !paths.length) {
        const closed = disable();
        return { status: closed ? "DISABLED" : "DISABLE_FAILED", qualification: false };
      }
      const delimiter = `sounding_line_private_failure_${randomUUID().replaceAll("-", "")}`;
      try {
        // Disable first; enable only after a complete bounded exact-path batch.
        requireValue(disable());
        append(outputFile, `${BROWSER_FAILURE_OUTPUT_KEYS.paths}<<${delimiter}\n${paths.join("\n")}\n${delimiter}\n`);
        append(outputFile, `${BROWSER_FAILURE_OUTPUT_KEYS.publish}=${nonce}\n`);
        return { status: "ENABLED_EXACT_MEMORY_PATHS", files: paths.length, qualification: false };
      } catch {
        const closed = disable();
        return { status: closed ? "DISABLED" : "DISABLE_FAILED", qualification: false };
      }
    },
  });
}
