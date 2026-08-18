import { expect, test, type Page } from "@playwright/test";

const campaignSlug = "development-forever-treasure";

type TransitionKind = "player-access";

type TransitionProbe = {
  kind: TransitionKind;
  operationCommitted: boolean;
  initialPoseSeen: boolean;
  finalPoseSeenAfterCommit: boolean;
  snappedBack: boolean;
  destinationSeen: boolean;
  sourceRemovedBeforeDestination: boolean;
  sampleCount: number;
  lastPoseValue: number | null;
  stopped: boolean;
};

type ProbeWindow = Window & {
  __lanternwakeTransitionProbe?: TransitionProbe;
  __lanternwakeTransitionFrame?: number;
};

async function proveIsolatedValidationDatabase(page: Page) {
  const response = await page.request.get("/api/dev/validation/database-identity");
  const identity = (await response.json().catch(() => null)) as {
    validationDatabase?: unknown;
    nonceMatch?: unknown;
  } | null;

  expect(response.status(), "Mutation-capable access E2E requires the isolated validation database.").toBe(200);
  expect(identity, "The validation database identity response must be readable.").toEqual(
    expect.objectContaining({ validationDatabase: true, nonceMatch: true }),
  );
}

async function useFullMotion(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.setItem("forever-motion", "full"));
}

async function installTransitionProbe(page: Page, kind: TransitionKind) {
  await page.evaluate((probeKind) => {
    const probeWindow = window as ProbeWindow;
    if (probeWindow.__lanternwakeTransitionFrame !== undefined) {
      window.cancelAnimationFrame(probeWindow.__lanternwakeTransitionFrame);
    }

    const state: TransitionProbe = {
      kind: probeKind,
      operationCommitted: false,
      initialPoseSeen: false,
      finalPoseSeenAfterCommit: false,
      snappedBack: false,
      destinationSeen: false,
      sourceRemovedBeforeDestination: false,
      sampleCount: 0,
      lastPoseValue: null,
      stopped: false,
    };
    probeWindow.__lanternwakeTransitionProbe = state;

    const sourceSelector = ".access-scene";
    const targetSelector = "[data-scene-part='seal']";
    const destinationSelector = ".voyage-shell";

    const isVisible = (element: Element | null) => {
      if (!(element instanceof HTMLElement) || !element.isConnected) return false;
      const style = window.getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
    };

    const sample = () => {
      if (state.stopped) return;

      if (isVisible(document.querySelector(destinationSelector))) {
        state.destinationSeen = true;
        state.stopped = true;
        return;
      }

      const source = document.querySelector(sourceSelector);
      const target = source?.querySelector(targetSelector);
      if (!source) state.sourceRemovedBeforeDestination = true;

      if (target instanceof HTMLElement) {
        let poseValue = 1;
        poseValue = Number.parseFloat(window.getComputedStyle(target).opacity);

        if (Number.isFinite(poseValue)) {
          state.sampleCount += 1;
          state.lastPoseValue = poseValue;
          const initialPose = poseValue >= 0.9;
          const finalPose = poseValue <= 0.08;
          if (initialPose && !state.finalPoseSeenAfterCommit) state.initialPoseSeen = true;
          if (finalPose && state.operationCommitted) state.finalPoseSeenAfterCommit = true;
          if (state.finalPoseSeenAfterCommit && initialPose) state.snappedBack = true;
        }
      }

      probeWindow.__lanternwakeTransitionFrame = window.requestAnimationFrame(sample);
    };

    sample();
  }, kind);

  await expect
    .poll(async () => (await readTransitionProbe(page)).initialPoseSeen, {
      message: `${kind} must begin in its observable initial pose`,
    })
    .toBe(true);
}

async function markOperationCommitted(page: Page) {
  await page.evaluate(() => {
    const state = (window as ProbeWindow).__lanternwakeTransitionProbe;
    if (!state) throw new Error("The Lanternwake transition probe is not installed.");
    state.operationCommitted = true;
  });
}

async function readTransitionProbe(page: Page) {
  return page.evaluate(() => {
    const state = (window as ProbeWindow).__lanternwakeTransitionProbe;
    if (!state) throw new Error("The Lanternwake transition probe is not installed.");
    return { ...state };
  });
}

async function expectCommittedPoseWithoutSnapback(page: Page, kind: TransitionKind) {
  await expect
    .poll(async () => (await readTransitionProbe(page)).destinationSeen, {
      message: `${kind} must reach its authenticated destination`,
      timeout: 20_000,
    })
    .toBe(true);

  const probe = await readTransitionProbe(page);
  expect(probe.operationCommitted).toBe(true);
  expect(probe.initialPoseSeen).toBe(true);
  expect(probe.finalPoseSeenAfterCommit).toBe(true);
  expect(probe.snappedBack).toBe(false);
  expect(probe.destinationSeen).toBe(true);
  expect(probe.sampleCount).toBeGreaterThan(1);
}

test.describe("Lanternwake Phase 1 access transition final-state holds", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "These authentication mutations run once in Chromium after isolated-database identity proof.",
  );

  test("Player invitation access holds its committed seal-release pose until the voyage surface is visible", async ({
    page,
  }) => {
    await proveIsolatedValidationDatabase(page);
    await useFullMotion(page);
    expect(
      process.env.PLAYER_ACCESS_CODE,
      "PLAYER_ACCESS_CODE is required for the isolated validation fixture.",
    ).toBeTruthy();

    await page.goto(`/tale/${campaignSlug}`);
    await expect(page.getByRole("heading", { name: "Confirm your invitation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm invitation" })).toBeVisible();
    await installTransitionProbe(page, "player-access");

    await page.getByLabel("Invitation phrase").fill(process.env.PLAYER_ACCESS_CODE!);
    const accessResponsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/player/access" && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Confirm invitation" }).click();
    const accessResponse = await accessResponsePromise;
    expect(accessResponse.status()).toBe(200);
    expect((await accessResponse.json()) as { ok?: unknown }).toEqual(expect.objectContaining({ ok: true }));
    await markOperationCommitted(page);

    await expectCommittedPoseWithoutSnapback(page, "player-access");
    await expect(page.locator(".voyage-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open the journal" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Confirm your invitation" })).toHaveCount(0);
    const snapshot = await page.request.get(`/api/player/${campaignSlug}/snapshot`);
    expect(snapshot.status()).toBe(200);
  });

  test("Captain entry delegates to canonical account sign-in without reviving a separate staff credential surface", async ({
    page,
  }) => {
    await proveIsolatedValidationDatabase(page);
    await page.goto("/captain/sign-in");
    await expect(page.getByRole("heading", { name: "Open the Captain's Console" })).toBeVisible();
    await expect(
      page.getByText(
        "Captain permission is checked from your current Voyagewright account. No second staff password is required.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue to account sign-in" })).toHaveAttribute(
      "href",
      "/sign-in?returnTo=%2Fcaptain%2Flibrary",
    );
    await expect(page.getByLabel("Username")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enter Captain's Console" })).toHaveCount(0);
  });
});
