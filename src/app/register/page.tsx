import { AccountFlow } from "@/components/wayfarer/AccountFlow";
import { headers } from "next/headers";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; return?: string }>;
}) {
  const requestHeaders = await headers();
  if (
    process.env.HOMEPORT_PHASE7_VALIDATION_DELAY_HOOK === "1" &&
    requestHeaders.get("x-homeport-validation-delay-ms") === "700"
  )
    await new Promise((resolve) => setTimeout(resolve, 700));
  return <AccountFlow mode="register" query={await searchParams} />;
}
