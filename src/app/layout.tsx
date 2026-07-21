import type { Metadata } from "next";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { ProductShell } from "@/components/shell/ProductShell";
import { canonicalTerms } from "@/language/canonical-terms";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/shell.css";
import "../styles/landing.css";
import "../styles/player.css";
import "../styles/gm.css";
import "../styles/animation.css";
import "../styles/showcase.css";
import "../styles/studio.css";
import "../styles/chronicle.css";
import "../styles/platform.css";

export const metadata: Metadata = {
  applicationName: canonicalTerms.product,
  title: { default: "Voyagewright | Stories made to be played", template: `%s | ${canonicalTerms.product}` },
  description: "Create a Chronicle, guide a Voyage, and gather your Crew for stories made to be played.",
  keywords: ["interactive experiences", "Chronicles", "Voyages", "group storytelling"],
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AnimationProvider>
          <ProductShell>{children}</ProductShell>
        </AnimationProvider>
      </body>
    </html>
  );
}
