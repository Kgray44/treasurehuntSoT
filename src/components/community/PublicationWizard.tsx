"use client";

import { FormEvent, useId, useMemo, useState } from "react";

export type PublicationWizardValues = {
  title: string;
  sourcePublishedVersionId: string;
  license: string;
  accessibilityDescription: string;
  scannerStatus: "CLEAN" | "SCAN_NOT_CONFIGURED" | "QUARANTINED" | "PENDING";
};

export function PublicationWizard({
  initialValues,
  requiresAccessibilityDescription = true,
  onSubmit,
}: {
  initialValues?: Partial<PublicationWizardValues>;
  requiresAccessibilityDescription?: boolean;
  onSubmit: (values: PublicationWizardValues) => void | Promise<void>;
}) {
  const titleId = useId();
  const sourceId = useId();
  const licenseId = useId();
  const descriptionId = useId();
  const scannerId = useId();
  const [values, setValues] = useState<PublicationWizardValues>({
    title: initialValues?.title ?? "",
    sourcePublishedVersionId: initialValues?.sourcePublishedVersionId ?? "",
    license: initialValues?.license ?? "",
    accessibilityDescription: initialValues?.accessibilityDescription ?? "",
    scannerStatus: initialValues?.scannerStatus ?? "PENDING",
  });
  const [submitted, setSubmitted] = useState(false);
  const errors = useMemo(() => {
    const next: string[] = [];
    if (!values.title.trim()) next.push("A listing title is required.");
    if (!values.sourcePublishedVersionId.trim()) next.push("Choose an immutable published Chronicle version.");
    if (!values.license.trim()) next.push("Select a licence before publishing.");
    if (requiresAccessibilityDescription && !values.accessibilityDescription.trim())
      next.push("Provide an accessibility description for this release.");
    if (values.scannerStatus !== "CLEAN") next.push("Publication is blocked until package scanning reports CLEAN.");
    return next;
  }, [requiresAccessibilityDescription, values]);
  const update = <K extends keyof PublicationWizardValues>(key: K, value: PublicationWizardValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (errors.length === 0) await onSubmit(values);
  };

  return (
    <form aria-labelledby="community-publication-heading" noValidate onSubmit={submit}>
      <h2 id="community-publication-heading">Publish to Community Harbor</h2>
      <p id="community-publication-progress" aria-live="polite">
        Publication review:{" "}
        {errors.length === 0
          ? "ready to publish"
          : `${errors.length} requirement${errors.length === 1 ? "" : "s"} remaining`}
        .
      </p>
      {submitted && errors.length > 0 ? (
        <section aria-labelledby="community-publication-errors" role="alert" tabIndex={-1}>
          <h3 id="community-publication-errors">Correct these requirements</h3>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p>
        <label htmlFor={titleId}>Listing title</label>
        <input
          id={titleId}
          value={values.title}
          onChange={(event) => update("title", event.target.value)}
          aria-invalid={submitted && !values.title.trim()}
        />
      </p>
      <p>
        <label htmlFor={sourceId}>Immutable published Chronicle version</label>
        <input
          id={sourceId}
          value={values.sourcePublishedVersionId}
          onChange={(event) => update("sourcePublishedVersionId", event.target.value)}
          aria-invalid={submitted && !values.sourcePublishedVersionId.trim()}
        />
      </p>
      <p>
        <label htmlFor={licenseId}>Licence</label>
        <input
          id={licenseId}
          value={values.license}
          onChange={(event) => update("license", event.target.value)}
          aria-invalid={submitted && !values.license.trim()}
        />
      </p>
      <p>
        <label htmlFor={descriptionId}>Accessibility description</label>
        <textarea
          id={descriptionId}
          value={values.accessibilityDescription}
          onChange={(event) => update("accessibilityDescription", event.target.value)}
          aria-invalid={submitted && requiresAccessibilityDescription && !values.accessibilityDescription.trim()}
        />
      </p>
      <p>
        <label htmlFor={scannerId}>Scanner status</label>
        <select
          id={scannerId}
          value={values.scannerStatus}
          onChange={(event) => update("scannerStatus", event.target.value as PublicationWizardValues["scannerStatus"])}
        >
          <option value="PENDING">Pending</option>
          <option value="SCAN_NOT_CONFIGURED">Scanner not configured</option>
          <option value="QUARANTINED">Quarantined</option>
          <option value="CLEAN">Clean</option>
        </select>
      </p>
      <button type="submit">Publish release</button>
    </form>
  );
}
