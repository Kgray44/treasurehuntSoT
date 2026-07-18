import { notFound } from "next/navigation";
import { AnimationShowcase } from "@/components/dev/AnimationShowcase";

export default function AnimationShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AnimationShowcase />;
}
