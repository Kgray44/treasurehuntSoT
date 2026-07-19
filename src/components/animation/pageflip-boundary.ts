import type { AnimatedProperty, SceneHostId } from "@/animation/core/animation-types";
import type { SceneHostHandle, SceneTargetHandle } from "@/animation/hosts/scene-host-types";

export type PageFlipOrientation = "portrait" | "landscape";
export type PageFlipCloneLifecycle = "initializing" | "visible" | "settling" | "stale" | "disposed";
export type PageFlipCloneRole = "primary" | "temporary" | "unproven";

export type PageFlipSourceBoundary = Readonly<{
  pageFlipInstanceId: string;
  sourceGeneration: number;
  bookId: string;
  pageId: string;
  contentRevision: string;
  root: HTMLElement;
}>;

export type PageFlipCloneBoundary = Readonly<{
  pageFlipInstanceId: string;
  cloneGeneration: number;
  bookId: string;
  pageId: string;
  pageIndex: number;
  orientation: PageFlipOrientation;
  lifecycle: PageFlipCloneLifecycle;
  current: boolean;
  role: PageFlipCloneRole;
  root: HTMLElement;
}>;

export type PageFlipBoundarySnapshot = Readonly<{
  mountId: string;
  pageFlipInstanceId: string;
  runtimeGeneration: number;
  sourceGeneration: number;
  cloneGeneration: number;
  currentPage: number;
  orientation: PageFlipOrientation;
  lifecycle: PageFlipCloneLifecycle;
  primaryPageCount: number;
  temporaryCloneCount: number;
  retainedCloneRecordCount: number;
  detachedCloneRecordCount: number;
  registeredSourceTargetCount: number;
  registeredPrimaryTargetCount: number;
  disposed: boolean;
}>;

export type PageFlipPageTargetCapability = Readonly<{
  handle: SceneTargetHandle;
  targetKey: string;
  pageId: string;
  part: string;
  generation: number;
  role: "primary";
  current: boolean;
}>;

export type PageFlipPageTargetAuthority = Readonly<{
  hostId: SceneHostId;
  pageFlipInstanceId: string;
  cloneGeneration: number;
  targets: readonly PageFlipPageTargetCapability[];
}>;

type MutableCloneBoundary = {
  pageFlipInstanceId: string;
  cloneGeneration: number;
  bookId: string;
  pageId: string;
  pageIndex: number;
  orientation: PageFlipOrientation;
  lifecycle: PageFlipCloneLifecycle;
  current: boolean;
  role: PageFlipCloneRole;
  root: HTMLElement;
};

type PageFlipBoundaryInput = Readonly<{
  mountId: string;
  runtimeGeneration: number;
  bookId: string;
  runtimeRoot: HTMLElement;
  sourceRoot: HTMLElement;
  sceneHost: Pick<SceneHostHandle, "hostId" | "registerTarget">;
  onChange?: (snapshot: PageFlipBoundarySnapshot) => void;
  onPageTargetsChange?: (authority: PageFlipPageTargetAuthority | null) => void;
}>;

type RegisteredPageTarget = PageFlipPageTargetCapability & Readonly<{ element: Element }>;

type CloneInterceptor = Readonly<{
  runtimeRoot: HTMLElement;
  clone: (source: HTMLElement, clone: HTMLElement) => void;
}>;

const cloneBoundaries = new WeakMap<HTMLElement, MutableCloneBoundary>();
const cloneInterceptors = new Set<CloneInterceptor>();
let nativeCloneNode: typeof Element.prototype.cloneNode | null = null;
let mountSequence = 0;

const SINGLE_IDREF_ATTRIBUTES = ["list", "form", "aria-activedescendant", "aria-errormessage"] as const;
const MULTI_IDREF_ATTRIBUTES = [
  "for",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-details",
  "aria-flowto",
  "headers",
  "itemref",
] as const;
const URL_REFERENCE_ATTRIBUTES = [
  "href",
  "xlink:href",
  "clip-path",
  "fill",
  "filter",
  "mask",
  "marker-start",
  "marker-mid",
  "marker-end",
] as const;
const CINEMATIC_AUTHORITY_ATTRIBUTES = [
  "data-animation-owner",
  "data-scene-instance",
  "data-scene-instance-id",
  "data-scene-target-id",
] as const;
const TEMPORARY_MARKER_ATTRIBUTES = [
  "data-gsap-owned",
  "data-opening-actor",
  "data-scene-part",
  "data-scene-target-key",
] as const;
const PAGEFLIP_BOUNDARY_ATTRIBUTES = [
  "data-pageflip-source",
  "data-pageflip-role",
  "data-pageflip-primary",
  "data-pageflip-temporary-clone",
  "data-pageflip-unproven-clone",
  "data-pageflip-instance-id",
  "data-pageflip-source-generation",
  "data-pageflip-clone-generation",
  "data-pageflip-book-id",
  "data-pageflip-page-id",
  "data-pageflip-page-index",
  "data-pageflip-orientation",
  "data-pageflip-lifecycle",
  "data-pageflip-current",
  "data-pageflip-content-revision",
] as const;
const DELIBERATE_PAGE_TARGET_SELECTOR = "[data-scene-part][data-gsap-owned]";
const PAGE_TARGET_ALLOWED_PROPERTIES = [
  "transform",
  "opacity",
  "clip-path",
  "filter",
  "path-drawing",
  "stroke-dasharray",
  "stroke-dashoffset",
  "visibility",
] as const satisfies readonly AnimatedProperty[];

function safeToken(value: string) {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return token || "page";
}

function collisionFreeIdToken(value: string) {
  return Array.from(value, (character) => character.codePointAt(0)!.toString(16).padStart(6, "0")).join("");
}

function allElements(root: HTMLElement) {
  return [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
}

function stripAttributes(root: HTMLElement, attributes: readonly string[]) {
  for (const element of allElements(root)) {
    for (const attribute of attributes) element.removeAttribute(attribute);
  }
}

function rewriteIds(root: HTMLElement, namespace: string) {
  const idMap = new Map<string, string>();
  for (const element of allElements(root)) {
    if (!element.id) continue;
    const original = element.id;
    const next = `${namespace}-id${collisionFreeIdToken(original)}`;
    idMap.set(original, next);
    element.id = next;
  }

  for (const element of allElements(root)) {
    for (const attribute of SINGLE_IDREF_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      const replacement = value ? idMap.get(value) : undefined;
      if (replacement) element.setAttribute(attribute, replacement);
    }
    for (const attribute of MULTI_IDREF_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      element.setAttribute(
        attribute,
        value
          .split(/\s+/)
          .map((id) => idMap.get(id) ?? id)
          .join(" "),
      );
    }
    for (const attribute of URL_REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const fragment = value.match(/^#(.+)$/)?.[1];
      if (fragment && idMap.has(fragment)) {
        element.setAttribute(attribute, `#${idMap.get(fragment)!}`);
        continue;
      }
      element.setAttribute(
        attribute,
        value.replace(/url\(["']?#([^)'"\s]+)["']?\)/g, (match, id: string) =>
          idMap.has(id) ? `url(#${idMap.get(id)!})` : match,
        ),
      );
    }
    const style = element.getAttribute("style");
    if (style) {
      element.setAttribute(
        "style",
        style.replace(/url\(["']?#([^)'"\s]+)["']?\)/g, (match, id: string) =>
          idMap.has(id) ? `url(#${idMap.get(id)!})` : match,
        ),
      );
    }
  }
}

function suppressAccessibility(root: HTMLElement) {
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("inert", "");
  root.style.pointerEvents = "none";
  for (const element of root.querySelectorAll<HTMLElement>(
    "a[href],button,input,select,textarea,[tabindex],[contenteditable='true']",
  )) {
    element.tabIndex = -1;
  }
}

function stampClone(boundary: MutableCloneBoundary) {
  const { root } = boundary;
  root.dataset.pageflipInstanceId = boundary.pageFlipInstanceId;
  root.dataset.pageflipCloneGeneration = String(boundary.cloneGeneration);
  root.dataset.pageflipBookId = boundary.bookId;
  root.dataset.pageflipPageId = boundary.pageId;
  root.dataset.pageflipPageIndex = String(boundary.pageIndex);
  root.dataset.pageflipOrientation = boundary.orientation;
  root.dataset.pageflipLifecycle = boundary.lifecycle;
  root.dataset.pageflipRole = boundary.role;
  root.dataset.pageflipCurrent = String(boundary.current);
  if (boundary.role === "primary") root.dataset.pageflipPrimary = "";
  else delete root.dataset.pageflipPrimary;
  if (boundary.role === "temporary") root.dataset.pageflipTemporaryClone = "";
  else delete root.dataset.pageflipTemporaryClone;
  if (boundary.role === "unproven") root.dataset.pageflipUnprovenClone = "";
  else delete root.dataset.pageflipUnprovenClone;
}

function installCloneInterceptor(interceptor: CloneInterceptor) {
  cloneInterceptors.add(interceptor);
  if (cloneInterceptors.size === 1) {
    nativeCloneNode = Element.prototype.cloneNode;
    Element.prototype.cloneNode = function pageFlipCloneNode(this: Element, deep?: boolean) {
      const clone = nativeCloneNode!.call(this, deep) as Node;
      if (this instanceof HTMLElement && clone instanceof HTMLElement) {
        for (const candidate of cloneInterceptors) {
          if (candidate.runtimeRoot.contains(this)) candidate.clone(this, clone);
        }
      }
      return clone;
    } as typeof Element.prototype.cloneNode;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    cloneInterceptors.delete(interceptor);
    if (cloneInterceptors.size === 0 && nativeCloneNode) {
      Element.prototype.cloneNode = nativeCloneNode;
      nativeCloneNode = null;
    }
  };
}

export function createPageFlipMountId(bookId: string) {
  mountSequence += 1;
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${mountSequence.toString(36)}`;
  return `pageflip-${safeToken(bookId)}-${suffix}`;
}

export class PageFlipBoundaryController {
  readonly mountId: string;
  readonly pageFlipInstanceId: string;
  readonly runtimeGeneration: number;
  readonly bookId: string;
  private readonly runtimeRoot: HTMLElement;
  private readonly sourceRoot: HTMLElement;
  private readonly sceneHost: Pick<SceneHostHandle, "hostId" | "registerTarget">;
  private readonly onChange?: (snapshot: PageFlipBoundarySnapshot) => void;
  private readonly onPageTargetsChange?: (authority: PageFlipPageTargetAuthority | null) => void;
  private readonly observer: MutationObserver | null;
  private readonly releaseCloneInterceptor: () => void;
  private sourceGeneration = 0;
  private cloneGeneration = 0;
  private currentPage = 0;
  private orientation: PageFlipOrientation = "landscape";
  private lifecycle: PageFlipCloneLifecycle = "initializing";
  private primaryPages: HTMLElement[] = [];
  private sourceBoundaries: PageFlipSourceBoundary[] = [];
  private cloneBoundaryRecords: MutableCloneBoundary[] = [];
  private registeredPageTargets: RegisteredPageTarget[] = [];
  private temporaryCloneCount = 0;
  private disposed = false;

  constructor(input: PageFlipBoundaryInput) {
    this.mountId = input.mountId;
    this.runtimeGeneration = input.runtimeGeneration;
    this.bookId = input.bookId;
    this.runtimeRoot = input.runtimeRoot;
    this.sourceRoot = input.sourceRoot;
    this.sceneHost = input.sceneHost;
    this.onChange = input.onChange;
    this.onPageTargetsChange = input.onPageTargetsChange;
    this.pageFlipInstanceId = `${input.mountId}:runtime-${input.runtimeGeneration}`;
    this.runtimeRoot.dataset.pageflipMountId = this.mountId;
    this.runtimeRoot.dataset.pageflipInstanceId = this.pageFlipInstanceId;
    this.runtimeRoot.dataset.pageflipRuntimeGeneration = String(this.runtimeGeneration);
    this.releaseCloneInterceptor = installCloneInterceptor({
      runtimeRoot: this.runtimeRoot,
      clone: (source, clone) => this.interceptTemporaryClone(source, clone),
    });
    this.observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            for (const record of records) {
              for (const added of record.addedNodes) {
                if (added instanceof HTMLElement) this.inspectAddedTree(added);
              }
            }
            this.pruneCloneBoundaryRecords();
          });
    this.observer?.observe(this.runtimeRoot, { childList: true, subtree: true });
    this.emit();
  }

  preparePages(pageIds: readonly string[], contentRevision: string) {
    this.assertLive();
    this.releasePageTargetRegistrations();
    this.pruneCloneBoundaryRecords();
    const sources = Array.from(this.sourceRoot.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    if (sources.length !== pageIds.length) throw new Error("PageFlip source/page identity count mismatch");
    this.revokeCloneGeneration("stale");
    this.sourceGeneration += 1;
    this.cloneGeneration += 1;
    this.lifecycle = "initializing";
    this.sourceRoot.dataset.pageflipSource = "";
    this.sourceRoot.dataset.pageflipRole = "source";
    this.sourceRoot.dataset.pageflipInstanceId = this.pageFlipInstanceId;
    this.sourceRoot.dataset.pageflipSourceGeneration = String(this.sourceGeneration);
    this.sourceRoot.dataset.pageflipBookId = this.bookId;
    this.sourceRoot.setAttribute("aria-hidden", "true");
    this.sourceRoot.setAttribute("inert", "");

    this.sourceBoundaries = sources.map((source, pageIndex) => {
      const pageId = pageIds[pageIndex]!;
      stripAttributes(source, [...CINEMATIC_AUTHORITY_ATTRIBUTES, "data-pageflip-temporary-clone"]);
      source.dataset.pageflipSource = "";
      source.dataset.pageflipRole = "source";
      source.dataset.pageflipInstanceId = this.pageFlipInstanceId;
      source.dataset.pageflipSourceGeneration = String(this.sourceGeneration);
      source.dataset.pageflipBookId = this.bookId;
      source.dataset.pageflipPageId = pageId;
      source.dataset.pageflipPageIndex = String(pageIndex);
      source.dataset.pageflipContentRevision = contentRevision;
      const boundary: PageFlipSourceBoundary = {
        pageFlipInstanceId: this.pageFlipInstanceId,
        sourceGeneration: this.sourceGeneration,
        bookId: this.bookId,
        pageId,
        contentRevision,
        root: source,
      };
      return boundary;
    });

    this.primaryPages = sources.map((source, pageIndex) => {
      const clone = source.cloneNode(true) as HTMLElement;
      stripAttributes(clone, [...CINEMATIC_AUTHORITY_ATTRIBUTES, ...PAGEFLIP_BOUNDARY_ATTRIBUTES]);
      const pageId = pageIds[pageIndex]!;
      rewriteIds(
        clone,
        `pf-${safeToken(this.mountId)}-r${this.runtimeGeneration}-g${this.cloneGeneration}-p${pageIndex}`,
      );
      const boundary: MutableCloneBoundary = {
        pageFlipInstanceId: this.pageFlipInstanceId,
        cloneGeneration: this.cloneGeneration,
        bookId: this.bookId,
        pageId,
        pageIndex,
        orientation: this.orientation,
        lifecycle: "initializing",
        current: false,
        role: "primary",
        root: clone,
      };
      stampClone(boundary);
      cloneBoundaries.set(clone, boundary);
      return clone;
    });
    this.syncPageTargetRegistrations(false);
    this.emit();
    return this.primaryPages;
  }

  bindPrimaryPages(currentPage: number, orientation: PageFlipOrientation) {
    this.assertLive();
    this.releasePageTargetRegistrations();
    this.pruneCloneBoundaryRecords();
    this.currentPage = currentPage;
    this.orientation = orientation;
    this.lifecycle = "visible";
    for (const page of this.primaryPages) {
      const boundary = cloneBoundaries.get(page);
      if (!boundary || !this.runtimeRoot.contains(page)) {
        if (boundary) this.failClosed(boundary.root, boundary.pageId, boundary.pageIndex);
        continue;
      }
      boundary.orientation = orientation;
      boundary.lifecycle = "visible";
      boundary.current = boundary.pageIndex === currentPage;
      page.removeAttribute("aria-hidden");
      page.removeAttribute("inert");
      page.style.removeProperty("pointer-events");
      stampClone(boundary);
      this.trackCloneBoundary(boundary);
    }
    this.primaryPages = this.primaryPages.filter((page) => this.runtimeRoot.contains(page));
    this.pruneCloneBoundaryRecords();
    this.syncPageTargetRegistrations(true);
    this.emit();
  }

  updateCurrentPage(currentPage: number, lifecycle: "visible" | "settling" = "visible") {
    this.assertLive();
    this.releasePageTargetRegistrations();
    this.pruneCloneBoundaryRecords();
    this.currentPage = currentPage;
    this.lifecycle = lifecycle;
    for (const page of this.primaryPages) {
      const boundary = cloneBoundaries.get(page);
      if (!boundary) continue;
      boundary.current = boundary.pageIndex === currentPage;
      boundary.lifecycle = lifecycle;
      stampClone(boundary);
    }
    if (lifecycle === "visible") {
      for (const boundary of this.cloneBoundaryRecords) {
        if (boundary.role === "temporary" && boundary.lifecycle !== "disposed") {
          boundary.lifecycle = "disposed";
          boundary.current = false;
          suppressAccessibility(boundary.root);
          stampClone(boundary);
        }
      }
    }
    this.pruneCloneBoundaryRecords();
    this.syncPageTargetRegistrations(true);
    this.emit();
  }

  rebindOrientation(orientation: PageFlipOrientation, currentPage: number) {
    this.assertLive();
    this.releasePageTargetRegistrations();
    this.pruneCloneBoundaryRecords();
    const priorGeneration = this.cloneGeneration;
    const pages = this.primaryPages.map((page) => {
      const trusted = cloneBoundaries.get(page);
      return {
        page,
        trusted:
          trusted?.role === "primary" &&
          trusted.pageFlipInstanceId === this.pageFlipInstanceId &&
          trusted.cloneGeneration === priorGeneration
            ? { pageId: trusted.pageId, pageIndex: trusted.pageIndex }
            : null,
      };
    });
    this.revokeCloneGeneration("stale");
    this.cloneGeneration += 1;
    this.orientation = orientation;
    this.currentPage = currentPage;
    this.lifecycle = "visible";
    this.primaryPages = pages.map(({ page }) => page);
    for (const { page, trusted } of pages) {
      if (!trusted || !this.runtimeRoot.contains(page)) {
        this.failClosed(page, "unproven", -1);
        continue;
      }
      const { pageId, pageIndex } = trusted;
      const boundary: MutableCloneBoundary = {
        pageFlipInstanceId: this.pageFlipInstanceId,
        cloneGeneration: this.cloneGeneration,
        bookId: this.bookId,
        pageId,
        pageIndex,
        orientation,
        lifecycle: "visible",
        current: pageIndex === currentPage,
        role: "primary",
        root: page,
      };
      cloneBoundaries.set(page, boundary);
      this.trackCloneBoundary(boundary);
      page.removeAttribute("aria-hidden");
      page.removeAttribute("inert");
      page.style.removeProperty("pointer-events");
      stampClone(boundary);
    }
    this.primaryPages = this.primaryPages.filter((page) => this.runtimeRoot.contains(page));
    this.pruneCloneBoundaryRecords();
    this.syncPageTargetRegistrations(true);
    this.emit();
  }

  snapshot(): PageFlipBoundarySnapshot {
    this.pruneCloneBoundaryRecords();
    return Object.freeze({
      mountId: this.mountId,
      pageFlipInstanceId: this.pageFlipInstanceId,
      runtimeGeneration: this.runtimeGeneration,
      sourceGeneration: this.sourceGeneration,
      cloneGeneration: this.cloneGeneration,
      currentPage: this.currentPage,
      orientation: this.orientation,
      lifecycle: this.lifecycle,
      primaryPageCount: this.primaryPages.length,
      temporaryCloneCount: this.temporaryCloneCount,
      retainedCloneRecordCount: this.cloneBoundaryRecords.length,
      detachedCloneRecordCount: this.cloneBoundaryRecords.filter((boundary) => !boundary.root.isConnected).length,
      registeredSourceTargetCount: 0,
      registeredPrimaryTargetCount: this.registeredPageTargets.filter((target) => target.role === "primary").length,
      disposed: this.disposed,
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.lifecycle = "disposed";
    this.releasePageTargetRegistrations();
    for (const boundary of this.cloneBoundaryRecords) {
      boundary.lifecycle = "disposed";
      boundary.current = false;
      suppressAccessibility(boundary.root);
      stampClone(boundary);
    }
    this.cloneBoundaryRecords = [];
    this.primaryPages = [];
    this.sourceBoundaries = [];
    this.sourceRoot.removeAttribute("data-pageflip-instance-id");
    this.sourceRoot.removeAttribute("data-pageflip-source-generation");
    this.observer?.disconnect();
    this.releaseCloneInterceptor();
    this.onPageTargetsChange?.(null);
    this.emit();
  }

  private interceptTemporaryClone(source: HTMLElement, clone: HTMLElement) {
    const sourceBoundary = cloneBoundaries.get(source);
    if (!sourceBoundary || sourceBoundary.role !== "primary" || sourceBoundary.lifecycle === "disposed") {
      if (source.matches(".stf__item,[data-pageflip-role]")) this.failClosed(clone, "unproven", -1);
      return;
    }
    this.temporaryCloneCount += 1;
    stripAttributes(clone, [
      ...CINEMATIC_AUTHORITY_ATTRIBUTES,
      ...TEMPORARY_MARKER_ATTRIBUTES,
      ...PAGEFLIP_BOUNDARY_ATTRIBUTES,
    ]);
    rewriteIds(
      clone,
      `pf-${safeToken(this.mountId)}-r${this.runtimeGeneration}-g${this.cloneGeneration}-temp${this.temporaryCloneCount}`,
    );
    const boundary: MutableCloneBoundary = {
      ...sourceBoundary,
      lifecycle: "settling",
      current: false,
      role: "temporary",
      root: clone,
    };
    suppressAccessibility(clone);
    stampClone(boundary);
    cloneBoundaries.set(clone, boundary);
    this.trackCloneBoundary(boundary);
    this.pruneCloneBoundaryRecords();
    this.emit();
  }

  private inspectAddedTree(root: HTMLElement) {
    const candidates = [
      ...(root.matches(".stf__item,[data-pageflip-role]") ? [root] : []),
      ...Array.from(root.querySelectorAll<HTMLElement>(".stf__item,[data-pageflip-role]")),
    ];
    for (const candidate of candidates) {
      const boundary = cloneBoundaries.get(candidate);
      if (boundary && boundary.pageFlipInstanceId === this.pageFlipInstanceId) {
        this.trackCloneBoundary(boundary);
        continue;
      }
      if (candidate.dataset.pageflipRole === "source") continue;
      this.failClosed(
        candidate,
        candidate.dataset.pageflipPageId ?? "unproven",
        Number(candidate.dataset.pageflipPageIndex ?? -1),
      );
    }
    this.pruneCloneBoundaryRecords();
  }

  private failClosed(root: HTMLElement, pageId: string, pageIndex: number) {
    stripAttributes(root, [
      ...CINEMATIC_AUTHORITY_ATTRIBUTES,
      ...TEMPORARY_MARKER_ATTRIBUTES,
      ...PAGEFLIP_BOUNDARY_ATTRIBUTES,
    ]);
    this.temporaryCloneCount += 1;
    rewriteIds(
      root,
      `pf-${safeToken(this.mountId)}-r${this.runtimeGeneration}-g${this.cloneGeneration}-unproven${this.temporaryCloneCount}`,
    );
    const boundary: MutableCloneBoundary = {
      pageFlipInstanceId: this.pageFlipInstanceId,
      cloneGeneration: this.cloneGeneration,
      bookId: this.bookId,
      pageId,
      pageIndex,
      orientation: this.orientation,
      lifecycle: "stale",
      current: false,
      role: "unproven",
      root,
    };
    suppressAccessibility(root);
    stampClone(boundary);
    cloneBoundaries.set(root, boundary);
    this.trackCloneBoundary(boundary);
  }

  private revokeCloneGeneration(lifecycle: "stale" | "disposed") {
    this.releasePageTargetRegistrations();
    this.pruneCloneBoundaryRecords();
    for (const boundary of this.cloneBoundaryRecords) {
      if (boundary.cloneGeneration !== this.cloneGeneration || boundary.lifecycle === "disposed") continue;
      boundary.lifecycle = lifecycle;
      boundary.current = false;
      if (lifecycle === "stale") suppressAccessibility(boundary.root);
      stampClone(boundary);
    }
    this.primaryPages = [];
    this.pruneCloneBoundaryRecords();
  }

  private syncPageTargetRegistrations(includePrimary: boolean) {
    const registerPage = (root: HTMLElement, pageId: string, current: boolean) => {
      const candidates = [
        ...(root.matches(DELIBERATE_PAGE_TARGET_SELECTOR) ? [root] : []),
        ...Array.from(root.querySelectorAll<HTMLElement>(DELIBERATE_PAGE_TARGET_SELECTOR)),
      ].map((element) => {
        const part = element.dataset.scenePart?.trim() ?? "";
        const explicitKey = element.dataset.sceneTargetKey?.trim();
        return { element, part, markerKey: explicitKey || part };
      });
      const identityCounts = new Map<string, number>();
      for (const candidate of candidates) {
        const identity = `${candidate.part}:${candidate.markerKey}`;
        identityCounts.set(identity, (identityCounts.get(identity) ?? 0) + 1);
      }
      for (const candidate of candidates) {
        const identity = `${candidate.part}:${candidate.markerKey}`;
        if (!candidate.part || !candidate.markerKey || identityCounts.get(identity) !== 1) continue;
        const targetKey = [
          "pageflip",
          safeToken(pageId),
          "primary",
          `g${this.cloneGeneration}`,
          safeToken(candidate.part),
          safeToken(candidate.markerKey),
        ].join(":");
        const handle = this.sceneHost.registerTarget({
          targetKey,
          part: candidate.part,
          element: candidate.element,
          ownerHint: "gsap",
          allowedProperties: PAGE_TARGET_ALLOWED_PROPERTIES,
          pageFlip: {
            role: "visible-clone",
            generation: this.cloneGeneration,
            pageId,
            current,
          },
        });
        this.registeredPageTargets.push(
          Object.freeze({
            handle,
            targetKey,
            pageId,
            part: candidate.part,
            generation: this.cloneGeneration,
            role: "primary",
            current,
            element: candidate.element,
          }),
        );
      }
    };

    if (includePrimary) {
      for (const page of this.primaryPages) {
        const boundary = cloneBoundaries.get(page);
        if (
          boundary?.role === "primary" &&
          boundary.cloneGeneration === this.cloneGeneration &&
          this.runtimeRoot.contains(page)
        ) {
          registerPage(page, boundary.pageId, boundary.current);
        }
      }
    }
    if (includePrimary) {
      this.onPageTargetsChange?.(
        Object.freeze({
          hostId: this.sceneHost.hostId,
          pageFlipInstanceId: this.pageFlipInstanceId,
          cloneGeneration: this.cloneGeneration,
          targets: Object.freeze(
            this.registeredPageTargets.map((target) =>
              Object.freeze({
                handle: target.handle,
                targetKey: target.targetKey,
                pageId: target.pageId,
                part: target.part,
                generation: target.generation,
                role: target.role,
                current: target.current,
              }),
            ),
          ),
        }),
      );
    }
  }

  private releasePageTargetRegistrations() {
    if (this.registeredPageTargets.length > 0) this.onPageTargetsChange?.(null);
    for (const target of this.registeredPageTargets.splice(0)) target.handle.release();
  }

  private trackCloneBoundary(boundary: MutableCloneBoundary) {
    if (
      !boundary.root.isConnected ||
      cloneBoundaries.get(boundary.root) !== boundary ||
      this.cloneBoundaryRecords.includes(boundary)
    ) {
      return;
    }
    this.cloneBoundaryRecords.push(boundary);
  }

  private pruneCloneBoundaryRecords() {
    this.cloneBoundaryRecords = this.cloneBoundaryRecords.filter(
      (boundary) =>
        boundary.root.isConnected &&
        boundary.lifecycle !== "disposed" &&
        boundary.pageFlipInstanceId === this.pageFlipInstanceId &&
        cloneBoundaries.get(boundary.root) === boundary,
    );
  }

  private assertLive() {
    if (this.disposed) throw new Error("PageFlip boundary is disposed");
  }

  private emit() {
    this.onChange?.(this.snapshot());
  }
}

export function getPageFlipCloneBoundary(target: Element): PageFlipCloneBoundary | null {
  const root = target.closest<HTMLElement>("[data-pageflip-role]");
  return root ? (cloneBoundaries.get(root) ?? null) : null;
}

export function qualifiesPageFlipClone(
  target: Element,
  expected: Readonly<{
    pageFlipInstanceId: string;
    cloneGeneration: number;
    allowOffPage?: boolean;
  }>,
) {
  const boundary = getPageFlipCloneBoundary(target);
  if (!boundary) return false;
  const hidden =
    boundary.root.getAttribute("aria-hidden") === "true" ||
    boundary.root.hasAttribute("inert") ||
    boundary.root.hidden ||
    boundary.root.style.display === "none" ||
    boundary.root.style.visibility === "hidden";
  return Boolean(
    boundary.root.isConnected &&
      boundary.role === "primary" &&
      boundary.pageFlipInstanceId === expected.pageFlipInstanceId &&
      boundary.cloneGeneration === expected.cloneGeneration &&
      (boundary.lifecycle === "visible" || boundary.lifecycle === "settling") &&
      (boundary.current || expected.allowOffPage) &&
      !hidden,
  );
}
