import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PageFlipBookHandle } from "@/components/animation/PageFlipBook";
import { PhysicalJournalBook } from "./PhysicalJournalBook";

const pages = [
  { id: "first", density: "soft" as const, label: "First leaf", content: <p>First leaf</p> },
  { id: "second", density: "soft" as const, label: "Second leaf", content: <p>Second leaf</p> },
];

describe("PhysicalJournalBook", () => {
  it("binds page-turn audio to a semantic settle after a committed page change", () => {
    const onPageTurn = vi.fn();
    const onTurnLifecycle = vi.fn();
    const onReadinessChange = vi.fn();
    const ref = createRef<PageFlipBookHandle>();

    render(
      <PhysicalJournalBook
        ref={ref}
        pages={pages}
        mode="reduced"
        openingPhase="JOURNAL_READY"
        interactive
        initialPage={0}
        coverTitle="The Lanternwake"
        coverSubtitle="Captain's journal"
        onPageTurn={onPageTurn}
        onTurnLifecycle={onTurnLifecycle}
        onReadinessChange={onReadinessChange}
      />,
    );

    expect(ref.current?.readiness()).toMatchObject({ status: "reduced", ready: true });
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));

    expect(onTurnLifecycle.mock.calls.map(([event]) => event.phase)).toEqual([
      "turn-start",
      "turn-commit",
      "turn-settle",
    ]);
    expect(onPageTurn).toHaveBeenCalledOnce();
    expect(onPageTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "turn-settle",
        source: "control-next",
        fromPage: 0,
        toPage: 1,
      }),
    );
    expect(onReadinessChange).toHaveBeenCalledWith(expect.objectContaining({ status: "reduced", ready: true }));
  });

  it("does not emit page-turn audio for a boundary no-op", () => {
    const onPageTurn = vi.fn();
    const onTurnLifecycle = vi.fn();
    const ref = createRef<PageFlipBookHandle>();

    render(
      <PhysicalJournalBook
        ref={ref}
        pages={pages}
        mode="reduced"
        openingPhase="JOURNAL_READY"
        interactive
        initialPage={0}
        coverTitle="The Lanternwake"
        coverSubtitle="Captain's journal"
        onPageTurn={onPageTurn}
        onTurnLifecycle={onTurnLifecycle}
      />,
    );

    ref.current?.previous();

    expect(onTurnLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "turn-cancel", reason: "page-boundary-no-op" }),
    );
    expect(onPageTurn).not.toHaveBeenCalled();
  });
});
