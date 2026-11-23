import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readSc07ReplayFixture,
  resolveSc07ReplayContext,
} from "../../scripts/sounding-line/experience-sc07-context.mjs";

test("SC-07 replay binds a role, exact release route, and private credential to one device", () => {
  const journey = {
    id: "moderation",
    entryPoint: "/admin/community",
    steps: [
      { action: "assert", role: "region", name: "Release", pathFromFixture: "pendingReviewPath" },
      { action: "fill", role: "textbox", name: "Confirm password", valueFromFixture: "password" },
    ],
  };
  const setup = {
    entryPoint: "/sign-in?returnTo=/admin/community",
    witness: { role: "heading", name: "Community content", text: "Community content" },
    steps: [{ action: "fill", role: "textbox", name: "Email", valueFromFixture: "moderatorEmail" }],
  };
  const fixture = {
    DESKTOP: { moderatorEmail: "desktop@example.test", pendingReviewPath: "/admin/community/desktop" },
    MOBILE: { moderatorEmail: "mobile@example.test", pendingReviewPath: "/admin/community/mobile" },
  };
  const password = "synthetic-fixture-password-only";
  const desktop = resolveSc07ReplayContext(journey, setup, fixture.DESKTOP, password);
  const mobile = resolveSc07ReplayContext(journey, setup, fixture.MOBILE, password);
  assert.equal(desktop.journey.steps[0].path, "/admin/community/desktop");
  assert.equal(mobile.journey.steps[0].path, "/admin/community/mobile");
  assert.equal(mobile.setup.steps[0].value, "mobile@example.test");
  assert.equal(desktop.journey.steps[1].value, password);
  assert.equal(journey.steps[0].path, undefined);
  assert.throws(
    () =>
      resolveSc07ReplayContext(journey, setup, { ...fixture.DESKTOP, pendingReviewPath: "//example.test" }, password),
    /SC07_EXPERIENCE_INVALID_FIXTURE_PATH/,
  );
  assert.throws(
    () =>
      resolveSc07ReplayContext(
        { ...journey, steps: [{ action: "assert", role: "region", textFromFixture: "password" }] },
        setup,
        fixture.DESKTOP,
        password,
      ),
    /SC07_EXPERIENCE_INVALID_FIXTURE_BINDING/,
  );
});

test("SC-07 replay reads only an exact candidate sidecar inside its task-owned fixture directory", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "experience-sc07-context-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = await realpath(temporary);
  const candidate = "a".repeat(40);
  const ownedRoot = path.join(root, "artifacts/sounding-line", "sc07-community-" + candidate.slice(0, 12));
  const basename = "validation-isolated-20261121-000000000-" + "b".repeat(32) + ".db";
  const database = path.join(ownedRoot, basename);
  const devices = { DESKTOP: { pendingTitle: "Desktop release" }, MOBILE: { pendingTitle: "Mobile release" } };
  const environment = {
    DATABASE_URL: "file:" + database,
    FOREVER_VALIDATION_ISOLATION: "1",
    SOUNDING_LINE_SUITE_PROFILE: "sc07-community",
  };
  await mkdir(ownedRoot, { recursive: true });
  await writeFile(database + ".sc07-experience.json", JSON.stringify({ candidate, devices }));
  assert.deepEqual(await readSc07ReplayFixture(root, candidate, environment), devices);
  await assert.rejects(
    readSc07ReplayFixture(root, candidate, { ...environment, DATABASE_URL: "file:" + path.join(root, basename) }),
    /SC07_EXPERIENCE_OWNED_FIXTURE_REQUIRED/,
  );
  await assert.rejects(
    readSc07ReplayFixture(root, candidate, { ...environment, SOUNDING_LINE_SUITE_PROFILE: "generic" }),
    /SC07_EXPERIENCE_OWNED_FIXTURE_REQUIRED/,
  );
  await writeFile(database + ".sc07-experience.json", JSON.stringify({ candidate: "c".repeat(40), devices }));
  await assert.rejects(readSc07ReplayFixture(root, candidate, environment), /SC07_EXPERIENCE_FIXTURE_SOURCE_MISMATCH/);
});
