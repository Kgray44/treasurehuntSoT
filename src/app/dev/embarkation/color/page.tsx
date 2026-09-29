import { notFound } from "next/navigation";
import { ColorDiagnostic } from "./color-diagnostic";
export const dynamic = "force-dynamic";
export default function ColorProbe() {
  if (process.env.NODE_ENV === "production" || process.env.EMBARKATION_PREVIEW !== "1") notFound();
  return (
    <main>
      <h1>Embarkation color qualification</h1>
      <ColorDiagnostic />
    </main>
  );
}
