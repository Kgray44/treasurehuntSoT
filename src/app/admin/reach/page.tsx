import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { unavailableProjection } from "@/admiralty/read-models";
import { getReachAdminOverview } from "@/reach/admin-service";
import { ChartroomPage } from "@/components/admiralty/AdminPrimitives";
import { ReachAdminConsole, type ReachAdminOverview } from "@/components/admiralty/ReachAdminConsole";

export default async function ReachAdminPage() {
  const operator = await admiraltyPageOperator("CONFIG_OBSERVE");
  let initial: ReachAdminOverview;
  try {
    initial = await getReachAdminOverview(operator);
  } catch {
    initial = unavailableProjection<NonNullable<ReachAdminOverview["data"]>>(
      "Reach administrative store",
      "Reach policy and reporting are unavailable.",
    );
  }
  return (
    <ChartroomPage
      eyebrow="Reach operations"
      title="Reach"
      description="Review aggregate interaction reports, calibration outcomes and the mandatory runtime policy. Measurements retain their source and coverage limits."
    >
      <ReachAdminConsole
        initial={initial}
        csrfToken={operator.csrfToken}
        canManage={operator.capabilities.includes("CONFIG_OPERATE")}
      />
    </ChartroomPage>
  );
}
