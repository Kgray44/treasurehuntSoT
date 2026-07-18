import { redirect } from "next/navigation";

export default function CaptainInvitationsPage() {
  redirect("/captain/library?tab=invitations");
}
