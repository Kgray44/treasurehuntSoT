import type { Metadata } from "next";
import { ThemeSettings } from "@/components/theme/ThemeSettings";

export const metadata: Metadata = { title: "Studio Settings" };

export default function StudioSettingsPage() {
  return <ThemeSettings />;
}
