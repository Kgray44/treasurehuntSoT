import type { Page, Response } from "@playwright/test";

/** Passive, bounded metadata only. Never emit credentials, bodies, headers or URL queries. */
export async function observeSextantSignIn(page: Page, expectedAccountId: string, exercise: () => Promise<void>) {
  const origin = new URL(page.url()).origin;
  const observations: Array<Record<string, unknown>> = [];
  const pending: Promise<void>[] = [];
  let responses = 0;
  let signInPosts = 0;
  const request = (value: import("@playwright/test").Request) => {
    const url = new URL(value.url());
    if (url.origin === origin && url.pathname === "/api/auth/sign-in" && value.method() === "POST")
      signInPosts = Math.min(12, signInPosts + 1);
  };
  const response = (value: Response) => {
    const url = new URL(value.url());
    if (
      url.origin !== origin ||
      !["/api/auth/sign-in", "/api/auth/context"].includes(url.pathname) ||
      responses++ >= 12
    )
      return;
    const row: Record<string, unknown> = {
      operation: url.pathname === "/api/auth/sign-in" ? "SIGN_IN" : "CURRENT_USER",
      status: value.status(),
    };
    observations.push(row);
    if (url.pathname === "/api/auth/context")
      pending.push(
        value
          .json()
          .then((body: { status?: string; user?: { accountId?: string } }) => {
            row.state = [
              "authenticated",
              "anonymous",
              "expired",
              "revoked",
              "invalid",
              "restricted",
              "unavailable",
            ].includes(body.status ?? "")
              ? body.status
              : "UNKNOWN";
            row.expectedIdentityMatches = body.user?.accountId === expectedAccountId;
          })
          .catch(() => {
            row.state = "BODY_UNAVAILABLE";
          }),
      );
  };
  page.on("request", request);
  page.on("response", response);
  try {
    await exercise();
  } finally {
    page.off("request", request);
    page.off("response", response);
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.allSettled(pending),
          new Promise((resolve) => {
            timer = setTimeout(resolve, 1200);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      const current = new URL(page.url());
      const cookies = await page.context().cookies(current.href);
      console.log(
        "SEXTANT_SIGNIN_OBSERVATION",
        JSON.stringify({
          signInPosts,
          observations,
          originMatches: current.origin === origin,
          destination:
            current.pathname === "/account"
              ? "ACCOUNT"
              : current.pathname === "/sign-in"
                ? "SIGN_IN"
                : current.pathname === "/dev/spatial-pilot"
                  ? "PILOT"
                  : "OTHER",
          sessionCookiePresent: cookies.some((cookie) => cookie.name === "wayfarer_account"),
        }),
      );
    } catch {
      console.warn("SEXTANT_SIGNIN_OBSERVATION_UNAVAILABLE");
    }
  }
}

export async function observeSextantOfflineShell(page: Page) {
  const resources: Array<{ resource: string; status: number }> = [];
  const response = (value: Response) => {
    if (resources.length >= 16) return;
    const url = new URL(value.url());
    const resource =
      url.pathname === "/landfall-offline-sw.js"
        ? "WORKER"
        : url.pathname === "/player/offline-landfall"
          ? "OFFLINE_SHELL"
          : url.pathname.startsWith("/_next/static/") && value.status() >= 400
            ? "STATIC_FAILURE"
            : null;
    if (resource) resources.push({ resource, status: value.status() });
  };
  page.context().on("response", response);
  await page.addInitScript(() => {
    const events: Array<Record<string, unknown>> = [];
    Object.defineProperty(window, "__sextantSWObservation", { value: events });
    const record = (row: Record<string, unknown>) => {
      if (events.length < 20) events.push(row);
    };
    if (!("serviceWorker" in navigator)) {
      record({ event: "UNSUPPORTED" });
      return;
    }
    const container = navigator.serviceWorker;
    const register = container.register.bind(container);
    const observed = new WeakSet<ServiceWorker>();
    const watch = (worker: ServiceWorker | null) => {
      if (!worker || observed.has(worker)) return;
      observed.add(worker);
      record({ event: "WORKER_STATE", state: worker.state });
      worker.addEventListener("statechange", () => record({ event: "WORKER_STATE", state: worker.state }));
    };
    container.addEventListener("controllerchange", () =>
      record({ event: "CONTROLLER_CHANGE", controlled: Boolean(container.controller) }),
    );
    container.register = ((...args: Parameters<ServiceWorkerContainer["register"]>) => {
      // Return the original native promise, including its original rejection.
      const result = register(...args);
      if (new URL(String(args[0]), location.href).pathname === "/landfall-offline-sw.js") {
        record({ event: "REGISTER_CALLED" });
        void result
          .then(
            (registration) => {
              record({ event: "REGISTER_RESOLVED", scopeMatches: new URL(registration.scope).pathname === "/player/" });
              watch(registration.installing);
              watch(registration.waiting);
              watch(registration.active);
              registration.addEventListener("updatefound", () => watch(registration.installing));
            },
            (error: unknown) =>
              record({
                event: "REGISTER_REJECTED",
                category:
                  error instanceof DOMException &&
                  ["SecurityError", "InvalidStateError", "NotAllowedError", "AbortError", "NetworkError"].includes(
                    error.name,
                  )
                    ? error.name
                    : error instanceof TypeError
                      ? "TypeError"
                      : "OTHER",
              }),
          )
          .catch(() => undefined);
      }
      return result;
    }) as ServiceWorkerContainer["register"];
  });
  return async () => {
    page.context().off("response", response);
    try {
      const state = await page.evaluate(async () => ({
        secureContext: isSecureContext,
        controlled: Boolean(navigator.serviceWorker?.controller),
        events: (window as Window & { __sextantSWObservation?: unknown[] }).__sextantSWObservation ?? [],
        registrations:
          "serviceWorker" in navigator
            ? (await navigator.serviceWorker.getRegistrations()).slice(0, 4).map((registration) => ({
                scopeMatches: new URL(registration.scope).pathname === "/player/",
                installing: registration.installing?.state ?? null,
                waiting: registration.waiting?.state ?? null,
                active: registration.active?.state ?? null,
              }))
            : [],
      }));
      console.log("SEXTANT_OFFLINE_SHELL_OBSERVATION", JSON.stringify({ ...state, resources }));
    } catch {
      console.warn("SEXTANT_OFFLINE_SHELL_OBSERVATION_UNAVAILABLE");
    }
  };
}
