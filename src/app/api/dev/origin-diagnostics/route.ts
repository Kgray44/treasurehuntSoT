import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function forwardedMetadata(value: string | null) {
  const first = firstHeaderValue(value);
  if (!first) return { host: null, proto: null };
  const pairs = new Map(
    first.split(";").flatMap((part) => {
      const [rawName, ...rawValue] = part.split("=");
      const name = rawName?.trim().toLocaleLowerCase("en-US");
      if (!name || !["host", "proto"].includes(name)) return [];
      return [[name, rawValue.join("=").trim().replace(/^"|"$/gu, "")] as const];
    }),
  );
  return { host: pairs.get("host") ?? null, proto: pairs.get("proto") ?? null };
}

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.HOMEPORT_ORIGIN_DIAGNOSTICS !== "1") return unavailable();

  const forwarded = forwardedMetadata(request.headers.get("forwarded"));
  const host = firstHeaderValue(request.headers.get("host"));
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const effectiveHost = forwardedHost ?? forwarded.host ?? host;
  const effectiveProto = forwardedProto ?? forwarded.proto ?? new URL(request.url).protocol.replace(/:$/u, "");

  return NextResponse.json({
    requestOrigin: new URL(request.url).origin,
    host,
    forwardedHost,
    forwardedProto,
    forwarded,
    effectiveHost,
    effectiveProto,
    coherent: Boolean(host && effectiveHost && effectiveProto),
  });
}
