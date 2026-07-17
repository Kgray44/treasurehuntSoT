"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { MotionMode } from "@/animation/core/animation-types";
import type { RiveAssetContract } from "@/animation/assets/rive-contracts";
import { AssetFallback } from "./AssetFallback";

export type RiveRuntimeInput = { name: string; type: "boolean" | "number" | "trigger"; value?: boolean | number };
export type RiveSignal = { name: string; value?: boolean | number; nonce: number };

const RiveRuntime = dynamic(() => import("./RiveRuntime").then((module) => module.RiveRuntime), {
  ssr: false,
  loading: () => <div className="rive-loading" aria-hidden="true" />,
});

export function RiveStatefulObject({
  asset,
  mode,
  label,
  className = "",
  signal,
  onInputs,
  onStatus,
}: {
  asset: RiveAssetContract;
  mode: MotionMode;
  label: string;
  className?: string;
  signal?: RiveSignal;
  onInputs?: (inputs: RiveRuntimeInput[]) => void;
  onStatus?: (status: "loading" | "ready" | "failed" | "fallback") => void;
}) {
  const canLoad = Boolean(asset.path) && (!asset.developmentOnly || process.env.NODE_ENV !== "production");
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);
  useEffect(() => {
    if (!canLoad) onStatusRef.current?.("fallback");
  }, [canLoad]);
  if (!canLoad) {
    return (
      <AssetFallback
        src={asset.fallback}
        label={`${label}. Original Rive artwork is not yet supplied; showing the production fallback.`}
        className={className}
      />
    );
  }
  return (
    <RiveRuntime
      asset={asset}
      mode={mode}
      label={label}
      className={className}
      signal={signal}
      onInputs={onInputs}
      onStatus={onStatus}
    />
  );
}
