import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export function privateProviderHttpFixture(
  archives,
  { binding, mutate = () => {}, requestBarrier = () => {}, responseBarrier = (response) => response } = {},
) {
  const requests = [];
  const request = async (url, options) => {
    requests.push({ url, headers: options.headers });
    await requestBarrier(url, options);
    const value = [...archives.values()].find(
      (item) =>
        url.includes(`/artifacts/${item.id}`) ||
        url.includes(`/runs/${item.runId}/`) ||
        url.includes(`fixture-${item.id}.zip`),
    );
    const item = value ?? archives.values().next().value;
    let response;
    if (url.startsWith("https://blob.fixture.invalid/")) {
      assert.equal(options.headers.Authorization, undefined, "API credential must not reach blob host");
      response = new Response(item.bytes, {
        status: 200,
        headers: { "content-type": "application/zip", "content-length": String(item.bytes.length) },
      });
    } else {
      assert.equal(options.headers.Authorization, "Bearer SYNTHETIC_PROVIDER_CREDENTIAL");
      if (url.endsWith("/zip"))
        response = new Response(null, {
          status: 302,
          headers: { location: `https://blob.fixture.invalid/fixture-${item.id}.zip?fixture-only=1` },
        });
      else {
        let metadata;
        if (url.includes("/artifacts/"))
          metadata = {
            id: item.id,
            name: `product-experience-${item.kind ?? "capture"}-${binding.sourceDigest.slice(0, 16)}`,
            expired: false,
            expires_at: "2099-01-01T00:00:00Z",
            workflow_run: { id: item.runId },
            size_in_bytes: item.bytes.length,
            digest: sha(item.bytes),
          };
        else if (url.includes("/runs/"))
          metadata = {
            id: item.runId,
            workflow_id: 77,
            run_attempt: 1,
            head_sha: binding.controllerSha,
            head_branch: "main",
            head_repository: { full_name: binding.repository },
            event: "workflow_dispatch",
            conclusion: "success",
            actor: { login: item.actor ?? "fixture-producer" },
            triggering_actor: { login: item.actor ?? "fixture-producer" },
          };
        else metadata = { id: 77, path: binding.workflowPath };
        mutate(metadata, url, requests);
        response = new Response(JSON.stringify(metadata), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return responseBarrier(response, url);
  };
  return { request, requests };
}
