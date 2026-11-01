// Actual owned Node/Chromium/SQLite fixture; no built-product or provider claim.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runBrowserAuthority } from "../../scripts/sounding-line/browser-authority.mjs";
import { spawnOwnedProcess } from "../../scripts/sounding-line/owned-process.mjs";
import { createOwnedRuntimeStateRetentionFactory } from "../../scripts/sounding-line/owned-runtime-state-retention.mjs";
import { restoreRuntimeSnapshotRetention } from "../../scripts/sounding-line/runtime-snapshot-retention.mjs";
import {
  createRawOutputDirectory,
  readBoundedRawCaptureFile,
} from "../../scripts/sounding-line/experience-raw-output.mjs";
import { shadowCaptureContextSchedule } from "../../scripts/sounding-line/experience-browser.mjs";
import { experienceDigest } from "../../scripts/sounding-line/product-experience.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test(
  "existing supervisor owns the private single-context worker and application before SQLite and private cache retention",
  { timeout: 90000 },
  async (t) => {
    // Keep fabricated plans outside Git exactly as the existing synthetic browser
    // fixtures do. The real protected-source recognizer must remain intact.
    const repository = process.cwd();
    const root = await fs.mkdtemp(path.join(repository, "artifacts/shadow-supervised-fixture-"));
    const invocation = `artifacts/sounding-line/product-experience-capture-staging/capture-supervised-${randomUUID()}`,
      rawDirectory = invocation + "/raw";
    await createRawOutputDirectory({ root, directory: rawDirectory });
    const absolute = (relative) => path.join(root, relative),
      databasePath = absolute(rawDirectory + "/runtime.db");
    execFileSync(
      "python",
      [
        "-c",
        "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute('create table fixture(value text)');c.commit();c.close()",
        databasePath,
      ],
      { windowsHide: true, timeout: 10000 },
    );
    await fs.chmod(databasePath, 0o600);
    const contract = {
      id: "fixture.supervised",
      experience: {
        entryPoint: "/",
        devices: ["DESKTOP"],
        roles: ["ANONYMOUS"],
        states: ["READY", "RETURNED"],
        recordingRequired: true,
        journeys: [
          {
            id: "roundtrip",
            roles: ["ANONYMOUS"],
            steps: [
              { action: "assert", role: "heading", name: "Owned fixture", state: "READY" },
              { action: "click", role: "link", name: "Leave fixture" },
              {
                action: "assert",
                kind: "outcome",
                role: "heading",
                name: "Outside fixture",
                path: "/away",
                meaning: "The owned fixture destination rendered.",
              },
              { action: "click", role: "link", name: "Return to fixture" },
              {
                action: "assert",
                role: "heading",
                name: "Owned fixture",
                path: "/",
                returnPath: true,
                state: "RETURNED",
              },
            ],
          },
        ],
      },
    };
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      plan = {
        applicable: true,
        prNumber: 900,
        baseSha: sha,
        candidateSha: sha,
        sourceDigest: "b".repeat(64),
        contractDigest: experienceDigest([contract]),
        contracts: [contract],
        contractIds: [contract.id],
      },
      target = shadowCaptureContextSchedule(plan)[0];
    const binding = {
      prNumber: 900,
      baseSha: sha,
      candidateSha: sha,
      sourceDigest: plan.sourceDigest,
      runtimeDigest: "d".repeat(64),
      contextId: target.contextId,
    };
    const factory = await createOwnedRuntimeStateRetentionFactory({ root, rawDirectory, prNumber: 900 }),
      owner = await factory.forContext({ databasePath, originalBinding: binding });
    let success = false;
    t.after(async () => {
      await factory.close();
      assert(absolute(invocation).startsWith(root + path.sep));
      if (success) await fs.rm(root, { recursive: true, force: true });
      else console.error("SYNTHETIC_SHADOW_FIXTURE_RETAINED:" + path.relative(repository, root));
    });
    const serverFile = absolute(rawDirectory + "/fixture-server.cjs");
    await fs.writeFile(
      serverFile,
      `const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.DATABASE_URL.slice(5));db.exec("PRAGMA journal_mode=WAL;PRAGMA wal_autocheckpoint=0;INSERT INTO fixture VALUES ('owned supervised state')");require('node:http').createServer((q,s)=>{const body=q.url==='/away'?'<h1>Outside fixture</h1><a href="/">Return to fixture</a>':'<h1>Owned fixture</h1><a href="/away">Leave fixture</a>';s.setHeader('Content-Type','text/html');s.end('<!doctype html><html lang="en"><head><title>Owned fixture</title><style>body{font:18px Arial;margin:24px;color:#111;background:white}a{display:inline-block;padding:14px}:focus-visible{outline:3px solid #164fc0}</style></head><body><main>'+body+'</main></body></html>')}).listen(Number(process.argv[process.argv.indexOf('-p')+1]),'127.0.0.1');`,
      { flag: "wx", mode: 0o600 },
    );
    const planBytes = Buffer.from(JSON.stringify(plan)),
      cache = Buffer.from("[]"),
      planPath = rawDirectory + "/plan.json",
      cachePath = rawDirectory + "/cache.json";
    await fs.writeFile(absolute(planPath), planBytes, { flag: "wx", mode: 0o600 });
    await fs.writeFile(absolute(cachePath), cache, { flag: "wx", mode: 0o600 });
    const input = {
      version: 1,
      planPath,
      planSha256: hash(planBytes),
      contextId: target.contextId,
      outputDirectory: invocation + "/capture/" + target.contextId,
      authenticationCachePath: cachePath,
      authenticationCacheSha256: hash(cache),
      resultPath: rawDirectory + `/shadow-context-result-${target.contextId}.json`,
    };
    const inputPath = rawDirectory + "/input.json",
      bytes = Buffer.from(JSON.stringify(input));
    await fs.writeFile(absolute(inputPath), bytes, { flag: "wx", mode: 0o600 });
    const port = await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        server.close((error) => (error ? reject(error) : resolve(address.port)));
      });
    });
    const registrations = [];
    const workerEntrypoint = absolute("shadow-worker-fixture.mjs");
    const workerSource = fileURLToPath(
      new URL("../../scripts/sounding-line/shadow-context-worker.mjs", import.meta.url),
    );
    await fs.writeFile(
      workerEntrypoint,
      `import {runShadowContextWorker} from ${JSON.stringify(pathToFileURL(workerSource).href)};try{await runShadowContextWorker({rawDirectory:process.argv[3],inputPath:process.argv[5],inputSha256:process.argv[7]});}catch(error){console.error('SYNTHETIC_SHADOW_WORKER_FAILED');process.exitCode=1;}`,
      { flag: "wx", mode: 0o600 },
    );
    const runtime = await runBrowserAuthority({
      root,
      port,
      environment: {
        ...process.env,
        DATABASE_URL: `file:${databasePath}`,
        NEXT_DIST_DIR: ".next",
        SOUNDING_LINE_TASK_OWNED_HTTP: "0",
      },
      serverArguments: [serverFile, "start", "-p", String(port)],
      browserScriptArguments: [
        workerEntrypoint,
        "--raw-directory",
        rawDirectory,
        "--input",
        inputPath,
        "--input-sha256",
        hash(bytes),
      ],
      executionTimeoutMs: 45000,
      cleanupOptions: { gracefulMs: 200, forceMs: 1000 },
      launch(command, args, options) {
        const child = spawnOwnedProcess(command, args, options),
          role = registrations.length === 0 ? "application" : "capture";
        registrations.push(
          owner.adoptCreatedProcess(role, { child, entrypoint: args[0], args: args.slice(1) }).then(
            () => null,
            (error) => error,
          ),
        );
        return child;
      },
    });
    assert.deepEqual(await Promise.all(registrations), [null, null]);
    assert.equal(runtime.failureCategory, null);
    assert.equal(runtime.lifecycle.cleanup.status, "PASS");
    assert.equal(runtime.lifecycle.cleanup.portsReleased, true);
    const result = JSON.parse(
      await readBoundedRawCaptureFile({ root, rawDirectory, file: input.resultPath, maximumBytes: 32768 }),
    );
    assert.equal(result.kind, "PARTIAL_SHADOW_CONTEXT_RESULT");
    assert.equal(result.qualification, false);
    const authenticationCache = await readBoundedRawCaptureFile({
      root,
      rawDirectory,
      file: result.privateAuthenticationCache.path,
      maximumBytes: 2 * 1024 * 1024,
    });
    assert.equal(hash(authenticationCache), result.privateAuthenticationCache.sha256);
    const retained = await owner.checkpoint({
      authenticationCache,
      fixtureState: Buffer.from('{"syntheticFixture":true}'),
    });
    assert.equal(retained.cleanup.capture.payloadExitCode, 0);
    assert.equal(retained.cleanup.application.status, "PASS");
    assert.equal(retained.qualification, false);
    assert.equal(retained.reuseAuthorized, false);
    const restored = await restoreRuntimeSnapshotRetention({
        root,
        rawDirectory,
        id: retained.retained.id,
        expectedOriginalBinding: binding,
      }),
      restoredPath = absolute(rawDirectory + "/restored.db");
    await fs.writeFile(restoredPath, restored.files.get("sqlite-backup"), { flag: "wx", mode: 0o600 });
    assert.equal(
      execFileSync(
        "python",
        [
          "-c",
          "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);print(c.execute('select value from fixture').fetchone()[0]);c.close()",
          restoredPath,
        ],
        { encoding: "utf8", windowsHide: true, timeout: 10000 },
      ).trim(),
      "owned supervised state",
    );
    assert.equal(restored.files.get("browser-authentication-cache").toString(), "[]");
    success = true;
  },
);
