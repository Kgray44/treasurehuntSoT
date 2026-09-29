import { notFound } from "next/navigation";
import { MaterialDiagnostic } from "./material-diagnostic";
import { PropDiagnostic } from "./prop-diagnostic";
export const dynamic = "force-dynamic";
export default function MaterialProbe() {
  if (process.env.NODE_ENV === "production" || process.env.EMBARKATION_PREVIEW !== "1") notFound();
  return (
    <main>
      <h1>Live material transport diagnostic</h1>
      <PropDiagnostic />
      <MaterialDiagnostic />
    </main>
  );
}
