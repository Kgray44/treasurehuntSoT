import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClosedContextResumeShadow } from "../../scripts/sounding-line/closed-context-resume-shadow.mjs";
import { browserRuntimeReceipt } from "../../scripts/sounding-line/browser-authority.mjs";
const plan = () => ({
  applicable: true,
  prNumber: 900,
  baseSha: "a".repeat(40),
  candidateSha: "b".repeat(40),
  sourceDigest: "c".repeat(64),
  contractDigest: "d".repeat(64),
  contracts: [
    { id: "fixture", experience: { devices: ["DESKTOP"], journeys: [{ id: "journey", roles: ["ANONYMOUS"] }] } },
  ],
});
test("held scope and malformed runtime bindings fail before filesystem access", async () => {
  for (const prNumber of [721, 776, 805, undefined])
    await assert.rejects(
      createClosedContextResumeShadow({
        root: "unused",
        plan: { ...plan(), prNumber },
        runtimeDigest: "e".repeat(64),
        fixtureStateDigest: "f".repeat(64),
      }),
      /SHADOW_CONTEXT_SCOPE_INVALID/u,
    );
  await assert.rejects(
    createClosedContextResumeShadow({
      root: "unused",
      plan: plan(),
      runtimeDigest: "invalid",
      fixtureStateDigest: "f".repeat(64),
    }),
    /RESUME_SHADOW_BINDING/u,
  );
});
test("JSON-shaped supervisor and state receipts cannot mint a closed prefix or restore a fabricated handle", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "resume-shadow-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workerEntrypoint = path.join(root, "worker.mjs"),
    applicationEntrypoint = path.join(root, "application.mjs");
  fs.writeFileSync(workerEntrypoint, "void 0\n");
  fs.writeFileSync(applicationEntrypoint, "void 0\n");
  const current = plan(),
    runtimeDigest = "e".repeat(64),
    resume = await createClosedContextResumeShadow({
      root,
      plan: current,
      runtimeDigest,
      fixtureStateDigest: "f".repeat(64),
      workerEntrypoint,
      applicationEntrypoint,
    });
  assert.throws(() => resume.snapshot(), /EMPTY_PREFIX/u);
  const fake = browserRuntimeReceipt({
    timings: {},
    baseURL: "http://127.0.0.1:1",
    lifecycle: { cleanup: { status: "PASS", portsReleased: true } },
  });
  await assert.rejects(resume.append({ runtimeReceipt: fake, stateCut: { qualification: false } }), /RUNTIME_PROOF/u);
  await assert.rejects(
    resume.restore(
      { kind: "CLOSED_CONTEXT_PREFIX_SHADOW_NOT_PROVIDER_AUTHENTICATED", completedContexts: 1, qualification: false },
      { plan: current, runtimeDigest },
    ),
    /PREFIX_PROOF/u,
  );
  assert.throws(() => resume.snapshot(), /EMPTY_PREFIX/u);
});
