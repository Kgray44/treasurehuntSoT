import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET(request: Request) {
  const expected = `file:${path.resolve(".runtime/muster/muster.sqlite").replaceAll("\\", "/")}`;
  if (
    process.env.NODE_ENV === "production" ||
    process.env.EMBARKATION_PREVIEW !== "1" ||
    process.env.DATABASE_URL !== expected
  )
    return new NextResponse(null, { status: 404 });
  const url = new URL(request.url),
    role = url.searchParams.get("role") ?? "captain";
  const fixture = JSON.parse(await readFile(path.resolve(".runtime/muster/fixture.json"), "utf8"));
  const profile = fixture.profiles[role === "captain" ? "captain" : role === "guest" ? "guest" : "sera"];
  if (!profile) return new NextResponse("Fixture has not been prepared.", { status: 503 });
  const target = new URL(
    role === "captain"
      ? "/captain/voyages/muster-all-ready/muster"
      : role === "guest"
        ? "/player/playthroughs/muster-guest"
        : "/player/playthroughs/muster-all-ready",
    process.env.NEXT_PUBLIC_APP_URL ?? url.origin,
  );
  for (const key of ["arrival", "quality", "motion", "missing", "failure", "inspector"])
    if (url.searchParams.has(key)) target.searchParams.set(key, url.searchParams.get(key)!);
  const response = NextResponse.redirect(target);
  response.cookies.set("wayfarer_account", profile.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 86400,
  });
  return response;
}
