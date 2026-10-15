import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { aiQuotaOverview } from "@/parallax/ai-quota-projections";
import { ChartroomPage } from "@/components/admiralty/AdminPrimitives";
import { AIQuotaConsole } from "@/components/admiralty/AIQuotaConsole";
import { AIEconomicsConsole } from "@/components/admiralty/AIEconomicsConsole";
import { aiEconomicsOverview } from "@/parallax/ai-economics";
export default async function AIUsagePage() {
  const operator = await admiraltyPageOperator("CONFIG_OBSERVE");
  return (
    <ChartroomPage
      eyebrow="AI Economics & Capability Intelligence"
      title="AI Usage & Quotas"
      description="Understand what AI is doing, what it costs, who can use it, and whether its results are proving useful."
    >
      {operator.roles.includes("ADMINISTRATOR") && <AIEconomicsConsole initial={await aiEconomicsOverview()} />}
      <details className="chartroom-panel" open={false}>
        <summary>Policies, allowances & model configuration</summary>
        <AIQuotaConsole
          initial={await aiQuotaOverview()}
          csrfToken={operator.csrfToken}
          canManage={operator.roles.includes("ADMINISTRATOR") && operator.capabilities.includes("CONFIG_OPERATE")}
        />
      </details>
    </ChartroomPage>
  );
}
