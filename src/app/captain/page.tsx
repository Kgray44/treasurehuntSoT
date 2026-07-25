import { requireGmCapability } from "@/lib/security";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function CaptainPage() {
  if (!(await requireGmCapability("CAPTAIN"))) redirect("/captain/sign-in");
  // A single canonical library route makes links, browser history, and the
  // application-bar active state deterministic.
  redirect("/captain/library");
}
