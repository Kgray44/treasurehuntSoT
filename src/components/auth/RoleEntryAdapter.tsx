import { StaffEntryAdapter } from "@/components/platform/StaffSignIn";

export function RoleEntryAdapter(props: Parameters<typeof StaffEntryAdapter>[0]) {
  return <StaffEntryAdapter {...props} />;
}
