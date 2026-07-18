import type { Metadata } from "next";
import { ThemeSettings } from "@/components/theme/ThemeSettings";

export const metadata: Metadata = { title: "Captain Settings" };

export default function CaptainSettingsPage() {
  return <ThemeSettings />;
}
