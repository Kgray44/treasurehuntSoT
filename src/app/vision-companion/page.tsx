import { notFound } from "next/navigation";
import { VisionCompanionDashboard } from "@/components/vision/VisionCompanionDashboard";
import { resolveVisionFeatureFlags } from "@/vision/feature-flags";

export default function VisionCompanionPage() {
  const flags = resolveVisionFeatureFlags();
  if (!flags.vision_companion) notFound();
  return <VisionCompanionDashboard featureFlags={flags} />;
}
