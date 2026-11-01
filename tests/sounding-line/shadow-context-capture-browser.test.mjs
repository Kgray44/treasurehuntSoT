// Actual Chromium over an explicitly synthetic static fixture. This establishes
// bounded capture equivalence, never product acceptance or runtime isolation.
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  captureProductExperience,
  shadowCaptureContextSchedule,
} from "../../scripts/sounding-line/experience-browser.mjs";
import { createRawOutputDirectory } from "../../scripts/sounding-line/experience-raw-output.mjs";
import { experienceDigest, validateExperienceEvidence } from "../../scripts/sounding-line/product-experience.mjs";
test(
  "single-context Chromium captures preserve full-run semantic results and screenshot bytes, with private state and no qualification",
  { timeout: 90000 },
  async (t) => {
    const parent = path.join(process.cwd(), "artifacts");
    await mkdir(parent, { recursive: true });
    const root = await mkdtemp(path.join(parent, "shadow-context-browser-"));
    const server = createServer((request, response) => {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html lang="en"><head><title>Shadow fixture</title><style>body{font:18px Arial;margin:24px;color:#111;background:#fff}</style></head><body><main><h1>Shadow context fixture</h1><p>Stable synthetic context.</p></main></body></html>',
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    });
    const contract = {
      id: "fixture.shadow",
      experience: {
        entryPoint: "/",
        devices: ["DESKTOP"],
        roles: ["ANONYMOUS"],
        motion: true,
        states: ["READY"],
        recordingRequired: true,
        journeys: [
          {
            id: "stable",
            roles: ["ANONYMOUS"],
            steps: [{ action: "assert", role: "heading", name: "Shadow context fixture", state: "READY" }],
          },
        ],
      },
    };
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const plan = {
      applicable: true,
      prNumber: 900,
      baseSha: sha,
      candidateSha: sha,
      sourceDigest: "b".repeat(64),
      contractDigest: experienceDigest([contract]),
      contracts: [contract],
      contractIds: [contract.id],
    };
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    const full = await captureProductExperience({
      root,
      plan,
      baseURL,
      outputDirectory: "artifacts/full",
      rawOutputDirectory: null,
    });
    assert.equal(full.journeys.length, 2);
    assert.equal(full.partialContext, undefined);
    const privateValue = "synthetic-private-cookie-value";
    let cache = Buffer.from(
      JSON.stringify([
        [
          "c".repeat(64),
          {
            cookies: [
              {
                name: "synthetic",
                value: privateValue,
                domain: "127.0.0.1",
                path: "/",
                expires: -1,
                httpOnly: true,
                secure: false,
                sameSite: "Lax",
              },
            ],
            origins: [],
          },
        ],
      ]),
    );
    for (const target of shadowCaptureContextSchedule(plan)) {
      const invocation = `artifacts/sounding-line/product-experience-capture-staging/capture-shadow-${target.ordinal}`,
        rawOutputDirectory = invocation + "/raw",
        outputDirectory = invocation + "/capture";
      await createRawOutputDirectory({ root, directory: rawOutputDirectory });
      const observed = await captureProductExperience({
        root,
        plan,
        baseURL,
        outputDirectory,
        rawOutputDirectory,
        shadowContext: { mode: "SHADOW_SINGLE_CONTEXT", contextId: target.contextId },
        shadowAuthenticationCache: cache,
      });
      assert.equal(observed.journeys.length, 1);
      assert.deepEqual(
        observed.journeys[0],
        full.journeys.find((value) => value.motionMode === target.context.motionMode),
      );
      const original = full.artifacts.filter((value) => value.motionMode === target.context.motionMode);
      assert.deepEqual(
        observed.artifacts.map((value) => [value.id, value.type]),
        original.map((value) => [value.id, value.type]),
      );
      for (const artifact of observed.artifacts.filter((value) => value.type === "screenshot"))
        assert(
          (await readFile(path.join(root, artifact.path))).equals(
            await readFile(path.join(root, original.find((value) => value.id === artifact.id).path)),
          ),
        );
      const previous = cache;
      cache = await readFile(observed.shadowPrivateState.path);
      assert(cache.equals(previous));
      const published = JSON.parse(await readFile(path.join(root, outputDirectory, "capture.json")));
      assert.equal(published.shadowPrivateState, undefined);
      assert.equal(published.partialContext.qualification, false);
      assert.equal(JSON.stringify(published).includes(privateValue), false);
      assert.equal(
        (await readFile(path.join(root, outputDirectory, contract.id + "-review-packet.json"), "utf8")).includes(
          privateValue,
        ),
        false,
      );
      assert.equal(
        observed.artifacts.some((value) => value.path.includes("/raw/")),
        false,
      );
      assert.throws(
        () => validateExperienceEvidence({ plan, evidence: observed, root, automatedOnly: true }),
        /SHADOW_CONTEXT_CAPTURE_NOT_QUALIFICATION/u,
      );
    }
  },
);
