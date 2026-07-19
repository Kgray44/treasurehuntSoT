import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tall Tale Experience",
  description: "Preview, begin, continue, and revisit a published interactive Tall Tale.",
};

export default function PlayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
