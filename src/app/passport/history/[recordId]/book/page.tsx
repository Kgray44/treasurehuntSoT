import { AuthenticatedPassportPage } from "@/components/wakebook/AuthenticatedPassportPage";
import { WakebookVoyageBook } from "@/components/wakebook/WakebookVoyageBook";

export const dynamic = "force-dynamic";

export default async function PassportVoyageBookPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  return (
    <AuthenticatedPassportPage
      returnTo={`/passport/history/${recordId}/book`}
      activeSection="passport-history"
      eyebrow="Chronicle Passport · Private Voyage Book"
      title="Voyage Book"
      description="A private, printable presentation of your source-bound journey and remembrance."
      capability="player"
    >
      <WakebookVoyageBook recordId={recordId} />
    </AuthenticatedPassportPage>
  );
}
