import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voyagewright Player",
  description: "Accept invitations, continue active Voyages, and revisit preserved Voyage Records.",
};

export default function PlayerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
