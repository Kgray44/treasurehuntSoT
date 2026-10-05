import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, request } from "node:https";

export class RemoteDataFailure extends Error {
  constructor(
    public readonly state: "UNAVAILABLE" | "RATE_LIMITED",
    public readonly retryAfterSeconds?: number,
  ) {
    super(`LANDFALL_REMOTE_${state}`);
  }
}

/** The adapter supports IPv4 egress only and pins the verified DNS result for TLS. */
export function isPublicRemoteIpv4(value: string) {
  if (isIP(value) !== 4) return false;
  const [a, b, c] = value.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    value === "168.63.129.16"
  );
}
export function isRemoteServiceUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (!url.port || url.port === "443") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !isIP(url.hostname) &&
      url.hostname.includes(".") &&
      !url.hostname.endsWith(".") &&
      !/(?:^localhost$|\.(?:localhost|local|localdomain|internal)$)/i.test(url.hostname) &&
      !["nominatim.openstreetmap.org", "router.project-osrm.org", "api.open-elevation.com"].some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}
export type RemoteJsonRequest = {
  url: URL;
  method: "GET" | "POST";
  userAgent: string;
  bearerToken?: string;
  body?: string;
  signal?: AbortSignal;
};
export type RemoteJsonTransport = (input: RemoteJsonRequest) => Promise<unknown>;

/** No redirects, ambient cookies, client-selected destinations, persistence or raw-request logging. */
export const requestRemoteJson: RemoteJsonTransport = async (input) => {
  if (
    !isRemoteServiceUrl(`${input.url.origin}${input.url.pathname}`) ||
    input.url.username ||
    input.url.password ||
    input.url.hash ||
    input.url.href.length > 4096 ||
    (input.body?.length ?? 0) > 1024 ||
    !input.userAgent ||
    /[\r\n]/.test(input.userAgent) ||
    (input.bearerToken !== undefined && !/^[A-Za-z0-9._~+/=-]{1,4096}$/.test(input.bearerToken))
  )
    throw new RemoteDataFailure("UNAVAILABLE");
  const resolver = new Resolver();
  const abort = new AbortController();
  const cancel = () => abort.abort();
  const cancelDns = () => resolver.cancel();
  abort.signal.addEventListener("abort", cancelDns, { once: true });
  input.signal?.addEventListener("abort", cancel, { once: true });
  if (input.signal?.aborted) abort.abort();
  const timer = setTimeout(cancel, 5000);
  let agent: Agent | undefined;
  const chunks: Buffer[] = [];
  try {
    abort.signal.throwIfAborted();
    const addresses = await resolver.resolve4(input.url.hostname);
    abort.signal.throwIfAborted();
    if (!addresses.length || addresses.some((address) => !isPublicRemoteIpv4(address)))
      throw new RemoteDataFailure("UNAVAILABLE");
    const address = addresses[0];
    agent = new Agent({
      keepAlive: false,
      maxSockets: 1,
      lookup: (hostname, options, callback) => {
        if (hostname !== input.url.hostname) return callback(new Error("LANDFALL_REMOTE_HOST_CHANGED"), "");
        if (options.all) callback(null, [{ address, family: 4 }]);
        else callback(null, address, 4);
      },
    });
    return await new Promise<unknown>((resolve, reject) => {
      const req = request(
        input.url,
        {
          method: input.method,
          agent,
          family: 4,
          signal: abort.signal,
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "identity",
            "User-Agent": input.userAgent,
            ...(input.bearerToken ? { Authorization: `Bearer ${input.bearerToken}` } : {}),
            ...(input.body
              ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(input.body) }
              : {}),
          },
        },
        (response) => {
          if (response.statusCode === 429) {
            const raw = response.headers["retry-after"];
            const seconds =
              typeof raw === "string" && /^\d+$/.test(raw)
                ? Number(raw)
                : typeof raw === "string" && Number.isFinite(Date.parse(raw))
                  ? Math.ceil((Date.parse(raw) - Date.now()) / 1000)
                  : 60;
            // Honor the provider cooldown internally. The client only receives
            // a bounded check-back interval and never starts an automatic retry.
            reject(new RemoteDataFailure("RATE_LIMITED", Math.max(1, Math.min(604800, seconds))));
            response.destroy();
            req.destroy();
            return;
          }
          const encoding = response.headers["content-encoding"];
          const size = response.headers["content-length"];
          if (
            response.statusCode !== 200 ||
            !/^application\/json(?:\s*;|$)/i.test(response.headers["content-type"] ?? "") ||
            (encoding && encoding !== "identity") ||
            (size && (!/^\d+$/.test(size) || Number(size) > 131072))
          ) {
            reject(new RemoteDataFailure("UNAVAILABLE"));
            response.destroy();
            req.destroy();
            return;
          }
          let bytes = 0;
          response.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 131072) {
              reject(new RemoteDataFailure("UNAVAILABLE"));
              response.destroy();
              req.destroy();
              return;
            }
            chunks.push(chunk);
          });
          response.once("aborted", () => reject(new RemoteDataFailure("UNAVAILABLE")));
          response.once("error", () => reject(new RemoteDataFailure("UNAVAILABLE")));
          response.once("end", () => {
            try {
              if (!response.complete) throw new Error("INCOMPLETE");
              const joined = Buffer.concat(chunks);
              try {
                resolve(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined)));
              } finally {
                joined.fill(0);
              }
            } catch {
              reject(new RemoteDataFailure("UNAVAILABLE"));
            }
          });
        },
      );
      req.once("error", () => reject(new RemoteDataFailure("UNAVAILABLE")));
      req.end(input.body);
    });
  } catch (error) {
    throw error instanceof RemoteDataFailure ? error : new RemoteDataFailure("UNAVAILABLE");
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", cancel);
    abort.signal.removeEventListener("abort", cancelDns);
    resolver.cancel();
    agent?.destroy();
    for (const chunk of chunks) chunk.fill(0);
    chunks.length = 0;
  }
};
