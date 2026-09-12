"use client";
import { useLayoutEffect, useRef } from "react";

/** Keep the approved closed-stage coordinates independent of later content growth. */
export function useMusterStage(voyageId: string, loaded: boolean) {
  const stage = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const scene = stage.current;
    if (!loaded || !scene) return;
    let active = true;
    const calibrate = () => {
      if (!active) return;
      const css = getComputedStyle(scene);
      if (!css.getPropertyValue("--muster-stage-min-row")) return;
      const paper = scene.querySelector<HTMLElement>(".muster-parchment")!;
      const content = scene.querySelector<HTMLElement>(".muster-paper-content")!;
      const gathering = scene.querySelector<HTMLElement>(".muster-gathering")!;
      const options = scene.querySelector<HTMLElement>(".muster-options-panel");
      const paperCss = getComputedStyle(paper);
      const px = (value: string) => parseFloat(value) || 0;
      const padding = px(css.paddingTop) + px(css.paddingBottom);
      // Subtract the disclosure before applying the existing parchment minimum.
      // Only viewport changes recalibrate; chat, options and text updates do not.
      const closedPaper = Math.max(
        px(paperCss.minHeight),
        content.getBoundingClientRect().height - (options?.getBoundingClientRect().height ?? 0),
      );
      const height = Math.max(
        px(css.minHeight),
        px(css.getPropertyValue("--muster-stage-min-row")) + padding,
        closedPaper + px(paperCss.marginTop) + px(paperCss.marginBottom) + padding,
        gathering.getBoundingClientRect().height + padding,
      );
      scene.style.setProperty("--muster-stage-height", `${height}px`);
    };
    calibrate();
    void document.fonts?.ready.then(calibrate);
    window.addEventListener("resize", calibrate);
    return () => {
      active = false;
      window.removeEventListener("resize", calibrate);
    };
  }, [voyageId, loaded]);
  return stage;
}
