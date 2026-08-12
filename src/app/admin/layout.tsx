import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { AdmiraltyShell } from "@/components/admiralty/AdmiraltyShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const operator = await admiraltyPageOperator("PLATFORM_OBSERVE");
  return <AdmiraltyShell operator={operator}>{children}</AdmiraltyShell>;
}
