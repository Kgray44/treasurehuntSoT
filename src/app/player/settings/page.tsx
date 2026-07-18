import type { Metadata } from "next";
import { ThemeSettings } from "@/components/theme/ThemeSettings";

export const metadata: Metadata = { title: "Player Settings" };

export default function PlayerSettingsPage() {
  return <ThemeSettings />;
}
