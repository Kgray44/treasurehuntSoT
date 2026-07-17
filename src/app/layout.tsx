import type { Metadata } from "next";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/landing.css";
import "../styles/player.css";
import "../styles/gm.css";
import "../styles/animation.css";
import "../styles/showcase.css";

export const metadata: Metadata = {
  title: { default: "The Forever Treasure", template: "%s · The Forever Treasure" },
  description: "An enchanted companion for a private nautical tale.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AnimationProvider>{children}</AnimationProvider>
      </body>
    </html>
  );
}
