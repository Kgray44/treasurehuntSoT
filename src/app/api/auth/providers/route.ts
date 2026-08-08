import { NextResponse } from "next/server";
import { publicOAuthProviderConfiguration } from "@/wayfarer/oauth";

export async function GET() {
  return NextResponse.json(
    { providers: publicOAuthProviderConfiguration() },
    { headers: { "cache-control": "no-store" } },
  );
}
