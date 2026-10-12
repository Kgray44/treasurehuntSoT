// @sounding-line-registration owner=project-crossdeck suite=browser.crossdeck contracts=crossdeck.phase1.participation,crossdeck.phase2.continuity,crossdeck.refit.companion
import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import type { PublishedTaleSnapshot } from "../../src/chronicle/types";
import type { DeckState } from "../../src/crossdeck/sync-contracts";
import { createAccountSession } from "../../src/wayfarer/accounts";
import { createCrossdeckRefitFixture, removeCrossdeckRefitFixture } from "./fixtures/crossdeck-refit";
import { authenticateClosure, openClosureJournal, openClosureMap } from "./fixtures/landfall-closure";

test.describe.configure({ mode: "serial", timeout: 180_000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.afterAll(() => db.$disconnect());

const directory = (process.env.CROSSDECK_REFIT_ARTIFACT_ROOT ?? "artifacts/crossdeck") + "/refit-recovery";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function connectionCode(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Bring your phone aboard", exact: true });
  await expect(dialog.getByRole("img", { name: "Scan with your phone to join this Chronicle" })).toBeVisible();
  await dialog.getByText("Use a code instead", { exact: true }).click();
  const code = await dialog.locator("code").innerText();
  expect(code).toMatch(/^[A-F0-9]{12}$/);
  return { dialog, code };
}
async function sendOptions(page: Page) {
  const handoff = page.getByRole("region", { name: "Send to your devices", exact: true });
  await handoff.getByRole("button", { name: /^Send to / }).click();
  const dialog = page.getByRole("dialog", { name: "Send this view", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio").check();
  const advanced = dialog.locator("details").filter({ has: dialog.getByText("More ways to open", { exact: true }) });
  if ((await advanced.getAttribute("open")) === null) await advanced.locator("summary").click();
  await dialog.getByLabel("Transfer mode", { exact: true }).selectOption("SEND_VIEW");
  return { handoff, dialog };
}
async function purposeOptions(page: Page) {
  const purposes = page
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: /^Change companion purpose$/ }),
    })
    .first();
  if ((await purposes.getAttribute("open")) === null) await purposes.locator("summary").first().click();
  const more = purposes.locator("details");
  if ((await more.getAttribute("open")) === null) await more.locator("summary").click();
  return purposes;
}

test("recover pairing and transfers while preserving shared-screen privacy", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("CROSSDECK_OWNED_BROWSER_ORIGIN_REQUIRED");
  const fixture = await createCrossdeckRefitFixture();
  const { account, voyage } = fixture;
  await mkdir(directory, { recursive: true });
  const companionSession = await createAccountSession(account.id, "Synthetic Crossdeck recovery phone");
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
    recordVideo: { dir: directory },
  });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: directory },
  });
  await desktop.tracing.start({ screenshots: true, snapshots: true });
  await phone.tracing.start({ screenshots: true, snapshots: true });
  const d = await desktop.newPage(),
    p = await phone.newPage();
  const recordings = { desktop: await d.video()?.path(), phone: await p.video()?.path() };
  d.setDefaultTimeout(15_000);
  p.setDefaultTimeout(15_000);
  let phase = "personal";
  const privateJournalRequests: string[] = [];
  p.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      phase === "shared" &&
      [`/api/play/sessions/${voyage.id}`, `/api/player/playthroughs/${voyage.id}/journal-state`].includes(pathname)
    )
      privateJournalRequests.push(pathname);
  });
  const passed: string[] = [];
  const faultInjection: string[] = [];
  const timings: Record<string, number> = {};
  const capture = async (page: Page, name: string) => {
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation.playState === "running" && Number.isFinite(animation.effect?.getComputedTiming().endTime),
                ).length,
          ),
        { timeout: 15_000, message: "Finite presentation animations finish before the full-page capture" },
      )
      .toBe(0);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    return page.screenshot({
      path: `${directory}/${name}.png`,
      fullPage: true,
      mask: [page.locator("code"), page.getByRole("img", { name: "Scan with your phone to join this Chronicle" })],
    });
  };
  const deck = async () =>
    JSON.parse(
      (
        await db.crossdeckDeck.findFirstOrThrow({
          where: { membership: { playthroughId: voyage.id } },
        })
      ).state,
    ) as DeckState;
  try {
    await test.step("Author only this synthetic edition’s Map for crew visibility", async () => {
      const edition = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
      const snapshot = JSON.parse(edition.contentSnapshot) as PublishedTaleSnapshot;
      const map = snapshot.chapters.flatMap((chapter) => chapter.blocks).find((block) => block.id === voyage.activeId)!;
      map.configuration.crossdeck = { visibility: "CREW" };
      const letter = snapshot.chapters
        .flatMap((chapter) => chapter.blocks)
        .find((block) => block.id === fixture.noteId)!;
      expect(letter.configuration.crossdeck).toBeUndefined();
      const contentSnapshot = JSON.stringify(snapshot);
      await db.publishedTaleVersion.update({
        where: { id: voyage.versionId },
        data: { contentSnapshot, checksum: digest(contentSnapshot) },
      });
    });
    await authenticateClosure(desktop, account, baseURL);
    await phone.addCookies([
      { name: "wayfarer_account", value: companionSession.token, url: baseURL, sameSite: "Lax" },
    ]);
    await openClosureJournal(d, voyage.id, baseURL);
    const before = {
      sequence: (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence,
      members: await db.playthroughMembership.count({ where: { playthroughId: voyage.id } }),
    };
    const chroniclePath = new URL(d.url()).pathname;
    await d.getByRole("button", { name: "Connect another device", exact: true }).click();
    const canceledPair = await connectionCode(d);
    await capture(d, "01-pairing-before-cancel");
    await canceledPair.dialog.press("Escape");
    await expect(canceledPair.dialog).not.toBeVisible();
    await expect(d.getByRole("button", { name: "Connect another device", exact: true })).toBeFocused();
    expect(new URL(d.url()).pathname).toBe(chroniclePath);
    passed.push("Pairing canceled in the Chronicle; focus and reading route preserved");

    await d.getByRole("button", { name: "Connect another device", exact: true }).click();
    const expiredPair = await connectionCode(d);
    expect(expiredPair.code).not.toBe(canceledPair.code);
    // Fault injection affects only the exact new challenge in this fixture's isolated database.
    await db.crossdeckPairingChallenge.update({
      where: { codeHash: digest(`crossdeck:v1:${expiredPair.code}`) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    faultInjection.push("DB expired the exact test-owned pairing challenge before its UI claim");
    await p.goto(`${baseURL}/devices/pair#code=${expiredPair.code}`);
    await expect(p.getByLabel("Connection code", { exact: true })).toHaveValue(expiredPair.code);
    await p.getByRole("button", { name: "Join the Chronicle", exact: true }).click();
    await expect(p.getByRole("status")).toContainText("That code is unavailable. Ask the other device for a new code.");
    await expect(p.locator("[data-crossdeck-companion]")).toHaveCount(0);
    expect(await db.crossdeckSurfaceSession.count({ where: { accountSessionId: companionSession.id } })).toBe(0);
    await capture(p, "02-expired-code-refused");
    passed.push("Expired pairing refused through the phone form without creating a surface");

    await expiredPair.dialog.getByRole("button", { name: "Close connection", exact: true }).click();
    await d.getByRole("button", { name: "Connect another device", exact: true }).click();
    const freshPair = await connectionCode(d);
    await p.goto(`${baseURL}/devices/pair#code=${freshPair.code}`);
    await expect(p.getByLabel("Connection code", { exact: true })).toHaveValue(freshPair.code);
    await p.getByRole("button", { name: "Join the Chronicle", exact: true }).click();
    await expect(p.getByRole("heading", { name: "Journal companion", exact: true })).toBeVisible();
    await expect(freshPair.dialog.getByRole("status")).toContainText("Phone connected", { timeout: 8000 });
    await freshPair.dialog.getByRole("button", { name: "Continue the Chronicle", exact: true }).click();
    const receiver = await db.crossdeckSurfaceSession.findFirstOrThrow({
      where: { accountSessionId: companionSession.id },
    });
    passed.push("A new UI-created code pairs the same phone successfully");

    const purposes = await purposeOptions(p);
    for (const name of ["Atmosphere", "Captain companion", "Accessibility companion", "Creator preview"])
      await expect(purposes.getByRole("button", { name, exact: true })).toBeDisabled();
    await expect(
      purposes.getByText("Use the Chronicle’s existing presentation controls.", { exact: true }),
    ).toBeVisible();
    await capture(p, "03-unavailable-purposes");
    await purposes.locator("summary").first().click();
    passed.push("Unavailable device purposes remain visibly explained and disabled");

    await p.getByRole("combobox", { name: /^Released passage/ }).selectOption(fixture.noteId);
    await expect(p.getByRole("article", { name: "A letter from the Captain", exact: true })).toBeVisible();
    const canceledTransfer = await sendOptions(p);
    await expect(canceledTransfer.dialog.getByRole("button", { name: "Send view", exact: true })).toBeDisabled();
    await canceledTransfer.dialog.getByLabel("Send this private note to my selected device", { exact: true }).check();
    await capture(p, "04-private-note-confirmation");
    await canceledTransfer.dialog.getByRole("button", { name: "Send view", exact: true }).click();
    const desktopReceive = d.getByRole("region", { name: "Send to your devices", exact: true });
    await expect(
      desktopReceive.getByRole("button", { name: "Receive A letter from the Captain", exact: true }),
    ).toBeVisible();
    await canceledTransfer.handoff.getByRole("button", { name: "Cancel send", exact: true }).click();
    await expect(
      canceledTransfer.handoff.getByText("That transfer ended. Your view remains recoverable.", { exact: true }),
    ).toBeVisible();
    await expect(desktopReceive.getByRole("button", { name: /^Receive / })).toHaveCount(0);
    expect((await deck()).handoffs.at(-1)?.state).toBe("CANCELLED");
    await capture(p, "05-canceled-transfer");
    passed.push("Private-note confirmation is required; sender cancellation clears the receiver offer");

    const declinedTransfer = await sendOptions(p);
    await declinedTransfer.dialog.getByLabel("Send this private note to my selected device", { exact: true }).check();
    await declinedTransfer.dialog.getByRole("button", { name: "Send view", exact: true }).click();
    await expect(
      desktopReceive.getByRole("button", { name: "Receive A letter from the Captain", exact: true }),
    ).toBeVisible();
    await desktopReceive.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(desktopReceive.getByRole("button", { name: /^Receive / })).toHaveCount(0);
    await expect(
      declinedTransfer.handoff.getByText("That transfer ended. Your view remains recoverable.", { exact: true }),
    ).toBeVisible();
    expect((await deck()).handoffs.at(-1)?.state).toBe("CANCELLED");
    await capture(d, "06-declined-transfer");
    passed.push("Receiver decline closes the pending transfer and leaves the source note readable");

    const sharedPurposes = await purposeOptions(p);
    await sharedPurposes.getByRole("button", { name: "Crew display", exact: true }).click();
    await expect(p.getByRole("heading", { name: "Crew display", exact: true })).toBeVisible();
    phase = "shared";
    await expect(p.locator("[data-crossdeck-companion]")).toHaveCount(0);
    await expect(p.getByRole("heading", { name: "Ready for your crew’s next view", exact: true })).toBeVisible();
    await expect(p.getByText("A letter from the Captain", { exact: true })).toHaveCount(0);
    await capture(p, "07-shared-empty-state");
    expect((await db.crossdeckSurfaceSession.findUniqueOrThrow({ where: { id: receiver.id } })).role).toBe(
      "SHARED_CREW_DISPLAY",
    );

    // This read-only HTTP assertion checks the existing restricted consumer; it does not replace a UI transfer.
    const privateParams = new URLSearchParams({
      voyage: voyage.id,
      surface: receiver.surfaceId,
      object: fixture.noteId,
      version: voyage.versionId,
      family: "NOTE",
    });
    const privateNote = await phone.request.get(`${baseURL}/api/crossdeck/view?${privateParams}`);
    expect(privateNote.status()).toBe(403);
    expect(await privateNote.text()).not.toContain("When the first lantern meets the northern light");
    passed.push("Shared participation refuses the PRIVATE Captain letter through /api/crossdeck/view");

    await openClosureMap(d);
    await d.getByRole("button", { name: "Close journal tool drawer", exact: true }).click();
    const crewSend = await sendOptions(d);
    await expect(crewSend.dialog.getByRole("radio")).toHaveAccessibleName(/Phone.*Crew display/);
    await capture(d, "08-send-authorized-crew-chart");
    const sentAt = Date.now();
    await crewSend.dialog.getByRole("button", { name: "Send view", exact: true }).click();
    const crewReceive = p.getByRole("region", { name: "Send to your devices", exact: true });
    await expect(crewReceive.getByRole("button", { name: /^Receive / })).toBeVisible();
    timings.sendToSharedOfferMs = Date.now() - sentAt;
    const receivedAt = Date.now();
    await crewReceive.getByRole("button", { name: /^Receive / }).click();
    const crewArticle = p.getByRole("article", { name: "Shared crew view", exact: true });
    await expect(crewArticle.getByRole("heading", { name: "The island course", exact: true })).toBeVisible();
    await expect(crewArticle.getByRole("img", { name: "Virtual Landfall chart", exact: true })).toBeVisible();
    await expect(crewSend.handoff.getByText(/is open on your other device/)).toBeVisible();
    timings.receiveToRenderedReceiptMs = Date.now() - receivedAt;
    expect((await deck()).handoffs.at(-1)?.state).toBe("ACKNOWLEDGED");
    await expect(p.getByText("A letter from the Captain", { exact: true })).toHaveCount(0);
    await expect(p.locator("[data-crossdeck-companion], [data-landfall-player-chart]")).toHaveCount(0);
    expect(privateJournalRequests).toEqual([]);
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture(p, "09-restricted-crew-chart-received");
    passed.push(
      "A real crew-visible Map opens read-only and is acknowledged after rendering; no personal Journal consumer loads",
    );

    phase = "returning";
    await p.getByRole("button", { name: "Use my Journal companion", exact: true }).click();
    await expect(p.getByRole("heading", { name: "Journal companion", exact: true })).toBeVisible();
    expect((await db.crossdeckSurfaceSession.findUniqueOrThrow({ where: { id: receiver.id } })).role).toBe("JOURNAL");
    await p.getByRole("combobox", { name: /^Released passage/ }).selectOption(fixture.noteId);
    await expect(p.getByRole("article", { name: "A letter from the Captain", exact: true })).toBeVisible();
    await capture(p, "10-authorized-personal-return");
    passed.push("The explicit return control changes the canonical own role before personal passages reappear");

    const revokedAt = Date.now();
    await db.crossdeckSurfaceSession.update({
      where: { id: receiver.id },
      data: { revokedAt: new Date(), lifecycle: "REVOKED" },
    });
    faultInjection.push("DB revoked the exact test-owned phone surface while its personal Journal was visible");
    // Observe the canonical participation refresh within the same bounded UI assertion window, without a reload.
    await expect(p.getByRole("heading", { name: "Reconnect this device", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    timings.revokeToPrivateViewClearedMs = Date.now() - revokedAt;
    await expect(p.getByRole("article", { name: "A letter from the Captain", exact: true })).toHaveCount(0);
    await expect(p.locator("[data-crossdeck-companion]")).toHaveCount(0);
    await capture(p, "11-current-surface-revoked");
    passed.push("A current surface revocation clears visible private content on the canonical participation refresh");
    expect((await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence).toBe(
      before.sequence,
    );
    expect(await db.playthroughMembership.count({ where: { playthroughId: voyage.id } })).toBe(before.members);
    await writeFile(
      `${directory}/observations.json`,
      JSON.stringify(
        {
          hardware: "CHROMIUM_EMULATION",
          physicalDeviceProof: "NOT_CLAIMED",
          ownerAcceptance: "NOT_CLAIMED",
          motion: "no-preference",
          fixture: "ISOLATED_SYNTHETIC_EDITION",
          authoredPermissionsSetup:
            "Only the released Map declares CREW in this owned edition; the Captain letter stays PRIVATE",
          faultInjection,
          recordings,
          passed,
          timings,
          privateJournalRequestsWhileShared: privateJournalRequests,
          progressionAndMembershipUnchanged: true,
        },
        null,
        2,
      ),
    );
  } catch (failure) {
    await capture(p, "failed-phone").catch(() => {});
    await capture(d, "failed-desktop").catch(() => {});
    await writeFile(
      `${directory}/failed-observations.json`,
      JSON.stringify(
        {
          hardware: "CHROMIUM_EMULATION",
          passed,
          faultInjection,
          recordings,
          phase,
          timings,
          privateJournalRequestsWhileShared: privateJournalRequests,
          error: failure instanceof Error ? failure.message : String(failure),
        },
        null,
        2,
      ),
    ).catch(() => {});
    throw failure;
  } finally {
    await desktop.tracing.stop({ path: `${directory}/desktop-trace.zip` }).catch(() => {});
    await phone.tracing.stop({ path: `${directory}/phone-trace.zip` }).catch(() => {});
    await desktop.close().catch(() => {});
    await phone.close().catch(() => {});
    await removeCrossdeckRefitFixture(fixture);
  }
});
