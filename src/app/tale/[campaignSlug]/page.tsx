import { AccessGate } from "@/components/player/AccessGate";
import { LegacyCompatibilityError, requireLegacyCompatibilityAccess } from "@/compatibility/legacy-companion";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function TalePage({ params }: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await params;
  let access: Awaited<ReturnType<typeof requireLegacyCompatibilityAccess>> | null = null;
  try {
    access = await requireLegacyCompatibilityAccess(campaignSlug);
  } catch (error) {
    if (error instanceof LegacyCompatibilityError && error.code === "NOT_MIGRATED") access = null;
    else throw error;
  }
  if (!access) return <AccessGate campaignSlug={campaignSlug} />;
  redirect(`/play/${encodeURIComponent(access.campaignSlug)}/session/${encodeURIComponent(access.sessionId)}`);
}
