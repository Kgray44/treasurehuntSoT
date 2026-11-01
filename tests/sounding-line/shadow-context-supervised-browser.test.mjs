// Actual owned Node/Chromium/SQLite fixture; no built-product or provider claim.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  runBrowserAuthority,
  inspectOwnedBrowserAuthorityReceipt,
} from "../../scripts/sounding-line/browser-authority.mjs";
import { spawnOwnedProcess } from "../../scripts/sounding-line/owned-process.mjs";
import {
  createOwnedRuntimeStateRetentionFactory,
  inspectOwnedRuntimeStateCut,
} from "../../scripts/sounding-line/owned-runtime-state-retention.mjs";
import { restoreRuntimeSnapshotRetention } from "../../scripts/sounding-line/runtime-snapshot-retention.mjs";
import {
  createRawOutputDirectory,
  readBoundedRawCaptureFile,
} from "../../scripts/sounding-line/experience-raw-output.mjs";
import { shadowCaptureContextSchedule } from "../../scripts/sounding-line/experience-browser.mjs";
import { experienceDigest } from "../../scripts/sounding-line/product-experience.mjs";
import { createClosedContextResumeShadow } from "../../scripts/sounding-line/closed-context-resume-shadow.mjs";
import { authenticatedCompletedReceipt } from "../../scripts/sounding-line/authenticated-completed-evidence.mjs";
import { buildClosedContextRegistryShadow } from "../../scripts/sounding-line/closed-context-registry-producer.mjs";
import { validateArtifactManifest } from "../../scripts/sounding-line/artifact-evidence-registry.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test(
  "owned SQLite restart restores an authenticated browser session and completed context without another sign-in",
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
        roles: ["OWNER"],
        motion: true,
        states: ["READY", "RETURNED"],
        recordingRequired: true,
        roleSetup: {
          OWNER: {
            entryPoint: "/sign-in?returnTo=/",
            witness: { role: "heading", name: "Owned fixture", text: "Owned fixture" },
            steps: [
              { action: "fill", role: "textbox", name: "Email or Player name", value: "owner@example.invalid" },
              { action: "fill", role: "textbox", name: "Password", value: "synthetic-owner-password" },
              { action: "click", role: "button", name: "Sign in" },
              { action: "assert", role: "heading", name: "Owned fixture" },
            ],
          },
        },
        journeys: [
          {
            id: "roundtrip",
            roles: ["OWNER"],
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
      `const{DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync(process.env.DATABASE_URL.slice(5));
db.exec("PRAGMA journal_mode=WAL;PRAGMA wal_autocheckpoint=0;INSERT INTO fixture VALUES ('owned supervised state');CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS logins(owner TEXT)");
const token='synthetic-private-authenticated-session';
const page=body=>'<!doctype html><html lang="en"><head><title>Owned fixture</title><style>body{font:18px Arial;margin:24px;color:#111;background:white}a,button{display:inline-block;padding:14px}:focus-visible{outline:3px solid #164fc0}</style></head><body><main>'+body+'</main></body></html>';
require('node:http').createServer((q,s)=>{
 const url=new URL(q.url,'http://fixture.invalid');
 s.setHeader('Content-Type','text/html');
 if(url.pathname==='/sign-in'){
  if(q.method==='POST'){
   let body='';q.on('data',part=>{body+=part;if(body.length>4096)q.destroy()});q.on('end',()=>{
    const form=new URLSearchParams(body);
    if(form.get('email')!=='owner@example.invalid'||form.get('password')!=='synthetic-owner-password'){s.statusCode=403;s.end('Rejected');return}
    db.prepare('INSERT OR IGNORE INTO sessions VALUES (?)').run(token);db.prepare('INSERT INTO logins VALUES (?)').run('owner');
    s.setHeader('Set-Cookie','fixture_session='+token+'; Path=/; HttpOnly; SameSite=Lax');s.statusCode=303;s.setHeader('Location','/');s.end();
   });return;
  }
  s.end(page('<h1>Sign in</h1><form method="post" action="/sign-in"><label>Email or Player name<input type="email" name="email"></label><label>Password<input role="textbox" type="password" name="password"></label><button>Sign in</button></form>'));return;
 }
 const cookie=(q.headers.cookie||'').split(';').map(v=>v.trim()).includes('fixture_session='+token);
 if(!cookie||!db.prepare('SELECT token FROM sessions WHERE token=?').get(token)){s.statusCode=302;s.setHeader('Location','/sign-in?returnTo=/');s.end();return}
 const body=url.pathname==='/away'?'<h1>Outside fixture</h1><a href="/">Return to fixture</a>':'<h1>Owned fixture</h1><a href="/away">Leave fixture</a>';
 s.end(page(body));
}).listen(Number(process.argv[process.argv.indexOf('-p')+1]),'127.0.0.1');`,
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
    const closedRuntime = inspectOwnedBrowserAuthorityReceipt(runtime, { root });
    assert(closedRuntime);
    assert.equal(inspectOwnedBrowserAuthorityReceipt(structuredClone(runtime), { root }), null);
    const result = JSON.parse(
      await readBoundedRawCaptureFile({ root, rawDirectory, file: input.resultPath, maximumBytes: 32768 }),
    );
    assert.equal(result.kind, "PARTIAL_SHADOW_CONTEXT_RESULT");
    assert.equal(result.qualification, false);
    const journalBytes = await readBoundedRawCaptureFile({
      root,
      rawDirectory,
      file: result.closedContextJournal.path,
      maximumBytes: 2 * 1024 * 1024,
    });
    assert.equal(hash(journalBytes), result.closedContextJournal.sha256);
    const journalObservation = {
      journal: JSON.parse(journalBytes),
      bytes: journalBytes,
      path: result.closedContextJournal.path,
      completedAt: new Date().toISOString(),
    };
    const registryInput = {
      plan,
      contexts: [journalObservation],
      producer: { repository: "Kgray44/treasurehuntSoT", runId: 4444, attempt: 1, workflowSha: plan.baseSha },
      sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8", windowsHide: true }).trim(),
      controllerDigest: hash(
        await fs.readFile(new URL("../../scripts/sounding-line/closed-context-registry-producer.mjs", import.meta.url)),
      ),
      rawArtifact: { id: 9001, archiveSha256: "9".repeat(64) },
      lifecycleArtifact: { id: 9002, archiveSha256: "8".repeat(64) },
      cleanup: {
        bytes: Buffer.from(JSON.stringify(runtime)),
        path: "browser-runtime.json",
        processTreeClosed: true,
        portsClosed: runtime.lifecycle.cleanup.portsReleased,
        streamsClosed: true,
      },
      definitionObservations: {
        fixtureDigest: hash(Buffer.from("synthetic fixture")),
        toolchainDigest: hash(Buffer.from(process.version)),
        browserDigest: hash(Buffer.from("unattested synthetic browser declaration")),
        environmentDigest: hash(Buffer.from("unattested synthetic environment declaration")),
      },
    };
    const registry = buildClosedContextRegistryShadow(registryInput);
    assert.equal(registry.manifest.artifacts.length, journalObservation.journal.artifacts.length + 3);
    assert.deepEqual(
      registry.manifest.artifacts.slice(0, journalObservation.journal.artifacts.length).map((value) => value.id),
      journalObservation.journal.artifacts.map((value) => value.id),
    );
    assert.equal(registry.manifest.completedContexts.length, 1);
    assert.equal(registry.manifest.runtimeAttestations[0].mutableStateClass, "UNATTESTED_SHARED_TASK_RUNTIME");
    assert.equal(registry.reuseAuthorized, false);
    assert.equal(registry.manifest.reviewReceipts.length, 0);
    assert.equal(
      validateArtifactManifest(registry.manifest, {
        expectedCoverage: registry.expectedCoverage,
        requireComplete: false,
      }).completedContexts,
      1,
    );
    assert.throws(() => validateArtifactManifest(registry.manifest), /PARTIAL_MANIFEST_NOT_ACCEPTANCE/u);
    for (const change of [
      (value) => {
        value.cleanup.portsClosed = false;
      },
      (value) => {
        value.contexts.push(value.contexts[0]);
      },
      (value) => {
        value.contexts[0].journal.journey.status = "FAIL";
      },
      (value) => {
        value.contexts[0].journal.mutableStateClass = "TASK_OWNED_ISOLATED_PER_CONTEXT";
      },
      (value) => {
        value.contexts[0].journal.artifacts[0].id = "renumbered-original";
      },
      (value) => {
        value.definitionObservations.sourceTreeDigest = "f".repeat(64);
      },
      (value) => {
        value.plan.contracts[0].experience.journeys[0].steps[0].when = "DESKTOP";
      },
    ]) {
      const altered = structuredClone(registryInput);
      altered.contexts[0].bytes = Buffer.from(altered.contexts[0].bytes);
      altered.cleanup.bytes = Buffer.from(altered.cleanup.bytes);
      change(altered);
      assert.throws(() => buildClosedContextRegistryShadow(altered), /SOUNDING_LINE_CONTEXT_REGISTRY_PRODUCER_/u);
    }
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
    assert(
      inspectOwnedRuntimeStateCut(retained, {
        root,
        expectedOriginalBinding: binding,
        runtimeReferences: closedRuntime.references,
      }),
    );
    assert.equal(
      inspectOwnedRuntimeStateCut(retained, {
        root,
        expectedOriginalBinding: binding,
        runtimeReferences: { application: {}, capture: {} },
      }),
      null,
    );
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
    assert(restored.files.get("browser-authentication-cache").equals(authenticationCache));
    const resume = await createClosedContextResumeShadow({
      root,
      plan,
      runtimeDigest: binding.runtimeDigest,
      fixtureStateDigest: hash(Buffer.from('{"syntheticFixture":true}')),
      workerEntrypoint,
      applicationEntrypoint: serverFile,
    });
    const prefixInput = {
      stateCut: retained,
      runtimeReceipt: runtime,
      workerInputPath: inputPath,
      workerInputSha256: hash(bytes),
    };
    await assert.rejects(resume.append({ ...prefixInput, stateCut: structuredClone(retained) }), /STATE_PROOF/u);
    await assert.rejects(resume.append({ ...prefixInput, runtimeReceipt: structuredClone(runtime) }), /RUNTIME_PROOF/u);
    await resume.append(prefixInput);
    const firstPrefix = resume.snapshot(),
      firstRestore = await resume.restore(firstPrefix, { plan, runtimeDigest: binding.runtimeDigest });
    assert.equal(firstRestore.completedContexts, 1);
    assert.equal(firstRestore.nextContext.context.motionMode, "REDUCED");
    assert.equal(authenticatedCompletedReceipt(firstPrefix, {}), null);
    await assert.rejects(
      resume.restore({ ...firstPrefix }, { plan, runtimeDigest: binding.runtimeDigest }),
      /PREFIX_PROOF/u,
    );
    await assert.rejects(
      resume.restore(firstPrefix, {
        plan: { ...plan, candidateSha: "0".repeat(40) },
        runtimeDigest: binding.runtimeDigest,
      }),
      /PREFIX_PROOF/u,
    );
    const resumedTarget = firstRestore.nextContext,
      resumedDatabase = absolute(rawDirectory + "/resumed-runtime.db");
    await fs.writeFile(resumedDatabase, firstRestore.files.get("sqlite-backup"), { flag: "wx", mode: 0o600 });
    const resumedBinding = { ...binding, contextId: resumedTarget.contextId },
      resumedOwner = await factory.forContext({ databasePath: resumedDatabase, originalBinding: resumedBinding });
    const resumedCachePath = rawDirectory + "/resumed-cache.json";
    await fs.writeFile(absolute(resumedCachePath), firstRestore.files.get("browser-authentication-cache"), {
      flag: "wx",
      mode: 0o600,
    });
    const resumedInput = {
      ...input,
      contextId: resumedTarget.contextId,
      outputDirectory: invocation + "/capture/" + resumedTarget.contextId,
      authenticationCachePath: resumedCachePath,
      authenticationCacheSha256: hash(firstRestore.files.get("browser-authentication-cache")),
      resultPath: rawDirectory + `/shadow-context-result-${resumedTarget.contextId}.json`,
    };
    const resumedInputPath = rawDirectory + "/resumed-input.json",
      resumedBytes = Buffer.from(JSON.stringify(resumedInput));
    await fs.writeFile(absolute(resumedInputPath), resumedBytes, { flag: "wx", mode: 0o600 });
    const resumedRegistrations = [];
    const resumedRuntime = await runBrowserAuthority({
      root,
      port,
      environment: {
        ...process.env,
        DATABASE_URL: `file:${resumedDatabase}`,
        NEXT_DIST_DIR: ".next",
        SOUNDING_LINE_TASK_OWNED_HTTP: "0",
      },
      serverArguments: [serverFile, "start", "-p", String(port)],
      browserScriptArguments: [
        workerEntrypoint,
        "--raw-directory",
        rawDirectory,
        "--input",
        resumedInputPath,
        "--input-sha256",
        hash(resumedBytes),
      ],
      executionTimeoutMs: 45000,
      cleanupOptions: { gracefulMs: 200, forceMs: 1000 },
      launch(command, args, options) {
        const child = spawnOwnedProcess(command, args, options),
          role = resumedRegistrations.length === 0 ? "application" : "capture";
        resumedRegistrations.push(
          resumedOwner.adoptCreatedProcess(role, { child, entrypoint: args[0], args: args.slice(1) }).then(
            () => null,
            (error) => error,
          ),
        );
        return child;
      },
    });
    assert.deepEqual(await Promise.all(resumedRegistrations), [null, null]);
    assert.equal(resumedRuntime.failureCategory, null);
    const resumedResult = JSON.parse(
        await readBoundedRawCaptureFile({ root, rawDirectory, file: resumedInput.resultPath, maximumBytes: 32768 }),
      ),
      resumedAuthentication = await readBoundedRawCaptureFile({
        root,
        rawDirectory,
        file: resumedResult.privateAuthenticationCache.path,
        maximumBytes: 2 * 1024 * 1024,
      });
    const resumedCut = await resumedOwner.checkpoint({
      authenticationCache: resumedAuthentication,
      fixtureState: firstRestore.files.get("fixture-state"),
    });
    await resume.append({
      stateCut: resumedCut,
      runtimeReceipt: resumedRuntime,
      workerInputPath: resumedInputPath,
      workerInputSha256: hash(resumedBytes),
    });
    const complete = await resume.restore(resume.snapshot(), { plan, runtimeDigest: binding.runtimeDigest });
    assert.equal(complete.completedContexts, 2);
    assert.equal(complete.nextContext, null);
    assert.equal(complete.reuseAuthorized, false);
    assert.deepEqual(
      complete.originalArtifacts.filter((artifact) => artifact.motionMode === "NORMAL").map((artifact) => artifact.id),
      firstRestore.originalArtifacts.map((artifact) => artifact.id),
    );
    const finalDatabase = absolute(rawDirectory + "/two-contexts.db");
    await fs.writeFile(finalDatabase, complete.files.get("sqlite-backup"), { flag: "wx", mode: 0o600 });
    assert.equal(
      execFileSync(
        "python",
        [
          "-c",
          "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);print(c.execute('select count(*) from fixture').fetchone()[0]);c.close()",
          finalDatabase,
        ],
        { encoding: "utf8", windowsHide: true, timeout: 10000 },
      ).trim(),
      "2",
    );
    assert.equal(
      (await resume.restore(firstPrefix, { plan, runtimeDigest: binding.runtimeDigest })).completedContexts,
      1,
    );
    assert.equal(JSON.parse(authenticationCache).length, 1);
    assert.equal(JSON.parse(resumedAuthentication).length, 1);
    const persistedAuth = execFileSync(
      "python",
      [
        "-c",
        "import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);print(json.dumps([c.execute('select count(*) from logins').fetchone()[0],c.execute('select count(*) from sessions').fetchone()[0]]));c.close()",
        finalDatabase,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10000 },
    ).trim();
    assert.deepEqual(JSON.parse(persistedAuth), [1, 1]);
    for (const output of [input.outputDirectory, resumedInput.outputDirectory]) {
      const capture = await fs.readFile(absolute(output + "/capture.json"), "utf8");
      assert(!capture.includes("synthetic-private-authenticated-session"));
      assert(!capture.includes("synthetic-owner-password"));
    }
    // A failed optional journal must not become a resumable worker result even
    // though its actual browser journey and immutable partial capture completed.
    const negativePlan = structuredClone(plan);
    negativePlan.contracts[0].experience.journeys[0].id = "missing-journal";
    negativePlan.contractDigest = experienceDigest(negativePlan.contracts);
    const negativeTarget = shadowCaptureContextSchedule(negativePlan)[0];
    const negativePlanPath = rawDirectory + "/negative-plan.json",
      negativePlanBytes = Buffer.from(JSON.stringify(negativePlan));
    await fs.writeFile(absolute(negativePlanPath), negativePlanBytes, { flag: "wx", mode: 0o600 });
    await fs.mkdir(absolute(rawDirectory + "/closed-contexts/" + negativeTarget.contextId), { mode: 0o700 });
    const negativeInput = {
      ...input,
      planPath: negativePlanPath,
      planSha256: hash(negativePlanBytes),
      contextId: negativeTarget.contextId,
      outputDirectory: invocation + "/capture/" + negativeTarget.contextId,
      resultPath: rawDirectory + `/shadow-context-result-${negativeTarget.contextId}.json`,
    };
    const negativeInputPath = rawDirectory + "/negative-input.json",
      negativeBytes = Buffer.from(JSON.stringify(negativeInput));
    await fs.writeFile(absolute(negativeInputPath), negativeBytes, { flag: "wx", mode: 0o600 });
    const negative = await runBrowserAuthority({
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
        negativeInputPath,
        "--input-sha256",
        hash(negativeBytes),
      ],
      executionTimeoutMs: 45000,
      cleanupOptions: { gracefulMs: 200, forceMs: 1000 },
    });
    assert.equal(negative.failureCategory, "PRODUCT_FAILURE");
    assert.equal(negative.lifecycle.cleanup.status, "PASS");
    assert.equal(negative.lifecycle.cleanup.portsReleased, true);
    assert.equal(inspectOwnedBrowserAuthorityReceipt(negative, { root }), null);
    await assert.rejects(fs.stat(absolute(negativeInput.resultPath)), (error) => error.code === "ENOENT");
    const incomplete = JSON.parse(await fs.readFile(absolute(negativeInput.outputDirectory + "/capture.json")));
    assert.equal(incomplete.journeys[0].status, "PASS");
    assert.equal(incomplete.partialContext.qualification, false);
    assert.equal(hash(await fs.readFile(retained.snapshot.path)), retained.snapshot.sha256);
    success = true;
  },
);
