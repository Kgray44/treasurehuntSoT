import { ReachLaboratory } from "@/reach/ReachLaboratory";
import { safeReturnTo } from "@/homeport/return-to";
export const metadata = { title: "Find the Hand · Voyagewright", referrer: "no-referrer" };
export default async function ReachLabPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  const returnHref = safeReturnTo(params.returnTo, "/devices/pair");
  return (
    <main>
      <ReachLaboratory
        returnHref={returnHref}
        returnLabel={returnHref === "/devices/pair" ? "Device connections" : "Back to your Voyage"}
      />
    </main>
  );
}
