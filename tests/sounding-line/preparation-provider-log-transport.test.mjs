import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

test("installed provider transport opts into exact binary logs only and keeps all output piped", () => {
  const source = fs.readFileSync(new URL("../../scripts/sounding-line/preparation-provider-auth.mjs", import.meta.url), "utf8");
  const body = /function providerRequest\(endpoint, \{ maximumBytes, timeoutMs \}\) \{[\s\S]*?\n\}\nfunction originalMarker/u.exec(source)?.[0];
  assert(body);
  const original = Buffer.from("timestamp \u001b[36;1moriginal\u001b[0m\n"), calls = [];
  const request = vm.runInNewContext(body.replace(/\nfunction originalMarker$/u, "") + "\nproviderRequest", {
    repository: "Kgray44/treasurehuntSoT",
    process: { env: { SYNTHETIC_ENV: "retained" } },
    execFileSync(command, args, options) { calls.push({ command, args: [...args], options }); return original; },
  });
  const endpoints = [
    "actions/jobs/125097878005/logs", "actions/jobs/125098263697/logs",
    "git/ref/heads/main", "actions/runs/123/attempts/1", "actions/artifacts/55",
    "actions/jobs/10/logs?extra=true", "actions/jobs/0/logs", "actions/jobs/10/logs/other",
    "actions/jobs/10/logs\n", "https://example.invalid/actions/jobs/10/logs",
  ];
  for (const [index, endpoint] of endpoints.entries()) {
    assert.equal(request(endpoint, { maximumBytes: 2097152, timeoutMs: 15000 }), original);
    const { command, args, options } = calls.at(-1);
    assert.equal(command, "gh");
    assert.equal(args.includes("--allow-escape-sequences"), index < 2);
    assert.deepEqual(args.slice(0, 3), ["api", "--hostname", "github.com"]);
    assert.equal(args.at(-1), `repos/Kgray44/treasurehuntSoT/${endpoint}`);
    assert.equal(options.encoding, null);
    assert.deepEqual([...options.stdio], ["ignore", "pipe", "pipe"]);
    assert.equal(options.timeout, 15000);
    assert.equal(options.maxBuffer, 2097152);
    assert.equal(options.env.NO_COLOR, "1");
  }
});
