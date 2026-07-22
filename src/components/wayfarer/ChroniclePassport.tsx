"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

type Profile = {
  displayName: string;
  handle?: string | null;
  biography?: string | null;
  defaultVisibility: string;
  privacyRules: Array<{ section: string; visibility: string }>;
  avatarMedia?: { id: string; altText?: string | null } | null;
  bannerMedia?: { id: string; altText?: string | null } | null;
  preferences: Preferences;
};
type Preferences = {
  version: 1;
  experience: {
    motion: string;
    textScale: number;
    theme: string;
    captions: boolean;
    transcripts: boolean;
    audioDescription: boolean;
    autoplay: boolean;
    contrast: string;
    textureIntensity: number;
    lowBandwidthMedia: boolean;
  };
  discovery: { searchable: boolean; themes: string[]; contentWarnings: string[] };
  social: { invitationPolicy: string; providerDiscovery: boolean };
  notifications: { email: boolean; product: boolean; invitations: boolean };
  privacy: { defaultVisibility: string };
};
const visibility = ["ONLY_ME", "CREW_ONLY", "REGISTERED_USERS", "PUBLIC", "UNLISTED"];

async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "The request could not be completed.");
  return body;
}

export function ChroniclePassport() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [identities, setIdentities] = useState<
    Array<{
      id: string;
      provider: string;
      providerDisplayName?: string | null;
      visibility: string;
      useForLogin: boolean;
      status: string;
    }>
  >([]);
  const [csrf, setCsrf] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [simulatorCode, setSimulatorCode] = useState("sim:wayfarer-demo:Discord voyager");

  useEffect(() => {
    Promise.all([
      fetch("/api/passport/profile").then(responseJson),
      fetch("/api/passport/providers").then(responseJson),
      fetch("/api/auth/sessions").then(responseJson),
    ])
      .then(([nextProfile, providers, sessions]) => {
        setProfile(nextProfile);
        setIdentities(providers.identities);
        setCsrf(sessions.csrfToken ?? "");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to open Chronicle Passport."));
  }, []);
  const headers = { "content-type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) };
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const next = await fetch("/api/passport/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify(values),
      }).then(responseJson);
      setProfile(next);
      setMessage("Profile saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save profile.");
    }
  }
  async function updatePrivacy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const rules = Object.fromEntries(Object.entries(values).filter(([key]) => key !== "defaultVisibility"));
      const rulesResult = await fetch("/api/passport/privacy", {
        method: "PUT",
        headers,
        body: JSON.stringify({ rules }),
      }).then(responseJson);
      if (profile) setProfile({ ...profile, privacyRules: rulesResult });
      setMessage("Privacy rules saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save privacy rules.");
    }
  }
  async function updatePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const next: Preferences = {
      ...profile.preferences,
      experience: {
        ...profile.preferences.experience,
        motion: String(form.get("motion")),
        textScale: Number(form.get("textScale")),
        theme: String(form.get("theme")),
        captions: form.get("captions") === "on",
        autoplay: form.get("autoplay") === "on",
      },
      discovery: { ...profile.preferences.discovery, searchable: form.get("searchable") === "on" },
    };
    try {
      const saved = await fetch("/api/passport/preferences", {
        method: "PUT",
        headers,
        body: JSON.stringify(next),
      }).then(responseJson);
      setProfile({ ...profile, preferences: saved });
      setMessage("Preferences saved for this account. Chronicle overrides remain temporary.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save preferences.");
    }
  }
  async function upload(kind: "AVATAR" | "BANNER", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read image."));
      reader.readAsDataURL(file);
    });
    try {
      await fetch("/api/passport/media", {
        method: "POST",
        headers,
        body: JSON.stringify({ kind, dataUrl, altText: kind === "AVATAR" ? "Profile avatar" : "Profile banner" }),
      }).then(responseJson);
      const next = await fetch("/api/passport/profile").then(responseJson);
      setProfile(next);
      setMessage(`${kind === "AVATAR" ? "Avatar" : "Banner"} saved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save image.");
    }
  }
  async function linkSimulator() {
    setError("");
    try {
      const begin = await fetch("/api/passport/providers/begin", {
        method: "POST",
        headers,
        body: JSON.stringify({ provider: "DISCORD_SIMULATOR" }),
      }).then(responseJson);
      const callback = await fetch("/api/passport/providers/callback", {
        method: "POST",
        headers,
        body: JSON.stringify({
          provider: "DISCORD_SIMULATOR",
          state: begin.state,
          nonce: begin.nonce,
          code: simulatorCode,
        }),
      }).then(responseJson);
      setIdentities((items) => [callback, ...items.filter((item) => item.id !== callback.id)]);
      setMessage("Discord simulator identity linked privately.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to link provider.");
    }
  }
  async function providerUpdate(id: string, patch: Record<string, unknown>) {
    try {
      const next = await fetch("/api/passport/providers", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id, ...patch }),
      }).then(responseJson);
      setIdentities((items) => items.map((item) => (item.id === id ? next : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update provider.");
    }
  }
  if (!profile)
    return (
      <main>
        <h1>Chronicle Passport</h1>
        <p aria-live="polite">{error || "Opening your private profile…"}</p>
      </main>
    );
  const rule = (section: string) =>
    profile.privacyRules.find((item) => item.section === section)?.visibility ?? "ONLY_ME";
  return (
    <main className="chronicle-passport">
      <header>
        <p>Private personal hub</p>
        <h1>Chronicle Passport</h1>
        <p>Manage your Profile, linked identities, preferences, privacy, and account security.</p>
      </header>
      <p aria-live="polite">{error || message}</p>
      <nav aria-label="Chronicle Passport sections">
        <a href="#profile">Profile</a>
        <a href="#providers">Linked identities</a>
        <a href="#preferences">Preferences</a>
        <a href="#privacy">Privacy</a>
        <a href="/account/security">Security</a>
      </nav>
      <section id="profile">
        <h2>Profile</h2>
        <form onSubmit={updateProfile}>
          <label>
            Display name
            <input name="displayName" defaultValue={profile.displayName} maxLength={80} required />
          </label>
          <label>
            Public handle
            <input name="handle" defaultValue={profile.handle ?? ""} placeholder="optional-handle" maxLength={32} />
          </label>
          <label>
            Biography
            <textarea name="biography" defaultValue={profile.biography ?? ""} maxLength={1000} />
          </label>
          <label>
            Default profile visibility
            <select name="defaultVisibility" defaultValue={profile.defaultVisibility}>
              {visibility.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Avatar
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void upload("AVATAR", event)}
            />
          </label>
          <label>
            Banner
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void upload("BANNER", event)}
            />
          </label>
          <button>Save profile</button>
        </form>
      </section>
      <section id="providers">
        <h2>Linked identities</h2>
        <p>Provider visibility and sign-in permission are independent. Provider tokens never appear here.</p>
        <label>
          Discord simulator code
          <input
            value={simulatorCode}
            onChange={(event) => setSimulatorCode(event.target.value)}
            aria-describedby="simulator-help"
          />
        </label>
        <p id="simulator-help">Local validation only; this is not external Discord approval.</p>
        <button type="button" onClick={() => void linkSimulator()}>
          Link Discord simulator
        </button>
        <ul>
          {identities.map((identity) => (
            <li key={identity.id}>
              <strong>{identity.provider}</strong> {identity.providerDisplayName ?? "Linked identity"}
              <label>
                Visibility
                <select
                  value={identity.visibility}
                  onChange={(event) => void providerUpdate(identity.id, { visibility: event.target.value })}
                >
                  {visibility.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={identity.useForLogin}
                  onChange={(event) => void providerUpdate(identity.id, { useForLogin: event.target.checked })}
                />{" "}
                Permit sign-in
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section id="preferences">
        <h2>Preferences</h2>
        <form onSubmit={updatePreferences}>
          <label>
            Motion
            <select name="motion" defaultValue={profile.preferences.experience.motion}>
              {["SYSTEM", "FULL", "GENTLE", "REDUCED"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Text scale
            <input
              name="textScale"
              type="number"
              min="0.8"
              max="2"
              step="0.1"
              defaultValue={profile.preferences.experience.textScale}
            />
          </label>
          <label>
            Theme
            <select name="theme" defaultValue={profile.preferences.experience.theme}>
              {["SYSTEM", "LIGHT", "DARK", "HIGH_CONTRAST"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <input name="captions" type="checkbox" defaultChecked={profile.preferences.experience.captions} /> Captions
          </label>
          <label>
            <input name="autoplay" type="checkbox" defaultChecked={profile.preferences.experience.autoplay} /> Autoplay
            permitted
          </label>
          <label>
            <input name="searchable" type="checkbox" defaultChecked={profile.preferences.discovery.searchable} /> Allow
            profile discovery
          </label>
          <button>Save preferences</button>
        </form>
      </section>
      <section id="privacy">
        <h2>Privacy</h2>
        <form onSubmit={updatePrivacy}>
          {["HEADER", "BIOGRAPHY", "PROVIDERS", "CHRONICLE_SUMMARY", "CREWS", "COMMUNITY"].map((section) => (
            <label key={section}>
              {section.replaceAll("_", " ")}
              <select name={section} defaultValue={rule(section)}>
                {visibility.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
          <button>Save privacy controls</button>
        </form>
        <p>
          Voyage history, artifacts, memories, and detailed crew records are future Phase 3 surfaces and remain private.
        </p>
      </section>
    </main>
  );
}
