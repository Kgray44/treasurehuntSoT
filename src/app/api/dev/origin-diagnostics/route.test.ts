import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("development origin diagnostics", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns only origin-routing metadata and never request credentials", async () => {
    vi.stubEnv("HOMEPORT_ORIGIN_DIAGNOSTICS", "1");
    const response = await GET(
      new Request("http://127.0.0.1:39001/api/dev/origin-diagnostics", {
        headers: {
          host: "staging.homeport.test:39002",
          origin: "http://staging.homeport.test:39002",
          cookie: "private=value",
          forwarded: 'for=192.0.2.1;host="staging.homeport.test:39002";proto=http',
          "x-forwarded-host": "staging.homeport.test:39002",
          "x-forwarded-proto": "http",
        },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      host: "staging.homeport.test:39002",
      forwardedHost: "staging.homeport.test:39002",
      forwardedProto: "http",
      effectiveHost: "staging.homeport.test:39002",
      effectiveProto: "http",
      coherent: true,
    });
    expect(JSON.stringify(body)).not.toMatch(/private|cookie|192\.0\.2\.1/u);
  });
});
