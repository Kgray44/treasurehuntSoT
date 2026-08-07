"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";
import { usePersonalHarbor } from "@/components/homeport/PersonalHarborLayout";
import { CroppedProfileImage, ProfileCropEditor, type CropValue } from "@/components/homeport/ProfileCropEditor";
import {
  ErrorState as SharedErrorState,
  LoadingState as SharedLoadingState,
  MutationStatus,
} from "@/components/ui/AsyncState";
import { ResilientImage } from "@/components/ui/ResilientImage";
import { useActionDialog } from "@/components/ui/ActionDialog";
import { applyRuntimePreferences, publishRuntimePreferences } from "@/homeport/preference-runtime";

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
    // A generation change deliberately returns the resource to its loading state before refetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  return <SharedLoadingState compact title={label} detail="Reading the latest account state from Voyagewright." />;
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <SharedErrorState
      title="This section is unavailable"
      detail={message}
      action={{ label: "Try again", onClick: retry }}
    />
  );
}

function MutationMessage({
  state,
}: {
  state: { kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string };
}) {
  if (state.kind === "idle") return null;
  return (
    <MutationStatus
      state={
        state.kind === "saving"
          ? "pending"
          : state.kind === "saved"
            ? "success"
            : state.kind === "stale"
              ? "conflict"
              : "failure"
      }
    >
      {state.message ?? (state.kind === "saving" ? "Saving…" : "Saved.")}
    </MutationStatus>
  );
}

type OverviewDto = {
  profile: {
    displayName: string;
    handle: string | null;
    biography: string | null;
    defaultVisibility: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    setupPrompt: { title: string; detail: string; href: string } | null;
  };
  workspaces: Array<{ id: string; label: string; state: string }>;
  counts: Record<"linkedIdentities" | "activeSessions" | "history" | "memories" | "artifacts" | "saved", number>;
  destinations: Array<{ sectionId: string; label: string; href: string; group: string }>;
};

export function AccountOverview() {
  const { state, reload } = useResource<OverviewDto>("/api/account/overview");
  if (state.status === "loading") return <LoadingState label="Preparing your Personal Harbor" />;
  if (state.status === "error") return <ErrorState message={state.message} retry={reload} />;
  const { profile, counts, destinations, workspaces } = state.value;
  return (
    <div className="harbor-stack">
      <section className="harbor-identity-hero" aria-labelledby="profile-overview-identity">
        <div className="harbor-identity-hero__banner">
          {profile.bannerUrl ? (
            <ResilientImage src={profile.bannerUrl} alt="" fallbackLabel="Profile banner unavailable" />
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
        <div className="harbor-identity-hero__body">
          <div className="harbor-identity-hero__avatar">
            {profile.avatarUrl ? (
              <ResilientImage src={profile.avatarUrl} alt="" fallbackLabel="Profile avatar unavailable" />
            ) : (
              <b aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</b>
            )}
          </div>
          <div className="harbor-identity-hero__copy">
            <p className="personal-harbor__eyebrow">Profile Overview</p>
            <h2 id="profile-overview-identity">{profile.displayName}</h2>
            <p className="harbor-identity-hero__handle">
              {profile.handle ? `@${profile.handle}` : "Private handle not configured"}
            </p>
            {profile.biography ? <p>{profile.biography}</p> : null}
            <p className="harbor-field-hint">Default visibility: {profile.defaultVisibility.replaceAll("_", " ")}</p>
          </div>
          <ul className="harbor-identity-hero__workspaces" aria-label="Workspace entry">
            {workspaces.map((workspace) => (
              <li key={workspace.id} data-state={workspace.state}>
                {workspace.label}
              </li>
            ))}
          </ul>
          <nav className="harbor-identity-hero__actions" aria-label="Profile actions">
            <Link className="button button--primary" href="/account/profile">
              Edit Public Profile
            </Link>
            {profile.handle ? (
              <Link className="button" href={`/profile/${encodeURIComponent(profile.handle)}`}>
                View Public Profile
              </Link>
            ) : null}
            <Link className="button" href="/account/personal-information">
              Personal Information
            </Link>
            <Link className="button" href="/passport">
              Chronicle Passport
            </Link>
          </nav>
        </div>
      </section>
      {profile.setupPrompt ? (
        <aside className="harbor-setup-prompt">
          <div>
            <strong>{profile.setupPrompt.title}</strong>
            <p>{profile.setupPrompt.detail}</p>
          </div>
          <Link className="button button--quiet" href={profile.setupPrompt.href}>
            Set handle
          </Link>
        </aside>
      ) : null}
      <section aria-labelledby="harbor-at-a-glance">
        <h2 id="harbor-at-a-glance">At a glance</h2>
        <div className="harbor-stat-grid">
          {[
            ["Chronicle history", counts.history],
            ["Memories", counts.memories],
            ["Artifacts", counts.artifacts],
            ["Saved", counts.saved],
            ["Linked identities", counts.linkedIdentities],
            ["Signed-in sessions", counts.activeSessions],
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
  avatar: {
    id: string;
    url: string;
    altText: string | null;
    processingState: "READY";
    crop: CropValue;
  } | null;
  banner: {
    id: string;
    url: string;
    altText: string | null;
    processingState: "READY";
    crop: CropValue;
  } | null;
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

export function ProfileEditor({ returnTo }: { returnTo?: string } = {}) {
  const { requestAction, dialog } = useActionDialog();
  const resource = useResource<ProfileDto>("/api/passport/profile");
  const { setDirty, csrfToken } = usePersonalHarbor();
  const { invalidate } = useCurrentUser();
  const [draft, setDraft] = useState<ProfileDto | null>(null);
  const [preview, setPreview] = useState<LoadState<PublicPreview> | null>(null);
  const [selection, setSelection] = useState<{
    kind: "AVATAR" | "BANNER";
    file: File;
    previewUrl: string;
    crop: CropValue;
    expectedMediaId: string | null;
    confirmed: boolean;
  } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );

  useEffect(() => {
    // Editable drafts intentionally hydrate only after the authoritative resource resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resource.state.status === "ready") setDraft(resource.state.value);
  }, [resource.state]);
  useEffect(() => () => setDirty(false), [setDirty]);
  useEffect(() => {
    const url = selection?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [selection?.previewUrl]);

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
    // The preview is a second authoritative projection triggered by the resolved owner record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resource.state.status === "ready") void loadPreview(resource.state.value);
  }, [resource.state]);

  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  if (resource.state.status === "loading" || !draft) return <LoadingState label="Loading your Profile" />;

  const change = <K extends keyof Pick<ProfileDto, "handle" | "biography" | "defaultVisibility">>(
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
      if (returnTo && value.handle && value.defaultVisibility === "PUBLIC") window.location.assign(returnTo);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Profile could not be saved.";
      setMutation({ kind: message.includes("another window") ? "stale" : "error", message });
    }
  };
  const chooseFile = (kind: "AVATAR" | "BANNER", file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8_000_000) {
      setMutation({ kind: "error", message: "Choose a PNG, JPEG, or WebP image no larger than 8 MB." });
      return;
    }
    setMutation({ kind: "idle" });
    setSelection({
      kind,
      file,
      previewUrl: URL.createObjectURL(file),
      crop: { centerX: 0.5, centerY: 0.5, scale: 1, rotation: 0 },
      expectedMediaId: kind === "AVATAR" ? (draft.avatar?.id ?? null) : (draft.banner?.id ?? null),
      confirmed: false,
    });
  };
  const adjustExisting = async (kind: "AVATAR" | "BANNER", media: NonNullable<ProfileDto["avatar"]>) => {
    setMutation({ kind: "saving", message: "Loading the private original for crop adjustment…" });
    try {
      const response = await fetch(`/api/passport/media/original?id=${encodeURIComponent(media.id)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("The private original could not be loaded.");
      const blob = await response.blob();
      const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const file = new File([blob], `profile-${kind.toLocaleLowerCase("en-US")}.${extension}`, { type: blob.type });
      setSelection({
        kind,
        file,
        previewUrl: URL.createObjectURL(blob),
        crop: media.crop,
        expectedMediaId: media.id,
        confirmed: false,
      });
      setMutation({ kind: "idle" });
    } catch (cause) {
      setMutation({
        kind: "error",
        message: cause instanceof Error ? cause.message : "The saved crop could not be adjusted.",
      });
    }
  };
  const upload = async () => {
    if (!selection) return;
    const { kind, file, crop, expectedMediaId } = selection;
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
          body: JSON.stringify({
            kind,
            dataUrl,
            crop,
            expectedMediaId,
            altText: kind === "AVATAR" ? "Profile avatar" : "Profile banner",
          }),
        }),
      );
      setDirty(false);
      setMutation({ kind: "saved", message: "Image normalized and stored. The public projection has been refreshed." });
      setSelection(null);
      await invalidate();
      resource.reload();
    } catch (cause) {
      setMutation({ kind: "error", message: cause instanceof Error ? cause.message : "Image processing failed." });
    }
  };
  const remove = async (media: NonNullable<ProfileDto["avatar"]>, label: string) => {
    if (
      !(await requestAction({
        title: `Remove this ${label}?`,
        detail: "Your Profile will use its safe fallback immediately.",
        confirmLabel: `Remove ${label}`,
        destructive: true,
      }))
    )
      return false;
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
      return true;
    } catch (cause) {
      setMutation({ kind: "error", message: cause instanceof Error ? cause.message : "Image removal failed." });
      return false;
    }
  };

  return (
    <>
      <div className="harbor-profile-grid">
        <form className="harbor-panel harbor-form" onSubmit={save}>
          <div>
            <p className="personal-harbor__eyebrow">Owner controls</p>
            <h2>Edit public Profile</h2>
            <p>Only the server-enforced public projection appears in the preview.</p>
          </div>
          <div className="harbor-readonly-field">
            <span>Display name</span>
            <strong>{draft.displayName}</strong>
            <small>
              This account-wide identity is managed in{" "}
              <Link href="/account/personal-information">Personal Information</Link>.
            </small>
          </div>
          <label>
            Handle<span className="harbor-field-hint">Lowercase letters, numbers, and internal hyphens.</span>
            <input
              value={draft.handle ?? ""}
              maxLength={32}
              onChange={(event) => change("handle", event.target.value)}
            />
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
            <select
              value={draft.defaultVisibility}
              onChange={(event) => change("defaultVisibility", event.target.value)}
            >
              <option value="ONLY_ME">Only me</option>
              <option value="CREW_ONLY">Crew only</option>
              <option value="REGISTERED_USERS">Registered members</option>
              <option value="PUBLIC">Public</option>
              <option value="UNLISTED">Unlisted</option>
            </select>
          </label>
          <fieldset className="harbor-media-fields">
            <legend>Profile imagery</legend>
            <div className="harbor-media-upload">
              <div>
                <span className="harbor-media-upload__title" id="profile-avatar-label">
                  Avatar image
                </span>
                <span className="harbor-field-hint">
                  {draft.avatar ? "A stored avatar is ready. Choose a file to replace it." : "No avatar is stored yet."}
                </span>
              </div>
              <div
                className="harbor-media-inline-preview harbor-media-inline-preview--avatar"
                aria-label="Current avatar preview"
              >
                {selection?.kind === "AVATAR" ? (
                  <CroppedProfileImage
                    kind="AVATAR"
                    previewUrl={selection.previewUrl}
                    crop={selection.crop}
                    alt="Pending avatar crop preview"
                  />
                ) : draft.avatar ? (
                  <ResilientImage src={draft.avatar.url} alt="" fallbackLabel="Avatar unavailable" />
                ) : (
                  <b aria-hidden="true">{draft.displayName.slice(0, 1).toUpperCase()}</b>
                )}
              </div>
              <input
                ref={avatarInputRef}
                id="profile-avatar-file"
                className="harbor-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-labelledby="profile-avatar-label"
                onClick={(event) => {
                  event.currentTarget.value = "";
                }}
                onChange={(event) => chooseFile("AVATAR", event.target.files?.[0])}
              />
              <label className="harbor-media-upload__trigger" htmlFor="profile-avatar-file">
                Choose avatar image
              </label>
              <small>{selection?.kind === "AVATAR" ? "PENDING_LOCAL" : draft.avatar ? "READY" : "No avatar"}</small>
            </div>
            {selection?.kind === "AVATAR" && selection.confirmed ? (
              <div className="harbor-media-field-actions" aria-label="Pending avatar actions">
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => setSelection((current) => (current ? { ...current, confirmed: false } : current))}
                >
                  Adjust pending crop
                </button>
                <button type="button" className="button button--primary" onClick={() => void upload()}>
                  Save avatar image
                </button>
                <button type="button" className="button button--quiet" onClick={() => setSelection(null)}>
                  Discard selection
                </button>
              </div>
            ) : null}
            {draft.avatar && (
              <div className="harbor-media-field-actions">
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => void adjustExisting("AVATAR", draft.avatar!)}
                >
                  Adjust avatar crop
                </button>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => void remove(draft.avatar!, "avatar")}
                >
                  Remove avatar
                </button>
              </div>
            )}
            <div className="harbor-media-upload">
              <div>
                <span className="harbor-media-upload__title" id="profile-banner-label">
                  Banner image
                </span>
                <span className="harbor-field-hint">
                  {draft.banner ? "A stored banner is ready. Choose a file to replace it." : "No banner is stored yet."}
                </span>
              </div>
              <div
                className="harbor-media-inline-preview harbor-media-inline-preview--banner"
                aria-label="Current banner preview"
              >
                {selection?.kind === "BANNER" ? (
                  <CroppedProfileImage
                    kind="BANNER"
                    previewUrl={selection.previewUrl}
                    crop={selection.crop}
                    alt="Pending banner crop preview"
                  />
                ) : draft.banner ? (
                  <ResilientImage src={draft.banner.url} alt="" fallbackLabel="Banner unavailable" />
                ) : (
                  <b aria-hidden="true">Dark banner fallback</b>
                )}
              </div>
              <input
                ref={bannerInputRef}
                id="profile-banner-file"
                className="harbor-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-labelledby="profile-banner-label"
                onClick={(event) => {
                  event.currentTarget.value = "";
                }}
                onChange={(event) => chooseFile("BANNER", event.target.files?.[0])}
              />
              <label className="harbor-media-upload__trigger" htmlFor="profile-banner-file">
                Choose banner image
              </label>
              <small>{selection?.kind === "BANNER" ? "PENDING_LOCAL" : draft.banner ? "READY" : "No banner"}</small>
            </div>
            {selection?.kind === "BANNER" && selection.confirmed ? (
              <div className="harbor-media-field-actions" aria-label="Pending banner actions">
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => setSelection((current) => (current ? { ...current, confirmed: false } : current))}
                >
                  Adjust pending crop
                </button>
                <button type="button" className="button button--primary" onClick={() => void upload()}>
                  Save banner image
                </button>
                <button type="button" className="button button--quiet" onClick={() => setSelection(null)}>
                  Discard selection
                </button>
              </div>
            ) : null}
            {draft.banner && (
              <div className="harbor-media-field-actions">
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => void adjustExisting("BANNER", draft.banner!)}
                >
                  Adjust banner crop
                </button>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => void remove(draft.banner!, "banner")}
                >
                  Remove banner
                </button>
              </div>
            )}
            <p className="harbor-field-hint">
              PNG, JPEG, or WebP is normalized into bounded private Profile storage. No external malware-scanner result
              is claimed by this flow.
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
                <ResilientImage
                  src={preview.value.bannerUrl}
                  alt=""
                  className="public-profile-preview__banner"
                  fallbackLabel="Profile banner unavailable"
                />
              )}
              {preview.value.avatarUrl ? (
                <ResilientImage
                  src={preview.value.avatarUrl}
                  alt="Profile avatar"
                  className="public-profile-preview__avatar"
                  fallbackLabel="Profile avatar unavailable"
                />
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
      {selection && !selection.confirmed ? (
        <ProfileCropEditor
          kind={selection.kind}
          previewUrl={selection.previewUrl}
          value={selection.crop}
          hasExisting={Boolean(selection.kind === "AVATAR" ? draft.avatar : draft.banner)}
          busy={mutation.kind === "saving"}
          onChange={(crop) => setSelection((current) => (current ? { ...current, crop } : current))}
          onSave={() => {
            setSelection((current) => (current ? { ...current, confirmed: true } : current));
            setMutation({ kind: "idle" });
          }}
          onReplace={() => {
            const input = selection.kind === "AVATAR" ? avatarInputRef.current : bannerInputRef.current;
            if (input) {
              input.value = "";
              input.click();
            }
          }}
          onCancel={() => setSelection(null)}
          onRemove={() => {
            const media = selection.kind === "AVATAR" ? draft.avatar : draft.banner;
            if (media)
              void remove(media, selection.kind.toLocaleLowerCase("en-US")).then(
                (removed) => removed && setSelection(null),
              );
          }}
        />
      ) : null}
      {dialog}
    </>
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
  const { setDirty, csrfToken } = usePersonalHarbor();
  const [name, setName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [nextEmail, setNextEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );
  const [emailMutation, setEmailMutation] = useState<{
    kind: "idle" | "saving" | "saved" | "error" | "stale";
    message?: string;
  }>({ kind: "idle" });
  useEffect(() => {
    // Editable personal information intentionally hydrates after the server resource resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (info.state.status === "ready") setName(info.state.value.displayName);
  }, [info.state]);
  useEffect(() => {
    setDirty(nameDirty || emailDirty);
    return () => setDirty(false);
  }, [emailDirty, nameDirty, setDirty]);
  if (info.state.status === "loading") return <LoadingState />;
  if (info.state.status === "error") return <ErrorState message={info.state.message} retry={info.reload} />;
  const currentRevision = info.state.value.revision;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMutation({ kind: "saving" });
    try {
      const value = await responseBody<PersonalInfoDto>(
        await fetch("/api/account/personal-information", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ displayName: name, expectedRevision: currentRevision }),
        }),
      );
      info.setState({ status: "ready", value });
      setNameDirty(false);
      setMutation({ kind: "saved", message: "Personal information saved." });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save.";
      setMutation({ kind: message.includes("another window") ? "stale" : "error", message });
    }
  };
  const requestEmail = async (event: FormEvent) => {
    event.preventDefault();
    setEmailMutation({ kind: "saving", message: "Preparing a verified email change…" });
    try {
      const result = await responseBody<{ ok: true; message: string }>(
        await fetch("/api/account/email/change/request", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({ email: nextEmail, password }),
        }),
      );
      setNextEmail("");
      setPassword("");
      setEmailDirty(false);
      setEmailMutation({ kind: "saved", message: result.message });
    } catch (cause) {
      setEmailMutation({
        kind: "error",
        message: cause instanceof Error ? cause.message : "The email change could not be prepared.",
      });
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
              setNameDirty(true);
              setMutation({ kind: "idle" });
            }}
          />
        </label>
        <div className="harbor-readonly-field">
          <span>Primary email</span>
          <strong>{value.primaryEmail ?? "No primary email is available"}</strong>
          <small>{value.emailVerificationState === "VERIFIED" ? "Verified" : value.emailVerificationState}</small>
        </div>
        <MutationMessage state={mutation} />
        <button className="button button--primary" disabled={mutation.kind === "saving"}>
          Save display name
        </button>
      </form>
      <form className="harbor-panel harbor-form" onSubmit={requestEmail}>
        <div>
          <p className="personal-harbor__eyebrow">Verified account change</p>
          <h2>Change primary email</h2>
          <p>
            Re-enter your password, then verify the new address. Existing sessions are revoked after confirmation, and
            the previous address receives a security notice.
          </p>
        </div>
        <label>
          New email address
          <input
            type="email"
            autoComplete="email"
            value={nextEmail}
            required
            onChange={(event) => {
              setNextEmail(event.target.value);
              setEmailDirty(true);
              setEmailMutation({ kind: "idle" });
            }}
          />
        </label>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            required
            onChange={(event) => {
              setPassword(event.target.value);
              setEmailDirty(true);
              setEmailMutation({ kind: "idle" });
            }}
          />
        </label>
        <MutationMessage state={emailMutation} />
        <button className="button button--primary" disabled={emailMutation.kind === "saving"}>
          Send verification link
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
  const { state: currentUser } = useCurrentUser();
  const { setDirty, csrfToken } = usePersonalHarbor();
  const [draft, setDraft] = useState<PreferencesDto | null>(null);
  const savedPreferences = useRef<Preferences | null>(null);
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );
  useEffect(() => {
    // Editable preference drafts intentionally hydrate from the authoritative async DTO.
    if (resource.state.status === "ready") {
      savedPreferences.current = resource.state.value.preferences;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(resource.state.value);
    }
  }, [resource.state]);
  useEffect(() => () => setDirty(false), [setDirty]);
  useEffect(() => {
    if (draft) applyRuntimePreferences(draft.preferences);
  }, [draft]);
  useEffect(
    () => () => {
      if (savedPreferences.current) applyRuntimePreferences(savedPreferences.current);
    },
    [],
  );
  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  if (resource.state.status === "loading" || !draft) return <LoadingState />;
  if (mode === "notifications")
    return (
      <section className="harbor-panel">
        <p className="personal-harbor__eyebrow">Delivery truth</p>
        <h2>Notifications</h2>
        <div className="harbor-callout">
          <strong>There are no configurable notification channels yet.</strong>
          <p>
            Voyagewright will add controls here only when an in-product inbox or verified external delivery adapter is
            available and enforced end to end. Stored legacy intents are preserved privately but are not presented as
            working controls.
          </p>
        </div>
      </section>
    );
  const update = (next: Preferences) => {
    setDraft({ ...draft, preferences: next });
    setDirty(true);
    setMutation({ kind: "idle" });
  };
  const exp = (patch: Partial<Preferences["experience"]>) =>
    update({ ...draft.preferences, experience: { ...draft.preferences.experience, ...patch } });
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
      savedPreferences.current = value.preferences;
      resource.setState({ status: "ready", value });
      setDirty(false);
      if (currentUser.status === "authenticated")
        publishRuntimePreferences(currentUser.user.accountId, value.preferences);
      setMutation({ kind: "saved", message: "Preferences saved and applied." });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Preferences could not be saved.";
      setMutation({ kind: message.includes("another window") ? "stale" : "error", message });
    }
  };
  const title = mode === "accessibility" ? "Accessibility preferences" : "Experience preferences";
  return (
    <form className="harbor-panel harbor-form" onSubmit={save}>
      <h2>{title}</h2>
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
      </>
      {mode === "accessibility" && (
        <div className="harbor-callout">
          <strong>Browser and operating-system accessibility settings remain authoritative.</strong>
          <p>
            Reduced motion and forced colors override a conflicting account preference. Reduced mode renders the
            semantic final state immediately.
          </p>
        </div>
      )}
      <MutationMessage state={mutation} />
      {mutation.kind === "stale" && (
        <button type="button" className="button" onClick={resource.reload}>
          Reload saved preferences
        </button>
      )}
      <button className="button button--primary" disabled={mutation.kind === "saving"}>
        Save preferences
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
    // Editable privacy drafts intentionally hydrate from the authoritative async DTO.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
type ProviderDto = {
  provider: string;
  name: string;
  available: boolean;
  link: boolean;
  status: string;
  externalApproval: string;
};
export function LinkedIdentities() {
  const resource = useResource<{
    identities: IdentityDto[];
    adapters: ProviderDto[];
    unlinkReauthentication: { method: "PASSWORD" | "RECENT_SESSION"; recent: boolean };
  }>("/api/passport/providers");
  const { csrfToken } = usePersonalHarbor();
  const [unlinkTarget, setUnlinkTarget] = useState<IdentityDto | null>(null);
  const [connectTarget, setConnectTarget] = useState<ProviderDto | null>(null);
  const [unlinkPassword, setUnlinkPassword] = useState("");
  const [message, setMessage] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>({
    kind: "idle",
  });
  if (resource.state.status === "loading") return <LoadingState />;
  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  const providerResource = resource.state.value;
  const linked = providerResource.identities.filter((identity) => identity.status === "LINKED" && !identity.revokedAt);
  const unlink = async (event: FormEvent) => {
    event.preventDefault();
    if (!unlinkTarget) return;
    setMessage({ kind: "saving", message: "Unlinking identity…" });
    try {
      await responseBody(
        await fetch("/api/passport/providers", {
          method: "DELETE",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify({
            id: unlinkTarget.id,
            ...(providerResource.unlinkReauthentication.method === "PASSWORD" ? { password: unlinkPassword } : {}),
          }),
        }),
      );
      setMessage({ kind: "saved", message: "Identity unlinked." });
      setUnlinkTarget(null);
      setUnlinkPassword("");
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
    <>
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
                      {identity.provider.replaceAll("_", " ")} · linked{" "}
                      {new Date(identity.linkedAt).toLocaleDateString()}
                      {identity.useForLogin ? " · login enabled" : ""}
                    </span>
                  </div>
                  <button type="button" className="button button--danger" onClick={() => setUnlinkTarget(identity)}>
                    Unlink…
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="harbor-empty">
              No external identities are linked. Your account credential remains the login authority.
            </p>
          )}
          {unlinkTarget && (
            <form className="harbor-reauth" onSubmit={unlink}>
              <h3>Confirm identity unlink</h3>
              <p>
                {providerResource.unlinkReauthentication.method === "PASSWORD"
                  ? `Re-enter your password to unlink ${unlinkTarget.displayName || unlinkTarget.provider}.`
                  : providerResource.unlinkReauthentication.recent
                    ? `Your recent provider sign-in will reauthenticate this unlink of ${unlinkTarget.displayName || unlinkTarget.provider}.`
                    : "Sign out and sign in again with a connected provider before unlinking an identity."}{" "}
                Voyagewright will reject the change if it would remove your last usable login method.
              </p>
              {providerResource.unlinkReauthentication.method === "PASSWORD" ? (
                <label>
                  Current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={unlinkPassword}
                    onChange={(event) => setUnlinkPassword(event.target.value)}
                    required
                  />
                </label>
              ) : null}
              <div className="personal-harbor__actions">
                <button
                  className="button button--danger"
                  disabled={
                    message.kind === "saving" ||
                    (providerResource.unlinkReauthentication.method === "RECENT_SESSION" &&
                      !providerResource.unlinkReauthentication.recent)
                  }
                >
                  Unlink identity
                </button>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => {
                    setUnlinkTarget(null);
                    setUnlinkPassword("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <MutationMessage state={message} />
        </section>
        <section className="harbor-panel">
          <h2>Available connections</h2>
          {providerResource.adapters.length ? (
            <ul className="harbor-list">
              {providerResource.adapters.map((provider) => (
                <li key={provider.provider}>
                  <div>
                    <strong>{provider.name}</strong>
                    <span>
                      {provider.available && provider.link
                        ? "Configured and available in this environment"
                        : `Unavailable here — requires ${provider.externalApproval}.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setConnectTarget(provider)}
                    disabled={!provider.available || !provider.link}
                  >
                    {provider.available && provider.link ? "Connect" : "Unavailable"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {connectTarget ? (
            <section className="harbor-reauth" aria-labelledby="provider-connect-confirmation">
              <h3 id="provider-connect-confirmation">Connect {connectTarget.name}?</h3>
              <p>
                Continue only if you intend to add this {connectTarget.name} identity as a sign-in method for the
                current Voyagewright account. An identity already owned by another account will be refused.
              </p>
              <div className="personal-harbor__actions">
                <button
                  type="button"
                  className="button button--primary"
                  disabled={message.kind === "saving"}
                  onClick={() => void begin(connectTarget)}
                >
                  Continue to {connectTarget.name}
                </button>
                <button type="button" className="button button--quiet" onClick={() => setConnectTarget(null)}>
                  Cancel
                </button>
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </>
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
  const { requestAction, dialog } = useActionDialog();
  const resource = useResource<{ sessions: SessionDto[] }>("/api/auth/sessions");
  const { csrfToken } = usePersonalHarbor();
  const { invalidate } = useCurrentUser();
  const [message, setMessage] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>({
    kind: "idle",
  });
  if (resource.state.status === "loading") return <LoadingState />;
  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  const revoke = async (session: SessionDto) => {
    if (
      !(await requestAction({
        title: session.current ? "Revoke this current session?" : "Revoke this session?",
        detail: session.current
          ? "This device will return to sign-in. Voyage and Chronicle records will not change."
          : "That device will need to sign in again. Voyage and Chronicle records will not change.",
        confirmLabel: "Revoke Session",
        destructive: true,
      }))
    )
      return;
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
    if (
      !(await requestAction({
        title: "Sign out every session?",
        detail:
          "Every accepted AccountSession, including this device, will be revoked. Tale Sessions and Voyage records remain unchanged.",
        confirmLabel: "Sign Out Everywhere",
        destructive: true,
      }))
    )
      return;
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
    <>
      <div className="harbor-stack">
        <section className="harbor-panel">
          <h2>Current session</h2>
          {current ? (
            <ul className="harbor-list">{card(current)}</ul>
          ) : (
            <p className="harbor-empty">The current session is no longer signed in.</p>
          )}
        </section>
        <section className="harbor-panel">
          <h2>Other sessions</h2>
          {others.length ? (
            <ul className="harbor-list">{others.map(card)}</ul>
          ) : (
            <p className="harbor-empty">No other signed-in sessions.</p>
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
      {dialog}
    </>
  );
}

type AccountExportDto = {
  id: string;
  state: string;
  schemaVersion: number;
  checksum: string | null;
  requestedAt: string;
  readyAt: string | null;
  expiresAt: string | null;
  downloadedAt: string | null;
  failureSummary: string | null;
  downloadHref: string | null;
};
type DataDto = {
  policy: { exportTtlHours: number; reactivationWindowDays: number; deletionDelayDays: number };
  exports: AccountExportDto[];
  lifecycle: Array<{
    id: string;
    kind: string;
    state: string;
    requestedAt: string;
    scheduledFor: string | null;
    cancellableUntil: string | null;
    canceledAt: string | null;
    completedAt: string | null;
  }>;
};
export function DataAccount() {
  const resource = useResource<DataDto>("/api/account/data");
  const { csrfToken } = usePersonalHarbor();
  const { invalidate } = useCurrentUser();
  const [exportPassword, setExportPassword] = useState("");
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivateConfirmation, setDeactivateConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );
  if (resource.state.status === "loading") return <LoadingState />;
  if (resource.state.status === "error") return <ErrorState message={resource.state.message} retry={resource.reload} />;
  const run = async (url: string, body: Record<string, string>, recoveryPath?: string) => {
    setMutation({ kind: "saving", message: "Applying the verified account request…" });
    try {
      await responseBody(
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify(body),
        }),
      );
      if (recoveryPath) {
        sessionStorage.removeItem("wayfarer-csrf");
        await invalidate();
        window.location.assign(recoveryPath);
        return;
      }
      setExportPassword("");
      setMutation({ kind: "saved", message: "Your export is ready for a limited time." });
      resource.reload();
    } catch (cause) {
      setMutation({
        kind: "error",
        message: cause instanceof Error ? cause.message : "The account request could not be completed.",
      });
    }
  };
  const value = resource.state.value;
  return (
    <div className="harbor-stack">
      <section className="harbor-panel">
        <p className="personal-harbor__eyebrow">Portable account record</p>
        <h2>Export my data</h2>
        <p>
          A private JSON export is built from your current account, Profile, roles, linked-identity labels, Community
          activity, and saved records. Provider tokens and credential hashes are excluded. Downloads expire after{" "}
          {value.policy.exportTtlHours} hours.
        </p>
        <form
          className="harbor-form harbor-form--inline"
          onSubmit={(event) => {
            event.preventDefault();
            void run("/api/account/data/export", { password: exportPassword });
          }}
        >
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={exportPassword}
              onChange={(event) => setExportPassword(event.target.value)}
              required
            />
          </label>
          <button className="button button--primary" disabled={mutation.kind === "saving"}>
            Create export
          </button>
        </form>
        {value.exports.length ? (
          <ul className="harbor-list harbor-export-list">
            {value.exports.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.state.replaceAll("_", " ")}</strong>
                  <span>Requested {new Date(item.requestedAt).toLocaleString()}</span>
                  {item.expiresAt ? <span>Expires {new Date(item.expiresAt).toLocaleString()}</span> : null}
                  {item.checksum ? <code title="SHA-256 checksum">{item.checksum}</code> : null}
                </div>
                {item.downloadHref ? (
                  <a className="button" href={item.downloadHref} download>
                    Download JSON
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="harbor-empty">No data exports have been requested.</p>
        )}
      </section>

      <section className="harbor-panel harbor-danger-zone">
        <p className="personal-harbor__eyebrow">Reversible account pause</p>
        <h2>Deactivate account</h2>
        <p>
          Deactivation signs out every device and leaves active Player memberships. Chronicle authorship, Voyage
          history, Community records, and security audit history remain intact. You can reactivate for{" "}
          {value.policy.reactivationWindowDays} days.
        </p>
        <form
          className="harbor-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              "/api/account/data/deactivate",
              { password: deactivatePassword, confirmation: deactivateConfirmation },
              "/account/reactivate?state=deactivated",
            );
          }}
        >
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={deactivatePassword}
              onChange={(event) => setDeactivatePassword(event.target.value)}
              required
            />
          </label>
          <label>
            Type DEACTIVATE
            <input
              value={deactivateConfirmation}
              onChange={(event) => setDeactivateConfirmation(event.target.value)}
              pattern="DEACTIVATE"
              required
            />
          </label>
          <button className="button button--danger" disabled={mutation.kind === "saving"}>
            Deactivate account
          </button>
        </form>
      </section>

      <section className="harbor-panel harbor-danger-zone harbor-danger-zone--final">
        <p className="personal-harbor__eyebrow">Delayed destructive request</p>
        <h2>Delete account</h2>
        <p>
          Deletion is scheduled {value.policy.deletionDelayDays} days from confirmation. Every device is signed out and
          active Player memberships are left immediately. You can cancel before the deadline. At execution, direct
          account identifiers and Profile presentation are anonymized; minimum integrity, safety, and audit records are
          retained as tombstoned history. Create and download a private export above first if you want a personal copy.
        </p>
        <form
          className="harbor-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              "/api/account/data/delete",
              { password: deletePassword, confirmation: deleteConfirmation },
              "/account/cancel-deletion?state=scheduled",
            );
          }}
        >
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              required
            />
          </label>
          <label>
            Type DELETE ACCOUNT
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              pattern="DELETE ACCOUNT"
              required
            />
          </label>
          <button className="button button--danger" disabled={mutation.kind === "saving"}>
            Schedule account deletion
          </button>
        </form>
      </section>
      <MutationMessage state={mutation} />
    </div>
  );
}

export function AccountLifecycleRecovery({ mode }: { mode: "reactivate" | "cancel-deletion" }) {
  const { invalidate } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mutation, setMutation] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "stale"; message?: string }>(
    { kind: "idle" },
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMutation({ kind: "saving", message: mode === "reactivate" ? "Reactivating account…" : "Canceling deletion…" });
    try {
      const result = await responseBody<{ ok: true; next: string }>(
        await fetch(`/api/auth/account/${mode}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, ...(mode === "cancel-deletion" ? { confirmation } : {}) }),
        }),
      );
      await invalidate();
      window.location.assign(result.next);
    } catch (cause) {
      setMutation({
        kind: "error",
        message: cause instanceof Error ? cause.message : "The recovery request could not be completed.",
      });
    }
  };
  return (
    <main className="platform-auth account-flow-page">
      <div className="auth-ledger">
        <p className="eyebrow">Voyagewright account recovery</p>
        <h1>{mode === "reactivate" ? "Reactivate your account" : "Cancel account deletion"}</h1>
        <p>
          {mode === "reactivate"
            ? "Use the verified primary email and password during the recovery window. Your retained account history and workspaces become available again."
            : "Use the verified primary email and password before the scheduled deletion deadline to restore the account."}
        </p>
        <form onSubmit={submit}>
          <label>
            <span>Primary email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {mode === "cancel-deletion" ? (
            <label>
              <span>Type CANCEL DELETION</span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                pattern="CANCEL DELETION"
                required
              />
            </label>
          ) : null}
          <button className="brass-button" disabled={mutation.kind === "saving"}>
            {mode === "reactivate" ? "Reactivate account" : "Cancel deletion"}
          </button>
        </form>
        <MutationMessage state={mutation} />
        <Link href="/sign-in">Return to sign in</Link>
      </div>
    </main>
  );
}
