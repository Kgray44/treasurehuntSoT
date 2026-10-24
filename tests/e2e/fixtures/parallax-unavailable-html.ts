import { expect, type APIResponse, type Response } from "@playwright/test";

/** Next streams a genuine not-found page with HTTP 200 after headers are sent. */
export async function expectUnavailableHtml(response: APIResponse | Response | null, forbidden: readonly string[]) {
  expect(response).not.toBeNull();
  const unavailable = response!;
  expect([200, 404]).toContain(unavailable.status());
  expect(unavailable.headers()["content-type"]).toContain("text/html");
  const html = await unavailable.text();
  expect(html).toContain("This page could not be found.");
  expect(html).toMatch(/<meta\b(?=[^>]*name="robots")(?=[^>]*content="[^"]*noindex)[^>]*>/);
  if (unavailable.status() === 200) expect(html).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
  for (const value of forbidden) expect(html).not.toContain(value);
}
