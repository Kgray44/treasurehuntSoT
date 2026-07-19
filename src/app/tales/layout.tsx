import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Tall Tales",
  description: "Browse published interactive stories by duration, group size, and progress.",
};

export default function TalesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
