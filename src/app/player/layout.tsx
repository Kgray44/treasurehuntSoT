import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Player Library",
  description: "Accept invitations, continue active Tall Tales, and revisit completed journals.",
};

export default function PlayerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
