import Link from "next/link";
import { ReachLaboratory } from "@/reach/ReachLaboratory";
export const metadata = { title: "Find the Hand · Voyagewright", referrer: "no-referrer" };
export default function ReachLabPage() {
  return (
    <main>
      <Link href="/devices/pair">Device connections</Link>
      <ReachLaboratory />
    </main>
  );
}
