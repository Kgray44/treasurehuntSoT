import { notFound } from "next/navigation";
import { AdmiraltyConsole } from "@/components/admiralty/AdmiraltyConsole";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { AdmiraltyError } from "@/admiralty/errors";
import { admiraltyOverview } from "@/admiralty/projections";

export const dynamic = "force-dynamic";

export default async function AdmiraltyPage() {
  let operator;
  try {
    operator = await requireAdmiraltyOperator("PLATFORM_OBSERVE");
  } catch (cause) {
    if (
      cause instanceof AdmiraltyError &&
      ["ADMIRALTY_AUTH_REQUIRED", "ADMIRALTY_CAPABILITY_DENIED"].includes(cause.code)
    )
      notFound();
    throw cause;
  }
  const overview = await admiraltyOverview(operator);
  return <AdmiraltyConsole initialOverview={overview} />;
}
