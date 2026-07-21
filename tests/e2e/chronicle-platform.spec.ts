import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

const unique = (label: string) => `${label}-${crypto.randomUUID()}`;

async function expectOk(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  expect(response.ok(), `${response.url()} returned ${response.status()}: ${await response.text()}`).toBeTruthy();
  return response;
}

test("the role gateway is responsive, reduced-motion aware, and never grants authorization", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Choose your role in Voyagewright" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Player", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Captain", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creator", exact: true })).toBeVisible();
  await expect(page.locator(".role-gateway")).toHaveAttribute("data-motion-mode", "reduced");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await page.request.get("/api/player/library")).status()).toBe(401);
  expect((await page.request.get("/api/captain/library")).status()).toBe(401);
  expect((await page.request.get("/api/studio/tales")).status()).toBe(401);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")),
  ).toEqual([]);
});

test("Captain invitation, immutable version, Player runtime, archive, and revocation form one persisted journey", async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "The shared-database mutation journey runs once in Chromium.");
  test.setTimeout(240_000);

  const captainContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const strangerContext = await browser.newContext();
  const captain = captainContext.request;
  const playerPage = await playerContext.newPage();

  const login = await captain.post("/api/gm/login", {
    data: {
      username: process.env.GM_USERNAME ?? "kato",
      password: process.env.GM_PASSWORD ?? "development-captain-only",
    },
  });
  await expectOk(login);
  const { csrfToken: captainCsrf } = (await login.json()) as { csrfToken: string };

  const captainLibrary = await captain.get("/api/captain/library");
  await expectOk(captainLibrary);
  const initialLibrary = (await captainLibrary.json()) as {
    publishedTales: Array<{ id: string; title: string; versions: Array<{ id: string; label: string }> }>;
  };
  const sourceTale = initialLibrary.publishedTales.find((tale) => tale.title.includes("Studio Development Voyage"));
  expect(sourceTale?.versions[0]).toBeTruthy();

  const forkResponse = await captain.post(
    `/api/studio/tales/${sourceTale!.id}/versions/${sourceTale!.versions[0].id}`,
    { headers: { "x-csrf-token": captainCsrf }, data: { action: "fork" } },
  );
  await expectOk(forkResponse);
  const fork = (await forkResponse.json()) as { id: string; slug: string; forkedFromVersionId: string };
  expect(fork.forkedFromVersionId).toBe(sourceTale!.versions[0].id);

  const validateFork = await captain.post(`/api/studio/tales/${fork.id}/validate`, {
    headers: { "x-csrf-token": captainCsrf },
    data: {},
  });
  await expectOk(validateFork);
  const firstValidation = (await validateFork.json()) as { valid: boolean; autosaveVersion: number };
  expect(firstValidation.valid).toBe(true);
  const publishFirst = await captain.post(`/api/studio/tales/${fork.id}/publish`, {
    headers: { "x-csrf-token": captainCsrf },
    data: { releaseNotes: "Initial platform acceptance edition", autosaveVersion: firstValidation.autosaveVersion },
  });
  await expectOk(publishFirst);
  const versionOne = (await publishFirst.json()) as { id: string; versionLabel: string; checksum: string };
  expect(versionOne.versionLabel).toBe("1.0");

  const crewName = `Sera ${crypto.randomUUID().slice(0, 8)}`;
  const voyageName = `Moonwake Crew ${crypto.randomUUID().slice(0, 8)}`;
  const createVoyage = await captain.post("/api/captain/playthroughs", {
    headers: { "x-csrf-token": captainCsrf },
    data: {
      taleId: fork.id,
      versionId: versionOne.id,
      voyageName,
      captainMode: "CAPTAIN_CONTROLLED",
      hints: "ON_REQUEST",
      sideQuests: true,
      scheduleTimezone: "America/New_York",
      accessibilityDefaults: { motion: "SYSTEM" },
      expiresInHours: 24,
      accountRequired: false,
      maxRedemptions: 1,
      players: [{ displayName: crewName, crewRole: "Navigator" }],
    },
  });
  expect(createVoyage.status(), await createVoyage.text()).toBe(201);
  const created = (await createVoyage.json()) as {
    playthroughId: string;
    versionId: string;
    invitations: Array<{ id: string; link: string; shortCode: string }>;
  };
  expect(created.versionId).toBe(versionOne.id);
  const invitation = created.invitations[0];
  expect(invitation).toBeTruthy();
  const rawToken = new URL(invitation.link).pathname.split("/").at(-1)!;

  const afterCreateLibrary = await captain.get("/api/captain/library");
  await expectOk(afterCreateLibrary);
  const captainPayload = await afterCreateLibrary.text();
  expect(captainPayload).not.toContain(rawToken);
  expect(captainPayload).not.toContain(invitation.shortCode);
  expect((await strangerContext.request.get(`/api/play/sessions/${created.playthroughId}`)).status()).toBe(401);

  await playerPage.goto(invitation.link);
  await expect(playerPage).toHaveURL(/\/player\/invitation$/);
  await expect(playerPage.getByRole("heading", { name: /Studio Development Voyage Copy/ })).toBeVisible();
  const acceptResponsePromise = playerPage.waitForResponse(
    (response) => response.url().endsWith("/api/invitations/accept") && response.request().method() === "POST",
  );
  await playerPage.getByRole("button", { name: "Accept and join voyage" }).click();
  const acceptResponse = await acceptResponsePromise;
  expect(acceptResponse.ok(), await acceptResponse.text()).toBe(true);
  const playerCookie = (await playerContext.cookies()).find((cookie) => cookie.name === "chronicle_player");
  expect(playerCookie).toBeTruthy();
  await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}$`));
  const playerUrl = (path: string) => new URL(path, playerPage.url()).href;
  expect(playerCookie!.domain).toBe(new URL(playerPage.url()).hostname);

  const playerLibrary = await playerContext.request.get(playerUrl("/api/player/library"));
  await expectOk(playerLibrary);
  const playerLibraryBody = (await playerLibrary.json()) as {
    groups: { awaitingCaptain: Array<{ id: string; versionLabel: string }> };
  };
  expect(playerLibraryBody.groups.awaitingCaptain).toContainEqual(
    expect.objectContaining({ id: created.playthroughId, versionLabel: "1.0" }),
  );
  expect((await playerContext.request.get(playerUrl("/api/captain/library"))).status()).toBe(401);
  expect((await playerContext.request.get(playerUrl("/api/studio/tales"))).status()).toBe(401);

  const launch = await captain.post(`/api/captain/playthroughs/${created.playthroughId}/launch`, {
    headers: { "x-csrf-token": captainCsrf },
    data: {},
  });
  await expectOk(launch);

  const activeStateResponse = await playerContext.request.get(playerUrl(`/api/play/sessions/${created.playthroughId}`));
  await expectOk(activeStateResponse);
  let activeState = (await activeStateResponse.json()) as {
    csrfToken: string;
    session: { status: string; versionId: string; currentSequence: number };
    block: { id: string; blockType: string; configuration: Record<string, unknown> };
    journal: {
      mode: string;
      currentBlockId: string;
      chapters: Array<{ blocks: Array<{ id: string; configuration: Record<string, unknown> }> }>;
    };
  };
  expect(activeState.session).toMatchObject({ status: "ACTIVE", versionId: versionOne.id });
  expect(activeState.block.blockType).toBe("narrative");
  expect(activeState.journal).toMatchObject({ mode: "active", currentBlockId: activeState.block.id });
  expect(JSON.stringify(activeState.journal)).not.toMatch(/acceptedAnswers|captainInstruction|creatorNotes/);
  await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}/journal$`), {
    timeout: 20_000,
  });
  await expect(playerPage.getByRole("button", { name: "Open the journal" })).toBeVisible();
  await playerPage.getByRole("button", { name: "Open the journal" }).click();
  await playerPage.getByRole("button", { name: "Skip ceremony" }).click();
  await expect(playerPage.getByRole("heading", { name: "1.0 Voyage Journal" })).toBeVisible();
  await expect(playerPage.locator(".main-journal-book")).toBeVisible();
  const withoutCsrf = await playerContext.request.post(playerUrl(`/api/play/sessions/${created.playthroughId}`), {
    data: { action: "continue", idempotencyKey: unique("csrf-denied") },
  });
  expect(withoutCsrf.status()).toBe(403);

  const restore = await captain.post(`/api/studio/tales/${fork.id}/versions/${versionOne.id}`, {
    headers: { "x-csrf-token": captainCsrf },
    data: { action: "restore" },
  });
  await expectOk(restore);
  const validateSecond = await captain.post(`/api/studio/tales/${fork.id}/validate`, {
    headers: { "x-csrf-token": captainCsrf },
    data: {},
  });
  await expectOk(validateSecond);
  const secondValidation = (await validateSecond.json()) as { valid: boolean; autosaveVersion: number };
  expect(secondValidation.valid).toBe(true);
  const publishSecond = await captain.post(`/api/studio/tales/${fork.id}/publish`, {
    headers: { "x-csrf-token": captainCsrf },
    data: {
      releaseNotes: "New edition published while version 1.0 is active",
      autosaveVersion: secondValidation.autosaveVersion,
    },
  });
  await expectOk(publishSecond);
  const versionTwo = (await publishSecond.json()) as { id: string; versionLabel: string };
  expect(versionTwo.versionLabel).toBe("1.1");
  const compare = await captain.get(
    `/api/studio/tales/${fork.id}/versions/compare?left=${versionOne.id}&right=${versionTwo.id}`,
  );
  await expectOk(compare);
  expect(await compare.json()).toMatchObject({ left: { id: versionOne.id }, right: { id: versionTwo.id } });

  activeState = (await (
    await expectOk(await playerContext.request.get(playerUrl(`/api/play/sessions/${created.playthroughId}`)))
  ).json()) as typeof activeState;
  expect(activeState.session.versionId).toBe(versionOne.id);
  const playerHeaders = { "x-csrf-token": activeState.csrfToken };
  const readingStateResponse = await playerContext.request.get(
    playerUrl(`/api/player/playthroughs/${created.playthroughId}/journal-state`),
  );
  await expectOk(readingStateResponse);
  const readingStateBefore = (await readingStateResponse.json()) as {
    csrfToken: string;
    readingState: { pageId: string | null };
  };
  const currentBlockBeforeReading = activeState.block.id;
  await expectOk(
    await playerContext.request.post(playerUrl(`/api/player/playthroughs/${created.playthroughId}/journal-state`), {
      headers: { "x-csrf-token": readingStateBefore.csrfToken },
      data: { pageId: "journal-title", hasOpened: true, lastEventSequence: activeState.session.currentSequence },
    }),
  );
  const restoredReading = await playerContext.request.get(
    playerUrl(`/api/player/playthroughs/${created.playthroughId}/journal-state`),
  );
  await expectOk(restoredReading);
  expect((await restoredReading.json()).readingState.pageId).toBe("journal-title");
  const stateAfterReading = await playerContext.request.get(playerUrl(`/api/play/sessions/${created.playthroughId}`));
  await expectOk(stateAfterReading);
  expect((await stateAfterReading.json()).block.id).toBe(currentBlockBeforeReading);
  await expectOk(
    await playerContext.request.post(playerUrl(`/api/play/sessions/${created.playthroughId}`), {
      headers: playerHeaders,
      data: { action: "continue", idempotencyKey: unique("narrative") },
    }),
  );
  activeState = (await (
    await expectOk(await playerContext.request.get(playerUrl(`/api/play/sessions/${created.playthroughId}`)))
  ).json()) as typeof activeState;
  expect(activeState.block.blockType).toBe("riddle");
  expect(activeState.block.configuration).not.toHaveProperty("acceptedAnswers");
  await expectOk(
    await playerContext.request.post(playerUrl(`/api/play/sessions/${created.playthroughId}`), {
      headers: playerHeaders,
      data: { action: "answer", answer: "LANTERN", idempotencyKey: unique("riddle") },
    }),
  );
  const approval = await captain.post(`/api/captain/sessions/${created.playthroughId}`, {
    headers: { "x-csrf-token": captainCsrf },
    data: { action: "approve", reason: "Platform acceptance", idempotencyKey: unique("captain-approval") },
  });
  await expectOk(approval);
  for (const label of ["chapter-complete", "travel", "confirmation"]) {
    await expectOk(
      await playerContext.request.post(playerUrl(`/api/play/sessions/${created.playthroughId}`), {
        headers: playerHeaders,
        data: { action: "continue", idempotencyKey: unique(label) },
      }),
    );
  }
  const finish = await playerContext.request.post(playerUrl(`/api/play/sessions/${created.playthroughId}`), {
    headers: playerHeaders,
    data: { action: "continue", idempotencyKey: unique("tale-complete") },
  });
  await expectOk(finish);
  const completed = (await finish.json()) as { state: { session: { status: string; versionId: string } } };
  expect(completed.state.session).toMatchObject({ status: "COMPLETED", versionId: versionOne.id });

  const archiveResponse = await playerContext.request.get(
    playerUrl(`/api/player/playthroughs/${created.playthroughId}/archive`),
  );
  await expectOk(archiveResponse);
  const archiveText = await archiveResponse.text();
  expect(archiveText).not.toMatch(/acceptedAnswers|captainInstruction|creatorNotes/);
  const archive = JSON.parse(archiveText) as {
    playthrough: { versionId: string; versionLabel: string; checksum: string };
    chapters: Array<{ blocks: unknown[] }>;
  };
  expect(archive.playthrough).toMatchObject({
    versionId: versionOne.id,
    versionLabel: "1.0",
    checksum: versionOne.checksum,
  });
  expect(archive.chapters.flatMap((chapter) => chapter.blocks).length).toBeGreaterThan(0);

  await playerPage.goto(playerUrl("/player/library"));
  const completedJournalLink = playerPage.getByRole("link", { name: "Open Completed Journal" });
  await expect(completedJournalLink).toHaveAttribute("href", `/player/playthroughs/${created.playthroughId}/journal`);
  await completedJournalLink.click();
  await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}/journal$`));
  await expect(playerPage.locator(".chronicle-journal-shell.mode-historical")).toBeVisible();
  await expect(playerPage.getByText(/Read-only · edition checksum/)).toBeVisible();

  const pin = await playerContext.request.post(
    playerUrl(`/api/player/playthroughs/${created.playthroughId}/preference`),
    { headers: playerHeaders, data: { action: "pin" } },
  );
  await expectOk(pin);
  const pinnedLibrary = await playerContext.request.get(playerUrl("/api/player/library"));
  await expectOk(pinnedLibrary);
  expect((await pinnedLibrary.json()).groups.completed).toContainEqual(
    expect.objectContaining({ id: created.playthroughId, pinned: true }),
  );
  const hide = await playerContext.request.post(
    playerUrl(`/api/player/playthroughs/${created.playthroughId}/preference`),
    { headers: playerHeaders, data: { action: "hide" } },
  );
  await expectOk(hide);
  const hiddenLibrary = await playerContext.request.get(playerUrl("/api/player/library"));
  await expectOk(hiddenLibrary);
  expect(JSON.stringify((await hiddenLibrary.json()).groups)).not.toContain(created.playthroughId);

  await playerPage.goto(invitation.link);
  const retryResolve = await playerContext.request.get(playerUrl("/api/invitations/resolve"));
  await expectOk(retryResolve);
  const retry = (await retryResolve.json()) as { csrfToken: string };
  const retryAccept = await playerContext.request.post(playerUrl("/api/invitations/accept"), {
    headers: { "x-csrf-token": retry.csrfToken },
    data: { displayName: crewName },
  });
  await expectOk(retryAccept);
  expect(await retryAccept.json()).toMatchObject({ idempotent: true, playthroughId: created.playthroughId });

  const revocable = await captain.post("/api/captain/playthroughs", {
    headers: { "x-csrf-token": captainCsrf },
    data: {
      taleId: fork.id,
      versionId: versionTwo.id,
      voyageName: `Revocation Proof ${crypto.randomUUID().slice(0, 8)}`,
      captainMode: "HYBRID",
      hints: "DISABLED",
      sideQuests: false,
      accessibilityDefaults: {},
      expiresInHours: 24,
      accountRequired: false,
      maxRedemptions: 1,
      players: [{ displayName: "Revocation Mariner", crewRole: "Lookout" }],
    },
  });
  expect(revocable.status(), await revocable.text()).toBe(201);
  const revocableBody = (await revocable.json()) as {
    invitations: Array<{ id: string; link: string }>;
  };
  const original = revocableBody.invitations[0];
  const replace = await captain.post(`/api/captain/invitations/${original.id}`, {
    headers: { "x-csrf-token": captainCsrf },
    data: { action: "replace", extendHours: 24 },
  });
  await expectOk(replace);
  const replacement = (await replace.json()) as { replacement: { id: string; link: string } };
  const staleContext = await browser.newContext();
  const stalePage = await staleContext.newPage();
  await stalePage.goto(original.link);
  await expect(stalePage).toHaveURL(/\/player\/invitation\?state=invalid$/);
  await expect(stalePage.getByRole("heading", { name: "This invitation cannot be opened" })).toBeVisible();
  await staleContext.close();

  const revoke = await captain.post(`/api/captain/invitations/${replacement.replacement.id}`, {
    headers: { "x-csrf-token": captainCsrf },
    data: { action: "revoke" },
  });
  await expectOk(revoke);
  const revokedContext = await browser.newContext();
  const revokedPage = await revokedContext.newPage();
  await revokedPage.goto(replacement.replacement.link);
  await expect(revokedPage).toHaveURL(/\/player\/invitation\?state=invalid$/);
  await expect(revokedPage.getByRole("heading", { name: "This invitation cannot be opened" })).toBeVisible();
  const lifecycleLibrary = await captain.get("/api/captain/library");
  await expectOk(lifecycleLibrary);
  const lifecycleBody = (await lifecycleLibrary.json()) as {
    invitations: Array<{ id: string; status: string; replacementId: string | null }>;
  };
  expect(lifecycleBody.invitations).toContainEqual(
    expect.objectContaining({ id: original.id, status: "REPLACED", replacementId: replacement.replacement.id }),
  );
  expect(lifecycleBody.invitations).toContainEqual(
    expect.objectContaining({ id: replacement.replacement.id, status: "REVOKED" }),
  );
  await revokedContext.close();

  await captainContext.close();
  await playerContext.close();
  await strangerContext.close();
});
