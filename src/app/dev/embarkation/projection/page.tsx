import { notFound } from "next/navigation";
import { ProjectionDiagnostic } from "./projection-diagnostic";
export const dynamic = "force-dynamic";
export default function ProjectionProbe() {
  if (process.env.NODE_ENV === "production" || process.env.EMBARKATION_PREVIEW !== "1") notFound();
  return (
    <main>
      <h1>Embarkation projection correspondence probe</h1>
      <ProjectionDiagnostic />
    </main>
  );
}
