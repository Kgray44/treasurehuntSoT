import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CroppedProfileImage, ProfileCropEditor, type CropValue } from "./ProfileCropEditor";

vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => <img {...props} /> }));

describe("Project Homeport Profile crop editor", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  function renderEditor(kind: "AVATAR" | "BANNER" = "AVATAR") {
    const onChange = vi.fn<(value: CropValue) => void>();
    const onCancel = vi.fn();
    render(
      <ProfileCropEditor
        kind={kind}
        previewUrl="blob:profile-preview"
        value={{ centerX: 0.5, centerY: 0.5, scale: 1, rotation: 0 }}
        hasExisting
        busy={false}
        onChange={onChange}
        onSave={vi.fn()}
        onReplace={vi.fn()}
        onCancel={onCancel}
        onRemove={vi.fn()}
      />,
    );
    return { onChange, onCancel };
  }

  it("homeport.owner-correction.round3.crop-keyboard provides non-drag positioning and zoom", () => {
    const { onChange } = renderEditor();
    const frame = screen.getByLabelText("avatar crop position");
    fireEvent.keyDown(frame, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ centerX: 0.515 }));
    fireEvent.keyDown(frame, { key: "+" });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ scale: 1.1 }));
  });

  it("contains focus, exposes a circular avatar frame, and closes on Escape", () => {
    const { onCancel } = renderEditor();
    expect(screen.getByRole("dialog", { name: "Position your avatar" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/stored result remains square/iu)).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("homeport.owner-correction.round3.banner-crop shows mobile and avatar safe-area consequences", () => {
    renderEditor("BANNER");
    expect(screen.getByText("Mobile safe area")).toBeVisible();
    expect(screen.getByText("Avatar overlap")).toBeVisible();
    expect(screen.getByRole("slider", { name: /Zoom/iu })).toHaveAttribute("max", "4");
  });

  it("uses the same bounded source crop window for modal and pending inline previews", () => {
    render(
      <div style={{ position: "relative", width: 400, height: 400 }}>
        <CroppedProfileImage
          kind="AVATAR"
          previewUrl="blob:profile-preview"
          crop={{ centerX: 0.75, centerY: 0.5, scale: 2, rotation: 0 }}
          alt="Pending avatar crop preview"
        />
      </div>,
    );
    const image = screen.getByAltText("Pending avatar crop preview");
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1200 },
      naturalHeight: { configurable: true, value: 800 },
    });
    fireEvent.load(image);
    expect(image).toHaveStyle({ left: "-175%", top: "-50%", width: "300%", height: "200%", opacity: "1" });
  });
});
