import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET(request: Request) {
  // A fixed audit fixture is a separate snapshot, never a reseed of the owner
  // screening database. No arbitrary database path is admitted by this route.
  const fixtureRoot = path.resolve(
    process.env.EMBARKATION_AUDIT_FIXTURE === "1" ? ".runtime/embarkation/audit-repair/fixture" : ".runtime/muster",
  );
  const expected = `file:${path.join(fixtureRoot, "muster.sqlite").replaceAll("\\", "/")}`;
  if (
    process.env.NODE_ENV === "production" ||
    process.env.EMBARKATION_PREVIEW !== "1" ||
    process.env.DATABASE_URL !== expected
  )
    return new NextResponse(null, { status: 404 });
  const url = new URL(request.url),
    role = url.searchParams.get("role") ?? "captain";
  const fixture = JSON.parse(await readFile(path.join(fixtureRoot, "fixture.json"), "utf8"));
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
