import { hash } from "bcryptjs";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createReusableAuthoringItem } from "../../src/studio/reusable-library-service";
import { checksumReusableEnvelope } from "../../src/studio/reusable-content";
import {
  preflightCreatorReusablePublication,
  submitCreatorReusablePublication,
} from "../../src/community/creator-reusable-publication";
import {
  reviewCreatorReusablePublication,
  decideCreatorReusablePublication,
} from "../../src/community/creator-reusable-moderation";
import { createReusableFixtureEnvelope } from "./sc07-reusable";

const licenseKey = "SC07_EXPERIENCE_REUSE";

async function createAccount(device: string, role: "publisher" | "moderator" | "installer", passwordHash: string) {
  const handle = `sc07-experience-${device.toLowerCase()}-${role}`;
  const email = `${handle}@example.test`;
  const now = new Date();
  const account = await db.userAccount.create({
    data: {
      status: "ACTIVE",
      claimedAt: now,
      ordinaryWorkspaceEntryAt: now,
      emails: {
        create: {
          normalizedEmail: email,
          displayEmail: email,
          isPrimary: true,
          verificationState: "VERIFIED",
          verifiedAt: now,
        },
      },
    },
  });
  await db.accountCredential.create({ data: { accountId: account.id, passwordHash } });
  await db.playerProfile.create({
    data: {
      accountId: account.id,
      displayName: `SC-07 ${device.toLowerCase()} ${role}`,
      handle,
      normalizedHandle: handle,
      defaultVisibility: "PUBLIC",
      status: "ACTIVE",
      claimedAt: now,
    },
  });
  if (role === "moderator") {
    await db.accountRoleAssignment.create({
      data: { accountId: account.id, role: "MODERATION_OPERATOR", scopeType: "GLOBAL" },
    });
  } else {
    await activateWorkspaceCapability(account.id, "CREATOR");
  }
  return { accountId: account.id, email };
}

async function seedDevice(device: string, passwordHash: string) {
  const suffix = device.toLowerCase();
  const publisher = await createAccount(device, "publisher", passwordHash);
  const moderator = await createAccount(device, "moderator", passwordHash);
  const installer = await createAccount(device, "installer", passwordHash);
  const actor = { accountId: moderator.accountId, roles: ["MODERATOR"] };

  const saved = createReusableFixtureEnvelope(publisher.accountId, "PRESET");
  await createReusableAuthoringItem(publisher.accountId, saved);
  const { checksum: _checksum, ...unverified } = createReusableFixtureEnvelope(publisher.accountId, "PRESET");
  const unsupported = {
    ...unverified,
    name: "Harbor welcome with an unverified asset",
    dependencies: { ...unverified.dependencies, assetIds: [unverified.itemId] },
  };
  await createReusableAuthoringItem(publisher.accountId, {
    ...unsupported,
    checksum: checksumReusableEnvelope(unsupported),
  });

  async function createRelease(state: "pending" | "approved") {
    const slug = `sc07-experience-${suffix}-${state}`;
    const title = `Harbor welcome for ${suffix} ${state}`;
    const input = {
      source: { itemId: saved.itemId, versionId: saved.versionId },
      slug,
      title,
      description: saved.description,
      tags: saved.tags,
      licenseKey,
      rightsAcknowledged: true as const,
    };
    const preflight = await preflightCreatorReusablePublication(publisher.accountId, input);
    const submission = await submitCreatorReusablePublication(publisher.accountId, input, preflight.reviewDigest);
    const review = await reviewCreatorReusablePublication(actor, submission.listingId);
    if (state === "approved") {
      await decideCreatorReusablePublication(actor, submission.listingId, {
        releaseId: review.releaseId,
        packageChecksum: review.packageChecksum,
        packageReviewed: true,
      });
    }
    return {
      slug,
      title,
      listingId: submission.listingId,
      packageChecksum: review.packageChecksum,
      publisherCredit: review.attribution[0].displayName,
    };
  }

  const pending = await createRelease("pending");
  const approved = await createRelease("approved");
  return { publisher, moderator, installer, saved, unsupported, pending, approved, licenseKey };
}

export async function seedSc07Experience(password: string) {
  if (password.length < 24) throw new Error("SC07_EXPERIENCE_SYNTHETIC_CREDENTIAL_REQUIRED");
  const data = {
    key: licenseKey,
    displayName: "SC-07 fictional reuse license",
    active: true,
    allowsPrivateUse: true,
    allowsPublicUse: true,
    allowsRedistribution: true,
    allowsModification: true,
    requiresAttribution: true,
  };
  await db.communityLicensePolicy.upsert({ where: { key: licenseKey }, create: data, update: data });
  const passwordHash = await hash(password, 10);
  const DESKTOP = await seedDevice("DESKTOP", passwordHash);
  const MOBILE = await seedDevice("MOBILE", passwordHash);
  return { DESKTOP, MOBILE };
}
