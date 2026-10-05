"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { z } from "zod";
import type { LandfallWaypoint } from "@/landfall/schema";
import { landfallId } from "@/landfall/schema";

type Installation = NonNullable<LandfallWaypoint["installations"]>[number];
type Props = {
  taleId: string;
  waypoint: LandfallWaypoint;
  csrfToken: string;
  unsaved: boolean;
  onChange(installations: Installation[]): void;
};
const installationSchema = z.strictObject({
  id: landfallId,
  medium: z.enum(["QR", "NFC"]),
  label: z.string().min(1).max(120),
  accessibilityAlternative: z.string().min(1).max(240),
});
const publishedSchema = z.strictObject({
  state: z.literal("CONFIGURED"),
  publishedVersionId: landfallId,
  versionLabel: z.string().max(240),
  installations: z.array(installationSchema).max(8),
  canComplete: z.literal(false),
});
const issuedSchema = z.strictObject({
  state: z.literal("ISSUED"),
  medium: z.enum(["QR", "NFC"]),
  installationId: landfallId,
  token: z.string().min(32).max(2048),
  expiresAt: z.number().int().nonnegative(),
  canComplete: z.literal(false),
  qrCodeDataUrl: z
    .string()
    .max(512000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/)
    .optional(),
});
export function LandfallInstallationPanel(props: Props) {
  return (
    <InstallationControls
      key={JSON.stringify([props.taleId, props.waypoint.id, props.waypoint.installations, props.unsaved])}
      {...props}
    />
  );
}
function InstallationControls({ taleId, waypoint, csrfToken, unsaved, onChange }: Props) {
  const [published, setPublished] = useState<z.infer<typeof publishedSchema> | null>(null);
  const [issued, setIssued] = useState<z.infer<typeof issuedSchema> | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      "Save and publish the installation configuration before creating a physical token.",
    );
  const abort = useRef<AbortController | null>(null),
    generation = useRef(0);
  useEffect(() => {
    const lifetime = generation;
    const clear = () => {
      lifetime.current++;
      abort.current?.abort();
      abort.current = null;
      setPublished(null);
      setIssued(null);
      setBusy(false);
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      lifetime.current++;
      abort.current?.abort();
    };
  }, []);
  const call = async (body: unknown) => {
    if (busy || unsaved) return;
    const attempt = ++generation.current;
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    setBusy(true);
    setIssued(null);
    try {
      const response = await fetch(`/api/studio/tales/${encodeURIComponent(taleId)}/landfall/interaction`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (attempt !== generation.current) return;
      const value = await response.json();
      if (!response.ok) throw new Error();
      if (value.state === "NOT_CONFIGURED") {
        setPublished(null);
        setMessage("Installation signing is not configured. Use the readable Player or Captain fallback.");
        return;
      }
      if (value.state === "CONFIGURED") {
        const result = publishedSchema.parse(value);
        setPublished(result);
        setMessage(
          result.installations.length
            ? "Choose an installation from the published version below."
            : "This waypoint has no installation in the current published version.",
        );
      } else {
        const result = issuedSchema.parse(value);
        if (
          !published?.installations.some((item) => item.id === result.installationId && item.medium === result.medium)
        )
          throw new Error();
        setIssued(result);
        setMessage(
          "A signed optional token was created. Check the printed label, permission to install it and accessible fallback at the site.",
        );
      }
    } catch {
      if (attempt === generation.current) {
        setPublished(null);
        setMessage(
          "Published installation unavailable. Save, publish and check again; your readable fallback remains available.",
        );
      }
    } finally {
      clearTimeout(timer);
      if (attempt === generation.current) {
        abort.current = null;
        setBusy(false);
      }
    }
  };
  return (
    <fieldset className="landfall-installation-authoring">
      <legend>Optional QR and NFC installations</legend>
      <p>
        A signed token identifies this published waypoint. Copies can be scanned elsewhere; it never proves presence or
        completes arrival. Keep the configured Player, Captain or alternate fallback accessible.
      </p>
      {(waypoint.installations ?? []).map((installation) => (
        <div key={installation.id}>
          <strong>{installation.medium}</strong>
          <label>
            Installation label
            <input
              defaultValue={installation.label}
              maxLength={120}
              onBlur={(event) =>
                onChange(
                  (waypoint.installations ?? []).map((item) =>
                    item.id === installation.id ? { ...item, label: event.target.value || item.label } : item,
                  ),
                )
              }
            />
          </label>
          <label>
            Accessible alternative
            <input
              defaultValue={installation.accessibilityAlternative}
              maxLength={240}
              onBlur={(event) =>
                onChange(
                  (waypoint.installations ?? []).map((item) =>
                    item.id === installation.id
                      ? { ...item, accessibilityAlternative: event.target.value || item.accessibilityAlternative }
                      : item,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            onClick={() => onChange((waypoint.installations ?? []).filter((item) => item.id !== installation.id))}
          >
            Remove {installation.medium} installation
          </button>
        </div>
      ))}
      {(["QR", "NFC"] as const).map((medium) => (
        <button
          type="button"
          key={medium}
          disabled={(waypoint.installations?.length ?? 0) >= 8}
          onClick={() =>
            onChange([
              ...(waypoint.installations ?? []),
              {
                id: crypto.randomUUID(),
                medium,
                label: `${waypoint.name} ${medium}`.slice(0, 120),
                accessibilityAlternative: "Use the configured Player, Captain or alternate waypoint fallback.",
              },
            ])
          }
        >
          Add optional {medium} installation
        </button>
      ))}
      <button
        type="button"
        disabled={busy || unsaved}
        onClick={() => void call({ operation: "STATUS", waypointId: waypoint.id })}
      >
        Check published installations
      </button>
      {published && (
        <div>
          <p>Published version: {published.versionLabel}</p>
          {published.installations.map((item) => (
            <button
              type="button"
              disabled={busy}
              key={item.id}
              onClick={() =>
                void call({
                  operation: "ISSUE",
                  waypointId: waypoint.id,
                  publishedVersionId: published.publishedVersionId,
                  installationId: item.id,
                })
              }
            >
              Create signed {item.medium} token for {item.label}
            </button>
          ))}
        </div>
      )}
      <p role="status">{message}</p>
      {issued && (
        <div>
          <p>
            Expires {new Date(issued.expiresAt).toLocaleString()}. Replace or reissue after expiry or signing-key
            rotation. Changing the published version requires its own token.
          </p>
          {issued.qrCodeDataUrl && (
            <a href={issued.qrCodeDataUrl} download="landfall-optional-installation.png">
              <Image
                unoptimized
                src={issued.qrCodeDataUrl}
                width={360}
                height={360}
                style={{ maxWidth: "100%", height: "auto" }}
                alt="Signed optional waypoint QR token. Download this image for printing."
              />
            </a>
          )}
          <label>
            {issued.medium === "NFC" ? "NDEF UTF-8 text payload for your NFC writer" : "Signed QR text alternative"}
            <textarea readOnly value={issued.token} rows={4} />
          </label>
          <button type="button" onClick={() => setIssued(null)}>
            Clear generated token
          </button>
        </div>
      )}
    </fieldset>
  );
}
