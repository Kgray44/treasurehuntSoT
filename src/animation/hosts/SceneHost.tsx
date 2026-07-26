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
import {
  SceneHostContext,
  SceneHostLeaseContext,
  useAnimationAuthority,
  useOptionalSceneHost,
  type AnimationAuthority,
  type SceneHostLease,
} from "./SceneHostContext";
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

class PendingSceneTargetHandle implements SceneTargetHandle {
  private handle: SceneTargetHandle | null = null;
  private released = false;

  constructor(
    readonly input: SceneTargetRegistration,
    private readonly onRelease: () => void,
  ) {}

  get providerId() {
    return this.requireActive().providerId;
  }

  get hostId() {
    return this.requireActive().hostId;
  }

  get hostGeneration() {
    return this.requireActive().hostGeneration;
  }

  get targetId() {
    return this.requireActive().targetId;
  }

  get part() {
    return this.requireActive().part;
  }

  get targetGeneration() {
    return this.requireActive().targetGeneration;
  }

  activate(handle: SceneTargetHandle) {
    if (this.released) {
      handle.release();
      return;
    }
    this.handle = handle;
  }

  release = () => {
    if (this.released) return;
    this.released = true;
    this.handle?.release();
    this.handle = null;
    this.onRelease();
  };

  private requireActive() {
    if (!this.handle) throw new Error("Scene target lease is pending or released");
    return this.handle;
  }
}

class PhysicalSceneHostLease implements SceneHostHandle, SceneHostLease {
  private handle: SceneHostHandle | null = null;
  private root: HTMLElement | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly pendingTargets = new Set<PendingSceneTargetHandle>();

  constructor(
    private readonly authority: AnimationAuthority,
    private readonly hostKind: SceneHostKind,
    private readonly logicalKey: string | undefined,
  ) {}

  get providerId() {
    return this.requireActive().providerId;
  }

  get hostId() {
    return this.requireActive().hostId;
  }

  get kind() {
    return this.hostKind;
  }

  get generation() {
    return this.requireActive().generation;
  }

  getHandle = () => this.handle;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  attach(root: HTMLElement) {
    if (this.root === root && this.handle && this.authority.hosts.hostForRoot(root) === this.handle) return;
    const existingForRoot = this.authority.hosts.hostForRoot(root);
    if (existingForRoot && existingForRoot !== this.handle) existingForRoot.release();
    this.detach();
    this.root = root;
    this.handle = this.authority.hosts.registerHost({
      kind: this.hostKind,
      root,
      ...(this.logicalKey ? { hostKey: this.logicalKey } : {}),
    });
    this.activatePendingTargets();
    this.notify();
  }

  detach(root?: HTMLElement | null) {
    if (root && this.root !== root) return;
    const current = this.handle;
    this.pendingTargets.forEach((target) => target.release());
    this.pendingTargets.clear();
    this.handle = null;
    this.root = null;
    current?.release();
    this.notify();
  }

  beginScene(request: Parameters<SceneHostHandle["beginScene"]>[0]) {
    return this.requireActive().beginScene(request);
  }

  registerTarget(input: SceneTargetRegistration) {
    const current = this.handle;
    if (current && this.root && this.authority.hosts.hostForRoot(this.root) === current) {
      return current.registerTarget(input);
    }
    const pending = new PendingSceneTargetHandle(input, () => this.pendingTargets.delete(pending));
    this.pendingTargets.add(pending);
    return pending;
  }

  claimRuntimeSurface(input: Parameters<SceneHostHandle["claimRuntimeSurface"]>[0]) {
    return this.requireActive().claimRuntimeSurface(input);
  }

  exportTarget(input: Parameters<SceneHostHandle["exportTarget"]>[0]) {
    return this.requireActive().exportTarget(input);
  }

  snapshot() {
    return this.requireActive().snapshot();
  }

  release = () => this.detach();

  private requireActive() {
    const current = this.handle;
    if (!current || !this.root || this.authority.hosts.hostForRoot(this.root) !== current) {
      throw new Error("Scene host lease is not active");
    }
    return current;
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private activatePendingTargets() {
    const current = this.requireActive();
    for (const pending of [...this.pendingTargets]) {
      this.pendingTargets.delete(pending);
      pending.activate(current.registerTarget(pending.input));
    }
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
  const lease = useMemo(() => new PhysicalSceneHostLease(authority, kind, hostKey), [authority, hostKey, kind]);
  const handle = useSyncExternalStore(lease.subscribe, lease.getHandle, lease.getHandle);
  const registerRoot = useCallback(
    (root: HTMLElement | null) => {
      if (root) lease.attach(root);
      else lease.detach();
    },
    [lease],
  );

  return createElement(
    as,
    { ...props, ref: registerRoot, "data-scene-host-boundary": kind },
    <SceneHostLeaseContext.Provider value={lease}>
      <SceneHostContext.Provider value={handle}>{children}</SceneHostContext.Provider>
    </SceneHostLeaseContext.Provider>,
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
