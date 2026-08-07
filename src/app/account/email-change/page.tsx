import { AccountFlow } from "@/components/wayfarer/AccountFlow";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <AccountFlow mode="email-change" query={await searchParams} />;
}
