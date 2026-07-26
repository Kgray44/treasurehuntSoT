import { VoyageLogEditor } from "@/components/community/VoyageLogEditor";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="page-shell">
      <VoyageLogEditor voyageLogId={id} />
    </main>
  );
}
