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
      // Remove only our previous crowded-Crew floor before reading the responsive minimum.
      scene.style.removeProperty("min-height");
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
      const chat = scene.querySelector<HTMLElement>(".muster-chat")!;
      const quote = scene.querySelector<HTMLElement>(".muster-quote")!;
      const lowerClearance = Math.max(
        chat.getBoundingClientRect().height +
          px(css.getPropertyValue("--muster-chat-bottom")) -
          px(css.getPropertyValue("--muster-lower-shift")),
        quote.getBoundingClientRect().height + 19 - px(css.getPropertyValue("--muster-lower-shift")),
      );
      const stageHeight = Math.max(height, gathering.getBoundingClientRect().height + lowerClearance + 32);
      if (stageHeight > height) scene.style.minHeight = `${stageHeight}px`;
      scene.style.setProperty("--muster-stage-height", `${stageHeight}px`);
    };
    calibrate();
    void document.fonts?.ready.then(calibrate);
    window.addEventListener("resize", calibrate);
    // New Crew rows may need more room. Options, parchment and chat changes never
    // trigger this observer, so the accepted lower-stage interactions stay anchored.
    const crewObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(calibrate);
    const gathering = scene.querySelector(".muster-gathering");
    if (gathering) crewObserver?.observe(gathering);
    return () => {
      active = false;
      window.removeEventListener("resize", calibrate);
      crewObserver?.disconnect();
    };
  }, [voyageId, loaded]);
  return stage;
}
