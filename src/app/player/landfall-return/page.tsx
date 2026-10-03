import { redirect } from "next/navigation";
import { resolveAuthenticatedLandfallReturn } from "@/landfall/notification-return-authority";

export const dynamic = "force-dynamic";
export default async function LandfallReturnPage({ searchParams }: { searchParams: Promise<{ handle?: string }> }) {
  const { handle } = await searchParams;
  const result = await resolveAuthenticatedLandfallReturn(handle ?? "");
  redirect(result.destination);
}
