import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { IncomingMessage, RequestOptions } from "node:http";
import type { LookupFunction } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ resolve4: vi.fn(), cancel: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => {
  const mocked = {
    Resolver: class {
      resolve4 = mocks.resolve4;
      cancel = mocks.cancel;
    },
  };
  return { ...mocked, default: mocked };
});
vi.mock("node:https", async (original) => {
  const actual = await original<typeof import("node:https")>();
  const mocked = { ...actual, request: mocks.request };
  return { ...mocked, default: mocked };
});
import { requestRemoteJson, isRemoteServiceUrl, isPublicRemoteIpv4 } from "./remote-network-server";

let response: PassThrough & { statusCode: number; headers: Record<string, string>; complete: boolean };
let body = '{"synthetic":true}';
let finish = true;
const input = () => ({
  url: new URL("https://geo.example.test/search?q=synthetic"),
  method: "GET" as const,
  userAgent: "Synthetic bounded network fixture",
});
beforeEach(() => {
  vi.clearAllMocks();
  body = '{"synthetic":true}';
  finish = true;
  mocks.resolve4.mockResolvedValue(["8.8.8.8"]);
  response = Object.assign(new PassThrough(), {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    complete: true,
  });
  mocks.request.mockImplementation((_url: URL, options: RequestOptions, receive: (value: IncomingMessage) => void) => {
    const events = new EventEmitter();
    const abort = () => events.emit("error", new Error("ABORTED"));
    options.signal?.addEventListener("abort", abort, { once: true });
    return Object.assign(events, {
      end: () => {
        if (finish)
          queueMicrotask(() => {
            receive(response as unknown as IncomingMessage);
            response.end(body);
          });
      },
      destroy: () => {
        options.signal?.removeEventListener("abort", abort);
        response.destroy();
      },
    });
  });
});
afterEach(() => {
  response.destroy();
  vi.useRealTimers();
});
describe("remote HTTPS containment", () => {
  it("blocks reserved egress and public demo host aliases without DNS or network work", () => {
    for (const host of [
      "nominatim.openstreetmap.org",
      "nominatim.openstreetmap.org.",
      "www.nominatim.openstreetmap.org",
      "router.project-osrm.org",
      "api.open-elevation.com",
      "localhost",
      "127.0.0.1",
      "private.local",
    ])
      expect(isRemoteServiceUrl(`https://${host}/`)).toBe(false);
    for (const address of ["192.88.99.1", "169.254.169.254", "168.63.129.16", "100.64.0.1", "::1"])
      expect(isPublicRemoteIpv4(address)).toBe(false);
    expect(mocks.resolve4).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("pins a verified public address and sends no ambient cookies or compression request", async () => {
    expect(await requestRemoteJson(input())).toEqual({ synthetic: true });
    const options = mocks.request.mock.calls[0][1] as RequestOptions;
    const lookup = (options.agent as unknown as { options: { lookup: LookupFunction } }).options.lookup;
    const reply = vi.fn();
    lookup("geo.example.test", { family: 4 }, reply);
    expect(reply).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    const changed = vi.fn();
    lookup("different.example.test", { family: 4 }, changed);
    expect(changed.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(options.headers).toMatchObject({ Accept: "application/json", "Accept-Encoding": "identity" });
    expect(options.headers).not.toHaveProperty("Cookie");
  });
  it("rejects a mixed public/private DNS answer before opening HTTPS", async () => {
    mocks.resolve4.mockResolvedValue(["8.8.8.8", "169.254.169.254"]);
    await expect(requestRemoteJson(input())).rejects.toMatchObject({ state: "UNAVAILABLE" });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("refuses redirects, HTML, compressed data and incomplete JSON bodies", async () => {
    response.statusCode = 302;
    response.headers.location = "https://127.0.0.1/private";
    await expect(requestRemoteJson(input())).rejects.toMatchObject({ state: "UNAVAILABLE" });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    response = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-type": "text/html" },
      complete: true,
    });
    await expect(requestRemoteJson(input())).rejects.toMatchObject({ state: "UNAVAILABLE" });
    response = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-type": "application/json", "content-encoding": "gzip" },
      complete: true,
    });
    await expect(requestRemoteJson(input())).rejects.toMatchObject({ state: "UNAVAILABLE" });
    response = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      complete: false,
    });
    await expect(requestRemoteJson(input())).rejects.toMatchObject({ state: "UNAVAILABLE" });
  });
  it("bounds streamed bytes and translates quota without following the provider response", async () => {
    body = JSON.stringify({ oversized: "x".repeat(131072) });
    await expect(requestRemoteJson(input())).rejects.toMatchObject({ state: "UNAVAILABLE" });
    response = Object.assign(new PassThrough(), {
      statusCode: 429,
      headers: { "content-type": "application/json", "retry-after": "9999" },
      complete: true,
    });
    await expect(requestRemoteJson(input())).rejects.toMatchObject({ state: "RATE_LIMITED", retryAfterSeconds: 9999 });
  });
  it("cancels an owned stalled request after five seconds", async () => {
    vi.useFakeTimers();
    finish = false;
    const pending = expect(requestRemoteJson(input())).rejects.toMatchObject({ state: "UNAVAILABLE" });
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(mocks.cancel).toHaveBeenCalled();
  });
});
