import type { NavigationItem, WorkspaceId } from "./types";

export type NavigationExtension = Readonly<{
  id: "community" | "sealed-hold-operations" | "wayfarer-passport";
  workspace: WorkspaceId;
  enabledOnCurrentBase: boolean;
  items: readonly NavigationItem[];
  integrationNote: string;
}>;

/**
 * Deferred projects register here instead of independently modifying ProductShell.
 * Disabled entries are contracts only: they never create a broken destination.
 */
export const navigationExtensions: readonly NavigationExtension[] = [
  {
    id: "community",
    workspace: "community",
    enabledOnCurrentBase: false,
    items: [
      {
        id: "community-harbor-extension",
        label: "Community Harbor",
        href: "/community",
        match: { type: "prefix" },
        desktopOrder: 10,
        mobileOrder: 10,
      },
    ],
    integrationNote: "Enable only with Harborlight's /community route family and district registry.",
  },
  {
    id: "sealed-hold-operations",
    workspace: "creator",
    enabledOnCurrentBase: false,
    items: [
      {
        id: "sealed-hold-operations-extension",
        label: "Operational Readiness",
        href: "/studio/private-content/operations",
        match: { type: "prefix" },
        authenticated: true,
        capability: "administrator",
        desktopOrder: 90,
        mobileOrder: 90,
      },
    ],
    integrationNote: "Enable only when the Sealed Hold administrator operations route is present.",
  },
  {
    id: "wayfarer-passport",
    workspace: "account",
    enabledOnCurrentBase: false,
    items: [],
    integrationNote: "Wayfarer owns Passport History, Artifact Cabinet, and Achievements context sections.",
  },
];

export function enabledNavigationExtensions() {
  return navigationExtensions.filter((extension) => extension.enabledOnCurrentBase);
}
