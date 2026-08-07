import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function CaptainPage() {
  // The library owns the canonical AccountSession capability decision.
  redirect("/captain/library");
}
