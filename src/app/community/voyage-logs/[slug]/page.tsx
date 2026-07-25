import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const log = await db.communityVoyageLog.findFirst({ where: { slug: (await params).slug, visibility: "COMMUNITY", publishedAt: { not: null }, verifiedCompletion: true } }); return log ? { title: log.title, description: log.safeSummary ?? "A public Voyage Log" } : { robots: { index: false, follow: false } }; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const log = await db.communityVoyageLog.findFirst({ where: { slug: (await params).slug, visibility: "COMMUNITY", publishedAt: { not: null }, verifiedCompletion: true } }); if (!log) notFound(); return <main className="page-shell" aria-labelledby="voyage-log-title"><p><Link href="/community/voyage-logs">Back to Voyage Logs</Link></p><p className="eyebrow">Verified completion</p><h1 id="voyage-log-title">{log.title}</h1>{log.safeSummary ? <p>{log.safeSummary}</p> : null}{log.approximateLocation ? <p>{log.approximateLocation}</p> : null}</main>; }
