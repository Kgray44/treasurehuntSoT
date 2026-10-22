// Native directory links and inert files only; no application build or browser.
import assert from "node:assert/strict";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  copyDevelopmentBuild,
  developmentBuildFingerprint,
  makeDevelopmentBuildImmutable,
} from "../../scripts/sounding-line/develop-browser-suite.mjs";

async function fixture(t) {
  const temporary = await realpath(tmpdir());
  const base = await realpath(await mkdtemp(path.join(temporary, "development-build-link-")));
  assert.equal(path.dirname(base), temporary);
  assert(path.basename(base).startsWith("development-build-link-"));
  t.after(async () => {
    assert.equal(path.dirname(await realpath(base)), temporary);
    async function writable(file) {
      const stat = await lstat(file);
      if (stat.isSymbolicLink()) return;
      await chmod(file, stat.isDirectory() ? 0o700 : 0o600);
      if (stat.isDirectory()) for (const item of await readdir(file)) await writable(path.join(file, item));
    }
    await writable(base);
    await rm(base, { recursive: true, force: true });
  });
  const workspace = path.join(base, "workspace"),
    build = path.join(workspace, ".next");
  const dependencies = path.join(workspace, "node_modules");
  const target = path.join(dependencies, "synthetic-package");
  const link = path.join(build, "server", "vendor", "package");
  await mkdir(path.dirname(link), { recursive: true });
  await mkdir(target, { recursive: true });
  const sentinel = path.join(target, "sentinel.txt");
  await writeFile(sentinel, "synthetic dependency must remain unchanged\n", { mode: 0o640 });
  await writeFile(path.join(build, "server", "page.js"), "// inert synthetic build\n");
  const literalFor = (directory) =>
    process.platform === "win32" ? directory : path.relative(path.dirname(link), directory);
  const linkTo = (directory) => symlink(literalFor(directory), link, process.platform === "win32" ? "junction" : "dir");
  return { base, workspace, build, dependencies, target, link, sentinel, literalFor, linkTo };
}
const rejected = (error) =>
  error.message === "DEVELOPMENT_BUILD_LINK_OUTSIDE_DEPENDENCIES" ||
  ["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code);

test("native contained dependency links retain exact fingerprints through immutable preparation and runtime copy", async (t) => {
  const f = await fixture(t);
  await f.linkTo(f.target);
  const sentinel = await readFile(f.sentinel);
  const targetMode = (await lstat(f.target)).mode,
    sentinelMode = (await lstat(f.sentinel)).mode;
  const literal = await readlink(f.link);
  const original = await developmentBuildFingerprint(f.build, f.workspace);
  const descriptor = original.files.find((item) => item.type === "symlink");
  assert.equal(descriptor.link, literal);
  assert.equal(descriptor.target, f.target);
  assert.equal(descriptor.linkType, process.platform === "win32" ? "junction" : undefined);
  const prepared = path.join(f.base, "immutable-build");
  const runtime = path.join(f.base, "runtime-copy");
  await copyDevelopmentBuild(f.build, prepared, f.workspace);
  await makeDevelopmentBuildImmutable(prepared, f.workspace);
  assert.deepEqual(await developmentBuildFingerprint(prepared, f.workspace), original);
  await copyDevelopmentBuild(prepared, runtime, f.workspace);
  assert.deepEqual(await developmentBuildFingerprint(runtime, f.workspace), original);
  assert.equal(await readlink(path.join(runtime, "server", "vendor", "package")), literal);
  assert.equal((await lstat(f.target)).mode, targetMode);
  assert.equal((await lstat(f.sentinel)).mode, sentinelMode);
  assert((await readFile(f.sentinel)).equals(sentinel));
});

for (const kind of ["dependency-root", "prefix-sibling", "external", "redirected", "dangling"]) {
  test(`native build link rejects ${kind} targets`, async (t) => {
    const f = await fixture(t);
    const external = path.join(f.base, "external");
    await mkdir(external);
    let target;
    if (kind === "dependency-root") target = f.dependencies;
    else if (kind === "prefix-sibling") {
      target = path.join(f.workspace, "node_modules-extra");
      await mkdir(target);
    } else if (kind === "external") target = external;
    else if (kind === "redirected") {
      target = path.join(f.dependencies, "redirected");
      await symlink(external, target, process.platform === "win32" ? "junction" : "dir");
    } else target = path.join(f.dependencies, "missing");
    await f.linkTo(target);
    await assert.rejects(developmentBuildFingerprint(f.build, f.workspace), rejected);
    await assert.rejects(copyDevelopmentBuild(f.build, path.join(f.base, "rejected-copy"), f.workspace), rejected);
    await assert.rejects(makeDevelopmentBuildImmutable(f.build, f.workspace), rejected);
  });
}

test(
  "native Windows absolute dependency junction rejects a target replaced by a file",
  { skip: process.platform !== "win32" },
  async (t) => {
    const f = await fixture(t);
    const target = path.join(f.dependencies, "directory-then-file");
    await mkdir(target);
    await f.linkTo(target);
    await rmdir(target);
    await writeFile(target, "synthetic non-directory target\n");
    await assert.rejects(developmentBuildFingerprint(f.build, f.workspace), rejected);
  },
);

test("POSIX absolute dependency links remain rejected", { skip: process.platform === "win32" }, async (t) => {
  const f = await fixture(t);
  await symlink(f.target, f.link, "dir");
  await assert.rejects(developmentBuildFingerprint(f.build, f.workspace), rejected);
});

test("retargeting a native link within owned dependencies changes the reuse fingerprint", async (t) => {
  const f = await fixture(t);
  await f.linkTo(f.target);
  const first = await developmentBuildFingerprint(f.build, f.workspace);
  const secondTarget = path.join(f.dependencies, "second-synthetic-package");
  await mkdir(secondTarget);
  await unlink(f.link);
  await f.linkTo(secondTarget);
  const second = await developmentBuildFingerprint(f.build, f.workspace);
  assert.notEqual(first.digest, second.digest);
  assert.equal(second.files.find((item) => item.type === "symlink").target, secondTarget);
});
