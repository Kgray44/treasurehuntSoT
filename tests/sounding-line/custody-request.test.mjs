import assert from "node:assert/strict";
import test from "node:test";
import { custodyRequest } from "../../scripts/sounding-line/custody-request.mjs";

const repository = "example/fixture";
const token = "fixture-not-a-credential";
const response = (value, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => value });

test("one failed GET transport is retried once with the identical authenticated request", async () => {
  const requests = [], waits = [];
  const request = custodyRequest(repository, token, {
    fetchImpl: async (url, options) => {
      requests.push({ url, ...options, signal: undefined });
      if (requests.length === 1) throw new TypeError("fetch failed");
      return response({ observed: true });
    },
    wait: async (milliseconds) => waits.push(milliseconds),
  });
  assert.deepEqual(await request("actions/runs/123"), { observed: true });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(waits, [250]);
});

test("exhausted GET transport fails after exactly two attempts without exposing request or credential", async () => {
  let calls = 0;
  const request = custodyRequest(repository, token, {
    fetchImpl: async () => { calls++; throw new TypeError("private endpoint and credential in cause"); },
    wait: async () => {},
  });
  await assert.rejects(request("git/ref/tags/fixture"), { message: "PRODUCT_EXPERIENCE_EXCEPTION_CUSTODY_TRANSPORT_GET_ATTEMPTS_2" });
  assert.equal(calls, 2);
});

test("an uncertain create is attempted once even if the transport fails after remote creation", async () => {
  let calls = 0, writes = 0, waits = 0;
  const request = custodyRequest(repository, token, {
    fetchImpl: async () => { calls++; writes++; throw new TypeError("fetch failed"); },
    wait: async () => { waits++; },
  });
  await assert.rejects(request("git/refs", "POST", { ref: "refs/tags/fixture" }), /CUSTODY_TRANSPORT_WRITE_ATTEMPTS_1/u);
  assert.equal(calls, 1);
  assert.equal(writes, 1);
  assert.equal(waits, 0);
});

test("404 absence and HTTP authorization failures are not retried", async () => {
  for (const status of [404, 401, 403, 503]) {
    let calls = 0;
    const request = custodyRequest(repository, token, { fetchImpl: async () => { calls++; return response(null, status); }, wait: async () => { throw Error("Unexpected retry"); } });
    if (status === 404) assert.equal(await request("git/ref/tags/fixture"), null);
    else await assert.rejects(request("git/ref/tags/fixture"), new RegExp(`CUSTODY_ACCESS_${status}`, "u"));
    assert.equal(calls, 1);
  }
});

test("atomic create conflicts remain consumed and are never retried", async () => {
  for (const status of [409, 422]) {
    let calls = 0;
    const request = custodyRequest(repository, token, { fetchImpl: async () => { calls++; return response(null, status); } });
    await assert.rejects(request("git/refs", "POST", { ref: "refs/tags/fixture" }), /SLOT_CONSUMED/u);
    assert.equal(calls, 1);
  }
});
