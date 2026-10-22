// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.captain-contextual-entry,sextant.shared-consumers.creator-contextual-entry
import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "default", timeout: 90000 });
test.use({ video: "on", trace: "off", screenshot: "only-on-failure" });
test.beforeAll(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("SEXTANT_OWNED_CONTEXTUAL_ENTRY_REQUIRED");
  ensureGenericSoundingLineIsolation();
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test.describe(`${viewport.width}px ${reducedMotion}`, () => {
      test.use({ viewport, contextOptions: { reducedMotion } });
      for (const entry of [
        {
          role: "Captain",
          path: "/captain/sign-in",
          title: "Open the Captain's Console",
          returnTo: "/captain/library",
        },
        {
          role: "Creator",
          path: "/studio/sign-in",
          title: "Open Voyagewright Studio",
          returnTo: "/studio/library",
        },
      ]) {
        test(`ordinary anonymous ${entry.role} context, account entrance and home return`, async ({
          page,
        }, info) => {
          let authOrPairingWrites = 0;
          page.on("request", (request) => {
            const pathname = new URL(request.url()).pathname;
            if (
              !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
              (/^\/api\/auth(?:\/|$)/u.test(pathname) ||
                /^\/api\/crossdeck(?:\/|$)/u.test(pathname))
            )
              authOrPairingWrites += 1;
          });
          const feedback: Array<{
            task: string;
            elapsedMs: number;
            budgetMs: number;
          }> = [];
          const measure = async (
            task: string,
            activate: () => Promise<unknown>,
            ready: () => Promise<unknown>,
          ) => {
            const began = performance.now();
            await activate();
            await ready();
            const elapsedMs = performance.now() - began;
            feedback.push({ task, elapsedMs, budgetMs: 3000 });
            expect(elapsedMs, task).toBeLessThanOrEqual(3000);
          };
          const capture = async (name: string, target: Locator) => {
            expect(authOrPairingWrites).toBe(0);
            await expect(target).toBeInViewport();
            expect(
              (await new AxeBuilder({ page }).include("main").analyze())
                .violations,
            ).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await page.screenshot({ path: info.outputPath(`${name}.png`) });
          };
          await page.goto(entry.path);
          const contextualHeading = page.getByRole("heading", {
            level: 1,
            name: entry.title,
            exact: true,
          });
          await expect(contextualHeading).toBeVisible();
          await expect(
            page.getByLabel("Password", { exact: true }),
          ).toHaveCount(0);
          const home = page.getByRole("link", {
            name: "Voyagewright home",
            exact: true,
          });
          await expect(home).toHaveAttribute("href", "/");
          await capture("context-ready", contextualHeading);
          const signIn = page.getByRole("link", {
            name: "Continue to account sign-in",
            exact: true,
          });
          await measure(
            "Canonical account entrance",
            async () => {
              if (reducedMotion === "reduce") {
                await signIn.focus();
                await page.keyboard.press("Enter");
              } else await signIn.click();
            },
            async () => {
              await expect(
                page.getByRole("heading", {
                  level: 1,
                  name: "Sign in",
                  exact: true,
                }),
              ).toBeVisible();
              await expect(
                page.getByLabel("Email or Player name", { exact: true }),
              ).toBeEnabled();
              await expect(
                page.getByLabel("Password", { exact: true }),
              ).toBeEnabled();
              await expect(
                page.getByRole("button", { name: "Sign in", exact: true }),
              ).toBeEnabled();
            },
          );
          expect(new URL(page.url()).pathname).toBe("/sign-in");
          expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
            entry.returnTo,
          );
          await expect(
            page.getByLabel("Password", { exact: true }),
          ).toHaveAttribute("type", "password");
          await expect(home).toHaveAttribute("href", "/");
          await capture(
            "account-sign-in-ready",
            page.getByRole("heading", {
              level: 1,
              name: "Sign in",
              exact: true,
            }),
          );
          await measure(
            "Visible public home return",
            () => home.click(),
            async () => {
              await page.waitForURL((url) => url.pathname === "/");
              await expect(
                page.getByRole("region", {
                  name: "Choose your role in Voyagewright",
                  exact: true,
                }),
              ).toBeVisible();
            },
          );
          await expect(home).toHaveAttribute("href", "/");
          expect(authOrPairingWrites).toBe(0);
          await info.attach("contextual-entry-feedback", {
            body: Buffer.from(
              JSON.stringify({
                viewport,
                reducedMotion,
                role: entry.role,
                feedback,
                authOrPairingWrites,
                boundary:
                  "DEVELOPMENT_ONLY; anonymous navigation; no credential submission, session grant, native execution or rendered acceptance",
              }),
            ),
            contentType: "application/json",
          });
        });
      }
    });
  }
}
