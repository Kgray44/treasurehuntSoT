import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const collection = await db.communityCollection.findFirst({ where: { slug: (await params).slug, visibility: "COMMUNITY", archivedAt: null, deletedAt: null } }); if (!collection) notFound(); const items = await db.communityCollectionItem.findMany({ where: { collectionId: collection.id }, orderBy: { position: "asc" }, take: 100 }); return <main className="page-shell" aria-labelledby="collection-title"><p><Link href="/community/collections">Back to Collections</Link></p><h1 id="collection-title">{collection.title}</h1>{collection.description ? <p>{collection.description}</p> : null}<p>{items.length} saved public references</p></main>; }
