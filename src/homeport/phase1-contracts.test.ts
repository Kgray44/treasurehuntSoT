import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Project Homeport Phase 1 integration contracts", () => {
  it("homeport.passport.session consumes canonical context and clears private projection on session change", () => {
    const page = source("src/app/passport/page.tsx");
    const passport = source("src/components/wayfarer/ChroniclePassport.tsx");
    expect(page).toContain('resolveCapability("player")');
    expect(passport).toContain("useCurrentUser()");
    expect(passport).toContain("loadedSessionId === activeSessionId");
    expect(passport).toContain("hasCurrentSessionData ? storedProfile : null");
  });

  it("homeport.compatibility.observation keeps compatibility readers bounded and ordinary writers closed", () => {
    const resolver = source("src/homeport/current-user.server.ts");
    const cookieAdapter = source("src/wayfarer/http.ts");
    expect(resolver).toContain('jar.get("forever_gm")');
    expect(resolver).toContain('jar.get("chronicle_player")');
    expect(cookieAdapter).not.toMatch(/\.set\("forever_gm"/u);
    expect(cookieAdapter).not.toMatch(/\.set\("chronicle_player"/u);
  });
});
