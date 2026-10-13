import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { createSpatialDraft } from "@/parallax/authoring";
import {
  assistantSceneDigest,
  materializeAssistantProposal,
  type AssistantProposal,
} from "@/parallax/spatial-assistant";
import { SpatialAssistant, type SpatialAssistantProps, type SpatialAssistantReply } from "./SpatialAssistant";
vi.mock("@/animation/motion/useMotionMode", () => ({ useMotionMode: () => ({ mode: "reduced" }) }));
const draft = createSpatialDraft("synthetic-component");
const usage = {
  enabled: true,
  advancedEnabled: false,
  allowance: 500,
  used: 0,
  remaining: 500,
  resetAt: "2026-11-01T00:00:00Z",
  source: "INHERITED" as const,
  nearingLimit: false,
};
const props = (): SpatialAssistantProps => ({
  draft,
  revision: 1,
  editorGeneration: 0,
  selectedEntityId: draft.content.entities[0].id,
  accountId: "synthetic-user",
  usage,
  port: {
    prepareBase: vi.fn(async () => ({ draft, revision: 1, editorGeneration: 0 })),
    request: vi.fn(async () => ({ status: "UNAVAILABLE", message: "Synthetic provider unavailable" })),
    apply: vi.fn(async (proposal, ids) => ({
      status: "SAVED" as const,
      draft: await materializeAssistantProposal(draft, 1, proposal, ids, 0),
      revision: 2,
    })),
  },
  onPreview: vi.fn(),
  onSelect: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  canUndo: true,
  canRedo: false,
});
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function proposal(): Promise<AssistantProposal> {
  return {
    schemaVersion: 1,
    requestId: "synthetic-request",
    definitionId: draft.content.definitionId,
    sceneRevision: 1,
    editorGeneration: 0,
    sceneDigest: await assistantSceneDigest(draft),
    intentType: "EDIT",
    summary: "Move the map to the entrance",
    clarification: null,
    assumptions: [],
    unsupportedCapabilities: [],
    warnings: [],
    accessibilityNotes: ["Guided reading remains available"],
    creatorExplanation: "The same map will be placed near the entrance.",
    operations: [
      {
        id: "move",
        type: "PLACEMENT",
        entityId: draft.content.entities[0].id,
        dependsOn: [],
        explanation: "Bring the clue closer to the doorway.",
        placement: "ENTRANCE",
      },
    ],
  };
}
describe("Spatial Assistant deliberate, accessible proposal review", () => {
  it("waits for the exact saved render and exposes location recovery instead of confirming an offscreen object", async () => {
    const input = props(),
      checked = await proposal();
    input.port.request = vi.fn(async () => ({ status: "PROPOSED", proposal: checked }));
    input.onCanvasView = vi.fn();
    input.renderedSceneVersion = JSON.stringify(draft);
    input.renderedEntities = { [draft.content.entities[0].id]: "IN_VIEW" };
    const view = render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move the map" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply all changes" }));
    await screen.findByText(/Canvas confirmation is pending/);
    const saved = await materializeAssistantProposal(draft, 1, checked, ["move"], 0);
    view.rerender(
      <SpatialAssistant
        {...input}
        renderedSceneVersion={JSON.stringify(saved)}
        renderedEntities={{ [draft.content.entities[0].id]: "OUTSIDE_VIEW" }}
      />,
    );
    await screen.findByText(/outside the current view/);
    fireEvent.click(screen.getByRole("button", { name: `Locate ${draft.content.entities[0].name} in canvas` }));
    expect(input.onSelect).toHaveBeenCalledWith(draft.content.entities[0].id);
    expect(input.onCanvasView).toHaveBeenCalled();
    view.rerender(
      <SpatialAssistant
        {...input}
        renderedSceneVersion={JSON.stringify(saved)}
        renderedEntities={{ [draft.content.entities[0].id]: "IN_VIEW" }}
      />,
    );
    await screen.findByText(/rendered in the current view/);
    expect(screen.queryByText(/Canvas confirmation is pending/)).not.toBeInTheDocument();
    view.rerender(<SpatialAssistant {...input} renderedSceneVersion={undefined} renderedEntities={{}} />);
    await screen.findByText(/Canvas confirmation is pending/);
    expect(screen.queryByText(/rendered in the current view/)).not.toBeInTheDocument();
  });
  it("carries the retained request identity into a deliberate clarification answer", async () => {
    const input = props(),
      checked = {
        ...(await proposal()),
        intentType: "CLARIFICATION" as const,
        clarification: "Which map should move?",
        operations: [],
      };
    const requestPort = vi
      .fn<SpatialAssistantProps["port"]["request"]>()
      .mockResolvedValueOnce({ status: "PROPOSED", proposal: checked })
      .mockResolvedValue({ status: "UNAVAILABLE", message: "Synthetic provider unavailable" });
    input.port.request = requestPort;
    render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move a map" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await screen.findByText("Which map should move?");
    await waitFor(() => expect(screen.getByRole("region", { name: "Review spatial proposal" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Refine this proposal" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "The selected map" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await waitFor(() => expect(requestPort).toHaveBeenCalledTimes(2));
    expect(requestPort.mock.calls[1][0]).toMatchObject({
      request: "The selected map",
      previousRequestId: checked.requestId,
    });
    expect(input.port.apply).not.toHaveBeenCalled();
  });
  it("starts a fresh task without inference, retained context, preview or scene mutation", async () => {
    const input = props(),
      checked = await proposal();
    const requestPort = vi
      .fn<SpatialAssistantProps["port"]["request"]>()
      .mockResolvedValue({ status: "PROPOSED", proposal: checked });
    input.port.request = requestPort;
    render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move it" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await screen.findByRole("button", { name: "Apply all changes" });
    fireEvent.click(screen.getByRole("button", { name: "Start new task" }));
    expect(requestPort).toHaveBeenCalledTimes(1);
    expect(input.port.apply).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Apply all changes" })).not.toBeInTheDocument();
    expect(sessionStorage.getItem(`parallax.assistant.v1:synthetic-user:${draft.content.definitionId}`)).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Review accessibility" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await waitFor(() => expect(requestPort).toHaveBeenCalledTimes(2));
    expect(requestPort.mock.calls[1][0].previousRequestId).toBeNull();
  });
  it("restores only recent account/draft metadata and clears context on account switch", async () => {
    const input = props();
    sessionStorage.setItem(
      `parallax.assistant.v1:synthetic-user:${draft.content.definitionId}`,
      JSON.stringify({ lastRequestAt: Date.now(), previousRequestId: "synthetic-prior-context" }),
    );
    const view = render(<SpatialAssistant {...input} />);
    await screen.findByText(/Your task session is restored/);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Continue the previous idea" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await waitFor(() => expect(input.port.request).toHaveBeenCalledTimes(1));
    expect(vi.mocked(input.port.request).mock.calls[0][0].previousRequestId).toBe("synthetic-prior-context");
    await screen.findByText("Synthetic provider unavailable");
    view.rerender(<SpatialAssistant {...input} accountId="different-synthetic-user" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A new account task" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await waitFor(() => expect(input.port.request).toHaveBeenCalledTimes(2));
    expect(vi.mocked(input.port.request).mock.calls[1][0].previousRequestId).toBeNull();
  });
  it("rejects an async proposal after edit followed by Undo even when the draft bytes match", async () => {
    const input = props(),
      checked = await proposal();
    let resolveReply!: (value: { status: string; proposal: AssistantProposal }) => void;
    input.port.request = vi.fn(
      () =>
        new Promise<{ status: string; proposal: AssistantProposal }>((resolve) => {
          resolveReply = resolve;
        }),
    );
    const view = render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move the map" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await waitFor(() => expect(input.port.request).toHaveBeenCalledTimes(1));
    view.rerender(<SpatialAssistant {...input} editorGeneration={2} />);
    await act(async () => {
      resolveReply({ status: "PROPOSED", proposal: checked });
    });
    await screen.findByText(/Your scene has changed/);
    expect(screen.queryByRole("button", { name: "Apply all changes" })).not.toBeInTheDocument();
    expect(input.port.apply).not.toHaveBeenCalled();
  });
  it("retries uncertain save outcomes using the same application identity", async () => {
    const input = props(),
      checked = await proposal();
    input.port.request = vi.fn(async () => ({ status: "PROPOSED", proposal: checked }));
    const applyPort = vi
      .fn(input.port.apply)
      .mockRejectedValueOnce(new Error("Save acknowledgement uncertain. Retry the reviewed change."));
    input.port.apply = applyPort;
    render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move the map" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await screen.findByRole("heading", { name: checked.summary });
    fireEvent.click(screen.getByRole("button", { name: "Apply all changes" }));
    await screen.findByText(/Save acknowledgement uncertain/);
    expect(screen.queryByText("Your changes are saved")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply all changes" }));
    await screen.findByText("Your changes are saved");
    expect(applyPort.mock.calls[0][2]).toBe(applyPort.mock.calls[1][2]);
  });
  it("shows usable welcome examples without inference while typing or rerendering", () => {
    const input = props();
    const view = render(<SpatialAssistant {...input} />);
    expect(screen.getByRole("heading", { name: /What would you like/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Place an object/ }));
    expect(screen.getByRole("textbox", { name: "Describe your spatial idea" })).toHaveValue(
      "Place a readable old pirate note on a desk near the entrance.",
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move the map" } });
    view.rerender(<SpatialAssistant {...input} />);
    expect(input.port.request).not.toHaveBeenCalled();
  });
  it("submits once after preparing the saved snapshot and permits multiline Shift+Enter", async () => {
    const input = props();
    render(<SpatialAssistant {...input} />);
    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "Move the map" } });
    fireEvent.keyDown(textbox, { key: "Enter", shiftKey: true });
    expect(input.port.request).not.toHaveBeenCalled();
    fireEvent.keyDown(textbox, { key: "Enter", shiftKey: false });
    await waitFor(() => expect(input.port.request).toHaveBeenCalledTimes(1));
    expect(input.port.prepareBase).toHaveBeenCalledTimes(1);
    expect(input.port.request).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "STANDARD", selectedEntityId: draft.content.entities[0].id, revision: 1 }),
      expect.any(AbortSignal),
    );
    await screen.findByText("Synthetic provider unavailable");
  });
  it("replaces welcome content with recovery feedback while preserving the submitted request", async () => {
    const input = props();
    render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move the map" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await screen.findByText("Synthetic provider unavailable");
    expect(screen.queryByRole("heading", { name: /What would you like/ })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Move the map");
    expect(screen.getByRole("button", { name: /Send idea/ })).toBeEnabled();
  });
  it("requires preview and explicit apply before calling the canonical edit port", async () => {
    const input = props(),
      checked = await proposal();
    input.port.request = vi.fn(async () => ({ status: "PROPOSED", proposal: checked }));
    render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move the map" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await screen.findByRole("heading", { name: checked.summary });
    expect(input.port.apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Proposed scene" }));
    await waitFor(() =>
      expect(input.onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.objectContaining({ definitionId: draft.content.definitionId }) }),
        [draft.content.entities[0].id],
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply all changes" }));
    await waitFor(() => expect(input.port.apply).toHaveBeenCalledWith(checked, ["move"], expect.any(String)));
    await screen.findByText(/Reviewed changes are saved/);
  });
  it("rejects stale review after newer Creator edits", async () => {
    const input = props();
    input.port.request = vi.fn(async () => ({ status: "PROPOSED", proposal: await proposal() }));
    const view = render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move the map" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await screen.findByRole("button", { name: "Apply all changes" });
    const changed = structuredClone(draft);
    changed.content.entities[0].name = "Creator's newer map";
    view.rerender(<SpatialAssistant {...input} draft={changed} />);
    await screen.findByText(/Your scene has changed/);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Apply all changes" })).not.toBeInTheDocument());
    expect(input.port.apply).not.toHaveBeenCalled();
  });
  it("reports acceptance only after the save port succeeds", async () => {
    const input = props();
    input.port.request = vi.fn(async () => ({ status: "PROPOSED", proposal: await proposal() }));
    input.port.apply = vi.fn(async () => {
      throw new Error("Synthetic save conflict");
    });
    render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move it" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply all changes" }));
    await screen.findByText("Synthetic save conflict");
    expect(screen.queryByText("Your changes are saved")).not.toBeInTheDocument();
  });
  it("cancels without a native form resubmit and ignores a late provider reply", async () => {
    const input = props();
    const signals: (AbortSignal | undefined)[] = [];
    let finish!: (reply: SpatialAssistantReply) => void;
    input.port.request = vi.fn((_request: unknown, signal?: AbortSignal) => {
      signals.push(signal);
      return new Promise<SpatialAssistantReply>((resolve) => {
        finish = resolve;
      });
    });
    render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move it" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await waitFor(() => expect(input.port.request).toHaveBeenCalledTimes(1));
    act(() => screen.getByRole("button", { name: "Cancel request" }).click());
    await screen.findByText("Assistance cancelled. Your scene is unchanged.");
    expect(screen.getByText("Request cancelled")).toBeInTheDocument();
    expect(screen.queryByText("FROM IDEA TO EXPERIENCE")).not.toBeInTheDocument();
    expect(input.port.request).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => {
      finish({ status: "PROPOSED", proposal: await proposal() });
    });
    expect(screen.queryByRole("button", { name: "Apply all changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });
  it("keeps disabled AI, quota state, collapse and history accessible", async () => {
    const input = props();
    render(<SpatialAssistant {...input} usage={{ ...usage, enabled: false, used: 500, remaining: 0 }} />);
    expect(screen.getByRole("button", { name: /Send idea/ })).toBeDisabled();
    expect(screen.getByText(/keep editing manually/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(input.onUndo).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Collapse Spatial Assistant" }));
    fireEvent.click(screen.getByRole("button", { name: /Spatial Assistant.*Describe your next idea/ }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
  it("stores bounded session metadata without prompt or private scene content", async () => {
    const input = props();
    input.port.request = vi.fn(async () => ({ status: "PROPOSED", proposal: await proposal() }));
    render(<SpatialAssistant {...input} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "PRIVATE_CREATOR_REQUEST" } });
    fireEvent.click(screen.getByRole("button", { name: /Send idea/ }));
    await screen.findByRole("button", { name: "Apply all changes" });
    expect(sessionStorage.getItem(`parallax.assistant.v1:synthetic-user:${draft.content.definitionId}`)).not.toMatch(
      /PRIVATE_CREATOR_REQUEST|Follow the compass/,
    );
  });
});
