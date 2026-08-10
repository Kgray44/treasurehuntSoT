"use client";

export function StudioSelectionToolbar({
  selectedTitle,
  selectionCount,
  onPreview,
  onPreviewFromHere,
  onCloseInspector,
  onMoveSelection,
}: {
  selectedTitle: string | null;
  selectionCount: number;
  onPreview: () => void;
  onPreviewFromHere: () => void;
  onCloseInspector: () => void;
  onMoveSelection: () => void;
}) {
  if (!selectedTitle) return null;
  return (
    <aside className="studio-selection-toolbar" aria-label="Selected Passage tools">
      <div>
        <p className="eyebrow">Selected Passage</p>
        <strong>{selectionCount} {selectionCount === 1 ? "Passage" : "Passages"} selected</strong>
      </div>
      <div>
        <button type="button" onClick={onPreview}>
          Preview Passage
        </button>
        <button type="button" onClick={onPreviewFromHere}>
          Preview from here
        </button>
        {selectionCount > 1 ? (
          <button type="button" onClick={onMoveSelection}>
            Move selection to next chapter
          </button>
        ) : null}
        <button type="button" onClick={onCloseInspector}>
          Close Inspector
        </button>
      </div>
    </aside>
  );
}
