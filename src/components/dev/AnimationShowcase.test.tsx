import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sceneNames } from "@/animation/core/animation-types";
import {
  AnimationShowcase,
  showcaseCoverage,
  showcaseDemoLabel,
  showcaseDemos,
  summarizeShowcaseReceipt,
} from "./AnimationShowcase";

const harness = vi.hoisted(() => {
  const snapshot = {
    isPlaying: false,
    isPaused: false,
    scene: null,
    label: "idle",
    progress: 0,
    speed: 1,
    mode: "full",
    phase: "idle",
    queueDepth: 0,
    error: null,
  };
  const director = {
    play: vi.fn(async (sceneName: string, options: Record<string, unknown>) => ({
      sceneName,
      sceneInstanceId: "development-instance-1",
      hostId: options.hostId,
      hostKind: options.hostKind,
      requestSource: options.requestSource,
      outcome: "presented",
      motionPolicy: {
        level: "full",
        source: { productSetting: "full", browserPrefersReduced: false },
        allowSpatialTravel: true,
        allowContinuousAmbientMotion: true,
        allowPageCurl: true,
        allowRiveStateTravel: true,
        allowLottiePlayback: true,
        allowMotionCues: true,
        durationScale: 1,
        distanceScale: 1,
        preserveSemanticStaging: true,
      },
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      semanticLabelsReached: ["scene-start", "scene-complete"],
      targetReport: {
        sceneName,
        sceneInstanceId: "development-instance-1",
        hostId: options.hostId,
        startedAt: 1,
        completedAt: 1,
        durationMs: 0,
        requiredSatisfied: true,
        observations: [
          {
            part: "title",
            required: true,
            matchedCount: 2,
            visibleCount: 1,
            duplicateCount: 1,
            ownershipRejectedCount: 0,
            observations: [],
          },
          {
            part: "fog",
            required: false,
            matchedCount: 2,
            visibleCount: 2,
            duplicateCount: 2,
            ownershipRejectedCount: 0,
            observations: [],
          },
        ],
        failures: [],
      },
      acknowledgmentAllowed: false,
      cleanup: "completed",
      operationResult: { private: "PRIVATE_PAYLOAD_SENTINEL" },
    })),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    skip: vi.fn(),
    reverse: vi.fn(),
    cancel: vi.fn(),
    setSpeed: vi.fn(),
  };
  return { director, snapshot };
});

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement> & { initial?: unknown; animate?: unknown; exit?: unknown }) => {
      const divProps = { ...props };
      const children = divProps.children;
      delete divProps.children;
      delete divProps.initial;
      delete divProps.animate;
      delete divProps.exit;
      return <div {...divProps}>{children}</div>;
    },
  },
}));
vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({ director: harness.director, snapshot: harness.snapshot }),
}));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "full", setMode: vi.fn() }),
}));
vi.mock("@/components/animation/AnimationControls", () => ({
  AnimationControls: () => <div>Animation controls</div>,
}));
vi.mock("@/components/animation/LottieEffect", () => ({
  LottieEffect: forwardRef(function MockLottieEffect() {
    return <div>Lottie harness</div>;
  }),
}));
vi.mock("@/components/animation/PageFlipBook", () => ({
  PageFlipBook: forwardRef(function MockPageFlipBook() {
    return <div>PageFlip harness</div>;
  }),
}));
vi.mock("@/components/animation/RiveStatefulObject", () => ({
  RiveStatefulObject: () => <div>Rive harness</div>,
}));
vi.mock("./AnimationMetrics", () => ({ AnimationMetrics: () => <div>Metrics harness</div> }));

describe("AnimationShowcase", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("represents every registered scene and derives every row label from its reachability contract", () => {
    expect(showcaseCoverage).toEqual({ rows: 38, uniqueScenes: 28, registeredScenes: 28 });
    expect(new Set(showcaseDemos.map((demo) => demo.scene))).toEqual(new Set(sceneNames));
    expect(showcaseDemos.every((demo) => showcaseDemoLabel(demo).startsWith(`${demo.label} — `))).toBe(true);
    expect(showcaseDemos.some((demo) => demo.scene === "prepare-chapter")).toBe(true);
    expect(showcaseDemos.some((demo) => demo.scene === "mark-solved")).toBe(true);
  });

  it("summarizes only receipt target counts", () => {
    const receipt = awaitReceipt();
    expect(summarizeShowcaseReceipt(receipt)).toEqual({ required: 2, visible: 1, duplicates: 3 });
  });

  it("uses the stable development host for deprecated scenes and renders a sanitized harness-only receipt", async () => {
    render(<AnimationShowcase />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("data-scene-host-id", "development-animation-showcase");
    expect(main).toHaveAttribute("data-scene-host-kind", "development-showcase");
    expect(main).toHaveAttribute("data-harness-only", "true");
    expect(screen.getByText(/development harness only · never production proof/i)).toBeVisible();
    expect(screen.getByText(/38 harness rows · 28\/28 registered scene contracts represented/i)).toBeVisible();

    const sceneSelect = screen.getByLabelText("Scene");
    expect(within(sceneSelect).getByRole("option", { name: "Journal cover opening — deprecated" })).toBeVisible();
    fireEvent.change(sceneSelect, { target: { value: "journal-open" } });
    fireEvent.click(screen.getByRole("button", { name: "Play selected scene" }));

    await waitFor(() => expect(harness.director.play).toHaveBeenCalledOnce());
    expect(harness.director.play).toHaveBeenCalledWith(
      "journal-open",
      expect.objectContaining({
        hostId: "development-animation-showcase",
        hostKind: "development-showcase",
        requestSource: "development",
        eventOrActionId: "development-showcase:journal-open",
      }),
    );

    const receipt = await screen.findByRole("region", { name: "Latest development presentation receipt" });
    expect(within(receipt).getByText("presented")).toBeVisible();
    expect(within(receipt).getByText("development")).toBeVisible();
    expect(within(receipt).getByText("not allowed")).toBeVisible();
    expect(
      within(receipt).getByText("Display payloads and operation results are intentionally excluded."),
    ).toBeVisible();
    expect(screen.queryByText("PRIVATE_PAYLOAD_SENTINEL")).not.toBeInTheDocument();
  });
});

function awaitReceipt() {
  return {
    targetReport: {
      observations: [
        { required: true, matchedCount: 2, visibleCount: 1, duplicateCount: 1 },
        { required: false, matchedCount: 2, visibleCount: 2, duplicateCount: 2 },
      ],
    },
  } as Parameters<typeof summarizeShowcaseReceipt>[0];
}
