import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { aiQuotaOverview } from "@/parallax/ai-quota-projections";
import { ChartroomPage } from "@/components/admiralty/AdminPrimitives";
import { AIQuotaConsole } from "@/components/admiralty/AIQuotaConsole";
export default async function AIUsagePage() {
  const operator = await admiraltyPageOperator("CONFIG_OBSERVE");
  return (
    <ChartroomPage
      eyebrow="Parallax AI resource control"
      title="AI Usage & Quotas"
      description="Manage assistance allowances, review spending and preserve an auditable history of every admitted request."
    >
      <AIQuotaConsole
        initial={await aiQuotaOverview()}
        csrfToken={operator.csrfToken}
        canManage={operator.capabilities.includes("CONFIG_OPERATE")}
      />
    </ChartroomPage>
  );
}
