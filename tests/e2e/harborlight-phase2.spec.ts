import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { packageChecksum, sha256 } from "../../src/community/package";

test.skip(({ browserName }) => browserName !== "chromium", "The isolated Exchange mutation journey runs once.");

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
      releaseId: releaseBody.id,
      packageId: packageBody.packageId,
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
  expect(rejected.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Open the Exchange" })).toBeVisible();
  await creator.close();
});
