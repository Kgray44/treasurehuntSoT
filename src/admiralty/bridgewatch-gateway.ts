import { requireAdmiraltyOperator } from "./authorization";

const BRIDGEWATCH_BASE_PATH = "/bridgewatch";
const DEFAULT_BRIDGEWATCH_INTERNAL_URL = "http://127.0.0.1:4318";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "::1", "localhost"]);
const STATIC_ASSETS = new Set(["app.js", "style.css"]);
const READ_ONLY_API_ROUTES = new Set([
  "api/summary",
  "api/program",
  "api/projects",
  "api/pull-requests",
  "api/branches",
  "api/actions",
  "api/workers",
  "api/tests",
  "api/attention",
  "api/activity",
  "api/sources",
  "api/trends",
  "api/compare",
]);
const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export type BridgewatchGatewayDependencies = Readonly<{
  authorize?: () => Promise<boolean>;
  fetcher?: typeof fetch;
  env?: Readonly<Record<string, string | undefined>>;
}>;

export async function bridgewatchAccessAllowed() {
  try {
    await requireAdmiraltyOperator("PLATFORM_OBSERVE");
    return true;
  } catch {
    return false;
  }
}

export function bridgewatchInternalUrl(env: Readonly<Record<string, string | undefined>> = process.env) {
  const configured = env.BRIDGEWATCH_INTERNAL_URL?.trim() || DEFAULT_BRIDGEWATCH_INTERNAL_URL;
  let upstream: URL;
  try {
    upstream = new URL(configured);
  } catch {
    return null;
  }
  if (
    upstream.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(upstream.hostname.toLocaleLowerCase("en-US")) ||
    upstream.username ||
    upstream.password ||
    upstream.search ||
    upstream.hash ||
    !["", "/"].includes(upstream.pathname)
  )
    return null;
  upstream.pathname = "/";
  return upstream;
}

function readOnlyPath(path: readonly string[]) {
  if (path.some((segment) => !segment || segment === "." || segment === ".." || /[\\/%\0]/u.test(segment))) return null;
  const joined = path.join("/");
  if (!joined) return "";
  if (STATIC_ASSETS.has(joined) || READ_ONLY_API_ROUTES.has(joined)) return joined;
  if (
    path.length === 3 &&
    path[0] === "api" &&
    path[1] === "projects" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(path[2]!)
  )
    return joined;
  if (
    path.length === 4 &&
    path[0] === "api" &&
    path[1] === "projects" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(path[2]!) &&
    ["history", "trends", "versions"].includes(path[3]!)
  )
    return joined;
  if (
    path.length === 5 &&
    path[0] === "api" &&
    path[1] === "projects" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(path[2]!) &&
    path[3] === "versions" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(path[4]!)
  )
    return joined;
  if (
    path.length === 5 &&
    path[0] === "api" &&
    path[1] === "projects" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(path[2]!) &&
    path[3] === "phases" &&
    /^\d{1,3}$/u.test(path[4]!)
  )
    return joined;
  if (path.length === 3 && path[0] === "api" && path[1] === "pull-requests" && /^\d{1,9}$/u.test(path[2]!))
    return joined;
  if (path.length === 3 && path[0] === "api" && path[1] === "sources" && /^[a-z][a-z0-9-]{0,63}$/u.test(path[2]!))
    return joined;
  if (path.length === 3 && path[0] === "api" && path[1] === "branches" && path[2] === "profile") return joined;
  if (path.length === 3 && path[0] === "api" && path[1] === "sounding-line" && path[2] === "runs") return joined;
  if (
    path.length === 4 &&
    path[0] === "api" &&
    path[1] === "sounding-line" &&
    path[2] === "runs" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(path[3]!)
  )
    return joined;
  if (path.length === 2 && path[0] === "api" && ["history", "archive"].includes(path[1]!)) return joined;
  return null;
}

const validTimestamp = (value: string | null) => Boolean(value) && !Number.isNaN(Date.parse(value!));
const safeProjectIdentifier = (value: string | null) =>
  Boolean(value) && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value!);

function allowedQuery(path: string, requestUrl: URL) {
  if (!requestUrl.search)
    return ["api/history", "api/archive", "api/compare", "api/branches/profile"].includes(path) ? null : "";
  if (path === "api/activity") {
    const values = requestUrl.searchParams.getAll("since");
    if (
      [...requestUrl.searchParams.keys()].some((key) => key !== "since") ||
      values.length !== 1 ||
      !validTimestamp(values[0]!)
    )
      return null;
    return `?since=${encodeURIComponent(values[0]!)}`;
  }
  if (path === "api/history") {
    const allowed = new Set(["since", "until", "project", "phase", "kind", "limit", "cursor"]);
    if ([...requestUrl.searchParams.keys()].some((key) => !allowed.has(key))) return null;
    if ([...allowed].some((key) => requestUrl.searchParams.getAll(key).length > 1)) return null;
    const since = requestUrl.searchParams.get("since");
    const until = requestUrl.searchParams.get("until");
    const project = requestUrl.searchParams.get("project");
    const phase = requestUrl.searchParams.get("phase");
    const kind = requestUrl.searchParams.get("kind");
    const limit = requestUrl.searchParams.get("limit");
    const cursor = requestUrl.searchParams.get("cursor");
    if (!since && !limit) return null;
    if (
      (since && !validTimestamp(since)) ||
      (until && !validTimestamp(until)) ||
      (project && !safeProjectIdentifier(project))
    )
      return null;
    if (phase && !safeProjectIdentifier(phase)) return null;
    if (kind && !/^[A-Z_]{3,80}$/u.test(kind)) return null;
    if (limit && (!/^\d{1,3}$/u.test(limit) || Number(limit) < 1 || Number(limit) > 250)) return null;
    if (cursor && !/^[A-Za-z0-9_-]{1,1024}$/u.test(cursor)) return null;
    const normalized = new URLSearchParams();
    for (const key of ["since", "until", "project", "phase", "kind", "limit", "cursor"] as const) {
      const value = requestUrl.searchParams.get(key);
      if (value) normalized.set(key, value);
    }
    return normalized.size ? `?${normalized}` : null;
  }
  if (path === "api/archive") {
    const values = requestUrl.searchParams.getAll("order");
    if ([...requestUrl.searchParams.keys()].some((key) => key !== "order") || values.length !== 1) return null;
    return ["chronological", "name"].includes(values[0]!) ? `?order=${values[0]}` : null;
  }
  if (/^api\/projects\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/history$/u.test(path)) {
    const values = requestUrl.searchParams.getAll("limit");
    if ([...requestUrl.searchParams.keys()].some((key) => key !== "limit") || values.length !== 1) return null;
    return values[0] === "20" ? "?limit=20" : null;
  }
  if (path === "api/compare") {
    if ([...requestUrl.searchParams.keys()].some((key) => !["from", "to"].includes(key))) return null;
    const from = requestUrl.searchParams.getAll("from");
    const to = requestUrl.searchParams.getAll("to");
    if (from.length !== 1 || to.length !== 1 || !validTimestamp(from[0]!) || !validTimestamp(to[0]!)) return null;
    return `?from=${encodeURIComponent(from[0]!)}&to=${encodeURIComponent(to[0]!)}`;
  }
  if (path === "api/pull-requests") {
    const values = requestUrl.searchParams.getAll("state");
    if ([...requestUrl.searchParams.keys()].some((key) => key !== "state") || values.length !== 1) return null;
    return ["ALL", "OPEN", "HISTORICAL", "MERGED", "CLOSED"].includes(values[0]!) ? `?state=${values[0]}` : null;
  }
  if (path === "api/branches/profile") {
    const values = requestUrl.searchParams.getAll("name");
    if ([...requestUrl.searchParams.keys()].some((key) => key !== "name") || values.length !== 1) return null;
    return /^[A-Za-z0-9._/-]{1,256}$/u.test(values[0]!) && !values[0]!.split("/").includes("..")
      ? `?name=${encodeURIComponent(values[0]!)}`
      : null;
  }
  return null;
}

function privateNotFound() {
  return new Response(null, { status: 404, headers: SECURITY_HEADERS });
}

function safeUnavailable(api: boolean) {
  const body = api
    ? JSON.stringify({ error: "Private tool unavailable" })
    : '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Private tool unavailable</title></head><body><main><h1>Private tool unavailable</h1><p>Voyagewright remains available. Try Bridgewatch again later.</p></main></body></html>';
  return new Response(body, {
    status: 503,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": api ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
    },
  });
}

function sanitizedResponseHeaders(upstream: Response) {
  const headers = new Headers(SECURITY_HEADERS);
  for (const name of ["content-type", "etag", "last-modified"])
    if (upstream.headers.has(name)) headers.set(name, upstream.headers.get(name)!);
  return headers;
}

function mountDashboardHtml(html: string) {
  return html
    .replace('href="/style.css"', `href="${BRIDGEWATCH_BASE_PATH}/style.css"`)
    .replace('src="/app.js"', `src="${BRIDGEWATCH_BASE_PATH}/app.js"`);
}

export async function handleBridgewatchGateway(
  request: Request,
  path: readonly string[] = [],
  dependencies: BridgewatchGatewayDependencies = {},
) {
  if (!(["GET", "HEAD"] as const).includes(request.method as "GET" | "HEAD"))
    return new Response(null, { status: 405, headers: { ...SECURITY_HEADERS, Allow: "GET, HEAD" } });

  const authorize = dependencies.authorize ?? bridgewatchAccessAllowed;
  if (!(await authorize())) return privateNotFound();

  const requestUrl = new URL(request.url);
  const proxyPath = readOnlyPath(path);
  if (proxyPath === null) return privateNotFound();
  const query = allowedQuery(proxyPath, requestUrl);
  if (query === null) return privateNotFound();
  const upstream = bridgewatchInternalUrl(dependencies.env);
  if (!upstream) return safeUnavailable(proxyPath.startsWith("api/"));
  const upstreamUrl = new URL(proxyPath || ".", upstream);
  upstreamUrl.search = query;

  const fetcher = dependencies.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(upstreamUrl, {
      method: request.method,
      headers: {
        Accept: proxyPath.startsWith("api/") ? "application/json" : "text/html, text/css, application/javascript",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return safeUnavailable(proxyPath.startsWith("api/"));
  }
  if (response.status >= 500 || (response.status >= 300 && response.status < 400))
    return safeUnavailable(proxyPath.startsWith("api/"));
  const body =
    request.method === "HEAD"
      ? null
      : !proxyPath && requestUrl.pathname === BRIDGEWATCH_BASE_PATH
        ? mountDashboardHtml(await response.text())
        : response.body;
  return new Response(body, {
    status: response.status,
    headers: sanitizedResponseHeaders(response),
  });
}
