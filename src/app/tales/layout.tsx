import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Chronicles",
  description: "Browse published Chronicles by duration, Crew size, and Voyage progress.",
};

export default function TalesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
