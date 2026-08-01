import { AccountFlow } from "@/components/wayfarer/AccountFlow";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; return?: string }>;
}) {
  return <AccountFlow mode="forgot" query={await searchParams} />;
}
