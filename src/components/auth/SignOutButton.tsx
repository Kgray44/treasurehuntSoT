"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./CurrentUserProvider";

export function SignOutButton() {
  const router = useRouter();
  const { state, invalidate } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: state.status === "authenticated" ? { "x-csrf-token": state.csrfToken } : {},
      });
      if (!response.ok) throw new Error("Sign out could not be completed.");
      sessionStorage.removeItem("wayfarer-csrf");
      await invalidate();
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign out could not be completed.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void signOut()} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </>
  );
}
