"use client";

/* eslint-disable @next/next/no-img-element -- This boundary preserves arbitrary authorized media URLs and provides a truthful fallback. */

import { useState, type AudioHTMLAttributes, type ImgHTMLAttributes, type VideoHTMLAttributes } from "react";
import { MediaFallback } from "./AsyncState";

type ResilientImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  fallbackLabel: string;
  fallbackDetail?: string;
};

export function ResilientImage({
  src,
  alt,
  fallbackLabel,
  fallbackDetail = "Artwork is unavailable. The rest of this content remains usable.",
  className,
  ...props
}: ResilientImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src)
    return (
      <span className={className} data-resilient-image="fallback">
        <MediaFallback label={fallbackLabel} detail={fallbackDetail} />
      </span>
    );
  return (
    <img
      {...props}
      className={className}
      src={src}
      alt={alt ?? ""}
      data-resilient-image="ready"
      onError={() => setFailedSource(src)}
    />
  );
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
