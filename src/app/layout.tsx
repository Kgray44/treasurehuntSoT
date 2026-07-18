import type { Metadata, Viewport } from "next";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { PwaRegistration } from "@/components/pwa/PwaRegistration";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/landing.css";
import "../styles/player.css";
import "../styles/gm.css";
import "../styles/animation.css";
import "../styles/showcase.css";
import "../styles/studio.css";
import "../styles/tall-tale.css";
import "../styles/platform.css";
import "../styles/vision.css";

export const metadata: Metadata = {
  title: { default: "The Forever Treasure", template: "%s · The Forever Treasure" },
  description: "An enchanted companion for a private nautical tale.",
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
        <AnimationProvider>{children}</AnimationProvider>
      </body>
    </html>
  );
}
