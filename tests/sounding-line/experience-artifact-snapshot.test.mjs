import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readExperienceArtifactSnapshot } from "../../scripts/sounding-line/experience-artifact-snapshot.mjs";

test("real immutable Git snapshot retains exact opaque code bytes and modes without reading unrelated media", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "artifact-snapshot-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args, input, encoding = "utf8") =>
    execFileSync("git", args, { cwd: root, input, encoding, stdio: ["pipe", "pipe", "pipe"] });
  git(["init", "--quiet", "--initial-branch=main", "--template="]);
  git(["config", "user.name", "Inert artifact fixture"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  mkdirSync(path.join(root, "src"));
  mkdirSync(path.join(root, "testing"));
  writeFileSync(path.join(root, "src/opaque.mjs"), Buffer.from([47, 47, 32, 255, 0, 10]));
  writeFileSync(path.join(root, "src/empty.ts"), "");
  writeFileSync(path.join(root, "testing/fixture.json"), '{"ready":true}\n');
  writeFileSync(path.join(root, "unrelated.png"), Buffer.alloc(65536, 7));
  git(["add", "."]);
  git(["commit", "--quiet", "-m", "inert immutable source"]);
  const revision = git(["rev-parse", "HEAD"]).trim(),
    calls = [];
  const value = readExperienceArtifactSnapshot(root, revision, {
    fixturePaths: ["testing/fixture.json"],
    execute: (command, args, options) => {
      calls.push({ command, args, options });
      return execFileSync(command, args, options);
    },
  });
  assert.deepEqual([...value.contents.keys()], ["src/empty.ts", "src/opaque.mjs", "testing/fixture.json"]);
  for (const [file, bytes] of value.contents)
    assert(bytes.equals(git(["show", `${revision}:${file}`], undefined, null)));
  assert.equal(value.entries.length, 4);
  assert.equal(value.measurements.gitInvocations, 4);
  assert.equal(value.qualification, false);
  assert(
    calls.every(
      (x) =>
        x.options.env.GIT_NO_LAZY_FETCH === "1" &&
        x.args.includes("protocol.https.allow=never") &&
        x.options.timeout <= 30000,
    ),
  );
  assert.throws(
    () => readExperienceArtifactSnapshot(root, revision, { fixturePaths: ["missing.json"] }),
    /FIXTURE_MISSING/u,
  );
  assert.throws(
    () => readExperienceArtifactSnapshot(root, revision, { fixturePaths: ["../outside.json"] }),
    /FIXTURE_PATHS/u,
  );
  assert.throws(
    () => readExperienceArtifactSnapshot(root, git(["rev-parse", "HEAD^{tree}"]).trim()),
    /COMMIT_REQUIRED/u,
  );
  assert.throws(
    () =>
      readExperienceArtifactSnapshot(root, revision, {
        execute: (command, args, options) => {
          const bytes = execFileSync(command, args, options);
          if (args.includes("--batch")) {
            const copy = Buffer.from(bytes);
            copy[copy.indexOf(255)] = 254;
            return copy;
          }
          return bytes;
        },
      }),
    /SOURCE_BYTES_CHANGED/u,
  );
});
