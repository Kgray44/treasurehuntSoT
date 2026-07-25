import { canonicalTerms } from "@/language/canonical-terms";
import { platformCopy } from "@/language/platform-copy";
import type { NavigationItem, WorkspaceDefinition, WorkspaceId } from "./types";

const publicItems = [
  {
    id: "public-explore",
    label: platformCopy.exploreChronicles.value,
    href: "/tales",
    match: { type: "exact" },
    desktopOrder: 10,
    mobileOrder: 10,
  },
  {
    id: "public-player",
    label: canonicalTerms.player,
    href: "/player",
    match: { type: "prefix" },
    desktopOrder: 20,
    mobileOrder: 20,
  },
  {
    id: "public-captain",
    label: canonicalTerms.captainConsole,
    href: "/captain/library",
    aliases: ["/captain"],
    match: { type: "prefix" },
    desktopOrder: 30,
    mobileOrder: 30,
  },
  {
    id: "public-creator",
    label: canonicalTerms.studio,
    href: "/studio",
    match: { type: "prefix" },
    desktopOrder: 40,
    mobileOrder: 40,
  },
] as const satisfies readonly NavigationItem[];

const playerItems = [
  {
    id: "player-library",
    label: "My Voyages",
    href: "/player/library",
    match: { type: "prefix" },
    authenticated: true,
    capability: "player",
    desktopOrder: 10,
    mobileOrder: 10,
    immersivePolicy: "compact",
  },
  {
    id: "player-explore",
    label: platformCopy.exploreChronicles.value,
    href: "/tales",
    match: { type: "exact" },
    desktopOrder: 20,
    mobileOrder: 20,
    immersivePolicy: "hidden",
  },
  {
    id: "player-passport",
    label: "Chronicle Passport",
    shortLabel: "Passport",
    href: "/passport",
    match: { type: "prefix" },
    authenticated: true,
    capability: "player",
    desktopOrder: 30,
    mobileOrder: 30,
    immersivePolicy: "compact",
  },
] as const satisfies readonly NavigationItem[];

const captainItems = [
  {
    id: "captain-voyages",
    label: "Voyages",
    href: "/captain/library",
    aliases: ["/captain"],
    match: { type: "prefix" },
    authenticated: true,
    capability: "captain",
    desktopOrder: 10,
    mobileOrder: 10,
    immersivePolicy: "compact",
  },
  {
    id: "captain-invitations",
    label: "Crew invitations",
    shortLabel: "Invitations",
    href: "/captain/invitations",
    match: { type: "prefix" },
    authenticated: true,
    capability: "captain",
    desktopOrder: 20,
    mobileOrder: 20,
    immersivePolicy: "hidden",
  },
  {
    id: "captain-explore",
    label: platformCopy.exploreChronicles.value,
    href: "/tales",
    match: { type: "exact" },
    desktopOrder: 30,
    mobileOrder: 30,
    immersivePolicy: "hidden",
  },
] as const satisfies readonly NavigationItem[];

const creatorItems = [
  {
    id: "creator-library",
    label: canonicalTerms.chronicleLibrary,
    href: "/studio/library",
    aliases: ["/studio"],
    match: { type: "prefix" },
    authenticated: true,
    capability: "creator",
    desktopOrder: 10,
    mobileOrder: 10,
  },
  {
    id: "creator-exchange",
    label: "Exchange",
    href: "/studio/exchange",
    match: { type: "prefix" },
    authenticated: true,
    capability: "creator",
    desktopOrder: 20,
    mobileOrder: 20,
  },
  {
    id: "creator-private-content",
    label: "Private Chronicle",
    shortLabel: "Private",
    href: "/studio/private-content",
    match: { type: "prefix" },
    authenticated: true,
    capability: "creator",
    desktopOrder: 30,
    mobileOrder: 30,
  },
] as const satisfies readonly NavigationItem[];

const accountItems = [
  {
    id: "account-passport",
    label: "Chronicle Passport",
    shortLabel: "Passport",
    href: "/passport",
    match: { type: "prefix" },
    authenticated: true,
    desktopOrder: 10,
    mobileOrder: 10,
  },
  {
    id: "account-security",
    label: "Security",
    href: "/account/security",
    match: { type: "prefix" },
    authenticated: true,
    desktopOrder: 20,
    mobileOrder: 20,
  },
] as const satisfies readonly NavigationItem[];

// Community is deliberately registered but invisible until Harborlight contributes
// routes. This prevents a future route family from silently becoming generic public.
const communityItems = [
  {
    id: "community-harbor",
    label: "Community Harbor",
    href: "/community",
    match: { type: "prefix" },
    desktopOrder: 10,
    mobileOrder: 10,
  },
] as const satisfies readonly NavigationItem[];

export const workspaceRegistry: Readonly<Record<WorkspaceId, WorkspaceDefinition>> = {
  public: { id: "public", label: canonicalTerms.product, homeHref: "/", items: publicItems },
  player: { id: "player", label: canonicalTerms.player, homeHref: "/player/library", items: playerItems },
  captain: { id: "captain", label: canonicalTerms.captainConsole, homeHref: "/captain/library", items: captainItems },
  creator: { id: "creator", label: canonicalTerms.studio, homeHref: "/studio/library", items: creatorItems },
  account: { id: "account", label: "Account", homeHref: "/passport", items: accountItems },
  community: { id: "community", label: "Community Harbor", homeHref: "/community", items: communityItems },
};

export const allNavigationItems = Object.values(workspaceRegistry).flatMap((workspace) => workspace.items);
