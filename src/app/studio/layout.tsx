import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voyagewright Studio",
  description: "Create, validate, preview, publish, and preserve reusable Chronicles.",
};

export default function StudioLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
