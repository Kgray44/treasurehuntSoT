import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buildTideglassCompareHref } from "@/tideglass/passage";
import { requireWayfarerAccount } from "@/wayfarer/http";

export const dynamic = "force-dynamic";

export default async function PassportHistoryCompareRedirect({ params }: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount();
  const playerProfileId = session?.account.profile?.id;
  if (!playerProfileId) notFound();

  const { recordId } = await params;
  const record = await db.playerChronicleRecord.findFirst({
    where: { id: recordId, playerProfileId },
    select: { publishedVersion: { select: { tale: { select: { slug: true } } } } },
  });
  if (!record) notFound();

  redirect(
    buildTideglassCompareHref({
      taleSlug: record.publishedVersion.tale.slug,
      historyRecordId: recordId,
      returnTo: `/passport/history/${encodeURIComponent(recordId)}`,
    }),
  );
}
