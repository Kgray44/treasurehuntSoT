import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { harborSharingMetadata } from "@/community/sharing-metadata";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const guide = await db.communityGuideContent.findFirst({ where: { slug: (await params).slug, status: "PUBLISHED" } }); return guide ? harborSharingMetadata({ kind: "guide", visibility: "COMMUNITY", canonicalPath: `/community/guides/${encodeURIComponent(guide.slug)}`, title: guide.title, safeDescription: guide.safeSummary }) : harborSharingMetadata({ kind: "guide", visibility: "PRIVATE", canonicalPath: "/community/guides" }); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const guide = await db.communityGuideContent.findFirst({ where: { slug: (await params).slug, status: "PUBLISHED" } }); if (!guide) notFound(); return <main className="page-shell" aria-labelledby="guide-title"><p><Link href="/community/guides">Back to the Workshop</Link></p><p className="eyebrow">{guide.category}</p><h1 id="guide-title">{guide.title}</h1><p>{guide.safeSummary}</p><article><p>{guide.sanitizedBody}</p></article>{guide.deprecatedAt ? <p>This Guide has been marked as deprecated.</p> : null}</main>; }
