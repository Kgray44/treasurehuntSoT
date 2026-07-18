import type { Metadata, Viewport } from "next";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { PwaRegistration } from "@/components/pwa/PwaRegistration";
import { ProductShell } from "@/components/shell/ProductShell";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/shell.css";
import "../styles/landing.css";
import "../styles/player.css";
import "../styles/gm.css";
import "../styles/animation.css";
import "../styles/showcase.css";
import "../styles/studio.css";
import "../styles/tall-tale.css";
import "../styles/platform.css";
import "../styles/vision.css";
import "../styles/companion.css";

export const metadata: Metadata = {
  applicationName: "Forever Treasure",
  title: { default: "Forever Treasure · Interactive Tall Tales", template: "%s · Forever Treasure" },
  description:
    "Create, host, join, and experience interactive Tall Tales for friends, families, groups, and celebrations.",
  keywords: ["interactive stories", "Tall Tales", "group experiences", "collaborative storytelling"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/forever-treasure-192.svg",
    apple: "/icons/forever-treasure-192.svg",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0c303b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <PwaRegistration />
        <AnimationProvider>
          <ProductShell>{children}</ProductShell>
        </AnimationProvider>
      </body>
    </html>
  );
}
