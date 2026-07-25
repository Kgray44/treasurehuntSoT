import type { NavigationItem } from "./types";

export function pathnameForHref(href: string) {
  return href.split("#", 1)[0] ?? href;
}

export function routePatternMatches(pathname: string, pattern: string) {
  const escaped = pattern
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment === ":id" || segment.startsWith(":")) return "[^/]+";
      if (segment === "*") return ".*";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${escaped}$`).test(pathname);
}

export function navigationItemMatches(pathname: string, item: NavigationItem) {
  const href = pathnameForHref(item.href);
  const candidates = [href, ...(item.aliases ?? [])];
  return candidates.some((candidate) => {
    if (item.match.type === "exact") return pathname === candidate;
    if (item.match.type === "prefix") return pathname === candidate || pathname.startsWith(`${candidate}/`);
    return routePatternMatches(pathname, item.match.pattern);
  });
}

export function activeNavigationItem(pathname: string, items: readonly NavigationItem[]) {
  const matches = items.filter((item) => navigationItemMatches(pathname, item));
  if (matches.length < 2) return matches[0] ?? null;
  return (
    [...matches].sort((left, right) => pathnameForHref(right.href).length - pathnameForHref(left.href).length)[0] ??
    null
  );
}
