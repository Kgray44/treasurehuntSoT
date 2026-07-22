import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientProgressEvent, PublicSnapshot } from "@/domain/story";
import type { PageFlipPageTargetExportAuthority } from "@/components/animation/PageFlipBook";
import type { SceneTargetHandle } from "@/animation/hosts/scene-host-types";
import { resolveSideQuestLocalTargets, SideQuestLedger, type SideQuestLocalTargetReady } from "./SideQuestLedger";

const pageFlipProbe = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  props: null as null | {
    pages: Array<{ id: string; content: ReactNode }>;
    onPageTargetsChange?: (authority: PageFlipPageTargetExportAuthority | null) => void;
  },
}));

vi.mock("@/components/animation/PageFlipBook", async () => {
  const { forwardRef, useEffect } = await import("react");
  return {
    PageFlipBook: forwardRef(function PageFlipBookMock(
      props: {
        pages: Array<{ id: string; content: ReactNode }>;
        onPageTargetsChange?: (authority: PageFlipPageTargetExportAuthority | null) => void;
      },
      _ref,
    ) {
      pageFlipProbe.props = props;
      useEffect(() => {
        pageFlipProbe.mounts += 1;
        return () => {
          pageFlipProbe.unmounts += 1;
        };
      }, []);
      const onPageTargetsChange = props.onPageTargetsChange;
      useEffect(() => () => onPageTargetsChange?.(null), [onPageTargetsChange]);
      return (
        <div data-testid="pageflip-mock">
          {props.pages.map((page) => (
            <article key={page.id} data-page-id={page.id}>
              {page.content}
            </article>
          ))}
        </div>
      );
    }),
  };
});

const snapshot: PublicSnapshot = {
  campaign: { slug: "quest-local-test", title: "Quest Local Test", status: "ACTIVE" },
  sequence: 24,
  chapter: { ordinal: 1, state: "ACTIVE", title: "Safe chapter", narrative: "Safe", objective: "Safe" },
  chapters: [{ ordinal: 1, state: "ACTIVE", title: "Safe chapter", narrative: "Safe", objective: "Safe" }],
  artifacts: [],
  mapLocations: [],
  mapRoutes: [],
  sideQuests: [
    {
      key: "lantern-rumor",
      state: "ACTIVE",
      title: "Lantern rumor",
      description: "Follow one safe thread.",
      objectives: [
        { ordinal: 1, body: "Find the lantern.", complete: true },
        { ordinal: 2, body: "Read the harmless mark.", complete: false },
      ],
      unseen: true,
    },
    {
      key: "shell-song",
      state: "COMPLETE",
      title: "Shell song",
      objectives: [{ ordinal: 1, body: "Listen safely.", complete: true }],
      reward: { type: "TOKEN", label: "Safe token" },
      unseen: false,
    },
  ],
  sideQuest: { title: "Lantern rumor", state: "ACTIVE" },
  log: [],
  finale: { state: "LOCKED", requirements: [], unseen: false },
  unseen: { journal: 0, chart: 0, treasures: 0, quests: 1, log: 0, finale: 0 },
};

function event(type: ClientProgressEvent["type"], payload: Record<string, unknown>): ClientProgressEvent {
  return { id: `event-${type.toLowerCase()}`, type, sequence: 24, releaseAt: "2026-07-18T20:00:00.000Z", payload };
}

function target(pageId: string, part: string, marker: string, current = true) {
  const targetKey = `pageflip:${pageId}:primary:g1:${part}:${marker.replaceAll(":", "-")}`;
  return {
    handle: {
      providerId: "provider-test",
      hostId: "host-test",
      hostGeneration: 1,
      targetId: `target-${marker}`,
      part,
      targetGeneration: 1,
      release: vi.fn(),
    } as unknown as SceneTargetHandle,
    targetKey,
    pageId,
    part,
    generation: 1,
    role: "primary" as const,
    current,
  };
}

function authority(...targets: ReturnType<typeof target>[]): PageFlipPageTargetExportAuthority {
  return {
    hostId: "host-test" as PageFlipPageTargetExportAuthority["hostId"],
    pageFlipInstanceId: "pageflip-test",
    cloneGeneration: 1,
    targets,
    exportTarget: vi.fn() as unknown as PageFlipPageTargetExportAuthority["exportTarget"],
  };
}

afterEach(() => {
  cleanup();
  pageFlipProbe.mounts = 0;
  pageFlipProbe.unmounts = 0;
  pageFlipProbe.props = null;
});

describe("SideQuestLedger local progression targets", () => {
  it("renders stable quest and objective identities for the exact item", () => {
    render(<SideQuestLedger snapshot={snapshot} mode="full" />);

    expect(document.querySelector('[data-scene-target-key="quest:lantern-rumor:note"]')).toHaveAttribute(
      "data-quest-key",
      "lantern-rumor",
    );
    expect(document.querySelector('[data-scene-target-key="quest:shell-song:note"]')).toHaveAttribute(
      "data-quest-key",
      "shell-song",
    );
    expect(document.querySelector('[data-scene-target-key="quest:lantern-rumor:objective:2"]')).toHaveTextContent(
      "Read the harmless mark.",
    );
    expect(document.querySelector('[data-scene-target-key="quest:shell-song:stamp"]')).toHaveTextContent(
      "Course complete",
    );
  });

  it("selects only the exact current discovery page and its relevant thread", () => {
    const exact = authority(
      target("shell-song-summary", "quest-note-new", "quest:shell-song:note"),
      target("lantern-rumor-summary", "quest-note-new", "quest:lantern-rumor:note"),
      target("lantern-rumor-summary", "red-thread", "quest:lantern-rumor:thread"),
      target("lantern-rumor-objectives", "quest-objective-updated", "quest:lantern-rumor:objective:2", false),
    );
    const ready = resolveSideQuestLocalTargets(event("SIDE_QUEST_DISCOVERED", { key: "lantern-rumor" }), exact);
    expect(ready).toMatchObject({
      eventType: "SIDE_QUEST_DISCOVERED",
      questKey: "lantern-rumor",
      pageId: "lantern-rumor-summary",
    });
    expect(Object.keys(ready!.targets)).toEqual(["quest-note", "quest-red-thread"]);
    expect(ready!.targets["quest-note"]!.pageId).toBe("lantern-rumor-summary");
    expect(ready!.authority.exportTarget).toBe(exact.exportTarget);
  });

  it("gives updates a distinct exact-objective target instead of discovery choreography", () => {
    const exact = authority(
      target("lantern-rumor-summary", "quest-note-new", "quest:lantern-rumor:note", false),
      target("lantern-rumor-objectives", "quest-objective-updated", "quest:lantern-rumor:objective:1"),
      target("lantern-rumor-objectives", "quest-objective-updated", "quest:lantern-rumor:objective:2"),
    );
    const ready = resolveSideQuestLocalTargets(
      event("SIDE_QUEST_UPDATED", { key: "lantern-rumor", objectiveOrdinal: 2 }),
      exact,
    );
    expect(ready).toMatchObject({
      eventType: "SIDE_QUEST_UPDATED",
      questKey: "lantern-rumor",
      objectiveOrdinal: 2,
      pageId: "lantern-rumor-objectives",
    });
    expect(Object.keys(ready!.targets)).toEqual(["quest-objective"]);
    expect(ready!.targets["quest-objective"]!.targetKey).toContain("objective-2");
  });

  it("publishes a current completion stamp, retracts stale handles, and does not remount PageFlip on filtering", async () => {
    const changes: Array<SideQuestLocalTargetReady | null> = [];
    const progressEvent = event("SIDE_QUEST_COMPLETED", { key: "shell-song", title: "Shell song" });
    const view = render(
      <SideQuestLedger
        snapshot={snapshot}
        mode="full"
        progressEvent={progressEvent}
        onTargetRegistrationChange={(ready) => changes.push(ready)}
      />,
    );
    const exact = authority(target("shell-song-objectives", "quest-stamp", "quest:shell-song:stamp"));

    act(() => pageFlipProbe.props!.onPageTargetsChange?.(exact));
    await waitFor(() => expect(changes.at(-1)).toMatchObject({ eventType: "SIDE_QUEST_COMPLETED" }));
    expect(pageFlipProbe.mounts).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "complete" }));
    expect(pageFlipProbe.mounts).toBe(1);
    expect(pageFlipProbe.unmounts).toBe(0);

    view.rerender(
      <SideQuestLedger
        snapshot={snapshot}
        mode="full"
        progressEvent={null}
        onTargetRegistrationChange={(ready) => changes.push(ready)}
      />,
    );
    await waitFor(() => expect(changes.at(-1)).toBeNull());
    view.unmount();
    expect(changes.at(-1)).toBeNull();
  });

  it("moves one Motion-owned physical divider between filter tabs without remounting the readable ledger", () => {
    render(<SideQuestLedger snapshot={snapshot} mode="full" />);

    expect(screen.getByRole("button", { name: "all" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector('[data-ledger-filter-divider="all"]')).toBeInTheDocument();
    expect(pageFlipProbe.mounts).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "complete" }));

    expect(screen.getByRole("button", { name: "complete" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "all" })).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelector('[data-ledger-filter-divider="complete"]')).toBeInTheDocument();
    expect(document.querySelector('[data-ledger-filter-divider="all"]')).not.toBeInTheDocument();
    expect(pageFlipProbe.mounts).toBe(1);
    expect(pageFlipProbe.unmounts).toBe(0);
  });
});
