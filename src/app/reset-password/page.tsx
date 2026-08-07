import { AccountFlow } from "@/components/wayfarer/AccountFlow";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; return?: string; token?: string }>;
}) {
  return <AccountFlow mode="reset" query={await searchParams} />;
}
