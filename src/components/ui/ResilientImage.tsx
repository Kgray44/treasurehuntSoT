"use client";

/* eslint-disable @next/next/no-img-element -- This boundary preserves arbitrary authorized media URLs and provides a truthful fallback. */

import {
  useEffect,
  useState,
  type AudioHTMLAttributes,
  type ImgHTMLAttributes,
  type ReactNode,
  type VideoHTMLAttributes,
} from "react";
import { MediaFallback } from "./AsyncState";

type ResilientImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError" | "onLoad"> & {
  src: string | null | undefined;
  fallbackLabel: string;
  fallbackDetail?: string;
  fallback?: ReactNode;
  onError?: ImgHTMLAttributes<HTMLImageElement>["onError"];
  onLoad?: ImgHTMLAttributes<HTMLImageElement>["onLoad"];
};

type ImageState = "loading" | "slow" | "ready" | "failed" | "missing";

function ResilientImageSource({
  src,
  alt,
  fallbackLabel,
  fallbackDetail = "Artwork is unavailable. The rest of this content remains usable.",
  fallback,
  className,
  onError,
  onLoad,
  ...props
}: ResilientImageProps) {
  const [state, setState] = useState<ImageState>(src ? "loading" : "missing");
  useEffect(() => {
    if (!src) return;
    const timer = window.setTimeout(() => setState((current) => (current === "loading" ? "slow" : current)), 1_400);
    return () => window.clearTimeout(timer);
  }, [src]);

  if (!src || state === "failed") {
    if (fallback !== undefined)
      return (
        <span className={className} data-resilient-image="fallback">
          {fallback}
        </span>
      );
    return (
      <span className={className} data-resilient-image="fallback">
        <MediaFallback label={fallbackLabel} detail={fallbackDetail} />
      </span>
    );
  }
  return (
    <>
      <img
        {...props}
        className={className}
        src={src}
        alt={alt ?? ""}
        aria-busy={state === "loading" || state === "slow" || undefined}
        data-resilient-image={state}
        onError={(event) => {
          onError?.(event);
          setState("failed");
        }}
        onLoad={(event) => {
          onLoad?.(event);
          setState("ready");
        }}
      />
      {state === "slow" ? (
        <span className="ui-media-loading" data-media-state="slow" role="status">
          Loading {fallbackLabel.toLocaleLowerCase()}…
        </span>
      ) : null}
    </>
  );
}

export function ResilientImage(props: ResilientImageProps) {
  return <ResilientImageSource key={props.src ?? "missing"} {...props} />;
}

type ResilientVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "onError"> & {
  src: string | null | undefined;
  fallbackLabel: string;
  fallbackDetail?: string;
};

export function ResilientVideo({
  src,
  fallbackLabel,
  fallbackDetail = "Video playback is unavailable. Any nearby transcript and controls remain usable.",
  ...props
}: ResilientVideoProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src) return <MediaFallback label={fallbackLabel} detail={fallbackDetail} />;
  return <video {...props} src={src} data-resilient-video="ready" onError={() => setFailedSource(src)} />;
}

type ResilientAudioProps = Omit<AudioHTMLAttributes<HTMLAudioElement>, "src" | "onError"> & {
  src: string | null | undefined;
  fallbackLabel: string;
  fallbackDetail?: string;
};

export function ResilientAudio({
  src,
  fallbackLabel,
  fallbackDetail = "Audio playback is unavailable. Any nearby transcript and controls remain usable.",
  ...props
}: ResilientAudioProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src) return <MediaFallback label={fallbackLabel} detail={fallbackDetail} />;
  return <audio {...props} src={src} data-resilient-audio="ready" onError={() => setFailedSource(src)} />;
}
