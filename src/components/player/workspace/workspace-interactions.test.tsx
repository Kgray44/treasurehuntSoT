import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicArtifact, PublicSnapshot } from "@/domain/story";
import { sectionVariants } from "@/animation/motion/variants";
import { ArtifactInspection } from "./ArtifactInspection";
import { CompanionNavigation, MobileNavigation } from "./CompanionNavigation";
import { ObjectiveNote } from "./ObjectiveNote";

const unseen: PublicSnapshot["unseen"] = { journal: 0, chart: 2, treasures: 0, quests: 0, log: 0, finale: 0 };

describe("Motion workspace interactions", () => {
  it("keeps exit states in every mode while removing spatial travel in reduced mode", () => {
    expect(sectionVariants("full")).toMatchObject({ initial: { y: 18 }, exit: { y: -10 } });
    expect(sectionVariants("gentle")).toHaveProperty("exit");
    expect(sectionVariants("reduced")).toMatchObject({ initial: { y: 0 }, exit: { y: 0 } });
  });

  it("operates desktop/mobile navigation and preserves stable unseen semantics", () => {
    const navigate = vi.fn();
    const { rerender } = render(<CompanionNavigation view="journal" unseen={unseen} navigate={navigate} />);
    expect(screen.getByRole("button", { name: /Journal/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("2 unseen")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Chart/ }));
    expect(navigate).toHaveBeenCalledWith("chart");

    rerender(<MobileNavigation view="chart" unseen={unseen} navigate={navigate} />);
    expect(screen.getByRole("button", { name: /Chart, new content/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Finale/ }));
    expect(navigate).toHaveBeenLastCalledWith("finale");
  });

  it("expands the pinned objective through an accessible control", () => {
    const setExpanded = vi.fn();
    const returnToClue = vi.fn();
    const { rerender } = render(
      <ObjectiveNote
        objective="Follow the safe mark."
        chapter={1}
        hintCount={0}
        expanded={false}
        setExpanded={setExpanded}
        returnToClue={returnToClue}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(setExpanded).toHaveBeenCalledWith(true);
    rerender(
      <ObjectiveNote
        objective="Follow the safe mark."
        chapter={1}
        hintCount={1}
        expanded
        setExpanded={setExpanded}
        returnToClue={returnToClue}
      />,
    );
    expect(screen.getByRole("button", { name: "Fold note" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Return to clue" }));
    expect(returnToClue).toHaveBeenCalledOnce();
  });

  it("traps artifact dialog focus, closes with Escape, and restores the altar trigger", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Inspect relic";
    document.body.appendChild(trigger);
    trigger.focus();
    const close = vi.fn();
    const artifact: PublicArtifact = {
      key: "development-compass",
      state: "AWARDED",
      name: "Development Compass",
      description: "A safe test relic.",
      displayX: 50,
      displayY: 50,
      unseen: false,
    };
    const { unmount } = render(<ArtifactInspection artifact={artifact} close={close} restoreFocus={trigger} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close inspection" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
