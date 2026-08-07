import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ voyageLogId?: string }> }) {
  const { voyageLogId } = await searchParams;
  redirect(
    voyageLogId ? `/community/voyage-logs/owner/${encodeURIComponent(voyageLogId)}` : "/community/voyage-logs/owner",
  );
}
