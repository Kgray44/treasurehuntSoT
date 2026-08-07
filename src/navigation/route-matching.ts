import type { NavigationItem, ProjectedNavigationItem } from "./types";

export function pathnameForHref(href: string) {
  return href.split(/[?#]/u, 1)[0] ?? href;
}

export function routePatternMatches(pathname: string, pattern: string) {
  if (pattern === "*") return true;
  const escaped = pattern
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment.startsWith(":")) return "[^/]+";
      if (segment === "*") return ".*";
      return segment.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    })
    .join("/");
  return new RegExp(`^${escaped}$`, "u").test(pathname);
}

export function navigationItemMatches(pathname: string, item: Pick<ProjectedNavigationItem, "href" | "activeMatch">) {
  switch (item.activeMatch.type) {
    case "EXACT":
      return item.href !== null && pathname === pathnameForHref(item.href);
    case "SECTION": {
      if (item.href === null) return false;
      const candidate = pathnameForHref(item.href);
      return pathname === candidate || pathname.startsWith(`${candidate}/`);
    }
    case "DYNAMIC_FAMILY":
      return routePatternMatches(pathname, item.activeMatch.pattern);
    case "ALIAS_OF":
      return routePatternMatches(pathname, item.activeMatch.pattern);
    case "NEVER_ACTIVE":
      return false;
  }
}

export function activeNavigationItem(pathname: string, items: readonly ProjectedNavigationItem[]) {
  const matches = items.filter((item) => navigationItemMatches(pathname, item));
  return (
    [...matches].sort((left, right) => {
      const leftLength = left.href ? pathnameForHref(left.href).length : 0;
      const rightLength = right.href ? pathnameForHref(right.href).length : 0;
      return rightLength - leftLength || left.order - right.order;
    })[0] ?? null
  );
}

export function resolveAliasTarget(pathname: string, registry: readonly NavigationItem[]) {
  const alias = registry.find(
    (item) => item.activeMatch.type === "ALIAS_OF" && routePatternMatches(pathname, item.activeMatch.pattern),
  );
  return alias?.activeMatch.type === "ALIAS_OF" ? alias.activeMatch.canonicalItemId : null;
}
