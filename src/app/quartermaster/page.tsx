import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function QuartermasterPage() {
  // Preserve historical bookmarks while placing operators on the canonical
  // Captain surface rather than a second live command center.
  redirect("/captain");
}
