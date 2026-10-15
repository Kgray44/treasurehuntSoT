import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { preparePublicSourceTrackerNotices } from "../../scripts/parallax/prepare-public-source-tracker-notices.mjs";

test("reproduces the pinned served notice bytes and refuses to replace an existing artifact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parallax-notice-packaging-"));
  try {
    const destination = join(directory, "public-source-slam.NOTICES.txt");
    const result = await preparePublicSourceTrackerNotices(destination);
    const bytes = await readFile(destination);
    assert.equal(result.bytes, 130097);
    assert.equal(result.sha256, "f483dc357199201394c3101a512a9f2deff5015e7dc1a6c858e3dce9548d3994");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), result.sha256);
    assert.equal(bytes.toString("utf8").replace(/\r\n/g, "").includes("\n"), false);
    await assert.rejects(preparePublicSourceTrackerNotices(destination), { code: "EEXIST" });
    assert.deepEqual(await readFile(destination), bytes);
  } finally {
    await rm(directory, { recursive: true });
  }
});
