"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";

function slugify(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function NewTaleForm({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const { mode } = useMotionMode();
  const routeMotion = resolvePlatformMotionToken("route", mode);
  const [csrf, setCsrf] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "creating" | "uploading" | "assigning" | "routing" | "failed">("idle");
  useEffect(() => {
    if (authenticated)
      void fetch("/api/studio/tales")
        .then((response) => response.json())
        .then((body: { csrfToken?: string }) => setCsrf(body.csrfToken ?? ""));
  }, [authenticated]);
  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <section>
          <h1>Creator authentication required</h1>
          <Link className="brass-button" href="/quartermaster">
            Open Quartermaster login
          </Link>
        </section>
      </main>
    );
  return (
    <main className="new-tale-page">
      <motion.form
        className="new-tale-sheet"
        data-creation-phase={phase}
        initial={mode === "reduced" ? false : { opacity: 0, y: routeMotion.distancePx }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: routeMotion.durationSeconds, ease: platformMotionEasing("route") }}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setPhase("creating");
          setError("");
          const values = Object.fromEntries(new FormData(event.currentTarget));
          const response = await fetch("/api/studio/tales", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
            body: JSON.stringify({
              ...values,
              title,
              slug,
              playerCountMin: Number(values.playerCountMin),
              playerCountMax: Number(values.playerCountMax),
              estimatedDuration: Number(values.estimatedDuration) || undefined,
            }),
          });
          const body = (await response.json()) as { id?: string; error?: string };
          if (!response.ok || !body.id) {
            setError(body.error ?? "The new tale could not be created.");
            setBusy(false);
            setPhase("failed");
            return;
          }
          if (coverFile) {
            setPhase("uploading");
            const upload = new FormData();
            upload.append("files", coverFile);
            const uploadResponse = await fetch(`/api/studio/tales/${body.id}/assets`, {
              method: "POST",
              headers: { "x-csrf-token": csrf },
              body: upload,
            });
            const uploaded = (await uploadResponse.json()) as {
              assets?: Array<{ asset?: { id?: string } }>;
              error?: string;
            };
            const coverAssetId = uploaded.assets?.[0]?.asset?.id;
            if (!uploadResponse.ok || !coverAssetId) {
              setError(
                `The tale was created, but its cover could not be uploaded: ${uploaded.error ?? "unknown upload error"}`,
              );
              setBusy(false);
              setPhase("failed");
              return;
            }
            setPhase("assigning");
            const studioResponse = await fetch(`/api/studio/tales/${body.id}`, { cache: "no-store" });
            const studio = (await studioResponse.json()) as {
              tale?: Record<string, unknown>;
              draft?: { autosaveVersion: number; chapters: unknown[] };
              error?: string;
            };
            if (!studioResponse.ok || !studio.tale || !studio.draft) {
              setError(
                `The tale and cover were created, but the cover could not be assigned: ${studio.error ?? "draft unavailable"}`,
              );
              setBusy(false);
              setPhase("failed");
              return;
            }
            const saveResponse = await fetch(`/api/studio/tales/${body.id}/draft`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
              body: JSON.stringify({
                autosaveVersion: studio.draft.autosaveVersion,
                tale: { ...studio.tale, coverAssetId },
                chapters: studio.draft.chapters,
              }),
            });
            if (!saveResponse.ok) {
              const saved = (await saveResponse.json()) as { error?: string };
              setError(
                `The tale and cover were created, but the cover could not be assigned: ${saved.error ?? "save failed"}`,
              );
              setBusy(false);
              setPhase("failed");
              return;
            }
          }
          setPhase("routing");
          router.push(`/studio/tales/${body.id}`);
        }}
      >
        <Link href="/studio">← Back to Studio</Link>
        <p className="eyebrow">Lay a fresh chart</p>
        <h1>Create a New Tall Tale</h1>
        <p>Start with the voyage identity and first chapter. Every field remains editable.</p>
        <div className="form-grid">
          <label className="wide">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
              required
              maxLength={160}
            />
          </label>
          <label className="wide">
            <span>Address</span>
            <span className="field-prefix">/play/</span>
            <input
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value.toLocaleLowerCase());
              }}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>
          <label>
            <span>Subtitle</span>
            <input name="subtitle" maxLength={240} />
          </label>
          <label>
            <span>Theme</span>
            <select name="theme">
              <option value="CARTOGRAPHERS_TABLE">Cartographer&apos;s Table</option>
              <option value="MOONLIT_JOURNAL">Moonlit Journal</option>
              <option value="CAPTAINS_CABIN">Captain&apos;s Cabin</option>
            </select>
          </label>
          <label className="wide">
            <span>Short description</span>
            <textarea name="shortDescription" maxLength={600} rows={3} />
          </label>
          <label className="wide">
            <span>Long description</span>
            <textarea name="longDescription" maxLength={20000} rows={5} />
          </label>
          <label>
            <span>Minimum players</span>
            <input name="playerCountMin" type="number" min={1} max={20} defaultValue={1} />
          </label>
          <label>
            <span>Maximum players</span>
            <input name="playerCountMax" type="number" min={1} max={20} defaultValue={4} />
          </label>
          <label>
            <span>Estimated minutes</span>
            <input name="estimatedDuration" type="number" min={1} max={10000} defaultValue={90} />
          </label>
          <label>
            <span>Visibility</span>
            <select name="visibility">
              <option value="PRIVATE">Private draft</option>
              <option value="UNLISTED">Unlisted after publish</option>
              <option value="PUBLIC">Public after publish</option>
            </select>
          </label>
          <label className="wide">
            <span>Initial chapter title</span>
            <input name="initialChapterTitle" defaultValue="Chapter One" required />
          </label>
          <label className="wide">
            <span>Cover image (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
            />
            <small>The original is preserved and optimized player variants are generated after creation.</small>
          </label>
        </div>
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              className="studio-error"
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        {busy && (
          <p className="new-tale-progress" role="status" aria-live="polite">
            {phase === "creating"
              ? "Creating the editable tale…"
              : phase === "uploading"
                ? "Uploading the cover…"
                : phase === "assigning"
                  ? "Assigning the ready cover to the draft…"
                  : "Opening the editor…"}
          </p>
        )}
        <div className="form-actions">
          <Link href="/studio">Cancel</Link>
          <button className="brass-button" disabled={busy}>
            {busy ? "Opening the chart…" : "Create and open editor"}
          </button>
        </div>
      </motion.form>
    </main>
  );
}
