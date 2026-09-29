import { notFound } from "next/navigation";
import { DepthDiagnostic } from "./depth-diagnostic";
export const dynamic = "force-dynamic";
export default function DepthProbe() {
  if (process.env.NODE_ENV === "production" || process.env.EMBARKATION_PREVIEW !== "1") notFound();
  return (
    <main>
      <h1>Embarkation shared surface depth</h1>
      <DepthDiagnostic />
    </main>
  );
}
