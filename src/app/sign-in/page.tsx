import { AccountFlow } from "@/components/wayfarer/AccountFlow";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; return?: string; reason?: string }>;
}) {
  return <AccountFlow mode="sign-in" query={await searchParams} />;
}
