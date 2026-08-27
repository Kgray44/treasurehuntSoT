import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { listSupportCases } from "@/admiralty/support-pilot-service";
import { ChartroomPage, Panel } from "@/components/admiralty/AdminPrimitives";
import { SupportCaseConsole } from "@/components/admiralty/SupportCaseConsole";

export const dynamic = "force-dynamic";

export default async function SupportCasesPage() {
  const operator = await admiraltyPageOperator("SUPPORT_REQUEST");
  const cases = await listSupportCases(operator);
  return (
    <ChartroomPage
      eyebrow="Support Pilot S1"
      title="Support cases"
      description="Owner-consented, short-lived, source-bound diagnostic sessions. Every S1 execution is read-only."
    >
      <Panel title="Autonomous diagnosis, no autonomous repair" kicker="Security boundary">
        <p>
          A diagnostic capability is derived from this operator, this exact case, the account owner&apos;s active grant,
          approved scopes, expiry, classifications, and a read-only ceiling. A repair proposal is information only.
        </p>
        <SupportCaseConsole
          initialCases={cases}
          csrfToken={operator.csrfToken}
          canDiagnose={operator.capabilities.includes("SUPPORT_USE")}
        />
      </Panel>
    </ChartroomPage>
  );
}
