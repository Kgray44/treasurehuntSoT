import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShipwrightPublishingReview } from "./ShipwrightPublishingReview";

const body = {
  review: {
    sourceChecksum: "a".repeat(64),
    currentPublished: { versionLabel: "1.0", checksum: "b".repeat(64) },
    summary: { chapters: 1, passages: 250, assets: 1, changes: 1 },
    changes: [
      { kind: "CHANGED", subject: "Passage", label: "The first lantern", detail: "Content changed in Harbor." },
    ],
    assets: { total: 1, ready: 1, attention: 0, items: [{ label: "Harbor chart", readiness: "READY" }] },
  },
  readiness: { status: "VERIFIED", warnings: [{ code: "DD-WARN" }], waivers: ["waiver-1"] },
  compatibility: { status: "COMPATIBLE", policyVersion: "drydock-v1", findings: [] },
  protectedContent: { visibility: "PRIVATE", recorded: false, evidence: [] },
};

afterEach(() => vi.unstubAllGlobals());

describe("Shipwright publishing review", () => {
  it("requires an explicit immutable confirmation after presenting the source-bound review", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    const publish = vi.fn();
    render(
      <ShipwrightPublishingReview
        taleId="tale-1"
        csrfToken="csrf"
        savedAt="2026-08-26T12:00:00.000Z"
        onSave={vi.fn().mockResolvedValue(true)}
        onPublish={publish}
        publishState="idle"
        publishError=""
        receipt={null}
        onPreviewPublished={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { name: "Review and publish" });
    expect(screen.getByText(/250 Passages/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish immutable Version" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Creator release notes"), { target: { value: "A safer harbor." } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Publish immutable Version" }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith("A safer harbor."));
  });

  it("offers next actions only when the complete authoritative receipt exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    render(
      <ShipwrightPublishingReview
        taleId="tale-1"
        csrfToken="csrf"
        savedAt="2026-08-26T12:00:00.000Z"
        onSave={vi.fn().mockResolvedValue(true)}
        onPublish={vi.fn()}
        publishState="published"
        publishError=""
        receipt={{
          id: "version-2",
          versionLabel: "1.1",
          checksum: "c".repeat(64),
          evidenceId: "evidence-2",
          publishedAt: "2026-08-26T12:00:00.000Z",
        }}
        onPreviewPublished={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { name: "Immutable publication committed" });
    expect(screen.getByRole("link", { name: "Begin governed Community handoff" })).toHaveAttribute(
      "href",
      "/studio/exchange?sourceVersion=version-2",
    );
    expect(screen.getByText("c".repeat(64))).toBeInTheDocument();
  });
});
