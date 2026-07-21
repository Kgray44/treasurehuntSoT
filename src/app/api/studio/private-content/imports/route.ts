import { NextResponse } from "next/server";
import { requireGmCapability } from "@/lib/security";
import { db } from "@/lib/db";
export async function GET() { const session = await requireGmCapability("CREATE_TALES"); if (!session) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403 }); const imports = await db.privateContentImport.findMany({ select: { id: true, packageId: true, packageRevision: true, status: true, createdAt: true, completedAt: true, warnings: true }, orderBy: { createdAt: "desc" }, take: 50 }); return NextResponse.json({ imports }, { headers: { "Cache-Control": "private, no-store" } }); }
