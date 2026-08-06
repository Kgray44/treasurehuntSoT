import { AccountFlow } from "@/components/wayfarer/AccountFlow";
import { maskEmailAddress } from "@/wayfarer/accounts";
import { requireWayfarerVerification } from "@/wayfarer/http";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; return?: string; token?: string; delivery?: string; action?: string }>;
}) {
  const session = await requireWayfarerVerification();
  const email = session?.account.emails[0]?.displayEmail ?? "";
  const maskedEmail = email ? maskEmailAddress(email) : undefined;
  return (
    <AccountFlow mode="verify" query={await searchParams} initialCsrf={session?.csrfToken} maskedEmail={maskedEmail} />
  );
}
