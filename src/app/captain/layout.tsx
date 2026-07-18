import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Captain's Command",
  description: "Create voyages, invite Players, and guide live Tall Tale sessions.",
};

export default function CaptainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
