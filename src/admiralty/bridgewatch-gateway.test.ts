import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { bridgewatchInternalUrl, handleBridgewatchGateway } from "./bridgewatch-gateway";

describe("Bridgewatch same-host gateway", () => {
  it("accepts only a trusted loopback HTTP upstream", () => {
    expect(bridgewatchInternalUrl({})?.href).toBe("http://127.0.0.1:4318/");
    expect(bridgewatchInternalUrl({ BRIDGEWATCH_INTERNAL_URL: "http://localhost:4318" })?.href).toBe(
      "http://localhost:4318/",
    );
    for (const value of [
      "https://127.0.0.1:4318",
      "http://example.test:4318",
      "http://operator:secret@127.0.0.1:4318",
      "http://127.0.0.1:4318/selected/path",
      "http://127.0.0.1:4318?upstream=other",
      "not-a-url",
    ])
      expect(bridgewatchInternalUrl({ BRIDGEWATCH_INTERNAL_URL: value })).toBeNull();
  });

  it("returns a private 404 to anonymous and ordinary callers without contacting Bridgewatch", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await handleBridgewatchGateway(new Request("http://voyagewright.test/bridgewatch/"), [], {
      authorize: async () => false,
      fetcher,
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("proxies only the mounted dashboard, static assets, and read-only APIs without browser credentials", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("ok", { status: 200, headers: { "Content-Type": "application/json", Server: "Fastify" } }),
      );
    const request = new Request("http://voyagewright.test/bridgewatch/api/activity?since=2026-08-13T12:00:00Z", {
      headers: { Authorization: "Bearer browser-secret", Cookie: "wayfarer_account=private", "X-Upstream": "evil" },
    });
    const response = await handleBridgewatchGateway(request, ["api", "activity"], {
      authorize: async () => true,
      fetcher,
      env: { BRIDGEWATCH_INTERNAL_URL: "http://127.0.0.1:4318" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("server")).toBeNull();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url.toString()).toBe("http://127.0.0.1:4318/api/activity?since=2026-08-13T12%3A00%3A00Z");
    expect(init?.headers).toEqual({ Accept: "application/json" });

    for (const path of [["app.js"], ["style.css"], ["api", "summary"], ["api", "projects", "bridgewatch"]])
      expect(
        (
          await handleBridgewatchGateway(new Request(`http://voyagewright.test/bridgewatch/${path.join("/")}`), path, {
            authorize: async () => true,
            fetcher,
          })
        ).status,
      ).toBe(200);
  });

  it("blocks mutation, telemetry, traversal, arbitrary routes, and request-selected upstream input", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const authorize = async () => true;
    expect(
      (
        await handleBridgewatchGateway(
          new Request("http://voyagewright.test/bridgewatch/api/telemetry/heartbeat", { method: "POST" }),
          ["api", "telemetry", "heartbeat"],
          { authorize, fetcher },
        )
      ).status,
    ).toBe(405);
    for (const [url, path] of [
      ["http://voyagewright.test/bridgewatch/api/telemetry/heartbeat", ["api", "telemetry", "heartbeat"]],
      ["http://voyagewright.test/bridgewatch/healthz", ["healthz"]],
      ["http://voyagewright.test/bridgewatch/../secret", ["..", "secret"]],
      ["http://voyagewright.test/bridgewatch/api/summary?upstream=http://evil.test", ["api", "summary"]],
    ] as const)
      expect((await handleBridgewatchGateway(new Request(url), path, { authorize, fetcher })).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a bounded unavailable response without leaking the configured upstream", async () => {
    const response = await handleBridgewatchGateway(
      new Request("http://voyagewright.test/bridgewatch/api/summary"),
      ["api", "summary"],
      {
        authorize: async () => true,
        fetcher: async () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:4318");
        },
      },
    );
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ error: "Private tool unavailable" });
    expect(body).not.toContain("127.0.0.1");
  });

  it("serves the authorized canonical entry with mounted asset paths", async () => {
    const response = await handleBridgewatchGateway(
      new Request("http://attacker-controlled-host.test/bridgewatch"),
      [],
      {
        authorize: async () => true,
        fetcher: async () =>
          new Response('<link href="/style.css"><script src="/app.js"></script>', {
            headers: { "Content-Type": "text/html" },
          }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('href="/bridgewatch/style.css"');
    expect(body).not.toContain("attacker-controlled-host.test");
  });

  it("keeps the deployed proxy allowlisted, capability-gated, credential-stripped, and fail-soft", () => {
    const nginx = readFileSync("deploy/nginx.conf", "utf8");
    expect(nginx).toContain("server 127.0.0.1:4318;");
    expect(nginx).toContain("map $request_uri $bridgewatch_browser_route");
    expect(nginx).toContain("auth_request /_bridgewatch_authorize;");
    expect(nginx).toContain("/api/internal/bridgewatch/authorize");
    expect(nginx).toContain("if ($request_method !~ ^(GET|HEAD)$) { return 405; }");
    expect(nginx).toContain("if ($bridgewatch_browser_route = 0) { return 404; }");
    expect(nginx).toContain('proxy_set_header Authorization "";');
    expect(nginx).toContain('proxy_set_header Cookie "";');
    expect(nginx).toContain("proxy_pass_request_body off;");
    expect(nginx).toContain('proxy_set_header X-Forwarded-For "";');
    expect(nginx).toContain("error_page 500 502 503 504 =503 @bridgewatch_unavailable;");
    expect(nginx).not.toMatch(/bridgewatch\/api\/telemetry/u);

    const service = readFileSync("deploy/forever-treasure-bridgewatch.service", "utf8");
    expect(service).toContain("BRIDGEWATCH_HOST=127.0.0.1");
    expect(service).toContain("BRIDGEWATCH_PORT=4318");
    expect(service).toContain("ExecStart=/usr/bin/node dist/lib/server.js");
    expect(service).not.toContain("forever-treasure.service");
    expect(readFileSync("src/admiralty/bridgewatch-gateway.ts", "utf8")).not.toMatch(/BridgewatchStore|sqlite/u);
  });
});
