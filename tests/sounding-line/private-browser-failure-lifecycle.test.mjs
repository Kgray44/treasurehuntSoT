// Actual authority + owned inert HTTP/proxy + real Playwright worker. No browser/product fixture or owner-key authentication.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { runBrowserAuthority } from "../../scripts/sounding-line/browser-authority.mjs";
import { createBrowserDiagnosticSession } from "../../scripts/sounding-line/browser-diagnostics.mjs";
import { PRIVATE_BROWSER_FAILURE_CONTEXT } from "../../scripts/sounding-line/private-browser-failure.mjs";
import { spawnOwnedProcess, stopOwnedProcess } from "../../scripts/sounding-line/owned-process.mjs";
import { createDevelopmentFailureEvidence } from "../../scripts/sounding-line/development-failure-evidence.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const identities = { baseSha: "a".repeat(40), candidateSha: "b".repeat(40), planDigest: "c".repeat(64) };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function assertReleased(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}
async function assertTerminated(pid) {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    assert.match(stat.slice(stat.lastIndexOf(")") + 2), /^[ZX] /u);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function fixture(t, mode) {
  const root = await mkdtemp(path.join(tmpdir(), "private-failure-lifecycle-"));
  const children = [],
    launches = [];
  t.after(async () => {
    await Promise.all(children.map((child) => stopOwnedProcess(child)));
    await rm(root, { recursive: true, force: true });
  });
  const require = createRequire(path.join(sourceRoot, "package.json"));
  const packageFile = process.env.SOUNDING_LINE_TEST_PLAYWRIGHT_PACKAGE
    ? path.join(process.env.SOUNDING_LINE_TEST_PLAYWRIGHT_PACKAGE, "package.json")
    : require.resolve("@playwright/test/package.json");
  const packageRoot = path.dirname(packageFile);
  assert.equal(JSON.parse(await readFile(packageFile, "utf8")).version, "1.56.1");
  await mkdir(path.join(root, "node_modules/@playwright"), { recursive: true });
  await symlink(packageRoot, path.join(root, "node_modules/@playwright/test"), "junction");
  await mkdir(path.join(root, "node_modules/next/dist/bin"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "inert-private-failure-lifecycle", private: true, type: "commonjs" }),
  );
  // The default authority server argv remains unchanged; this tiny HTTP stub is
  // explicitly not Next or a product build and uses the actual allocated backend port.
  await writeFile(
    path.join(root, "node_modules/next/dist/bin/next"),
    `const {createServer}=require('node:http'); const {writeFileSync}=require('node:fs');
    const port=Number(process.argv[process.argv.indexOf('-p')+1]);
    const server=createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/plain','set-cookie':['INERT=1; Secure; HttpOnly; Path=/'],'x-inert-backend':'owned'});res.end('owned inert lifecycle');});
    server.listen(port,'127.0.0.1',()=>writeFileSync('server.private.json',JSON.stringify({pid:process.pid,port})));
    process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`,
  );
  const config = path.join(root, "playwright.config.mjs");
  await writeFile(
    config,
    `export default {testDir:'.',testMatch:'worker.spec.mjs',workers:1,retries:0,repeatEach:1,timeout:15000,projects:[{name:'chromium'}],reporter:[['list'],['json',{outputFile:${JSON.stringify(path.join(root, "original-reporter.private.json"))}}]]};`,
  );
  await writeFile(
    path.join(root, "worker.spec.mjs"),
    `import {test,expect} from ${JSON.stringify(pathToFileURL(path.join(packageRoot, "index.mjs")).href)}; import {writeFileSync} from 'node:fs';
    test('inert authority worker', async ({},info)=>{
      writeFileSync('worker.started.private.json',JSON.stringify({pid:process.pid}));
      const response=await fetch(process.env.PLAYWRIGHT_BASE_URL+'/inert-proof');
      expect(await response.text()).toBe('owned inert lifecycle'); expect(response.headers.get('x-inert-backend')).toBe('owned'); expect(response.headers.get('set-cookie')).not.toContain('Secure');
      writeFileSync('proxy-observed.private.json',JSON.stringify({forwarded:true,secureCookieRemoved:true}));
      if(${JSON.stringify(mode)}==='cancel'){await new Promise(()=>{});}
      if(!['missing','development-missing'].includes(${JSON.stringify(mode)})) for(const [name,extension,contentType] of [['screenshot','png','image/png'],['video','webm','video/webm'],['trace','zip','application/zip'],['error-context','md','text/markdown']]){const file=info.outputPath(name+'.'+extension);writeFileSync(file,'INERT_PRIVATE_LIFECYCLE_'+name);await info.attach(name,{path:file,contentType});}
      expect(1).toBe(2);
    });`,
  );
  const environment = { ...process.env };
  // Inert workers cannot borrow an enclosing campaign's credentials or leases.
  for (const key of Object.keys(environment))
    if (
      /^(?:GH_TOKEN|GITHUB_TOKEN|SOUNDING_LINE_EXCEPTION_(?:PHASE|LEASE|ORDINARY_LEASE)|SOUNDING_LINE_R\d+_LOCAL_LEASE|SOUNDING_LINE_PRIVATE_BROWSER_FAILURE_CONTEXT|PW_TEST_REPORTER)$/u.test(
        key,
      )
    )
      delete environment[key];
  const diagnostic = createBrowserDiagnosticSession(root, identities),
    context = diagnostic.beginScope();
  const controller = new AbortController();
  const launch = (command, args, options) => {
    const cli = args[0] === "node_modules/@playwright/test/cli.js";
    const record = { command, args: [...args], cli, stdout: [], stderr: [], closed: false, cipherPresentAtClose: null };
    if (cli) {
      assert.equal(args.includes("--reporter"), false, "configured reporters are not overridden");
      assert(args.includes("--output"));
      record.privateContext = JSON.parse(options.env[PRIVATE_BROWSER_FAILURE_CONTEXT]);
      assert.equal(
        options.env.PW_TEST_REPORTER,
        path.join(sourceRoot, "scripts/sounding-line/private-browser-failure-reporter.mjs"),
      );
      if (mode === "collection-error") {
        const directory = path.join(record.privateContext.directory, "failure.encrypted");
        return launchWithInjectedDirectory(directory);
      }
    }
    return launchChild();
    function launchWithInjectedDirectory(directory) {
      // Deliberate collector-only write collision, before worker launch.
      // mkdir is synchronous here so the actual test failure still executes unchanged.
      const { mkdirSync } = require("node:fs");
      mkdirSync(directory);
      return launchChild();
    }
    function launchChild() {
      const child = spawnOwnedProcess(command, args, options);
      children.push(child);
      launches.push(record);
      for (const stream of ["stdout", "stderr"])
        child[stream].on("data", (chunk) => {
          if (record[stream].reduce((n, b) => n + b.length, 0) < 256 * 1024) record[stream].push(Buffer.from(chunk));
        });
      child.once("close", () => {
        record.closed = true;
        if (record.privateContext)
          record.cipherPresentAtClose = existsSync(path.join(record.privateContext.directory, "failure.encrypted"));
      });
      return child;
    }
  };
  let cancellation;
  if (mode === "cancel")
    cancellation = (async () => {
      const end = performance.now() + 12000;
      while (performance.now() < end) {
        try {
          await access(path.join(root, "proxy-observed.private.json"));
          controller.abort();
          return;
        } catch {
          await pause(20);
        }
      }
      controller.abort();
      throw Error("INERT_WORKER_START_DEADLINE");
    })();
  let developmentCollections = 0;
  const receipt = await runBrowserAuthority({
    root,
    browserArguments: ["--config", config, "--project", "chromium"],
    ...(mode === "fixture-failure" ? { fixtureArguments: ["--config", config] } : {}),
    environment: {
      ...environment,
      ...context,
      SOUNDING_LINE_TASK_OWNED_HTTP: "1",
      FOREVER_VALIDATION_ISOLATION: "1",
      FOREVER_VALIDATION_PRODUCTION_IDENTITY: "1",
      FOREVER_VALIDATION_NONCE_HASH: "d".repeat(64),
    },
    launch,
    signal: controller.signal,
    executionTimeoutMs: 20000,
    cleanupOptions: { gracefulMs: 500, forceMs: 1500 },
    ...(mode === "development-missing"
      ? {
          async collectDevelopmentFailureEvidence({ binding, producersClosed }) {
            developmentCollections++;
            assert.equal(producersClosed, true);
            assert(
              launches.every((record) => record.closed),
              "all producer streams closed before supplementary capture",
            );
            return createDevelopmentFailureEvidence({
              binding,
              selector: "tests/e2e/synthetic.spec.ts:1",
              provider: null,
              producersClosed,
              report: { status: "COMPLETE", bytes: await readFile(path.join(root, "original-reporter.private.json")) },
              streams: launches.flatMap((record, index) =>
                ["stdout", "stderr"].map((kind) => {
                  const bytes = Buffer.concat(record[kind]);
                  return {
                    label: `${index === 0 ? "server" : "browser"}.${kind}`,
                    bytes,
                    originalBytes: bytes.length,
                    originalStreamSHA256: digest(bytes),
                    complete: true,
                  };
                }),
              ),
            });
          },
        }
      : {}),
  });
  await cancellation;
  const phase = mode === "fixture-failure" ? "fixture" : "browser",
    retention = receipt.lifecycle.privateFailureDiagnostics[phase];
  const cliLaunches = launches.filter((record) => record.cli);
  assert.equal(cliLaunches.length, 1, "one real default CLI worker, no custom browserScriptArguments path");
  assert.equal(cliLaunches[0].args[0], "node_modules/@playwright/test/cli.js");
  assert.equal(receipt.lifecycle.cleanup.status, "PASS");
  for (const key of ["browser", "fixture", "server"]) {
    assert.equal(receipt.lifecycle.cleanup[key].treeReaped, true);
    assert.equal(receipt.lifecycle.cleanup[key].streamsClosed, true);
  }
  assert.equal(receipt.lifecycle.cleanup.proxy.status, "PASS");
  assert.equal(receipt.lifecycle.cleanup.portsReleased, true);
  const server = JSON.parse(await readFile(path.join(root, "server.private.json"), "utf8"));
  await assertReleased(server.port);
  await assertReleased(Number(new URL(receipt.baseURL).port));
  await assertTerminated(server.pid);
  const worker = JSON.parse(await readFile(path.join(root, "worker.started.private.json"), "utf8"));
  await assertTerminated(worker.pid);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "proxy-observed.private.json"), "utf8")), {
    forwarded: true,
    secureCookieRemoved: true,
  });
  assert.equal(cliLaunches[0].closed, true);
  if (mode !== "collection-error")
    assert.equal(cliLaunches[0].cipherPresentAtClose, false, "collection cannot precede worker close");
  if (mode !== "cancel") {
    assert.equal(retention.worker.exitCode, 1, "preserves actual Playwright failure exit");
    const original = JSON.parse(await readFile(path.join(root, "original-reporter.private.json"), "utf8"));
    assert.equal(original.stats.unexpected, 1, "original configured JSON reporter remains active");
    assert.match(Buffer.concat(cliLaunches[0].stdout).toString(), /1 failed/u, "original list reporter remains active");
  }
  const privateContext = cliLaunches[0].privateContext;
  for (const [key, value] of Object.entries(identities)) assert.equal(privateContext.binding[key], value);
  const expectedDirectories = await readdir(path.join(root, "artifacts/sounding-line/private-browser-failures"));
  assert.equal(expectedDirectories.length, 1, "phase owns a fresh directory");
  if (mode !== "cancel" && mode !== "collection-error") {
    const bytes = await readFile(path.join(privateContext.directory, "failure.encrypted"));
    assert.equal(digest(bytes), retention.ciphertextDigest);
    assert.equal(bytes.length, retention.ciphertextBytes);
    const envelope = JSON.parse(bytes),
      aad = JSON.parse(Buffer.from(envelope.aad, "base64"));
    assert.equal(envelope.format, "VW-POSTTECHNICAL-EVIDENCE-1");
    assert.equal(aad.sessionId, privateContext.sessionId);
    assert.equal(aad.keyId, "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc");
    for (const [key, value] of Object.entries(privateContext.binding)) assert.equal(aad[key], value);
    const manifest = JSON.parse(await readFile(path.join(privateContext.directory, "manifest.private.json"), "utf8"));
    assert.equal(manifest.failures.length, 1);
    assert.match(manifest.failures[0].id, /^[a-f0-9]{64}$/u);
    assert.equal(manifest.records.length, ["missing", "development-missing"].includes(mode) ? 0 : 4);
  }
  if (process.env.SOUNDING_LINE_TEST_RECEIPTS_DIRECTORY) {
    const out = path.join(process.env.SOUNDING_LINE_TEST_RECEIPTS_DIRECTORY, mode);
    await mkdir(out, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(out, "authority-runtime.actual.private.json"),
      JSON.stringify(
        {
          classification: "INERT_REAL_AUTHORITY_LIFECYCLE_NOT_BROWSER_PRODUCT_ACCEPTANCE",
          receipt,
          cliLaunches: cliLaunches.map(({ args, closed, cipherPresentAtClose, privateContext }) => ({
            args,
            closed,
            cipherPresentAtClose,
            privateContext,
          })),
          ownerPrivateAuthentication: false,
          syntheticAttachments: true,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    await writeFile(
      path.join(out, "actual-default-playwright.stdout.private.log"),
      Buffer.concat(cliLaunches[0].stdout),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(out, "actual-default-playwright.stderr.private.log"),
      Buffer.concat(cliLaunches[0].stderr),
      { mode: 0o600 },
    );
    for (const name of ["failure.encrypted", "manifest.private.json", "context.private.json", "retention.json"]) {
      try {
        const data = await readFile(path.join(privateContext.directory, name));
        await writeFile(path.join(out, name), data, { mode: 0o600 });
      } catch (error) {
        if (!["ENOENT", "EISDIR"].includes(error.code)) throw error;
      }
    }
    if (mode !== "cancel")
      await copyFile(
        path.join(root, "original-reporter.private.json"),
        path.join(out, "original-reporter.private.json"),
      );
  }
  return { receipt, retention, developmentCollections };
}

test(
  "real authority captures source-bound development report and streams only after all owned producers close",
  { skip: process.platform === "win32", timeout: 35000 },
  async (t) => {
    const { receipt, retention, developmentCollections } = await fixture(t, "development-missing");
    assert.equal(developmentCollections, 1);
    assert.equal(receipt.failureCategory, "PRODUCT_FAILURE");
    assert.equal(receipt.lifecycle.cleanup.status, "PASS");
    assert.equal(retention.worker.exitCode, 1);
    assert.equal(retention.retention, "INCOMPLETE");
    assert(retention.issues.includes("NO_FAILURE_ATTACHMENTS"));
    assert.equal(retention.memberCount, 7);
    assert.equal(retention.qualification, false);
  },
);

for (const mode of ["failure", "missing", "cancel", "collection-error", "fixture-failure"]) {
  test(
    `real default Playwright authority retains ${mode} diagnostics after owned cleanup`,
    { timeout: 35000 },
    async (t) => {
      const { receipt, retention } = await fixture(t, mode);
      if (mode === "cancel") {
        assert.equal(receipt.failureCategory, "INFRASTRUCTURE_RUNTIME_FAILURE");
        assert.equal(receipt.failureCode, "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:CANCELLED");
        assert.equal(retention.retention, "INCOMPLETE");
      } else {
        assert.equal(receipt.failureCategory, "PRODUCT_FAILURE");
        assert.equal(
          receipt.failureCode,
          mode === "fixture-failure"
            ? "SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_FIXTURE_EXITED"
            : "SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_EXITED",
        );
        assert.equal(
          retention.retention,
          mode === "collection-error" ? "ENCRYPTION_FAILED" : mode === "missing" ? "INCOMPLETE" : "COMPLETE",
        );
      }
      assert.equal(retention.qualification, false);
      if (mode === "fixture-failure") {
        assert.equal(receipt.lifecycle.fixture, "FAIL");
        assert.equal(receipt.lifecycle.capture, "NOT_STARTED");
        assert.equal(receipt.lifecycle.privateFailureDiagnostics.browser, undefined);
      }
    },
  );
}
