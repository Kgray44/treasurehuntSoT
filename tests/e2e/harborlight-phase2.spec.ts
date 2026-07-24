import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { packageChecksum, sha256 } from "../../src/community/package";
import { syntheticBinaryFixtures, syntheticFixtureBytes } from "../../src/community/synthetic-binary-fixtures";

const fixtureId = randomUUID();
const username = `harborlight-${fixtureId.slice(0, 12)}`;
const password = `Harborlight-${fixtureId}-safe`;

test("Harborlight Studio access and Exchange package installation are isolated and authoritative", async ({
  browser,
}) => {
  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto("/studio/exchange");
  await expect(anonymousPage.getByRole("heading", { name: "Creator access is required." })).toBeVisible();
  expect((await anonymousPage.request.post("/api/community/exchange/installation/review", { data: {} })).status()).toBe(
    403,
  );
  await anonymous.close();

  const version = await db.publishedTaleVersion.findFirst({ where: { isCurrent: true }, select: { id: true } });
  expect(version, "The disposable seed must provide an immutable Chronicle source.").toBeTruthy();
  const gm = await db.gameMasterUser.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), role: "CAPTAIN_CREATOR" },
  });
  const account = await db.userAccount.create({ data: { status: "ACTIVE", legacyGameMasterId: gm.id } });
  await db.playerProfile.create({
    data: {
      accountId: account.id,
      displayName: "Synthetic Harborlight Creator",
      status: "ACTIVE",
      claimedAt: new Date(),
    },
  });
  await db.accountRoleAssignment.create({ data: { accountId: account.id, role: "CREATOR", scopeType: "GLOBAL" } });

  const creator = await browser.newContext();
  const page = await creator.newPage();
  const login = await creator.request.post("/api/gm/login", { data: { username, password } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const headers = { "x-csrf-token": csrfToken };
  await page.goto("/studio");
  await expect(page.getByRole("link", { name: "Community Exchange" })).toBeVisible();
  await page.getByRole("link", { name: "Community Exchange" }).focus();
  await expect(page.getByRole("link", { name: "Community Exchange" })).toBeFocused();
  await page.goto("/studio/exchange");
  await expect(page.getByRole("heading", { name: "Open the Exchange" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByText("A static poster fallback is always available for 3D Exchange artifacts.")).toBeVisible();

  const profile = await creator.request.post("/api/community/profile", {
    headers,
    data: { handle: `creator-${fixtureId.slice(0, 12)}`, displayName: "Synthetic Harborlight Creator" },
  });
  expect(profile.status(), await profile.text()).toBe(201);
  const listing = await creator.request.post("/api/community/listings", {
    headers,
    data: {
      itemType: "CHRONICLE",
      slug: `harborlight-${fixtureId.slice(0, 12)}`,
      title: "Synthetic Harborlight Chronicle",
      shortDescription: "Synthetic isolated browser evidence.",
      visibility: "COMMUNITY",
      spoilerLevel: "PREVIEW_SAFE",
      locationClass: "FICTIONAL",
      tags: ["synthetic"],
    },
  });
  expect(listing.status(), await listing.text()).toBe(201);
  const listingBody = (await listing.json()) as { id: string };
  const release = await creator.request.post(`/api/community/listings/${listingBody.id}/releases`, {
    headers,
    data: {
      schemaVersion: 1,
      listingId: listingBody.id,
      semanticVersion: "1.0.0",
      sourcePublishedTaleVersionId: version!.id,
      publicMetadata: { title: "Synthetic Harborlight Chronicle", spoilerLevel: "PREVIEW_SAFE" },
      license: { key: "CC-BY-4.0", version: 1 },
      attribution: [{ displayName: "Synthetic Harborlight Creator", contributionType: "Author" }],
    },
  });
  expect(release.status(), await release.text()).toBe(201);
  const releaseBody = (await release.json()) as { id: string; manifestChecksum: string };

  const bytes = new TextEncoder().encode("synthetic Harborlight package");
  const manifest = {
    schemaVersion: 1 as const,
    packageId: `pkg-${fixtureId}`,
    releaseId: releaseBody.id,
    semanticVersion: "1.0.0",
    license: { key: "CC-BY-4.0", version: 1 },
    attribution: [{ displayName: "Synthetic Harborlight Creator", contributionType: "Author" }],
    items: [
      {
        id: "chronicle",
        type: "CHRONICLE" as const,
        path: "chronicle.txt",
        checksum: sha256(bytes),
        mediaType: "text/plain",
        byteLength: bytes.byteLength,
        dependencies: [],
      },
    ],
  };
  const files = [{ path: "chronicle.txt", mediaType: "text/plain", base64: Buffer.from(bytes).toString("base64") }];
  const preflight = await creator.request.post("/api/community/exchange/publication/preflight", {
    headers,
    data: { releaseId: releaseBody.id, manifest, files },
  });
  expect(preflight.status(), await preflight.text()).toBe(200);
  const packaged = await creator.request.post("/api/community/exchange/publication/package", {
    headers,
    data: { releaseId: releaseBody.id, manifest, files },
  });
  expect(packaged.status(), await packaged.text()).toBe(201);
  const packageBody = (await packaged.json()) as { packageId: string; packageChecksum: string };
  expect(packageBody.packageChecksum).toBe(packageChecksum(manifest));

  const reviewInput = {
    packageManifest: manifest,
    packageChecksum: packageBody.packageChecksum,
    mode: "EDITABLE_COPY",
    destinationRevision: "synthetic-draft-v1",
    currentDestinationRevision: "synthetic-draft-v1",
    license: {
      key: "CC-BY-4.0",
      allowsModification: true,
      allowsPublicUse: true,
      allowsCommercialUse: false,
      requiresAttribution: true,
      shareAlike: false,
    },
    releaseId: releaseBody.id,
    packageId: packageBody.packageId,
  };
  const review = await creator.request.post("/api/community/exchange/installation/review", {
    headers,
    data: reviewInput,
  });
  expect(review.status(), await review.text()).toBe(200);
  const plan = (await review.json()) as { idMappings: Record<string, string>; obligations: string[] };
  expect(plan.idMappings.chronicle).not.toBe("chronicle");
  expect(plan.obligations).toContain("Preserve package attribution.");

  const commit = await creator.request.post("/api/community/exchange/installation/commit", {
    headers,
    data: {
      ...reviewInput,
      requestId: randomUUID(),
      finalizationSucceeded: true,
    },
  });
  expect(commit.status(), await commit.text()).toBe(201);
  expect(await db.communityInstallation.count({ where: { releaseId: releaseBody.id, accountId: account.id } })).toBe(1);
  expect(
    await db.communityRelease.findUniqueOrThrow({ where: { id: releaseBody.id }, select: { manifestChecksum: true } }),
  ).toEqual({
    manifestChecksum: releaseBody.manifestChecksum,
  });

  const rejected = await creator.request.post("/api/community/exchange/installation/review", {
    headers,
    data: {
      ...reviewInput,
      packageChecksum: createHash("sha256").update("wrong").digest("hex"),
      mode: "LIBRARY_REFERENCE",
    },
  });
  // A client cannot substitute a checksum while asking for a trusted review.
  expect(rejected.status()).toBe(400);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Open the Exchange" })).toBeVisible();
  await creator.close();
});

async function createSyntheticCreator(browser: import("@playwright/test").Browser, label: string) {
  const unique = randomUUID();
  const creatorUsername = `harborlight-${label}-${unique.slice(0, 8)}`;
  const creatorPassword = `Harborlight-${unique}-safe`;
  const gm = await db.gameMasterUser.create({
    data: { username: creatorUsername, passwordHash: await bcrypt.hash(creatorPassword, 10), role: "CAPTAIN_CREATOR" },
  });
  const account = await db.userAccount.create({ data: { status: "ACTIVE", legacyGameMasterId: gm.id } });
  await db.playerProfile.create({
    data: { accountId: account.id, displayName: `Synthetic ${label} Creator`, status: "ACTIVE", claimedAt: new Date() },
  });
  await db.accountRoleAssignment.create({ data: { accountId: account.id, role: "CREATOR", scopeType: "GLOBAL" } });
  const context = await browser.newContext();
  const login = await context.request.post("/api/gm/login", {
    data: { username: creatorUsername, password: creatorPassword },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const profile = await context.request.post("/api/community/profile", {
    headers: { "x-csrf-token": csrfToken },
    data: { handle: `creator-${label}-${unique.slice(0, 8)}`, displayName: `Synthetic ${label} Creator` },
  });
  expect(profile.status(), await profile.text()).toBe(201);
  return { context, accountId: account.id, headers: { "x-csrf-token": csrfToken }, unique };
}

async function createBinaryRelease(
  request: import("@playwright/test").APIRequestContext,
  headers: Record<string, string>,
  unique: string,
  label: string,
) {
  const version = await db.publishedTaleVersion.findFirst({ where: { isCurrent: true }, select: { id: true } });
  expect(version).toBeTruthy();
  const listing = await request.post("/api/community/listings", {
    headers,
    data: {
      itemType: label === "3d" ? "ARTIFACT_3D" : "ARTIFACT_2D",
      slug: `harborlight-${label}-${unique.slice(0, 12)}`,
      title: `Synthetic ${label} artifact`,
      shortDescription: "Repository-owned hash-attested fixture.",
      visibility: "COMMUNITY",
      spoilerLevel: "PREVIEW_SAFE",
      locationClass: "FICTIONAL",
      tags: ["synthetic"],
    },
  });
  expect(listing.status(), await listing.text()).toBe(201);
  const listingId = ((await listing.json()) as { id: string }).id;
  const release = await request.post(`/api/community/listings/${listingId}/releases`, {
    headers,
    data: {
      schemaVersion: 1,
      listingId,
      semanticVersion: "1.0.0",
      sourcePublishedTaleVersionId: version!.id,
      publicMetadata: { title: `Synthetic ${label} artifact`, spoilerLevel: "PREVIEW_SAFE" },
      license: { key: "CC-BY-4.0", version: 1 },
      attribution: [{ displayName: `Synthetic ${label} Creator`, contributionType: "Author" }],
    },
  });
  expect(release.status(), await release.text()).toBe(201);
  return (await release.json()) as { id: string; manifestChecksum: string };
}

test("H2: hash-attested synthetic 2D artifact publication persists its immutable package", async ({ browser }) => {
  const creator = await createSyntheticCreator(browser, "2d");
  const page = await creator.context.newPage();
  const release = await createBinaryRelease(creator.context.request, creator.headers, creator.unique, "2d");
  // Community publication and installation are deliberately outside the
  // Chronicle progression aggregate. Keep a version-pinned active session as
  // a browser-run sentinel for the no-progression/no-player-state guarantee.
  const pinnedVersion = await db.publishedTaleVersion.findFirstOrThrow({
    where: { isCurrent: true },
    select: { id: true, taleId: true },
  });
  const activeSession = await db.taleSession.create({
    data: {
      taleId: pinnedVersion.taleId,
      publishedVersionId: pinnedVersion.id,
      ownerLabel: "Harborlight isolation sentinel",
      accessTokenHash: createHash("sha256").update(`harborlight-session:${creator.unique}`).digest("hex"),
      variables: JSON.stringify({ pinned: true }),
      inventory: JSON.stringify(["unchanged"]),
    },
  });
  const activeSessionBefore = await db.taleSession.findUniqueOrThrow({
    where: { id: activeSession.id },
    select: { publishedVersionId: true, currentSequence: true, variables: true, inventory: true },
  });
  const activeEventsBefore = await db.taleSessionEvent.count({ where: { sessionId: activeSession.id } });
  const fixture = syntheticBinaryFixtures[0];
  const bytes = syntheticFixtureBytes(fixture);
  const manifest = {
    schemaVersion: 1 as const,
    packageId: `package-${creator.unique}`,
    releaseId: release.id,
    semanticVersion: "1.0.0",
    license: { key: "CC-BY-4.0", version: 1 },
    attribution: [{ displayName: "Synthetic 2D Creator", contributionType: "Author" }],
    items: [
      {
        id: "synthetic-poster",
        type: "ARTIFACT_2D" as const,
        path: "artifacts/synthetic-poster.png",
        checksum: sha256(bytes),
        mediaType: "image/png",
        byteLength: bytes.byteLength,
        dependencies: [],
        accessibility: { description: "A one-pixel synthetic poster fallback." },
      },
    ],
  };
  const files = [
    { path: manifest.items[0].path, mediaType: "image/png", base64: Buffer.from(bytes).toString("base64") },
  ];
  const packaged = await creator.context.request.post("/api/community/exchange/publication/package", {
    headers: creator.headers,
    data: { releaseId: release.id, manifest, files },
  });
  expect(packaged.status(), await packaged.text()).toBe(201);
  const result = (await packaged.json()) as {
    packageId: string;
    packageChecksum: string;
    scanStatus: string;
    scanReceipts: Array<{ result: string; fixtureId: string; evidenceKind: string }>;
  };
  expect(result).toMatchObject({ packageChecksum: packageChecksum(manifest), scanStatus: "CLEAN" });
  expect(result.scanReceipts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        result: "CLEAN",
        fixtureId: fixture.id,
        evidenceKind: "synthetic-hash-attested",
      }),
    ]),
  );
  await expect(
    db.communityPackage.findUniqueOrThrow({
      where: { id: result.packageId },
      select: { scanStatus: true, releaseId: true },
    }),
  ).resolves.toEqual({ scanStatus: "CLEAN", releaseId: release.id });
  await page.goto("/studio/exchange");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByText("A static poster fallback is always available for 3D Exchange artifacts.")).toBeVisible();
  await page.reload();
  expect(await db.communityPackageItem.count({ where: { packageId: result.packageId, itemType: "ARTIFACT_2D" } })).toBe(
    1,
  );
  const requestId = randomUUID();
  const installInput = {
    packageManifest: manifest,
    packageChecksum: result.packageChecksum,
    mode: "EDITABLE_COPY",
    destinationRevision: "synthetic-editable-draft-v1",
    currentDestinationRevision: "synthetic-editable-draft-v1",
    license: {
      key: "CC-BY-4.0",
      allowsModification: true,
      allowsPublicUse: true,
      allowsCommercialUse: false,
      requiresAttribution: true,
      shareAlike: false,
    },
    requestId,
    releaseId: release.id,
    packageId: result.packageId,
  };
  const failedFinalization = await creator.context.request.post("/api/community/exchange/installation/commit", {
    headers: creator.headers,
    data: { ...installInput, finalizationSucceeded: false },
  });
  expect(failedFinalization.status(), await failedFinalization.text()).toBe(201);
  const retryOperation = await db.communityInstallOperation.findUniqueOrThrow({
    where: { accountId_requestId: { accountId: creator.accountId, requestId } },
  });
  expect(retryOperation.status).toBe("FINALIZATION_RETRY_REQUIRED");
  expect(await db.communityInstallMapping.count({ where: { operationId: retryOperation.id } })).toBe(0);
  expect(await db.communityInstallation.count({ where: { operationId: retryOperation.id } })).toBe(0);
  const committed = await creator.context.request.post("/api/community/exchange/installation/commit", {
    headers: creator.headers,
    data: { ...installInput, finalizationSucceeded: true },
  });
  expect(committed.status(), await committed.text()).toBe(201);
  expect(await db.communityInstallMapping.count({ where: { operationId: retryOperation.id } })).toBe(1);
  expect(
    await db.communityInstallation.count({ where: { operationId: retryOperation.id, mode: "EDITABLE_COPY" } }),
  ).toBe(1);
  const idempotentRetry = await creator.context.request.post("/api/community/exchange/installation/commit", {
    headers: creator.headers,
    data: { ...installInput, finalizationSucceeded: true },
  });
  expect(idempotentRetry.status(), await idempotentRetry.text()).toBe(201);
  expect(await db.communityInstallation.count({ where: { operationId: retryOperation.id } })).toBe(1);
  const reviewer = await createSyntheticCreator(browser, "reviewer");
  const { requestId: _requestId, ...reviewInput } = installInput;
  const forkReview = await reviewer.context.request.post("/api/community/exchange/installation/review", {
    headers: reviewer.headers,
    data: {
      ...reviewInput,
      mode: "FORK",
      destinationRevision: "synthetic-fork-v1",
      currentDestinationRevision: "synthetic-fork-v1",
    },
  });
  expect(forkReview.status(), await forkReview.text()).toBe(200);
  const reviewedPlan = (await forkReview.json()) as {
    mode: string;
    packageId: string;
    packageChecksum: string;
    idMappings: Record<string, string>;
    obligations: string[];
    assetReusePaths: string[];
    review: {
      creatorIdentity: string;
      listing: { id: string; title: string };
      release: { id: string; semanticVersion: string; schemaVersion: number };
      license: { key: string };
      attribution: unknown[];
      dependencies: string[];
      package: { id: string; checksum: string; byteLength: number; inventory: unknown[] };
      compatibility: unknown;
      accessibilityWarnings: string[];
      performanceWarnings: string[];
      modificationRights: boolean;
      redistributionRights: boolean;
      noArbitraryExecutableScripts: boolean;
    };
  };
  expect(reviewedPlan).toMatchObject({
    mode: "FORK",
    packageId: manifest.packageId,
    packageChecksum: result.packageChecksum,
  });
  expect(reviewedPlan.idMappings[manifest.items[0].id]).not.toBe(manifest.items[0].id);
  expect(reviewedPlan.obligations).toContain("Preserve package attribution.");
  expect(reviewedPlan.assetReusePaths).toEqual([manifest.items[0].path]);
  expect(reviewedPlan.review).toMatchObject({
    creatorIdentity: "Synthetic 2d Creator",
    release: { id: release.id, semanticVersion: "1.0.0", schemaVersion: 1 },
    license: { key: "CC-BY-4.0" },
    package: { id: result.packageId, checksum: result.packageChecksum, inventory: [expect.any(Object)] },
    modificationRights: true,
    redistributionRights: true,
    noArbitraryExecutableScripts: true,
  });
  const forked = await reviewer.context.request.post("/api/community/exchange/installation/commit", {
    headers: reviewer.headers,
    data: {
      ...installInput,
      mode: "FORK",
      destinationRevision: "synthetic-fork-v1",
      currentDestinationRevision: "synthetic-fork-v1",
      requestId: randomUUID(),
      finalizationSucceeded: true,
    },
  });
  expect(forked.status(), await forked.text()).toBe(201);
  const forkReceipt = (await forked.json()) as { fork: { listingId: string; releaseId: string; lineageId: string } };
  const [lineage, derived, sourceAfter] = await Promise.all([
    db.communityRemixLineage.findUniqueOrThrow({ where: { id: forkReceipt.fork.lineageId } }),
    db.communityRelease.findUniqueOrThrow({ where: { id: forkReceipt.fork.releaseId } }),
    db.communityRelease.findUniqueOrThrow({ where: { id: release.id } }),
  ]);
  expect(lineage).toMatchObject({ sourceReleaseId: release.id, rootReleaseId: release.id, mode: "FORK" });
  expect(derived.listingId).toBe(forkReceipt.fork.listingId);
  expect(derived.attributionSnapshot).toBe(sourceAfter.attributionSnapshot);
  expect(sourceAfter.manifestChecksum).toBe(release.manifestChecksum);
  expect(
    await db.taleSession.findUniqueOrThrow({
      where: { id: activeSession.id },
      select: { publishedVersionId: true, currentSequence: true, variables: true, inventory: true },
    }),
  ).toEqual(activeSessionBefore);
  expect(await db.taleSessionEvent.count({ where: { sessionId: activeSession.id } })).toBe(activeEventsBefore);
  await reviewer.context.close();
  await creator.context.close();
});

test("H3: hash-attested GLB publication accepts only the exact embedded fixture and preserves fallback metadata", async ({
  browser,
}) => {
  const creator = await createSyntheticCreator(browser, "3d");
  const release = await createBinaryRelease(creator.context.request, creator.headers, creator.unique, "3d");
  const glb = syntheticBinaryFixtures[1];
  const poster = syntheticBinaryFixtures[0];
  const glbBytes = syntheticFixtureBytes(glb);
  const posterBytes = syntheticFixtureBytes(poster);
  const manifest = {
    schemaVersion: 1 as const,
    packageId: `package-${creator.unique}`,
    releaseId: release.id,
    semanticVersion: "1.0.0",
    license: { key: "CC-BY-4.0", version: 1 },
    attribution: [{ displayName: "Synthetic 3D Creator", contributionType: "Author" }],
    items: [
      {
        id: "synthetic-model",
        type: "ARTIFACT_3D" as const,
        path: "artifacts/synthetic.glb",
        checksum: sha256(glbBytes),
        mediaType: "model/gltf-binary",
        byteLength: glbBytes.byteLength,
        dependencies: ["synthetic-poster"],
        accessibility: {
          description: "A synthetic embedded-mesh GLB with a static poster fallback.",
          posterPath: "artifacts/synthetic-poster.png",
        },
      },
      {
        id: "synthetic-poster",
        type: "ARTIFACT_2D" as const,
        path: "artifacts/synthetic-poster.png",
        checksum: sha256(posterBytes),
        mediaType: "image/png",
        byteLength: posterBytes.byteLength,
        dependencies: [],
        accessibility: { description: "Static reduced-motion poster fallback." },
      },
    ],
  };
  const files = [
    {
      path: manifest.items[0].path,
      mediaType: manifest.items[0].mediaType,
      base64: Buffer.from(glbBytes).toString("base64"),
    },
    {
      path: manifest.items[1].path,
      mediaType: manifest.items[1].mediaType,
      base64: Buffer.from(posterBytes).toString("base64"),
    },
  ];
  const packaged = await creator.context.request.post("/api/community/exchange/publication/package", {
    headers: creator.headers,
    data: { releaseId: release.id, manifest, files },
  });
  expect(packaged.status(), await packaged.text()).toBe(201);
  const result = (await packaged.json()) as {
    packageId: string;
    scanStatus: string;
    scanReceipts: Array<{ fixtureId: string; result: string }>;
  };
  expect(result.scanStatus).toBe("CLEAN");
  expect(result.scanReceipts).toEqual(
    expect.arrayContaining([expect.objectContaining({ fixtureId: glb.id, result: "CLEAN" })]),
  );
  const malformed = await creator.context.request.post("/api/community/exchange/publication/preflight", {
    headers: creator.headers,
    data: {
      releaseId: release.id,
      manifest: { ...manifest, packageId: `malformed-${creator.unique}` },
      files: [{ ...files[0], base64: Buffer.from([1, 2, 3]).toString("base64") }, files[1]],
    },
  });
  expect(malformed.status()).toBe(400);
  const modified = new Uint8Array(glbBytes);
  modified[modified.length - 1] ^= 1;
  const untrusted = await creator.context.request.post("/api/community/exchange/publication/preflight", {
    headers: creator.headers,
    data: {
      releaseId: release.id,
      manifest: {
        ...manifest,
        packageId: `modified-${creator.unique}`,
        items: [{ ...manifest.items[0], checksum: sha256(modified) }, manifest.items[1]],
      },
      files: [{ ...files[0], base64: Buffer.from(modified).toString("base64") }, files[1]],
    },
  });
  expect(untrusted.status()).toBe(400);
  expect(await db.communityPackageItem.count({ where: { packageId: result.packageId, itemType: "ARTIFACT_3D" } })).toBe(
    1,
  );
  await creator.context.close();
});
