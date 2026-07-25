import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const guide = await db.communityGuideContent.findFirst({ where: { slug: (await params).slug, status: "PUBLISHED" } }); return guide ? { title: guide.title, description: guide.safeSummary } : { robots: { index: false, follow: false } }; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const guide = await db.communityGuideContent.findFirst({ where: { slug: (await params).slug, status: "PUBLISHED" } }); if (!guide) notFound(); return <main className="page-shell" aria-labelledby="guide-title"><p><Link href="/community/guides">Back to the Workshop</Link></p><p className="eyebrow">{guide.category}</p><h1 id="guide-title">{guide.title}</h1><p>{guide.safeSummary}</p><article><p>{guide.sanitizedBody}</p></article>{guide.deprecatedAt ? <p>This Guide has been marked as deprecated.</p> : null}</main>; }
