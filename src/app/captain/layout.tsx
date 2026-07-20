import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Captain's Console | Voyagewright",
  description: "Begin Voyages, invite Crew, and guide live Chronicles.",
};

export default function CaptainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
