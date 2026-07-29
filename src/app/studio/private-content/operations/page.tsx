import { PrivateOperationsConsole } from "@/components/studio/PrivateOperationsConsole";
import { requireGmCapability } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function PrivateOperationsPage() {
  if (!(await requireGmCapability("ADMIN")))
    return (
      <main className="studio-auth-gate">
        <h1>Administrator access is required.</h1>
      </main>
    );
  return <PrivateOperationsConsole />;
}
