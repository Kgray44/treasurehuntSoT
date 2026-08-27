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
      eyebrow="Support Pilot S2"
      title="Support cases"
      description="Owner-consented, short-lived, source-bound diagnosis with registered, bounded repair authority."
    >
      <Panel title="Autonomous diagnosis, no autonomous repair" kicker="Security boundary">
        <p>
          Every repair is derived from this operator, this exact case, the account owner&apos;s active grant, approved
          scopes, named registered repairs, expiry, current state, and a hard risk ceiling. Unregistered actions remain
          prohibited.
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
