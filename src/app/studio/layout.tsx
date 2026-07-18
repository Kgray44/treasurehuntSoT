import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tall Tale Studio",
  description: "Create, validate, preview, publish, and preserve reusable Tall Tales.",
};

export default function StudioLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
