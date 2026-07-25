import { db } from "@/lib/db";

type PublicVoyageLogRecord = {
  id: string;
  slug: string;
  title: string;
  safeSummary: string | null;
  spoilerLevel: string;
};

export type PublicVoyageLog = Readonly<{
  slug: string;
  title: string;
  safeSummary?: string;
  spoilerLevel: "NONE" | "PREVIEW_SAFE";
  verifiedCompletion: true;
}>;

const publicFields = {
  id: true,
  slug: true,
  title: true,
  safeSummary: true,
  spoilerLevel: true,
} as const;

function activeConsent(
  consents: readonly {
    purpose: string;
    state?: string | null;
    expiresAt?: Date | null;
    grantedAt: Date | null;
    revokedAt: Date | null;
  }[],
  purpose: string,
) {
  return consents.some((consent) => consent.purpose === purpose && consent.grantedAt && !consent.revokedAt);
}

function activePublicationDisplayConsent(
  consents: readonly {
    purpose: string;
    state?: string | null;
    expiresAt?: Date | null;
    grantedAt: Date | null;
    revokedAt: Date | null;
  }[],
) {
  const now = new Date();
  return (
    activeConsent(consents, "DISPLAY_IN_LOG") ||
    consents.some(
      (consent) =>
        consent.purpose === "HARBORLIGHT_VOYAGE_LOG_PUBLICATION:DISPLAY_NAME" &&
        consent.state === "APPROVED" &&
        !!consent.grantedAt &&
        !consent.revokedAt &&
        (!consent.expiresAt || consent.expiresAt > now),
    )
  );
}

function project(record: PublicVoyageLogRecord): PublicVoyageLog {
  return {
    slug: record.slug,
    title: record.title,
    ...(record.safeSummary && ["NONE", "PREVIEW_SAFE"].includes(record.spoilerLevel)
      ? { safeSummary: record.safeSummary }
      : {}),
    spoilerLevel: record.spoilerLevel === "NONE" ? "NONE" : "PREVIEW_SAFE",
    verifiedCompletion: true,
  };
}

/**
 * Filters persisted rows with a server-side allowlist. The selects intentionally
 * exclude owner/session IDs, participant account/name data, private-media and
 * derivative-storage references, and all location fields.
 */
export async function readPublicVoyageLogs(slug?: string): Promise<readonly PublicVoyageLog[]> {
  const logs = await db.communityVoyageLog.findMany({
    where: {
      visibility: "COMMUNITY",
      publishedAt: { not: null },
      lifecycleState: "PUBLISHED",
      verifiedCompletion: true,
      ...(slug ? { slug } : {}),
    },
    select: publicFields,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: slug ? undefined : 24,
  });
  if (!logs.length) return [];
  const ids = logs.map((log) => log.id);
  const [restrictions, participants, participantConsents, media] = await Promise.all([
    db.communityVoyageLogShareRestriction.findMany({
      where: { voyageLogId: { in: ids } },
      select: { voyageLogId: true, restrictionType: true },
    }),
    db.communityVoyageLogParticipant.findMany({
      where: { voyageLogId: { in: ids } },
      select: { id: true, voyageLogId: true },
    }),
    db.communityVoyageLogParticipantConsent.findMany({
      where: { voyageLogId: { in: ids } },
      select: {
        voyageLogId: true,
        participantId: true,
        purpose: true,
        state: true,
        expiresAt: true,
        grantedAt: true,
        revokedAt: true,
      },
    }),
    db.communityVoyageLogMedia.findMany({
      where: { voyageLogId: { in: ids } },
      select: { id: true, voyageLogId: true, processingStatus: true, scanStatus: true, exifGpsRemoved: true },
    }),
  ]);
  const mediaConsents = media.length
    ? await db.communityVoyageLogMediaConsent.findMany({
        where: { voyageLogMediaId: { in: media.map((item) => item.id) } },
        select: { voyageLogMediaId: true, purpose: true, grantedAt: true, revokedAt: true },
      })
    : [];

  const byLog = <T extends { voyageLogId: string }>(rows: readonly T[]) =>
    rows.reduce<Record<string, T[]>>((result, row) => {
      (result[row.voyageLogId] ??= []).push(row);
      return result;
    }, {});
  const restrictionsByLog = byLog(restrictions);
  const participantsByLog = byLog(participants);
  const participantConsentsByLog = byLog(participantConsents);
  const mediaByLog = byLog(media);
  const mediaConsentsById = mediaConsents.reduce<Record<string, typeof mediaConsents>>((result, consent) => {
    (result[consent.voyageLogMediaId] ??= []).push(consent);
    return result;
  }, {});

  return logs
    .filter((log) => {
      const ruleSet = new Set((restrictionsByLog[log.id] ?? []).map((restriction) => restriction.restrictionType));
      if (ruleSet.has("PRIVATE_ONLY") || ruleSet.has("NO_PUBLIC_SHARING")) return false;
      const consentRows = participantConsentsByLog[log.id] ?? [];
      if (
        (participantsByLog[log.id] ?? []).some(
          (participant) =>
            !activePublicationDisplayConsent(consentRows.filter((consent) => consent.participantId === participant.id)),
        )
      )
        return false;
      const logMedia = mediaByLog[log.id] ?? [];
      if (ruleSet.has("NO_MEDIA") && logMedia.length) return false;
      return logMedia.every(
        (item) =>
          item.processingStatus === "READY" &&
          item.scanStatus === "CLEAN" &&
          item.exifGpsRemoved &&
          activeConsent(mediaConsentsById[item.id] ?? [], "PUBLIC_MEDIA"),
      );
    })
    .map(project);
}
