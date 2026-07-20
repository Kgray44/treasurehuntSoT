import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voyagewright Player",
  description: "Preview a published Chronicle, begin a Voyage, and revisit your Voyage Record.",
};

export default function PlayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
