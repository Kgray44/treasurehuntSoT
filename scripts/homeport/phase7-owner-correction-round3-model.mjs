export const round3Baseline = "8e3900a734674cb58800878aaeaf91a0e9f2285e";
export const round3Fixture = "homeport-phase7-owner-correction-round3-v1";

export const round3Findings = [
  "Avatar selection needs an immediate preview.",
  "Banner selection needs an immediate preview.",
  "Avatar selection needs a crop-and-position editor.",
  "Banner selection needs a crop-and-position editor.",
  "The person must be able to drag the selected image.",
  "The person must be able to zoom the selected image.",
  "Reset, replace, cancel, and remove actions are required.",
  "A small preview must remain visible near each Profile Imagery field.",
  "The saved avatar must appear throughout account identity surfaces.",
  "The saved banner must appear prominently in Personal Harbor.",
  "The upper-right account circle must use the avatar when one exists.",
  "Initial fallback remains only when no avatar exists.",
  "The profile-completion percentage currently occupies too much attention.",
  "A handle reminder is useful.",
  "A large score/progress bar is not useful.",
  "Profile Overview should primarily present the person's identity.",
  "The banner and avatar should become the primary visual composition.",
  "Registration itself worked well.",
  "After registration submission, a verification-code screen should appear.",
  "A verification code must be sent to the entered email address.",
  "The person must enter the code before becoming a fully verified ordinary account.",
  "The email system must work with real inbox delivery.",
  "Postmark is the selected staging/production transactional-email provider.",
  "The synthetic outbox remains for automated/local test isolation.",
  "Verification, password recovery, email change, and security notices must use the same governed provider architecture.",
  "The application should default to Dark Mode.",
  "New anonymous sessions should start in Dark Mode.",
  "New accounts should start in Dark Mode.",
  "The owner-review fixture should start in Dark Mode.",
  "Light Mode needs additional work, but that work is deferred from this correction round.",
  "Round 3 must not become another broad Light Mode redesign.",
  "The All Workspaces page is visually improved.",
  "Captain remains marked UNAVAILABLE.",
  "Creator remains marked UNAVAILABLE.",
  "This occurs on a newly created account.",
  "This occurs before the account has entered any Chronicle.",
  "The active-Chronicle lock is therefore not the cause.",
  "New-account workspace provisioning is incorrect.",
  "Claimed active accounts must be able to enter all three workspaces.",
  "Workspace availability must not be confused with ownership of another person's Chronicle, Voyage, draft, or private content.",
  "Captain should show a useful empty workspace when no Captain Voyages exist.",
  "Creator should show a useful empty workspace and creation action.",
  "Existing claimed accounts require safe reconciliation.",
  "Current page transitions fade completely to the background.",
  "They then fade from the background into the destination.",
  "The result feels like a soft blink.",
  "Pages should crossfade directly into one another.",
  "No empty background-only frame should be visible.",
  "The shell should remain stable.",
  "Loading remains governed separately by the 500 ms threshold.",
  "The upper-right Profile dropdown still has no perceptible animation.",
  "Prior automated proof did not match owner perception.",
  "The real production dropdown requires stronger, visible motion.",
  "Opening and closing must both be proven through frame evidence.",
];

export const round3Decisions = [
  [
    "Round 3 owner authority",
    "The 54 HP-OWCR3 findings are the correction authority; prior history is preserved and owner acceptance remains external.",
  ],
  [
    "Profile-media ownership",
    "One account-owned Player Profile controls PROFILE_AVATAR and PROFILE_BANNER media; no second profile or asset system is authorized.",
  ],
  [
    "Image-selection lifecycle",
    "Selection validates locally, creates a temporary preview, opens the editor, and uploads only after explicit confirmation while the existing media remains active until replacement succeeds.",
  ],
  [
    "Client-side preview lifecycle",
    "Object URLs are local and temporary, never persisted, and revoked on replacement, cancellation, unmount, success, or terminal failure.",
  ],
  [
    "Crop and focal-point model",
    "Normalized center X/Y, scale, source orientation, optional rotation, and output aspect reproduce a crop independently of viewport pixels.",
  ],
  [
    "Avatar aspect and mask",
    "Avatar output is a high-resolution square derivative shown through a circular CSS mask with pan, zoom, keyboard alternatives, and dimmed exclusion.",
  ],
  [
    "Banner aspect and safe areas",
    "Banner output uses the governed wide aspect with explicit desktop/mobile safe-area preview, pan, zoom, keyboard alternatives, and focal-point persistence.",
  ],
  [
    "Media validation",
    "Server validation trusts decoded bytes rather than extension, bounds bytes/pixels/dimensions, accepts PNG/JPEG/WebP, rejects malformed or unintended animation, and strips metadata from derivatives.",
  ],
  [
    "Private original storage",
    "The confirmed original is stored privately under task/configured media authority, is never the ordinary public response, and is retained or removed through explicit lifecycle policy.",
  ],
  [
    "Public/safe derivative storage",
    "Server-generated checksum-addressed normalized derivatives are the only ordinary avatar/banner delivery assets and remain governed by Profile visibility.",
  ],
  [
    "Scan and processing states",
    "UPLOADED, VALIDATING, SCAN_PENDING, PROCESSING, READY, QUARANTINED, FAILED, REPLACED, and REMOVED are explicit; only READY derivatives may become active.",
  ],
  [
    "Identity-media propagation",
    "The canonical current-user and public Profile projections carry authorized derivative URLs to Personal Harbor, account trigger/menu, and Community identity surfaces; initials remain a no-avatar fallback.",
  ],
  [
    "Profile Overview composition",
    "Banner, avatar, display name, handle state, and biography lead the identity hero; completion utilities are subordinate.",
  ],
  [
    "Profile-completion prompt policy",
    "A missing-handle reminder is modest and actionable; no dominant percentage or large progress bar is rendered.",
  ],
  [
    "Registration state machine",
    "SUBMITTING creates a pending account and delivery challenge, then routes to CODE_REQUIRED; ACTIVE is impossible until server verification succeeds.",
  ],
  [
    "Verification-code state machine",
    "CODE_REQUIRED, VERIFYING, INVALID, EXPIRED, RATE_LIMITED, RESEND_AVAILABLE, VERIFIED, and UNAVAILABLE are distinct server-backed states with safe retry and resend.",
  ],
  [
    "Code security policy",
    "Codes are six random digits, stored only as hashes, expire, have bounded attempts and resend rotation, are single-use, are never logged or committed, and verification is account/email/challenge scoped.",
  ],
  [
    "Postmark provider contract",
    "A provider-neutral transactional-email port selects Postmark only when complete validated configuration exists; unconfigured production fails closed and cannot silently discard delivery.",
  ],
  [
    "Postmark templates",
    "Verified aliases and typed models cover verification code, password reset, email change, change notice, and security notice through a transactional Message Stream.",
  ],
  [
    "Postmark delivery receipt handling",
    "Provider MessageID, submission time, purpose, account, recipient hash, status, and failure classification are persisted without codes, tokens, secrets, or message bodies.",
  ],
  [
    "Postmark webhook policy",
    "Delivery and bounce events use a dedicated authenticated endpoint, validate structure, correlate MessageID, process idempotently, suppress unsafe disclosure, and acknowledge governed retries.",
  ],
  [
    "Synthetic-provider behavior",
    "The task-owned synthetic provider implements the same delivery port, emits deterministic secret-safe receipts to an isolated outbox, and never proves external delivery.",
  ],
  [
    "Live-provider evidence boundary",
    "Only a configured Postmark send plus real inbox receipt and correlated provider evidence may establish live delivery; absence is classified POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION.",
  ],
  [
    "Dark default policy",
    "Dark is the deterministic server-safe default for anonymous sessions, new accounts, missing preferences, and the owner fixture while explicit stored choices remain respected.",
  ],
  [
    "Light Mode deferral",
    "Existing Light support is preserved without a broad redesign; Round 3 fixes no unrelated Light polish and records its remaining work as deferred.",
  ],
  [
    "Workspace entry capability",
    "Every active claimed verified ordinary account may enter Player, Captain, and Creator workspaces through one AccountSession.",
  ],
  [
    "Resource-specific authority",
    "Workspace entry grants no ownership, edit, publication, moderation, administration, or access to another person's Voyage, Chronicle, draft, or private content.",
  ],
  [
    "New-account provisioning",
    "Verification activation creates or reconciles ordinary entry capability atomically and idempotently; no privileged or resource-scoped grant is synthesized.",
  ],
  [
    "Existing-account reconciliation",
    "Dry-run/commit reconciliation repairs active claimed verified accounts, records an audit event, is repeat-safe, and skips restricted, unclaimed, or unverified accounts.",
  ],
  [
    "Active-Chronicle lock",
    "The lock is computed only from authoritative active non-preview Player membership; it blocks Captain/Creator transition only when true and never masquerades as missing capability.",
  ],
  [
    "Route crossfade lifecycle",
    "The stable ProductShell owns one transition runtime that overlaps outgoing and incoming page layers; the destination becomes visible before the source reaches zero opacity and no background-only frame is allowed.",
  ],
  [
    "Loading integration",
    "Route crossfade begins immediately while loading UI remains a separate request truth exposed only after 500 ms; loading never creates an intermediate blank frame.",
  ],
  [
    "Focus and scroll integration",
    "Destination scroll restoration and heading focus occur after committed navigation without focusing an exiting layer, losing keyboard context, or destabilizing the shell.",
  ],
  [
    "Account-menu animation",
    "The production disclosure uses stronger visible opacity, translation, scale, and material/depth change with symmetric opening and closing, stable geometry, and focus safety.",
  ],
  [
    "Reduced-motion behavior",
    "Reduced motion removes spatial travel and long fades while preserving immediate comprehensible state, focus, input, and cleanup.",
  ],
  [
    "Fixture updates",
    "The one Round 3 fixture builder supplies Dark preference, verified account/code states, all ordinary workspace entry, empty Captain/Creator data, authoritative lock variants, media roots, and synthetic email isolation.",
  ],
  [
    "Schema/migration decision",
    "Additive schema changes are authorized only for reproducible crop/original/derivative lifecycle, verification challenge security, and provider receipts; SQLite and MySQL receive equivalent fresh and populated upgrades.",
  ],
  [
    "Testing and evidence",
    "Focused units, API/service/component tests, journeys A-V, retained regressions, accessibility/responsive/privacy checks, and evidence A-AD bind to the exact implementation source; motion requires frame sequences.",
  ],
  [
    "Sounding Line impact",
    "Subsystem and mainline Sounding Line evaluate exact-source receipts after validation; RELEASE_GO may authorize publication but never owner acceptance or deployment.",
  ],
  [
    "Owner re-review runtime",
    "One healthy task-owned production runtime uses the final owner clone, Round 3 fixture, Dark default, isolated media/outbox, and truthful Postmark classification; prior evidence remains preserved.",
  ],
  [
    "Final status language",
    "The highest automated success is PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 3 READY FOR OWNER RE-REVIEW; Round 3 remains PENDING_OWNER_DECISION.",
  ],
  [
    "Rollback",
    "Stop only the task-owned Round 3 runtime, restore configuration pointers, preserve databases/media/evidence, and roll back additive code/schema without touching canonical or prior-round state.",
  ],
];

export const evidenceIds = [
  "A-AVATAR-SELECTED",
  "B-AVATAR-CROP",
  "C-AVATAR-INLINE-PREVIEW",
  "D-BANNER-CROP",
  "E-BANNER-INLINE-PREVIEW",
  "F-PROFILE-OVERVIEW-IDENTITY",
  "G-ACCOUNT-TRIGGER-AVATAR",
  "H-ACCOUNT-MENU-AVATAR",
  "I-PROFILE-HANDLE-PROMPT",
  "J-REGISTRATION",
  "K-VERIFICATION-CODE",
  "L-VERIFICATION-INVALID",
  "M-VERIFICATION-SUCCESS",
  "N-KGTESTING-WORKSPACES",
  "O-CAPTAIN-EMPTY",
  "P-CREATOR-EMPTY",
  "Q-ACTIVE-CHRONICLE-LOCK",
  "R-PERSONAL-HARBOR-CROSSFADE",
  "S-CROSS-PRODUCT-CROSSFADE",
  "T-DELAYED-LOADING-CROSSFADE",
  "U-ACCOUNT-MENU-OPENING",
  "V-ACCOUNT-MENU-OPEN",
  "W-ACCOUNT-MENU-CLOSING",
  "X-DARK-FIRST-PAINT",
  "Y-MOBILE-AVATAR-CROP",
  "Z-MOBILE-VERIFICATION",
  "AA-MOBILE-WORKSPACES",
  "AB-ZOOM-CROP-EDITOR",
  "AC-REDUCED-MOTION",
  "AD-FULL-ROUND3-REGRESSION",
].map((suffix) => `HP-OWCR3-EV-${suffix}`);

export function findingArea(index) {
  if (index <= 12)
    return [
      "Profile imagery",
      "high",
      "wayfarer-profile-media",
      "Project_Homeport_Profile_Imagery_and_Crop_Contract.md",
      "profile-media;crop-editor;identity-projection",
      "HP-OWCR3-EV-A;HP-OWCR3-EV-B;HP-OWCR3-EV-C;HP-OWCR3-EV-D;HP-OWCR3-EV-E;HP-OWCR3-EV-G;HP-OWCR3-EV-H",
    ];
  if (index <= 17)
    return [
      "Profile Overview",
      "high",
      "personal-harbor",
      "Project_Homeport_Profile_Identity_Presentation_Contract.md",
      "profile-overview;profile-identity",
      "HP-OWCR3-EV-F;HP-OWCR3-EV-I",
    ];
  if (index <= 25)
    return [
      "Transactional email",
      index >= 20 && index <= 23 ? "critical" : "high",
      "wayfarer-account-security",
      index >= 22
        ? "Project_Homeport_Postmark_Transactional_Email_Contract.md"
        : "Project_Homeport_Registration_Email_Code_Verification_Contract.md",
      "email-code;transactional-email;postmark-adapter",
      "HP-OWCR3-EV-J;HP-OWCR3-EV-K;HP-OWCR3-EV-L;HP-OWCR3-EV-M",
    ];
  if (index <= 31)
    return [
      "Theme",
      "high",
      "product-shell-theme",
      "Project_Homeport_Dark_Default_and_Light_Deferral_Contract.md",
      "theme-bootstrap;theme-default",
      "HP-OWCR3-EV-X",
    ];
  if (index <= 43)
    return [
      "Workspace access",
      "critical",
      "homeport-workspace-authority",
      "Project_Homeport_Workspace_Entry_and_Resource_Authority_Contract.md",
      "workspace-entry;resource-authority;reconciliation;active-lock",
      "HP-OWCR3-EV-N;HP-OWCR3-EV-O;HP-OWCR3-EV-P;HP-OWCR3-EV-Q",
    ];
  if (index <= 50)
    return [
      "Route transition",
      "high",
      "platform-motion",
      "Project_Homeport_Route_Crossfade_Transition_Contract.md",
      "route-crossfade;loading-threshold;focus-scroll",
      "HP-OWCR3-EV-R;HP-OWCR3-EV-S;HP-OWCR3-EV-T",
    ];
  return [
    "Account dropdown",
    "high",
    "product-shell",
    "Project_Homeport_Account_Menu_Motion_Contract.md",
    "account-menu-motion;frame-evidence",
    "HP-OWCR3-EV-U;HP-OWCR3-EV-V;HP-OWCR3-EV-W",
  ];
}
