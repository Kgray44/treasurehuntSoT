import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/homeport/PersonalHarborLayout", () => ({
  usePersonalHarbor: () => ({ setDirty: () => undefined, csrfToken: "synthetic-csrf" }),
}));
import { PersonalInformation } from "./AccountSurfaces";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Personal Harbor guest recovery entry", () => {
  it.each([true, false])(
    "homeport.phase7.account.canonical-lifecycle shows existing claim and merge entry only when canonical guest recovery is available=%s",
    async (guestRecoveryAvailable) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              displayName: "Synthetic Navigator",
              primaryEmail: null,
              emailVerificationState: "UNAVAILABLE",
              emailVerifiedAt: null,
              accountStatus: "Account state",
              guestRecoveryAvailable,
              createdAt: "2026-10-19T00:00:00Z",
              revision: "2026-10-19T00:00:00Z",
              emailChange: { status: "VERIFICATION_REQUIRED", reason: "Verify the primary email." },
            }),
            { status: 200 },
          ),
        ),
      );
      render(<PersonalInformation />);
      await screen.findByRole("button", { name: "Save display name" });
      if (guestRecoveryAvailable) {
        expect(screen.getByRole("link", { name: "Claim this guest Voyage" })).toHaveAttribute("href", "/account/claim");
        expect(screen.getByRole("link", { name: "Use an existing account" })).toHaveAttribute("href", "/account/merge");
      } else {
        expect(screen.queryByRole("link", { name: "Claim this guest Voyage" })).toBeNull();
        expect(screen.queryByRole("link", { name: "Use an existing account" })).toBeNull();
      }
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith(
        "/api/account/personal-information",
        expect.objectContaining({ cache: "no-store" }),
      );
    },
  );
});
