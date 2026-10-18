import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReachAdminConsole, type ReachAdminOverview } from "./ReachAdminConsole";
import { defaultReachRuntimePolicyEnvelope } from "@/reach/runtime-policy";
import {
  createReachTelemetryReport,
  summarizeReachTelemetry,
  observeReachHistogram,
  reachTimingUpperBoundsMs,
} from "@/reach/telemetry";

const envelope = { ...defaultReachRuntimePolicyEnvelope, revision: 1 };
function overview(state: "AVAILABLE" | "NO_REPORTS" = "AVAILABLE", reports = 1): ReachAdminOverview {
  const report = createReachTelemetryReport(1);
  report.model.packets = 20;
  report.model.accepted = 15;
  report.model.late = 5;
  report.model.handCountMissing = 5;
  observeReachHistogram(report.timings.captureToImageMs, reachTimingUpperBoundsMs, 120);
  return {
    state: "HEALTHY",
    evidence: {
      source: "Synthetic Reach aggregate store",
      observedAt: "2026-10-17T12:00:00Z",
      freshness: "LIVE",
      lastSuccessfulRefresh: "2026-10-17T12:00:00Z",
      environment: "test",
      safeError: null,
      dataClass: "OPERATIONAL_SENSITIVE",
    },
    data: {
      envelope,
      reporting: {
        state,
        collectionEnabled: true,
        coverage: {
          from: "2026-09-17T12:00:00Z",
          to: "2026-10-17T12:00:00Z",
          totalReports: state === "NO_REPORTS" ? 0 : reports,
          returnedReports: state === "NO_REPORTS" ? 0 : reports,
          truncated: false,
          pagesRead: state === "NO_REPORTS" ? 0 : Math.ceil(reports / 1000),
          pageSize: 1000,
          distinctPeople: null,
          distinctSessions: null,
        },
        summary: summarizeReachTelemetry(state === "NO_REPORTS" ? [] : Array.from({ length: reports }, () => report)),
      },
      history: [],
    },
  } as ReachAdminOverview;
}
const ok = (data: unknown) => ({ ok: true, json: async () => data });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const mount = (initial = overview(), canManage = false) =>
  render(<ReachAdminConsole initial={initial} csrfToken="synthetic-csrf" canManage={canManage} />);
const openPolicy = () => fireEvent.click(screen.getByRole("button", { name: "Runtime policy" }));
async function prepareChange(fetcher: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetcher);
  mount(overview(), true);
  openPolicy();
  fireEvent.change(screen.getByLabelText("Normal tracking ceiling (Hz)"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Hand model inference ceiling (Hz)"), { target: { value: "20" } });
  fireEvent.change(screen.getByLabelText("Reason for policy change"), {
    target: { value: "Reduce load during active laptop testing" },
  });
  expect(screen.getByRole("button", { name: "Preview Reach policy" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify identity" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Preview Reach policy" })).toBeEnabled());
  expect(screen.getByLabelText("Current password")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Preview Reach policy" }));
  await screen.findByRole("heading", { name: "Review Reach policy change" });
}
function commandResponses() {
  const nextEnvelope = {
    ...envelope,
    revision: 2,
    policy: { ...envelope.policy, normalMaximumHz: 10, modelMaximumHz: 20 },
  };
  const preview = {
    previewId: "11111111-2222-4333-8444-555555555555",
    currentState: envelope,
    resultingState: nextEnvelope,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    consequences: ["All clients use the new ceilings."],
    warnings: ["Accuracy gates remain unchanged."],
  };
  const next = overview();
  next.data!.envelope = nextEnvelope;
  return {
    preview,
    nextEnvelope,
    fetcher: vi
      .fn()
      .mockResolvedValueOnce(ok({ assurance: { expiresAt: new Date(Date.now() + 600000).toISOString() } }))
      .mockResolvedValueOnce(ok({ preview }))
      .mockResolvedValueOnce(
        ok({ receipt: { id: "receipt-1", correlationId: "correlation-1", envelope: nextEnvelope, idempotent: false } }),
      )
      .mockResolvedValueOnce(ok(next)),
  };
}
describe("canonical Reach administration", () => {
  it("distinguishes automatic report coverage from unknown people and sessions", () => {
    mount();
    expect(screen.getByText("Distinct people").nextElementSibling).toHaveTextContent("Not collected");
    expect(screen.getByText("Distinct sessions").nextElementSibling).toHaveTextContent("Not collected");
    expect(screen.getByText("75.0%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Privacy & history" }));
    expect(screen.getByText(/Automatic reports contain bounded aggregate/)).toBeInTheDocument();
    expect(screen.getByText(/no account, camera, track or session identifiers/)).toBeInTheDocument();
    expect(screen.queryByText(/opt.in|consenting signed.in/i)).not.toBeInTheDocument();
  });
  it("renders empty and unavailable projections without manufactured performance", () => {
    const view = mount(overview("NO_REPORTS"));
    expect(screen.getByText("No aggregate reports in this window")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Performance" }));
    expect(screen.getByText("Performance summary unavailable")).toBeInTheDocument();
    view.unmount();
    mount({ ...overview(), state: "UNAVAILABLE", data: null });
    expect(screen.getByText("Reach administrative data unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview Reach policy" })).not.toBeInTheDocument();
  });
  it("shows complete streamed cohorts beyond10000 reports without sampling", () => {
    mount(overview("AVAILABLE", 12001));
    expect(screen.getByText(/12,001 matching reports; 12,001 were aggregated across 13 pages/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Performance" }));
    expect(screen.getByRole("figure", { name: "Capture to image result" })).toHaveTextContent("12,001 observed");
    expect(screen.queryByText(/10,000-report|truncated cohort/)).not.toBeInTheDocument();
  });
  it("withholds summaries when coverage is incomplete rather than presenting a sample", () => {
    const incomplete = overview();
    incomplete.data!.reporting.coverage.returnedReports = 0;
    mount(incomplete);
    expect(screen.getByRole("alert")).toHaveTextContent("Report coverage is incomplete");
    fireEvent.click(screen.getByRole("button", { name: "Calibration" }));
    expect(screen.getByText("Calibration summary unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });
  it("separates bounded revision detail from complete numeric reporting", () => {
    const manyRevisions = overview();
    manyRevisions.data!.reporting.summary = summarizeReachTelemetry(
      Array.from({ length: 130 }, (_, revision) => createReachTelemetryReport(revision)),
    );
    manyRevisions.data!.reporting.coverage.totalReports = 130;
    manyRevisions.data!.reporting.coverage.returnedReports = 130;
    mount(manyRevisions);
    expect(screen.getByText(/Per-revision detail retains at most 128 revision buckets; 2 reports/)).toBeInTheDocument();
    expect(
      screen.getByText(/Overall numeric totals and distributions still include every valid report/),
    ).toBeInTheDocument();
  });
  it("shows histogram percentile ranges and missing values instead of invented exact latency", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Performance" }));
    expect(screen.getAllByText(">100–≤125 ms").length).toBeGreaterThan(0);
    expect(screen.getByRole("figure", { name: "Capture to image result" })).toHaveTextContent("1 observed · 0 missing");
    expect(screen.getByText(/not hand-presence, tracking or pointing confidence/)).toBeInTheDocument();
  });
  it("has no mutation or assurance controls for observe-only authority", () => {
    mount();
    openPolicy();
    expect(screen.getByText(/CONFIG_OPERATE authority is required/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview Reach policy" })).not.toBeInTheDocument();
  });
  it("uses canonical assurance, exact preview and frozen explicit confirmed execution with CSRF", async () => {
    const { fetcher } = commandResponses();
    await prepareChange(fetcher);
    const confirm = screen.getByRole("button", { name: "Confirm and apply Reach policy" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByLabelText("I reviewed the policy and its effect on all Reach clients."));
    fireEvent.click(confirm);
    await screen.findByText(/Policy revision 2 recorded. Receipt correlation-1/);
    const calls = fetcher.mock.calls;
    expect(calls[0][0]).toBe("/api/admin/assurance");
    expect(calls[1][0]).toBe("/api/admin/commands/reach-runtime-policy/preview");
    const frozen = JSON.parse(calls[1][1].body);
    expect(frozen).toMatchObject({ expectedRevision: 1, policy: { normalMaximumHz: 10, modelMaximumHz: 20 } });
    expect(calls[2][0]).toBe("/api/admin/commands/reach-runtime-policy/execute");
    expect(JSON.parse(calls[2][1].body)).toEqual({
      input: frozen,
      previewId: "11111111-2222-4333-8444-555555555555",
      confirmed: true,
    });
    expect(calls.slice(0, 3).every(([, init]) => init.headers["x-csrf-token"] === "synthetic-csrf")).toBe(true);
  });
  it("expires assurance and discards a reviewed command before applying", async () => {
    vi.useFakeTimers();
    const { fetcher, preview } = commandResponses();
    vi.stubGlobal("fetch", fetcher);
    mount(overview(), true);
    openPolicy();
    fireEvent.change(screen.getByLabelText("Reason for policy change"), {
      target: { value: "Keep the isolated browser fixture bounded" },
    });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "synthetic-password" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Verify identity" })));
    expect(screen.getByRole("button", { name: "Preview Reach policy" })).toBeEnabled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Preview Reach policy" })));
    expect(screen.getByRole("heading", { name: "Review Reach policy change" })).toBeInTheDocument();
    expect(preview.previewId).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(600001));
    expect(screen.getByRole("button", { name: "Preview Reach policy" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Confirm and apply Reach policy" })).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("invalidates a reviewed preview when its reason or policy changes", async () => {
    const { fetcher } = commandResponses();
    await prepareChange(fetcher);
    fireEvent.change(screen.getByLabelText("Reason for policy change"), {
      target: { value: "A different reason for this policy" },
    });
    expect(screen.queryByRole("button", { name: "Confirm and apply Reach policy" })).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
