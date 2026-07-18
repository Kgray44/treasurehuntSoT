import { notFound } from "next/navigation";
import { isExperienceSection } from "@/lib/experience-routes";

export default async function HistoricalExperienceSectionPage({ params }: { params: Promise<{ section: string }> }) {
  if (!isExperienceSection((await params).section)) notFound();
  return null;
}
