"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { usePersonalHarbor } from "@/components/homeport/PersonalHarborLayout";

type LoadState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: T };

async function responseBody<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "This request could not be completed.");
  return body;
}

function useResource<T>(url: string) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(responseBody<T>)
      .then((value) => setState({ status: "ready", value }))
      .catch((cause) => {
        if (!controller.signal.aborted)
          setState({
            status: "error",
            message: cause instanceof Error ? cause.message : "This section is unavailable.",
          });
      });
    return () => controller.abort();
  }, [generation, url]);
  return { state, reload: () => setGeneration((value) => value + 1), setState };
}

function LoadingState({ label = "Loading this section" }: { label?: string }) {
  return (
    <div className="harbor-state harbor-state--loading" role="status">
      <span aria-hidden="true" />
      {label}…
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="harbor-state harbor-state--error" role="alert">
      <h2>This section is unavailable</h2>
      <p>{message}</p>
      <button type="button" className="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

function MutationMessage({
  state,
}: {
  state: { kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string };
}) {
  if (state.kind === "idle") return null;
  return (
    <p
      className={`harbor-mutation harbor-mutation--${state.kind}`}
      role={state.kind === "error" || state.kind === "stale" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message ?? (state.kind === "saving" ? "Saving…" : "Saved.")}
    </p>
  );
}

type OverviewDto = {
  profile: {
    displayName: string;
    handle: string | null;
    completion: { completed: number; total: number; percent: number };
  };
  counts: Record<"linkedIdentities" | "activeSessions" | "history" | "memories" | "artifacts" | "saved", number>;
  destinations: Array<{ sectionId: string; label: string; href: string; group: string }>;
};

export function AccountOverview() {
  const { state, reload } = useResource<OverviewDto>("/api/account/overview");
  if (state.status === "loading") return <LoadingState label="Preparing your Personal Harbor" />;
  if (state.status === "error") return <ErrorState message={state.message} retry={reload} />;
  const { profile, counts, destinations } = state.value;
  return (
    <div className="harbor-stack">
      <section className="harbor-identity-card">
        <div>
          <p className="personal-harbor__eyebrow">Welcome back</p>
          <h2>{profile.displayName}</h2>
          <p>
            {profile.handle ? `@${profile.handle}` : "Choose a public handle when you are ready to share your Profile."}
          </p>
        </div>
        <div className="harbor-completion" aria-label={`Profile ${profile.completion.percent}% complete`}>
          <strong>{profile.completion.percent}%</strong>
          <span>
            {profile.completion.completed} of {profile.completion.total} profile details ready
          </span>
          <progress max={profile.completion.total} value={profile.completion.completed}>
            {profile.completion.percent}%
          </progress>
        </div>
      </section>
      <section aria-labelledby="harbor-at-a-glance">
        <h2 id="harbor-at-a-glance">At a glance</h2>
        <div className="harbor-stat-grid">
          {[
            ["Chronicle history", counts.history],
            ["Memories", counts.memories],
            ["Artifacts", counts.artifacts],
            ["Saved", counts.saved],
            ["Linked identities", counts.linkedIdentities],
            ["Active sessions", counts.activeSessions],
          ].map(([label, value]) => (
            <article key={String(label)} className="harbor-stat">
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="harbor-next">
        <h2 id="harbor-next">Your harbor</h2>
        <div className="harbor-card-grid">
          {destinations
            .filter((item) => !["personal-harbor-overview", "passport-home"].includes(item.sectionId))
            .map((item) => (
              <Link className="harbor-link-card" href={item.href} key={item.sectionId}>
                <span>{item.group}</span>
                <strong>{item.label}</strong>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}

type ProfileDto = {
  id: string;
  displayName: string;
  handle: string | null;
  biography: string | null;
  defaultVisibility: string;
  revision: string;
  avatar: { id: string; url: string; altText: string | null; processingState: "READY" } | null;
  banner: { id: string; url: string; altText: string | null; processingState: "READY" } | null;
};

type PublicPreview = {
  private?: boolean;
  displayName?: string;
  handle: string;
  biography?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  providers?: Array<{ provider: string; providerDisplayName?: string | null }>;
};

export function ProfileEditor() {
  const resource = useResource<ProfileDto>("/api/passport/profile");
  const { setDirty, csrfToken } = usePersonalHarbor();
  const { invalidate } = useCurrentUser();
  const [draft, setDraft] = useState<ProfileDto | null>(null);
  const [preview, setPreview] = useState<LoadState<PublicPreview> | null>(null);
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );

  useEffect(() => {
    if (resource.state.status === "ready") setDraft(resource.state.value);
  }, [resource.state]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const loadPreview = async (profile: ProfileDto) => {
    if (!profile.handle) return setPreview(null);
    setPreview({ status: "loading" });
    try {
      const response = await fetch(`/api/profile/${encodeURIComponent(profile.handle)}?viewer=public`, {
        cache: "no-store",
      });
      setPreview({ status: "ready", value: await responseBody<PublicPreview>(response) });
    } catch (cause) {
      setPreview({ status: "error", message: cause instanceof Error ? cause.message : "Public preview unavailable." });
    }
  };
  useEffect(() => {
    if (resource.state.status === "ready") void loadPreview(resource.state.value);
  }, [resource.state]);

  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  if (resource.state.status === "loading" || !draft) return <LoadingState label="Loading your Profile" />;

  const change = <K extends keyof Pick<ProfileDto, "displayName" | "handle" | "biography" | "defaultVisibility">>(
    key: K,
    value: ProfileDto[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setDirty(true);
    setMutation({ kind: "idle" });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMutation({ kind: "saving" });
    try {
      const response = await fetch("/api/passport/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({
          displayName: draft.displayName,
          handle: draft.handle || null,
          biography: draft.biography || null,
          defaultVisibility: draft.defaultVisibility,
          expectedRevision: draft.revision,
        }),
      });
      const value = await responseBody<ProfileDto>(response);
      setDraft(value);
      resource.setState({ status: "ready", value });
      setDirty(false);
      setMutation({ kind: "saved", message: "Profile saved and public preview refreshed." });
      await invalidate();
      await loadPreview(value);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Profile could not be saved.";
      setMutation({ kind: message.includes("another window") ? "stale" : "error", message });
    }
  };
  const upload = async (kind: "AVATAR" | "BANNER", file: File | undefined) => {
    if (!file) return;
    setMutation({ kind: "saving", message: `Processing ${kind === "AVATAR" ? "avatar" : "banner"}…` });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("The selected image could not be read."));
      reader.readAsDataURL(file);
    });
    try {
      await responseBody(
        await fetch("/api/passport/media", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ kind, dataUrl, altText: kind === "AVATAR" ? "Profile avatar" : "Profile banner" }),
        }),
      );
      setDirty(false);
      setMutation({ kind: "saved", message: "Image normalized and stored. The public projection has been refreshed." });
      await invalidate();
      resource.reload();
    } catch (cause) {
      setMutation({ kind: "error", message: cause instanceof Error ? cause.message : "Image processing failed." });
    }
  };
  const remove = async (media: NonNullable<ProfileDto["avatar"]>, label: string) => {
    if (!window.confirm(`Remove this ${label}? The Profile will use its fallback immediately.`)) return;
    setMutation({ kind: "saving", message: `Removing ${label}…` });
    try {
      await responseBody(
        await fetch("/api/passport/media", {
          method: "DELETE",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ id: media.id }),
        }),
      );
      setMutation({ kind: "saved", message: `${label[0].toUpperCase()}${label.slice(1)} removed.` });
      await invalidate();
      resource.reload();
    } catch (cause) {
      setMutation({ kind: "error", message: cause instanceof Error ? cause.message : "Image removal failed." });
    }
  };

  return (
    <div className="harbor-profile-grid">
      <form className="harbor-panel harbor-form" onSubmit={save}>
        <div>
          <p className="personal-harbor__eyebrow">Owner controls</p>
          <h2>Edit public Profile</h2>
          <p>Only the server-enforced public projection appears in the preview.</p>
        </div>
        <label>
          Display name
          <input
            value={draft.displayName}
            maxLength={80}
            onChange={(event) => change("displayName", event.target.value)}
            required
          />
        </label>
        <label>
          Handle<span className="harbor-field-hint">Lowercase letters, numbers, and internal hyphens.</span>
          <input value={draft.handle ?? ""} maxLength={32} onChange={(event) => change("handle", event.target.value)} />
        </label>
        <label>
          Biography
          <textarea
            value={draft.biography ?? ""}
            maxLength={1000}
            rows={7}
            onChange={(event) => change("biography", event.target.value)}
          />
        </label>
        <label>
          Default visibility
          <select value={draft.defaultVisibility} onChange={(event) => change("defaultVisibility", event.target.value)}>
            <option value="ONLY_ME">Only me</option>
            <option value="CREW_ONLY">Crew only</option>
            <option value="REGISTERED_USERS">Registered members</option>
            <option value="PUBLIC">Public</option>
            <option value="UNLISTED">Unlisted</option>
          </select>
        </label>
        <fieldset className="harbor-media-fields">
          <legend>Profile imagery</legend>
          <label>
            Avatar image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void upload("AVATAR", event.target.files?.[0])}
            />
          </label>
          {draft.avatar && (
            <button type="button" className="button button--quiet" onClick={() => void remove(draft.avatar!, "avatar")}>
              Remove avatar
            </button>
          )}
          <label>
            Banner image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void upload("BANNER", event.target.files?.[0])}
            />
          </label>
          {draft.banner && (
            <button type="button" className="button button--quiet" onClick={() => void remove(draft.banner!, "banner")}>
              Remove banner
            </button>
          )}
          <p className="harbor-field-hint">
            PNG, JPEG, or WebP is normalized into bounded private Profile storage. No external malware-scanner result is
            claimed by this flow.
          </p>
        </fieldset>
        <MutationMessage state={mutation} />
        {mutation.kind === "stale" && (
          <button type="button" className="button" onClick={resource.reload}>
            Reload saved Profile
          </button>
        )}
        <button className="button button--primary" disabled={mutation.kind === "saving"}>
          Save Profile
        </button>
      </form>
      <aside className="harbor-panel harbor-preview" aria-labelledby="profile-preview-title">
        <p className="personal-harbor__eyebrow">Public-view preview</p>
        <h2 id="profile-preview-title">What another visitor can see</h2>
        {!draft.handle ? (
          <p className="harbor-empty">Choose a handle to create a public Profile destination.</p>
        ) : preview?.status === "loading" ? (
          <LoadingState label="Refreshing preview" />
        ) : preview?.status === "error" ? (
          <p role="alert">{preview.message}</p>
        ) : preview?.status === "ready" && preview.value.private ? (
          <p className="harbor-empty">Your Profile header is not public to an anonymous visitor.</p>
        ) : preview?.status === "ready" ? (
          <div className="public-profile-preview">
            {preview.value.bannerUrl && (
              <img src={preview.value.bannerUrl} alt="" className="public-profile-preview__banner" />
            )}
            {preview.value.avatarUrl ? (
              <img src={preview.value.avatarUrl} alt="Profile avatar" className="public-profile-preview__avatar" />
            ) : (
              <div className="public-profile-preview__fallback" aria-hidden="true">
                {draft.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <h3>{preview.value.displayName}</h3>
            <p>@{preview.value.handle}</p>
            {preview.value.biography && <p>{preview.value.biography}</p>}
            {(preview.value.providers?.length ?? 0) > 0 && (
              <ul>
                {preview.value.providers!.map((provider) => (
                  <li key={provider.provider}>{provider.providerDisplayName || provider.provider}</li>
                ))}
              </ul>
            )}
            <Link href={`/profile/${encodeURIComponent(draft.handle!)}`}>Open my Profile</Link>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

type PersonalInfoDto = {
  displayName: string;
  primaryEmail: string | null;
  emailVerificationState: string;
  emailVerifiedAt: string | null;
  accountStatus: string;
  createdAt: string;
  revision: string;
  emailChange: { status: string; reason: string };
};

export function PersonalInformation() {
  const info = useResource<PersonalInfoDto>("/api/account/personal-information");
  const profile = useResource<ProfileDto>("/api/passport/profile");
  const { setDirty, csrfToken } = usePersonalHarbor();
  const [name, setName] = useState("");
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );
  useEffect(() => {
    if (info.state.status === "ready") setName(info.state.value.displayName);
  }, [info.state]);
  useEffect(() => () => setDirty(false), [setDirty]);
  if (info.state.status === "loading" || profile.state.status === "loading") return <LoadingState />;
  if (info.state.status === "error") return <ErrorState message={info.state.message} retry={info.reload} />;
  if (profile.state.status === "error") return <ErrorState message={profile.state.message} retry={profile.reload} />;
  const savedProfile = profile.state.value;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMutation({ kind: "saving" });
    try {
      const value = await responseBody<ProfileDto>(
        await fetch("/api/passport/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ displayName: name, expectedRevision: savedProfile.revision }),
        }),
      );
      profile.setState({ status: "ready", value });
      setDirty(false);
      setMutation({ kind: "saved", message: "Personal information saved." });
      info.reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save.";
      setMutation({ kind: message.includes("another window") ? "stale" : "error", message });
    }
  };
  const value = info.state.value;
  return (
    <div className="harbor-stack">
      <form className="harbor-panel harbor-form" onSubmit={save}>
        <h2>Personal information</h2>
        <label>
          Display name
          <input
            value={name}
            maxLength={80}
            required
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
              setMutation({ kind: "idle" });
            }}
          />
        </label>
        <div className="harbor-readonly-field">
          <span>Primary email</span>
          <strong>{value.primaryEmail ?? "No primary email is available"}</strong>
          <small>{value.emailVerificationState === "VERIFIED" ? "Verified" : value.emailVerificationState}</small>
        </div>
        <div className="harbor-callout">
          <strong>Email changes are not currently supported.</strong>
          <p>{value.emailChange.reason}</p>
        </div>
        <MutationMessage state={mutation} />
        <button className="button button--primary" disabled={mutation.kind === "saving"}>
          Save display name
        </button>
      </form>
      <section className="harbor-panel">
        <h2>Account record</h2>
        <dl className="harbor-definition-list">
          <div>
            <dt>Status</dt>
            <dd>{value.accountStatus}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(value.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

type Preferences = {
  version: 1;
  experience: {
    motion: "FULL" | "GENTLE" | "REDUCED" | "SYSTEM";
    textScale: number;
    theme: "SYSTEM" | "LIGHT" | "DARK" | "HIGH_CONTRAST";
    captions: boolean;
    transcripts: boolean;
    audioDescription: boolean;
    autoplay: boolean;
    contrast: "SYSTEM" | "STANDARD" | "HIGH";
    textureIntensity: number;
    lowBandwidthMedia: boolean;
  };
  discovery: { searchable: boolean; themes: string[]; contentWarnings: string[] };
  social: { invitationPolicy: "ONLY_ME" | "CREW_ONLY" | "REGISTERED_USERS" | "PUBLIC"; providerDiscovery: boolean };
  notifications: { email: boolean; product: boolean; invitations: boolean };
  privacy: { defaultVisibility: string };
};
type PreferencesDto = { preferences: Preferences; revision: string };

export function PreferenceEditor({ mode }: { mode: "preferences" | "accessibility" | "notifications" }) {
  const resource = useResource<PreferencesDto>("/api/passport/preferences");
  const { setDirty, csrfToken } = usePersonalHarbor();
  const [draft, setDraft] = useState<PreferencesDto | null>(null);
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );
  useEffect(() => {
    if (resource.state.status === "ready") setDraft(resource.state.value);
  }, [resource.state]);
  useEffect(() => () => setDirty(false), [setDirty]);
  useEffect(() => {
    if (!draft) return;
    document.documentElement.dataset.motionPreference = draft.preferences.experience.motion.toLowerCase();
    document.documentElement.style.setProperty("--personal-text-scale", String(draft.preferences.experience.textScale));
  }, [draft]);
  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  if (resource.state.status === "loading" || !draft) return <LoadingState />;
  const update = (next: Preferences) => {
    setDraft({ ...draft, preferences: next });
    setDirty(true);
    setMutation({ kind: "idle" });
  };
  const exp = (patch: Partial<Preferences["experience"]>) =>
    update({ ...draft.preferences, experience: { ...draft.preferences.experience, ...patch } });
  const notice = (patch: Partial<Preferences["notifications"]>) =>
    update({ ...draft.preferences, notifications: { ...draft.preferences.notifications, ...patch } });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMutation({ kind: "saving" });
    try {
      const value = await responseBody<PreferencesDto>(
        await fetch("/api/passport/preferences", {
          method: "PUT",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ preferences: draft.preferences, expectedRevision: draft.revision }),
        }),
      );
      setDraft(value);
      resource.setState({ status: "ready", value });
      setDirty(false);
      setMutation({ kind: "saved", message: "Preferences saved and applied." });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Preferences could not be saved.";
      setMutation({ kind: message.includes("another window") ? "stale" : "error", message });
    }
  };
  const title =
    mode === "accessibility"
      ? "Accessibility preferences"
      : mode === "notifications"
        ? "Notification preferences"
        : "Experience preferences";
  return (
    <form className="harbor-panel harbor-form" onSubmit={save}>
      <h2>{title}</h2>
      {mode !== "notifications" && (
        <>
          <label>
            Theme
            <select
              value={draft.preferences.experience.theme}
              onChange={(event) => exp({ theme: event.target.value as Preferences["experience"]["theme"] })}
            >
              <option value="SYSTEM">Follow system</option>
              <option value="LIGHT">Light</option>
              <option value="DARK">Dark</option>
              <option value="HIGH_CONTRAST">High contrast</option>
            </select>
          </label>
          <label>
            Motion
            <select
              value={draft.preferences.experience.motion}
              onChange={(event) => exp({ motion: event.target.value as Preferences["experience"]["motion"] })}
            >
              <option value="SYSTEM">Follow system</option>
              <option value="FULL">Full</option>
              <option value="GENTLE">Gentle</option>
              <option value="REDUCED">Reduced</option>
            </select>
          </label>
          <label>
            Text scale <output>{Math.round(draft.preferences.experience.textScale * 100)}%</output>
            <input
              type="range"
              min="0.8"
              max="2"
              step="0.1"
              value={draft.preferences.experience.textScale}
              onChange={(event) => exp({ textScale: Number(event.target.value) })}
            />
          </label>
          <label>
            Contrast
            <select
              value={draft.preferences.experience.contrast}
              onChange={(event) => exp({ contrast: event.target.value as Preferences["experience"]["contrast"] })}
            >
              <option value="SYSTEM">Follow system</option>
              <option value="STANDARD">Standard</option>
              <option value="HIGH">High</option>
            </select>
          </label>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.experience.autoplay}
              onChange={(event) => exp({ autoplay: event.target.checked })}
            />
            Allow media autoplay
          </label>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.experience.lowBandwidthMedia}
              onChange={(event) => exp({ lowBandwidthMedia: event.target.checked })}
            />
            Prefer low-bandwidth media
          </label>
        </>
      )}
      {mode === "accessibility" && (
        <>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.experience.captions}
              onChange={(event) => exp({ captions: event.target.checked })}
            />
            Prefer captions
          </label>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.experience.transcripts}
              onChange={(event) => exp({ transcripts: event.target.checked })}
            />
            Prefer transcripts
          </label>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.experience.audioDescription}
              onChange={(event) => exp({ audioDescription: event.target.checked })}
            />
            Prefer audio descriptions
          </label>
          <div className="harbor-callout">
            <strong>Browser and operating-system accessibility settings remain authoritative.</strong>
            <p>
              Reduced motion and forced colors override a conflicting account preference. Reduced mode renders the
              semantic final state immediately.
            </p>
          </div>
        </>
      )}
      {mode === "preferences" && (
        <>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.discovery.searchable}
              onChange={(event) =>
                update({
                  ...draft.preferences,
                  discovery: { ...draft.preferences.discovery, searchable: event.target.checked },
                })
              }
            />
            Allow Profile discovery
          </label>
          <label>
            Invitation policy
            <select
              value={draft.preferences.social.invitationPolicy}
              onChange={(event) =>
                update({
                  ...draft.preferences,
                  social: {
                    ...draft.preferences.social,
                    invitationPolicy: event.target.value as Preferences["social"]["invitationPolicy"],
                  },
                })
              }
            >
              <option value="ONLY_ME">Only me</option>
              <option value="CREW_ONLY">Crew only</option>
              <option value="REGISTERED_USERS">Registered members</option>
              <option value="PUBLIC">Public</option>
            </select>
          </label>
        </>
      )}
      {mode === "notifications" && (
        <>
          <p>
            These preferences control accepted in-product and email intent. They do not claim an external delivery
            provider is configured.
          </p>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.notifications.product}
              onChange={(event) => notice({ product: event.target.checked })}
            />
            In-product updates
          </label>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.notifications.email}
              onChange={(event) => notice({ email: event.target.checked })}
            />
            Email updates when delivery is available
          </label>
          <label className="harbor-checkbox">
            <input
              type="checkbox"
              checked={draft.preferences.notifications.invitations}
              onChange={(event) => notice({ invitations: event.target.checked })}
            />
            Voyage invitation updates
          </label>
        </>
      )}
      <MutationMessage state={mutation} />
      {mutation.kind === "stale" && (
        <button type="button" className="button" onClick={resource.reload}>
          Reload saved preferences
        </button>
      )}
      <button className="button button--primary" disabled={mutation.kind === "saving"}>
        Save {mode === "notifications" ? "notifications" : "preferences"}
      </button>
    </form>
  );
}

type PrivacyDto = { rules: Array<{ section: string; visibility: string }>; revision: string };
const privacySections = ["HEADER", "BIOGRAPHY", "PROVIDERS", "CHRONICLE_SUMMARY", "CREWS", "COMMUNITY"];
export function PrivacyEditor() {
  const resource = useResource<PrivacyDto>("/api/passport/privacy");
  const { setDirty, csrfToken } = usePersonalHarbor();
  const [draft, setDraft] = useState<PrivacyDto | null>(null);
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );
  useEffect(() => {
    if (resource.state.status === "ready") setDraft(resource.state.value);
  }, [resource.state]);
  useEffect(() => () => setDirty(false), [setDirty]);
  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  if (resource.state.status === "loading" || !draft) return <LoadingState />;
  const rules = Object.fromEntries(draft.rules.map((rule) => [rule.section, rule.visibility]));
  const setRule = (section: string, visibility: string) => {
    setDraft({ ...draft, rules: [...draft.rules.filter((rule) => rule.section !== section), { section, visibility }] });
    setDirty(true);
    setMutation({ kind: "idle" });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMutation({ kind: "saving" });
    try {
      const value = await responseBody<PrivacyDto>(
        await fetch("/api/passport/privacy", {
          method: "PUT",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({
            rules: Object.fromEntries(draft.rules.map((rule) => [rule.section, rule.visibility])),
            expectedRevision: draft.revision,
          }),
        }),
      );
      setDraft(value);
      resource.setState({ status: "ready", value });
      setDirty(false);
      setMutation({ kind: "saved", message: "Privacy rules saved and enforced by public projections." });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Privacy rules could not be saved.";
      setMutation({ kind: message.includes("another window") ? "stale" : "error", message });
    }
  };
  return (
    <form className="harbor-panel harbor-form" onSubmit={save}>
      <h2>Profile privacy rules</h2>
      <p>
        These controls are enforced by the server. Hidden data is omitted from public responses; CSS is never used as a
        privacy boundary.
      </p>
      <div className="harbor-rule-grid">
        {privacySections.map((section) => (
          <label key={section}>
            {section.toLowerCase().replaceAll("_", " ")}
            <select value={rules[section] ?? "ONLY_ME"} onChange={(event) => setRule(section, event.target.value)}>
              <option value="ONLY_ME">Only me</option>
              <option value="CREW_ONLY">Crew only</option>
              <option value="REGISTERED_USERS">Registered members</option>
              <option value="PUBLIC">Public</option>
              <option value="UNLISTED">Unlisted</option>
            </select>
          </label>
        ))}
      </div>
      <MutationMessage state={mutation} />
      {mutation.kind === "stale" && (
        <button type="button" className="button" onClick={resource.reload}>
          Reload saved rules
        </button>
      )}
      <button className="button button--primary" disabled={mutation.kind === "saving"}>
        Save privacy rules
      </button>
    </form>
  );
}

type IdentityDto = {
  id: string;
  provider: string;
  displayName: string | null;
  avatarUrl: string | null;
  useForLogin: boolean;
  visibility: string;
  status: string;
  linkedAt: string;
  lastVerifiedAt: string | null;
  revokedAt: string | null;
};
type ProviderDto = { provider: string; name: string; available: boolean; link: boolean };
export function LinkedIdentities() {
  const resource = useResource<{ identities: IdentityDto[]; adapters: ProviderDto[] }>("/api/passport/providers");
  const { csrfToken } = usePersonalHarbor();
  const [message, setMessage] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>({
    kind: "idle",
  });
  if (resource.state.status === "loading") return <LoadingState />;
  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  const linked = resource.state.value.identities.filter(
    (identity) => identity.status === "LINKED" && !identity.revokedAt,
  );
  const unlink = async (identity: IdentityDto) => {
    if (
      !window.confirm(
        `Unlink ${identity.displayName || identity.provider}? You will not be allowed to remove your last usable login method.`,
      )
    )
      return;
    setMessage({ kind: "saving", message: "Unlinking identity…" });
    try {
      await responseBody(
        await fetch("/api/passport/providers", {
          method: "DELETE",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ id: identity.id }),
        }),
      );
      setMessage({ kind: "saved", message: "Identity unlinked." });
      resource.reload();
    } catch (cause) {
      setMessage({
        kind: "error",
        message: cause instanceof Error ? cause.message : "Identity could not be unlinked.",
      });
    }
  };
  const begin = async (provider: ProviderDto) => {
    setMessage({ kind: "saving", message: `Preparing ${provider.name}…` });
    try {
      const result = await responseBody<{ authorizationUrl: string }>(
        await fetch("/api/passport/providers/begin", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ provider: provider.provider, redirectPath: "/account/linked-identities" }),
        }),
      );
      window.location.assign(result.authorizationUrl);
    } catch (cause) {
      setMessage({
        kind: "error",
        message: cause instanceof Error ? cause.message : "Provider linking is unavailable.",
      });
    }
  };
  return (
    <div className="harbor-stack">
      <section className="harbor-panel">
        <h2>Connected identities</h2>
        <p>Provider subjects, access tokens, refresh tokens, and requested scopes are never returned to this page.</p>
        {linked.length ? (
          <ul className="harbor-list">
            {linked.map((identity) => (
              <li key={identity.id}>
                <div>
                  <strong>{identity.displayName || identity.provider}</strong>
                  <span>
                    {identity.provider.replaceAll("_", " ")} · linked {new Date(identity.linkedAt).toLocaleDateString()}
                    {identity.useForLogin ? " · login enabled" : ""}
                  </span>
                </div>
                <button type="button" className="button button--danger" onClick={() => void unlink(identity)}>
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="harbor-empty">
            No external identities are linked. Your account credential remains the login authority.
          </p>
        )}
        <MutationMessage state={message} />
      </section>
      <section className="harbor-panel">
        <h2>Available connections</h2>
        {resource.state.value.adapters.length ? (
          <ul className="harbor-list">
            {resource.state.value.adapters.map((provider) => (
              <li key={provider.provider}>
                <div>
                  <strong>{provider.name}</strong>
                  <span>Configured and available in this environment</span>
                </div>
                <button type="button" className="button" onClick={() => void begin(provider)}>
                  Connect
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="harbor-callout">
            <strong>No external connection is configured.</strong>
            <p>
              Partner-gated, planned, disabled, and simulator adapters are intentionally absent from this ordinary
              product surface.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function SecurityOverview() {
  return (
    <div className="harbor-stack">
      <section className="harbor-panel">
        <h2>Password & recovery</h2>
        <p>
          Credential verification and reset remain with the accepted Wayfarer lifecycle. Personal Harbor does not
          collect a current password or invent a temporary reauthentication grant.
        </p>
        <Link className="button button--primary" href="/forgot-password">
          Start password reset
        </Link>
      </section>
      <section className="harbor-panel">
        <h2>Session security</h2>
        <p>Review current and other signed-in devices, revoke a session, or sign out everywhere.</p>
        <Link className="button" href="/account/sessions">
          Open Sessions & Devices
        </Link>
      </section>
    </div>
  );
}

type SessionDto = {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};
export function SessionManager() {
  const resource = useResource<{ sessions: SessionDto[] }>("/api/auth/sessions");
  const { csrfToken } = usePersonalHarbor();
  const { invalidate } = useCurrentUser();
  const [message, setMessage] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>({
    kind: "idle",
  });
  if (resource.state.status === "loading") return <LoadingState />;
  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  const revoke = async (session: SessionDto) => {
    if (!window.confirm(`${session.current ? "Revoke this current session" : "Revoke this session"}?`)) return;
    setMessage({ kind: "saving", message: "Revoking session…" });
    try {
      await responseBody(
        await fetch(`/api/auth/sessions/${encodeURIComponent(session.id)}/revoke`, {
          method: "POST",
          headers: { "x-csrf-token": csrfToken },
        }),
      );
      setMessage({ kind: "saved", message: "Session revoked." });
      if (session.current) await invalidate();
      else resource.reload();
    } catch (cause) {
      setMessage({ kind: "error", message: cause instanceof Error ? cause.message : "Session could not be revoked." });
    }
  };
  const all = async () => {
    if (!window.confirm("Sign out every active session, including this device?")) return;
    setMessage({ kind: "saving", message: "Signing out all sessions…" });
    try {
      await responseBody(
        await fetch("/api/auth/sign-out-all", { method: "POST", headers: { "x-csrf-token": csrfToken } }),
      );
      setMessage({ kind: "saved", message: "All sessions signed out." });
      await invalidate();
      window.location.assign("/sign-in?reason=revoked&returnTo=%2Faccount%2Fsessions");
    } catch (cause) {
      setMessage({
        kind: "error",
        message: cause instanceof Error ? cause.message : "Sessions could not be signed out.",
      });
    }
  };
  const current = resource.state.value.sessions.find((session) => session.current);
  const others = resource.state.value.sessions.filter((session) => !session.current);
  const card = (session: SessionDto) => (
    <li key={session.id}>
      <div>
        <strong>
          {session.deviceLabel || "Unlabelled browser"}
          {session.current ? " · This device" : ""}
        </strong>
        <span>Last active {new Date(session.lastSeenAt).toLocaleString()}</span>
        <span>Expires {new Date(session.expiresAt).toLocaleString()}</span>
      </div>
      <button type="button" className="button button--danger" onClick={() => void revoke(session)}>
        Revoke
      </button>
    </li>
  );
  return (
    <div className="harbor-stack">
      <section className="harbor-panel">
        <h2>Current session</h2>
        {current ? (
          <ul className="harbor-list">{card(current)}</ul>
        ) : (
          <p className="harbor-empty">The current session is no longer active.</p>
        )}
      </section>
      <section className="harbor-panel">
        <h2>Other sessions</h2>
        {others.length ? (
          <ul className="harbor-list">{others.map(card)}</ul>
        ) : (
          <p className="harbor-empty">No other active sessions.</p>
        )}
      </section>
      <section className="harbor-panel harbor-danger-zone">
        <h2>Sign out everywhere</h2>
        <p>This revokes every accepted AccountSession. It does not alter Tale Session or Voyage business records.</p>
        <button type="button" className="button button--danger" onClick={() => void all()}>
          Sign out all sessions
        </button>
        <MutationMessage state={message} />
      </section>
    </div>
  );
}

type DataDto = {
  operations: Array<{
    id: string;
    label: string;
    status: "AVAILABLE" | "PROVIDER_DEPENDENT" | "NOT_CURRENTLY_SUPPORTED" | "REQUIRES_REAUTHENTICATION";
    href: string | null;
    reason: string;
  }>;
};
export function DataAccount() {
  const { state, reload } = useResource<DataDto>("/api/account/data");
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState message={state.message} retry={reload} />;
  return (
    <section className="harbor-panel">
      <h2>Data & account operations</h2>
      <p>
        Availability is stated from accepted services. An unavailable operation is not represented by a decorative
        button.
      </p>
      <ul className="harbor-availability-list">
        {state.value.operations.map((operation) => (
          <li key={operation.id}>
            <div>
              <span className={`harbor-badge harbor-badge--${operation.status.toLowerCase()}`}>
                {operation.status.replaceAll("_", " ")}
              </span>
              <h3>{operation.label}</h3>
              <p>{operation.reason}</p>
            </div>
            {operation.href && (
              <Link className="button" href={operation.href}>
                Open
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
