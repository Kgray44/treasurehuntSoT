export const fixtureVersion = "homeport-phase6-v1";
export const implementationSourceSha = "e02ee0dae0469a2ba573beaf409c0b34e8668d09";
export const phase6ContractIds = [
  "homeport.surface.catalog-complete",
  "homeport.surface.source-parity",
  "homeport.surface.criticality",
  "homeport.surface.visual-maturity",
  "homeport.surface.critical-desktop-evidence",
  "homeport.surface.critical-mobile-evidence",
  "homeport.surface.zoom-evidence",
  "homeport.surface.human-visual-review",
  "homeport.surface.source-bound-evidence",
  "homeport.surface.raw-implementation-prohibited",
  "homeport.surface.component-family-consistency",
  "homeport.state.applicability",
  "homeport.state.loading-truthful",
  "homeport.state.empty-truthful",
  "homeport.state.no-results-truthful",
  "homeport.state.error-recovery",
  "homeport.state.dependency-unavailable",
  "homeport.state.offline-degraded",
  "homeport.state.permission-explicit",
  "homeport.state.session-expired",
  "homeport.state.account-restricted",
  "homeport.state.mutation-pending",
  "homeport.state.mutation-success",
  "homeport.state.mutation-failure",
  "homeport.state.stale-conflict",
  "homeport.state.archived-removed",
  "homeport.state.tokenized",
  "homeport.responsive.desktop",
  "homeport.responsive.tablet",
  "homeport.responsive.mobile",
  "homeport.responsive.narrow-mobile",
  "homeport.responsive.zoom",
  "homeport.responsive.no-horizontal-overflow",
  "homeport.accessibility.semantic",
  "homeport.accessibility.keyboard",
  "homeport.accessibility.touch",
  "homeport.accessibility.focus",
  "homeport.accessibility.live-region",
  "homeport.accessibility.automated-scan",
  "homeport.motion.authority",
  "homeport.motion.reduced-motion",
  "homeport.motion.route-lifecycle",
  "homeport.motion.no-false-success",
  "homeport.media.fallback",
  "homeport.media.scan-state",
  "homeport.media.no-object-key",
  "homeport.mutation.feedback",
  "homeport.mutation.no-duplicate",
  "homeport.mutation.authoritative-result",
  "homeport.surface.phase1-regression",
  "homeport.surface.phase2-regression",
  "homeport.surface.phase3-regression",
  "homeport.surface.phase4-regression",
  "homeport.surface.phase5-regression",
  "homeport.surface.artifact-idempotency",
];
export const architectureFreezeSha = "07544240bc592b0798625824265fd48c5419f87a";
export const generatedAt = "2026-08-04T07:00:00.000Z";

export const stateVocabulary = [
  "INITIAL_LOADING",
  "STREAMING_LOADING",
  "READY_POPULATED",
  "READY_EMPTY",
  "NO_RESULTS",
  "AUTH_REQUIRED",
  "SESSION_EXPIRED",
  "SESSION_REVOKED_OR_INVALID",
  "ACCOUNT_RESTRICTED",
  "PERMISSION_RESTRICTED",
  "DEPENDENCY_UNAVAILABLE",
  "OFFLINE_OR_DEGRADED",
  "RECOVERABLE_ERROR",
  "PARTIAL_MEDIA_FAILURE",
  "MUTATION_PENDING",
  "MUTATION_SUCCESS",
  "MUTATION_FAILURE",
  "STALE_CONFLICT",
  "RATE_LIMITED",
  "ARCHIVED_OR_REMOVED",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "TOKEN_CONSUMED",
  "TOKEN_REVOKED",
  "NOT_APPLICABLE",
];

export const viewports = [
  ["LARGE_DESKTOP", "1600x1000"],
  ["STANDARD_DESKTOP", "1440x900"],
  ["COMPACT_DESKTOP", "1280x720"],
  ["TABLET_LANDSCAPE", "1024x768"],
  ["TABLET_PORTRAIT", "768x1024"],
  ["MODERN_MOBILE", "390x844"],
  ["NARROW_MOBILE", "320x568"],
  ["EFFECTIVE_200_PERCENT", "720x450"],
];

const criticalPaths = new Set([
  "/",
  "/sign-in",
  "/player/library",
  "/captain/library",
  "/studio/library",
  "/account",
  "/account/profile",
  "/passport",
  "/community",
  "/player/playthroughs/[playthroughId]",
  "/captain/sessions/[sessionId]",
  "/studio/tales/[taleId]",
]);

const highPaths = new Set([
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/account/security",
  "/account/sessions",
  "/passport/history",
  "/passport/history/[recordId]",
  "/passport/artifacts",
  "/passport/artifacts/[artifactId]",
  "/community/chronicles",
  "/community/[slug]",
  "/community/collections/[slug]",
  "/community/moderation",
  "/player/playthroughs/[playthroughId]/journal",
  "/player/invitation",
  "/studio/private-content",
]);

export function criticality(node) {
  if (!node) return "CONTEXTUAL";
  if (node.pathPattern.startsWith("/dev")) return "DEVELOPMENT_ONLY";
  if (node.tokenized || node.compatibility || node.deprecated) return "CONTEXTUAL";
  if (criticalPaths.has(node.pathPattern)) return "CRITICAL";
  if (highPaths.has(node.pathPattern)) return "HIGH";
  return "STANDARD";
}

export function finalMaturity(node) {
  const tier = criticality(node);
  if (tier === "DEVELOPMENT_ONLY") return "DEVELOPMENT_ONLY";
  if (
    node?.pathPattern === "/studio/private-content/operations" ||
    node?.pathPattern === "/community/moderation" ||
    node?.pathPattern === "/community/moderation/[id]"
  )
    return "COMPLETE_WITH_TRUTHFUL_EXTERNAL_LIMITATION";
  return "VISUALLY_COMPLETE";
}

export function screenId(node) {
  return node ? node.routeId.replace(/^route-/u, "screen-") : "screen-state-contract";
}

export function componentFamilies(node) {
  if (!node) return ["state-panels"];
  const families = [
    "product-shell",
    "global-headers",
    "account-control",
    "account-menus",
    "workspace-switchers",
    "breadcrumbs",
    "disclosures",
    "state-panels",
    "status-regions",
  ];
  const route = node.pathPattern;
  const states = new Set(applicableStates(node));
  if (states.has("INITIAL_LOADING")) families.push("loading-skeletons");
  if (states.has("READY_EMPTY")) families.push("empty-states");
  if (states.has("NO_RESULTS")) families.push("no-result-states");
  if (states.has("RECOVERABLE_ERROR")) families.push("error-summaries");
  if (states.has("DEPENDENCY_UNAVAILABLE")) families.push("dependency-unavailable");
  if (states.has("PERMISSION_RESTRICTED")) families.push("permission-panels");
  if (states.has("MUTATION_PENDING")) families.push("mutation-status");
  if (states.has("ARCHIVED_OR_REMOVED")) families.push("archived-removed-panels");
  if (route.startsWith("/account"))
    families.push(
      "section-navigation",
      "profile-heroes",
      "settings-panels",
      "form-groups",
      "field-descriptions",
      "dialogs",
      "confirmations",
    );
  if (route.startsWith("/passport"))
    families.push(
      "section-navigation",
      "passport-cards",
      "record-details",
      "history-cards",
      "artifact-cards",
      "media-fallback",
    );
  if (route.startsWith("/community"))
    families.push(
      "district-navigation",
      "content-shelves",
      "community-cards",
      "creator-cards",
      "collection-cards",
      "filter-bars",
      "filter-drawers",
      "search-controls",
      "pagination-cursors",
      "badges",
      "metadata",
      "media-fallback",
    );
  if (route.startsWith("/player"))
    families.push(
      "voyage-cards",
      "chronicle-journal",
      "badges",
      "metadata",
      "dialogs",
      "confirmations",
      "media-fallback",
    );
  if (route.startsWith("/captain"))
    families.push("voyage-cards", "captain-controls", "tabs", "badges", "metadata", "dialogs", "confirmations");
  if (route.startsWith("/studio"))
    families.push(
      "studio-workbench",
      "form-groups",
      "field-descriptions",
      "tabs",
      "dialogs",
      "confirmations",
      "media-fallback",
    );
  if (/^\/(?:sign-in|register|forgot-password|reset-password|verify-email)$/u.test(route))
    families.push("form-groups", "field-descriptions", "dialogs", "confirmations");
  if (node.tokenized) families.push("tokenized-state-panels");
  if (node.compactOrImmersive !== "NO") families.push("contextual-exits");
  return [...new Set(families)];
}

export function applicableStates(node) {
  if (!node)
    return [
      "INITIAL_LOADING",
      "READY_EMPTY",
      "NO_RESULTS",
      "RECOVERABLE_ERROR",
      "DEPENDENCY_UNAVAILABLE",
      "PERMISSION_RESTRICTED",
    ];
  const route = node.pathPattern;
  const states = ["READY_POPULATED"];
  if (!node.compatibility) states.push("INITIAL_LOADING", "RECOVERABLE_ERROR");
  if (!node.anonymousAvailability) {
    states.push("AUTH_REQUIRED", "SESSION_EXPIRED", "SESSION_REVOKED_OR_INVALID", "ACCOUNT_RESTRICTED");
  }
  if (node.requiredCapabilities.length) states.push("PERMISSION_RESTRICTED");
  if (/community|account|passport|player|captain|studio/u.test(route))
    states.push("DEPENDENCY_UNAVAILABLE", "OFFLINE_OR_DEGRADED");
  if (/library|history|memories|saved|artifacts|community|collections|creators|guides|tales$/u.test(route))
    states.push("READY_EMPTY", "NO_RESULTS");
  if (/account|passport|community|captain|studio|invitation|register|password|verify/u.test(route))
    states.push("MUTATION_PENDING", "MUTATION_SUCCESS", "MUTATION_FAILURE");
  if (/profile|preferences|privacy|accessibility|notifications|studio/u.test(route)) states.push("STALE_CONFLICT");
  if (/community|passport|player|studio|play/u.test(route)) states.push("PARTIAL_MEDIA_FAILURE");
  if (/community|passport|captain|studio/u.test(route)) states.push("ARCHIVED_OR_REMOVED");
  if (node.tokenized) states.push("TOKEN_INVALID", "TOKEN_EXPIRED", "TOKEN_CONSUMED", "TOKEN_REVOKED");
  return [...new Set(states)];
}

export const componentFamilyDefinitions = [
  ["product-shell", "true-north", "src/components/shell/ProductShell.tsx"],
  ["global-headers", "true-north", "src/components/shell/ProductShell.tsx"],
  ["account-control", "wayfarer", "src/components/shell/ProductShell.tsx"],
  ["account-menus", "wayfarer", "src/components/shell/ProductShell.tsx"],
  ["workspace-switchers", "true-north", "src/components/shell/ProductShell.tsx"],
  ["section-navigation", "project-homeport", "src/components/homeport/PersonalHarborLayout.tsx"],
  ["district-navigation", "harborlight", "src/components/community/CommunityDistrictNavigator.tsx"],
  ["breadcrumbs", "project-homeport", "src/components/shell/ProductShell.tsx"],
  ["contextual-exits", "one-voyage", "src/components/shell/ProductShell.tsx"],
  ["profile-heroes", "project-homeport", "src/components/homeport/AccountSurfaces.tsx"],
  ["settings-panels", "project-homeport", "src/components/homeport/AccountSurfaces.tsx"],
  ["form-groups", "project-homeport", "src/components/homeport/AccountSurfaces.tsx"],
  ["field-descriptions", "project-homeport", "src/components/homeport/AccountSurfaces.tsx"],
  ["error-summaries", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["status-regions", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["content-shelves", "harborlight", "src/components/community/CommunityDiscoveryBrowser.tsx"],
  ["community-cards", "harborlight", "src/components/community/CommunityCardGrid.tsx"],
  ["voyage-cards", "one-voyage", "src/components/platform/PlayerLibrary.tsx"],
  ["history-cards", "wayfarer", "src/components/homeport/PassportSurfaces.tsx"],
  ["artifact-cards", "wayfarer", "src/components/homeport/PassportSurfaces.tsx"],
  ["creator-cards", "harborlight", "src/components/community/CommunityCardGrid.tsx"],
  ["collection-cards", "harborlight", "src/components/community/CommunityCardGrid.tsx"],
  ["filter-bars", "harborlight", "src/components/community/CommunityDiscoveryBrowser.tsx"],
  ["filter-drawers", "harborlight", "src/components/community/CommunityDiscoveryBrowser.tsx"],
  ["search-controls", "harborlight", "src/components/community/CommunityDiscoveryBrowser.tsx"],
  ["badges", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["metadata", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["tabs", "one-voyage", "src/components/platform/CaptainLibrary.tsx"],
  ["disclosures", "true-north", "src/components/shell/ProductShell.tsx"],
  ["empty-states", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["no-result-states", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["loading-skeletons", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["dependency-unavailable", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["permission-panels", "wayfarer", "src/components/auth/AccessDecisionState.tsx"],
  ["dialogs", "project-homeport", "src/components/ui/ActionDialog.tsx"],
  ["confirmations", "project-homeport", "src/components/ui/ActionDialog.tsx"],
  ["mutation-status", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["pagination-cursors", "harborlight", "src/components/community/CommunityDiscoveryBrowser.tsx"],
  ["media-fallback", "project-homeport", "src/components/ui/ResilientImage.tsx"],
  ["archived-removed-panels", "project-homeport", "src/components/ui/AsyncState.tsx"],
  ["tokenized-state-panels", "wayfarer", "src/components/auth/AccessDecisionState.tsx"],
  ["passport-cards", "wayfarer", "src/components/homeport/PassportSurfaces.tsx"],
  ["record-details", "wayfarer", "src/components/homeport/PassportSurfaces.tsx"],
  ["captain-controls", "one-voyage", "src/components/captain/CaptainSessionControl.tsx"],
  ["studio-workbench", "one-voyage", "src/components/studio/TaleEditor.tsx"],
  ["chronicle-journal", "lanternwake", "src/components/player/journal/ChronicleJournalSession.tsx"],
  ["state-panels", "project-homeport", "src/components/ui/AsyncState.tsx"],
];

export const mediaFamilies = [
  ["profile-avatar", "project-homeport"],
  ["profile-banner", "project-homeport"],
  ["chronicle-cover", "one-voyage"],
  ["community-card-artwork", "harborlight"],
  ["creator-avatar-banner", "harborlight"],
  ["artifact-artwork", "wayfarer"],
  ["map-preview", "one-voyage"],
  ["audio-reveal-artwork", "lanternwake"],
  ["three-dimensional-preview", "one-voyage"],
  ["private-media", "sealed-hold"],
  ["journal-media", "lanternwake"],
  ["pageflip-assets", "lanternwake"],
];

export const mutationDefinitions = [
  ["sign-in", "screen-page-sign-in"],
  ["registration", "screen-page-register"],
  ["password-reset", "screen-page-reset-password"],
  ["verification-resend", "screen-page-verify-email"],
  ["profile-save", "screen-page-account-profile"],
  ["preferences-save", "screen-page-account-preferences"],
  ["accessibility-save", "screen-page-account-accessibility"],
  ["notifications-save", "screen-page-account-notifications"],
  ["privacy-save", "screen-page-account-privacy"],
  ["linked-identity", "screen-page-account-linked-identities"],
  ["session-revoke", "screen-page-account-sessions"],
  ["sign-out-everywhere", "screen-page-account-sessions"],
  ["community-save", "screen-page-community"],
  ["community-follow", "screen-page-community-creators-handle"],
  ["invitation-accept-decline", "screen-page-player-invitation"],
  ["player-library-preference", "screen-page-player-library"],
  ["captain-invitation-control", "screen-page-captain-library"],
  ["captain-voyage-control", "screen-page-captain-sessions-sessionid"],
  ["studio-save-publish", "screen-page-studio-tales-taleid"],
  ["archive-favorite", "screen-page-passport-artifacts"],
];
