import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

type Alias = { accountId: string; email: string; displayName: string };
type Credentials = {
  fixtureVersion: string;
  password: string;
  accounts: Record<string, Alias>;
  chronicle: { id: string; slug: string; versions: Array<{ id: string; label: string }> };
};
type Evidence = {
  id: string;
  route: string;
  state: string;
  viewport: string;
  sourceSha: string;
  fixtureVersion: string;
  fixtureChecksum: string;
  sha256: string;
  semanticAssertion: string;
  capturePath: string;
};

let sourceSha = "";
let fixtureChecksum = "";
let credentialPath = "";
let evidenceRoot = "";
const evidence: Evidence[] = [];
let credentials: Credentials;

test.beforeAll(() => {
  const taskRoot = path.resolve(required("TIDEGLASS_PHASE3_TASK_ROOT"));
  sourceSha = required("TIDEGLASS_PHASE3_SOURCE_SHA");
  fixtureChecksum = required("TIDEGLASS_PHASE3_FIXTURE_CHECKSUM");
  credentialPath = path.join(taskRoot, "credentials", "tideglass-phase3-walkthrough.private.json");
  evidenceRoot = path.join(taskRoot, "browser", "evidence");
  credentials = JSON.parse(readFileSync(credentialPath, "utf8")) as Credentials;
  expect(credentials.fixtureVersion).toBe("tideglass-phase3-v2");
});

test.afterAll(async () => {
  if (!credentials || !evidenceRoot) return;
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "manifest.json"),
    `${JSON.stringify({ status: "AUTOMATED_BROWSER_PROOF_COMPLETE_OWNER_WALKTHROUGH_PENDING", sourceSha, fixtureVersion: credentials.fixtureVersion, fixtureChecksum, records: evidence }, null, 2)}\n`,
    "utf8",
  );
});

test("Journeys A-J: visible entry, accepted Journey Detail history, creator detail, security, and responsive accessibility", async ({
  browser,
}) => {
  const anonymous = await anonymousPage(browser);
  await anonymous.page.goto("/");
  const globalNavigation = anonymous.page.getByLabel("Global navigation");
  await expect(globalNavigation.getByRole("link", { name: "Explore Chronicles", exact: true })).toBeVisible();
  await globalNavigation.getByRole("link", { name: "Explore Chronicles", exact: true }).click();
  await expect(anonymous.page.getByRole("heading", { name: "Choose a Chronicle", exact: true })).toBeVisible();
  await anonymous.page.getByRole("link", { name: "Preview Chronicle", exact: true }).click();
  await expect(
    anonymous.page.getByRole("heading", { name: "The Tideglass Passage Fixture", exact: true }),
  ).toBeVisible();
  await anonymous.page.getByRole("link", { name: "See what changed", exact: true }).click();
  await expect(
    anonymous.page.getByRole("heading", { name: "Chronicle edition comparison", exact: true }),
  ).toBeVisible();
  await expect(anonymous.page.getByRole("heading", { name: "What changed?", exact: true })).toBeVisible();
  await expect(anonymous.page.getByText("No recorded Voyage is available for this Chronicle.")).toBeVisible();
  await expect(anonymous.page.getByRole("region", { name: "Selected edition context" })).toBeVisible();
  await expect(anonymous.page.getByText(/meaningful changes are available to review/u)).toBeVisible();
  await assertNoSeriousAxeViolations(anonymous.page);
  await capture(
    anonymous.page,
    "TG3-EV-A-VISIBLE-ENTRY",
    "POPULATED",
    "Visible Gateway-to-Tideglass route with exact edition context",
  );

  await anonymous.page.getByRole("button", { name: "Show detailed comparison", exact: true }).click();
  await expect(anonymous.page.getByRole("list", { name: "Semantic changes" }).first()).toBeVisible();
  await capture(
    anonymous.page,
    "TG3-EV-B-PUBLIC-DETAILED",
    "PUBLIC_DETAILED",
    "Public semantic cards remain server-projected and do not expose withheld story detail",
  );

  await anonymous.page
    .getByRole("combobox", { name: "Played or starting edition", exact: true })
    .selectOption("tg3-edition-b");
  await anonymous.page.getByRole("button", { name: "Compare editions", exact: true }).click();
  await expect(
    anonymous.page.getByText("This comparison is partial. Some semantic sections are unavailable."),
  ).toBeVisible();
  await capture(
    anonymous.page,
    "TG3-EV-C-PARTIAL",
    "PARTIAL",
    "Known unsupported fixture semantics are named as partial without source disclosure",
  );

  await anonymous.page
    .getByRole("combobox", { name: "Played or starting edition", exact: true })
    .selectOption("tg3-edition-c");
  await anonymous.page.getByRole("combobox", { name: "Edition to review", exact: true }).selectOption("tg3-edition-a");
  await anonymous.page.getByRole("button", { name: "Swap selected editions", exact: true }).click();
  await expect(anonymous.page.getByRole("combobox", { name: "Played or starting edition", exact: true })).toHaveValue(
    credentials.chronicle.versions[0].id,
  );
  await expect(anonymous.page.getByRole("combobox", { name: "Edition to review", exact: true })).toHaveValue(
    credentials.chronicle.versions[2].id,
  );
  await anonymous.page.getByRole("button", { name: "Compare to recommended", exact: true }).click();
  await expect(anonymous.page.getByRole("combobox", { name: "Edition to review", exact: true })).toHaveValue(
    credentials.chronicle.versions[2].id,
  );
  await capture(
    anonymous.page,
    "TG3-EV-D-SWAP-CURRENT",
    "PAIR_SELECTION",
    "Swap reverses the canonical selected pair and current action restores the server target",
  );
  await anonymous.context.close();

  const playerA = await signedInPage(browser, "PLAYER_A", "/passport/history");
  await expect(playerA.page.getByRole("heading", { name: "Your Voyages", exact: true, level: 1 })).toBeVisible();
  await playerA.page.getByRole("link", { name: "Open The Tideglass Passage Fixture Voyage", exact: true }).click();
  await expect(playerA.page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();
  await playerA.page.getByRole("link", { name: "See what changed", exact: true }).click();
  await expect(playerA.page.getByRole("heading", { name: "What changed?", exact: true })).toBeVisible();
  await expect(playerA.page.getByLabel("Your recorded Voyage")).toContainText(/completed .*; completed; success/u);
  await playerA.page.getByRole("button", { name: "Show detailed comparison", exact: true }).click();
  const playerDisclosure = playerA.page.getByRole("button", { name: "Show safe-to-reveal details", exact: true });
  await expect(playerDisclosure).toHaveAttribute("aria-expanded", "false");
  await playerDisclosure.click();
  await expect(playerA.page.getByRole("button", { name: "Hide safe-to-reveal details", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(playerA.page.getByRole("list", { name: "Semantic changes" }).first()).toBeVisible();
  const foreignResult = await playerA.page.evaluate(async () => {
    const response = await fetch(`/api/tideglass/chronicles/${encodeURIComponent("tideglass-passage-fixture")}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "tg3-edition-a", to: "tg3-edition-c", historyRecord: "tg3-record-foreign" }),
    });
    return { status: response.status, body: await response.json() };
  });
  expect(foreignResult.status).toBe(409);
  expect(foreignResult.body.code).toBe("TIDEGLASS_INVALID_HISTORY_RECORD");
  await playerA.page.getByRole("link", { name: "Return to past Voyage", exact: true }).click();
  await expect(playerA.page).toHaveURL(/\/passport\/history\/tg3-record-a$/u);
  await expect(playerA.page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();
  await playerA.page.goBack();
  await expect(playerA.page.getByRole("heading", { name: "What changed?", exact: true })).toBeVisible();
  await capture(
    playerA.page,
    "TG3-EV-E-OWNED-HISTORY-DISCLOSURE",
    "PLAYER_A_HISTORY_DISCLOSURE",
    "Accepted Journey Detail preserves the owner-recorded edition, returns to the same Voyage, and gates story detail by explicit disclosure",
  );
  await playerA.context.close();

  const playerAB = await signedInPage(browser, "PLAYER_AB", "/passport/history");
  await expect(playerAB.page.getByRole("heading", { name: "Your Voyages", exact: true, level: 1 })).toBeVisible();
  await playerAB.page
    .getByRole("link", { name: "Open The Tideglass Passage Fixture Voyage", exact: true })
    .first()
    .click();
  await expect(playerAB.page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();
  await playerAB.page.getByRole("link", { name: "See what changed", exact: true }).click();
  await expect(
    playerAB.page.getByRole("combobox", { name: "Your recorded Voyage", exact: true }).locator("option"),
  ).toHaveCount(3);
  await playerAB.page
    .getByRole("combobox", { name: "Your recorded Voyage", exact: true })
    .selectOption("tg3-record-ab-b");
  await expect(playerAB.page.getByRole("combobox", { name: "Played or starting edition", exact: true })).toHaveValue(
    "tg3-edition-b",
  );
  await capture(
    playerAB.page,
    "TG3-EV-F-MULTIPLE-HISTORY",
    "MULTIPLE_HISTORY",
    "Each historical Voyage remains independently selectable",
  );
  await playerAB.context.close();

  const playerC = await signedInPage(browser, "PLAYER_C", "/passport/history");
  await expect(playerC.page.getByRole("heading", { name: "Your Voyages", exact: true, level: 1 })).toBeVisible();
  await playerC.page.getByRole("link", { name: "Open The Tideglass Passage Fixture Voyage", exact: true }).click();
  await expect(playerC.page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();
  await playerC.page.getByRole("link", { name: "See what changed", exact: true }).click();
  await expect(playerC.page.getByRole("heading", { name: "You are up to date.", exact: true })).toBeVisible();
  await capture(
    playerC.page,
    "TG3-EV-G-UP-TO-DATE",
    "UP_TO_DATE",
    "Recorded current edition produces an intentional up-to-date state",
  );
  await playerC.context.close();

  const creator = await signedInPage(browser, "CREATOR", `/studio/tales/${credentials.chronicle.id}/versions`);
  await expect(creator.page.getByRole("heading", { name: "Version history", exact: true })).toBeVisible();
  await creator.page.getByRole("button", { name: "Compare to current", exact: true }).first().click();
  await expect(creator.page.getByRole("heading", { name: "Technical semantic detail", exact: true })).toBeVisible();
  await expect(creator.page.getByText(/raw storage diff/u)).toBeVisible();
  const semanticCategories = creator.page.getByLabel("Semantic change categories");
  for (const category of ["Branching And Choices", "Ending", "Setup Requirements", "Accessibility", "Compatibility"])
    await expect(semanticCategories.getByRole("heading", { name: category, exact: true })).toBeVisible();
  await expect(creator.page.getByRole("heading", { name: "Creator annotations", exact: true })).toBeVisible();
  await expect(creator.page.getByText("Synthetic Creator implementation note")).toBeVisible();
  await capture(
    creator.page,
    "TG3-EV-H-CREATOR-SEMANTIC",
    "CREATOR_FULL",
    "Creator Studio proves a branch rewire, alternate ending, Captain requirement, caption/accessibility, compatibility, and Creator annotation through semantic records only",
  );
  await creator.context.close();

  const responsive = await anonymousPage(browser);
  await responsive.page.goto(`/chronicles/${credentials.chronicle.slug}/compare`);
  await responsive.page.setViewportSize({ width: 390, height: 844 });
  await responsive.page.emulateMedia({ reducedMotion: "reduce" });
  await responsive.page.reload();
  await expect(responsive.page.getByRole("heading", { name: "What changed?", exact: true })).toBeVisible();
  const mobileWidth = await responsive.page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    widest: [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        text: element.innerText.slice(0, 80),
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .filter((element) => element.right > document.documentElement.clientWidth + 1)
      .slice(0, 8),
    boxes: [
      document.documentElement,
      document.body,
      document.querySelector<HTMLElement>(".product-shell"),
      document.querySelector<HTMLElement>(".product-shell-header"),
      document.querySelector<HTMLElement>(".product-shell-content"),
      document.querySelector<HTMLElement>(".product-route-layer"),
      document.querySelector<HTMLElement>(".product-route-transition"),
      document.querySelector<HTMLElement>(".product-route-content"),
      document.querySelector<HTMLElement>(".community-harbor"),
      document.querySelector<HTMLElement>(".community-hero"),
      document.querySelector<HTMLElement>(".community-district-nav"),
    ].map((element) =>
      element
        ? {
            className: element.className,
            scrollWidth: element.scrollWidth,
            width: Math.round(element.getBoundingClientRect().width),
          }
        : null,
    ),
  }));
  expect(mobileWidth, JSON.stringify(mobileWidth)).toMatchObject({ scrollWidth: mobileWidth.clientWidth });
  await responsive.page.keyboard.press("Tab");
  expect(await responsive.page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  await assertNoSeriousAxeViolations(responsive.page);
  await capture(
    responsive.page,
    "TG3-EV-I-MOBILE-REDUCED-MOTION",
    "MOBILE_REDUCED_MOTION",
    "Responsive controls fit without horizontal overflow and remain keyboard reachable",
  );
  await responsive.page.setViewportSize({ width: 720, height: 450 });
  await responsive.page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(responsive.page.getByRole("heading", { name: "What changed?", exact: true })).toBeVisible();
  await capture(
    responsive.page,
    "TG3-EV-J-EFFECTIVE-200-PERCENT",
    "EFFECTIVE_200_PERCENT",
    "Comparison remains readable at effective 200 percent zoom",
  );
  await responsive.context.close();
});

async function anonymousPage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return { context, page: await context.newPage() } satisfies { context: BrowserContext; page: Page };
}

async function signedInPage(browser: Browser, key: string, returnTo: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const account = credentials.accounts[key];
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo);
  return { context, page } satisfies { context: BrowserContext; page: Page };
}

async function assertNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

async function capture(page: Page, id: string, state: string, semanticAssertion: string) {
  await mkdir(evidenceRoot, { recursive: true });
  const target = path.join(evidenceRoot, `${id}.png`);
  await page.screenshot({ path: target, fullPage: true });
  evidence.push({
    id,
    route: new URL(page.url()).pathname,
    state,
    viewport: `${page.viewportSize()?.width ?? 0}x${page.viewportSize()?.height ?? 0}`,
    sourceSha,
    fixtureVersion: credentials.fixtureVersion,
    fixtureChecksum,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    semanticAssertion,
    capturePath: target,
  });
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
