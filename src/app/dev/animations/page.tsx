import { notFound } from "next/navigation";
import { AnimationShowcase } from "@/components/dev/AnimationShowcase";

export default function AnimationShowcasePage() {
  const enabled = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_ANIMATION_LAB === "true";
  if (!enabled) notFound();
  return <AnimationShowcase />;
}
