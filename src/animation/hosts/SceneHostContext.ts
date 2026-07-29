"use client";

import { createContext, useContext } from "react";
import type { AnimationProviderId } from "../core/animation-types";
import type { AnimationOwnershipRegistry } from "../core/ownership";
import type { SceneHostRegistry } from "./scene-host-registry";
import type { SceneHostHandle } from "./scene-host-types";

export type AnimationAuthority = Readonly<{
  providerId: AnimationProviderId;
  hosts: SceneHostRegistry;
  ownership: AnimationOwnershipRegistry;
}>;

export const AnimationAuthorityContext = createContext<AnimationAuthority | null>(null);
export const SceneHostContext = createContext<SceneHostHandle | null>(null);

export type SceneHostLease = Pick<
  SceneHostHandle,
  "beginScene" | "registerTarget" | "claimRuntimeSurface" | "exportTarget" | "snapshot" | "release"
> &
  Readonly<{
    getHandle: () => SceneHostHandle | null;
    subscribe: (listener: () => void) => () => void;
  }>;

export const SceneHostLeaseContext = createContext<SceneHostLease | null>(null);

export function useAnimationAuthority() {
  const authority = useContext(AnimationAuthorityContext);
  if (!authority) throw new Error("SceneHost requires an AnimationProvider");
  return authority;
}

export function useSceneHost() {
  const host = useContext(SceneHostContext);
  if (!host) throw new Error("A registered SceneHost is required");
  return host;
}

export function useOptionalSceneHost() {
  return useContext(SceneHostContext);
}

export function useOptionalSceneHostLease() {
  return useContext(SceneHostLeaseContext);
}
