import { requireAdmiraltyOperator } from "./authorization";

const BRIDGEWATCH_BASE_PATH = "/bridgewatch";
const DEFAULT_BRIDGEWATCH_INTERNAL_URL = "http://127.0.0.1:4318";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "::1", "localhost"]);
const STATIC_ASSETS = new Set(["app.js", "style.css"]);
const READ_ONLY_API_ROUTES = new Set([
  "api/summary",
  "api/projects",
  "api/pull-requests",
  "api/actions",
  "api/workers",
  "api/tests",
  "api/attention",
  "api/activity",
  "api/sources",
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
  return null;
}

function allowedQuery(path: string, requestUrl: URL) {
  if (!requestUrl.search) return "";
  if (path !== "api/activity") return null;
  if ([...requestUrl.searchParams.keys()].some((key) => key !== "since")) return null;
  const values = requestUrl.searchParams.getAll("since");
  if (values.length !== 1 || Number.isNaN(Date.parse(values[0]!))) return null;
  return `?since=${encodeURIComponent(values[0]!)}`;
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
