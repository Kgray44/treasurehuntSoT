"use client";

import {
  createElement,
  useCallback,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { AnimatedProperty, SceneHostKind } from "../core/animation-types";
import { SceneHostContext, useAnimationAuthority, useOptionalSceneHost } from "./SceneHostContext";
import type {
  RuntimeOwnedSceneTargetBinding,
  RuntimeOwnedSceneTargetInput,
  RuntimeSurfaceLease,
  SceneHostHandle,
  SceneTargetHandle,
  SceneTargetRegistration,
} from "./scene-host-types";

type SceneHostElement = "div" | "section" | "main" | "aside";

class RegistrationCell<T extends { release: () => void }> {
  private value: T | null = null;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.value;

  replace(next: T | null) {
    if (this.value === next) return;
    this.value?.release();
    this.value = next;
    this.listeners.forEach((listener) => listener());
  }
}

class BoundElementCell {
  private value: Element | null = null;

  get() {
    return this.value;
  }

  set(element: Element | null) {
    this.value = element;
  }
}

export type SceneHostProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  kind: SceneHostKind;
  hostKey?: string;
  as?: SceneHostElement;
  children: ReactNode;
};

export function SceneHost({ kind, hostKey, as = "div", children, ...props }: SceneHostProps) {
  const authority = useAnimationAuthority();
  const cell = useMemo(() => new RegistrationCell<SceneHostHandle>(), []);
  const handle = useSyncExternalStore(cell.subscribe, cell.getSnapshot, cell.getSnapshot);
  const registerRoot = useCallback(
    (root: HTMLElement | null) => {
      cell.replace(root ? authority.hosts.registerHost({ kind, root, ...(hostKey ? { hostKey } : {}) }) : null);
    },
    [authority.hosts, cell, hostKey, kind],
  );

  return createElement(
    as,
    { ...props, ref: registerRoot, "data-scene-host-boundary": kind },
    <SceneHostContext.Provider value={handle}>{children}</SceneHostContext.Provider>,
  );
}

export function useSceneTargetRegistration(
  input: Omit<SceneTargetRegistration, "element">,
): Readonly<{ bindTarget: (element: Element | null) => void; handle: SceneTargetHandle | null }> {
  const host = useOptionalSceneHost();
  const cell = useMemo(() => new RegistrationCell<SceneTargetHandle>(), []);
  const handle = useSyncExternalStore(cell.subscribe, cell.getSnapshot, cell.getSnapshot);
  const stableInput = useMemo(
    () => ({
      ...input,
      allowedProperties: [...input.allowedProperties],
      ...(input.pageFlip ? { pageFlip: { ...input.pageFlip } } : {}),
    }),
    [input],
  );
  const bindTarget = useCallback(
    (element: Element | null) => {
      cell.replace(element && host ? host.registerTarget({ ...stableInput, element }) : null);
    },
    [cell, host, stableInput],
  );

  return useMemo(() => Object.freeze({ bindTarget, handle }), [bindTarget, handle]);
}

type RuntimeOwnedRegistration = Readonly<{
  element: Element;
  version: string;
  handle: SceneTargetHandle;
  lease: RuntimeSurfaceLease;
  release: () => void;
}>;

/**
 * Registers and claims a runtime-owned target inside the ref commit boundary.
 * Consumers must omit Motion layout/layoutId/animate props until `ownershipReady` is true.
 */
export function useRuntimeOwnedSceneTarget(input: RuntimeOwnedSceneTargetInput): RuntimeOwnedSceneTargetBinding {
  const host = useOptionalSceneHost();
  const cell = useMemo(() => new RegistrationCell<RuntimeOwnedRegistration>(), []);
  const registration = useSyncExternalStore(cell.subscribe, cell.getSnapshot, cell.getSnapshot);
  const elementCell = useMemo(() => new BoundElementCell(), []);
  const allowedPropertiesKey = input.allowedProperties.join("\u0000");
  const claimedPropertiesKey = input.properties.join("\u0000");
  const pageFlipRole = input.pageFlip?.role;
  const pageFlipGeneration = input.pageFlip?.generation;
  const pageFlipPageId = input.pageFlip?.pageId;
  const pageFlipCurrent = input.pageFlip?.current;
  const registrationVersion = [
    input.targetKey,
    input.part,
    input.runtime,
    input.allowedProperties.join(","),
    input.properties.join(","),
    input.pageFlip?.role ?? "",
    input.pageFlip?.generation ?? "",
    input.pageFlip?.pageId ?? "",
    input.pageFlip?.current ?? "",
  ].join("\u0000");
  const stableInput = useMemo(
    () => ({
      targetKey: input.targetKey,
      part: input.part,
      runtime: input.runtime,
      allowedProperties: Object.freeze(
        allowedPropertiesKey ? allowedPropertiesKey.split("\u0000") : [],
      ) as readonly AnimatedProperty[],
      properties: Object.freeze(
        claimedPropertiesKey ? claimedPropertiesKey.split("\u0000") : [],
      ) as readonly AnimatedProperty[],
      ...(pageFlipRole && pageFlipGeneration !== undefined && pageFlipPageId && pageFlipCurrent !== undefined
        ? {
            pageFlip: Object.freeze({
              role: pageFlipRole,
              generation: pageFlipGeneration,
              pageId: pageFlipPageId,
              current: pageFlipCurrent,
            }),
          }
        : {}),
    }),
    [
      allowedPropertiesKey,
      claimedPropertiesKey,
      input.part,
      input.runtime,
      input.targetKey,
      pageFlipCurrent,
      pageFlipGeneration,
      pageFlipPageId,
      pageFlipRole,
    ],
  );
  const registerElement = useCallback(
    (element: Element) => {
      if (!host) {
        cell.replace(null);
        return;
      }
      const current = cell.getSnapshot();
      if (current?.element === element && current.version === registrationVersion) return;
      cell.replace(null);
      let handle: SceneTargetHandle | null = null;
      try {
        handle = host.registerTarget({
          targetKey: stableInput.targetKey,
          part: stableInput.part,
          element,
          ownerHint: stableInput.runtime,
          allowedProperties: stableInput.allowedProperties,
          ...(stableInput.pageFlip ? { pageFlip: stableInput.pageFlip } : {}),
        });
        const result = host.claimRuntimeSurface({
          target: handle,
          element,
          runtime: stableInput.runtime,
          properties: stableInput.properties,
        });
        if (result.status !== "granted") {
          handle.release();
          cell.replace(null);
          return;
        }
        const targetHandle = handle;
        let released = false;
        cell.replace(
          Object.freeze({
            element,
            version: registrationVersion,
            handle: targetHandle,
            lease: result,
            release: () => {
              if (released) return;
              released = true;
              result.release();
              targetHandle.release();
            },
          }),
        );
      } catch {
        handle?.release();
        cell.replace(null);
      }
    },
    [cell, host, registrationVersion, stableInput],
  );
  const bindTarget = useCallback(
    (element: Element | null) => {
      elementCell.set(element);
      if (!element) {
        cell.replace(null);
        return;
      }
      registerElement(element);
    },
    [cell, elementCell, registerElement],
  );

  useLayoutEffect(() => {
    const element = elementCell.get();
    if (element) registerElement(element);
  }, [elementCell, registerElement]);

  useLayoutEffect(
    () => () => {
      elementCell.set(null);
      cell.replace(null);
    },
    [cell, elementCell],
  );

  return useMemo(
    () =>
      Object.freeze({
        bindTarget,
        handle: registration?.handle ?? null,
        lease: registration?.lease ?? null,
        ownershipReady: Boolean(registration),
      }),
    [bindTarget, registration],
  );
}
